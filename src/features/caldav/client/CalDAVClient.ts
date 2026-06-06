import { createDAVClient } from 'tsdav'
import type { CalDAVCredentials, CalDAVCalendar, CreateCalendarOptions, UpdateCalendarOptions } from '../types'
import { v4 as uuidv4 } from 'uuid'

const NETWORK_TIMEOUT_MS = 15_000

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildProxyUrl(proxyBase: string, targetUrl: string): string {
  const encodedTarget = encodeURIComponent(targetUrl)
  const proxyBaseClean = proxyBase.replace(/\/$/, '')
  return `${proxyBaseClean}/${encodedTarget}`
}

function prefixUrlWithProxy(url: string, proxyBase: string): string {
  if (!proxyBase) {
    return url
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return buildProxyUrl(proxyBase, url)
  }

  if (url.startsWith('/')) {
    return buildProxyUrl(proxyBase, url)
  }

  return buildProxyUrl(proxyBase, url)
}

function createProxyFetch(proxyUrl: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string
    if (typeof input === 'string') {
      url = input
    } else if (input instanceof Request) {
      url = input.url
    } else {
      url = input.toString()
    }
    const proxiedUrl = prefixUrlWithProxy(url, proxyUrl)
    return fetchWithTimeout(proxiedUrl, init)
  }
}

async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export class CalDAVClient {
  private client: Awaited<ReturnType<typeof createDAVClient>> | null = null
  // Cache of raw DAV calendar objects from tsdav, keyed by URL matching.
  // Populated on the first fetchCalendars() call and reused by findCalendarByUrl().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cachedCalendars: any[] = []
  private serverUrl: string
  private proxyUrl: string | null
  private credentials: CalDAVCredentials

  constructor(serverUrl: string, credentials: CalDAVCredentials, proxyUrl: string | null = null) {
    this.serverUrl = serverUrl
    this.proxyUrl = proxyUrl
    this.credentials = credentials
  }

  async connect(): Promise<void> {
    this.client = await createDAVClient({
      serverUrl: this.serverUrl,
      credentials: {
        username: this.credentials.username,
        password: this.credentials.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
      fetch: this.proxyUrl ? createProxyFetch(this.proxyUrl) : undefined,
    })
  }

  private getClient() {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.')
    }
    return this.client
  }

  async fetchCalendars(): Promise<CalDAVCalendar[]> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    const client = this.getClient()
    const davCalendars = await client.fetchCalendars()

    this.cachedCalendars = davCalendars

    return davCalendars.map((cal, index) => ({
      id: cal.url || `cal-${index}-${uuidv4()}`,
      accountId: this.credentials.id,
      // Store the raw server URL — proxy prefix is applied only at HTTP request time
      url: cal.url || '',
      name: typeof cal.displayName === 'string' ? cal.displayName : 'Unnamed Calendar',
      color: '#4285F4',
      ctag: null,
      syncToken: null,
      isVisible: true,
      isDefault: index === 0,
    }))
  }

  /**
   * Find a raw DAV calendar object by URL, using the cache when available.
   * Falls back to a network fetch if the cache is empty (e.g. after connect()
   * but before the first explicit fetchCalendars() call).
   */
  private async findCalendarByUrl(calendarUrl: string) {
    // Lazily populate cache on first use after connect()
    if (this.cachedCalendars.length === 0) {
      const client = this.getClient()
      this.cachedCalendars = await client.fetchCalendars()
    }

    const calendar = this.cachedCalendars.find((c) => {
      if (c.url === calendarUrl) return true
      // Legacy: stored URL may be proxy-prefixed (e.g. proxy/cal-encoded), decode it
      try {
        const decoded = decodeURIComponent(calendarUrl)
        if (decoded === c.url) return true
      } catch { /* ignore decode errors */ }
      return false
    })

    if (!calendar) {
      throw new Error(`Calendar not found: ${calendarUrl}`)
    }

    return calendar
  }

  async fetchEvents(
    calendarUrl: string,
    start: string,
    end: string
  ): Promise<{ url: string; data: string; etag?: string }[]> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    const client = this.getClient()
    const calendar = await this.findCalendarByUrl(calendarUrl)

    // Fetch VEVENTs with time range
    const eventObjects = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start,
        end,
      },
    })

    // Fetch VTODOs with custom filter (tsdav defaults to VEVENT only)
    const todoObjects = await client.fetchCalendarObjects({
      calendar,
      filters: {
        'comp-filter': {
          _attributes: {
            name: 'VCALENDAR',
          },
          'comp-filter': {
            _attributes: {
              name: 'VTODO',
            },
          },
        },
      },
    })

    const allItems = [...eventObjects, ...todoObjects]

    // Remove duplicates by URL — store raw server URLs consistently
    const uniqueByUrl = new Map<string, { url: string; data: string; etag?: string }>()
    for (const obj of allItems) {
      if (!uniqueByUrl.has(obj.url)) {
        uniqueByUrl.set(obj.url, {
          url: obj.url,
          data: obj.data as string,
          etag: obj.etag,
        })
      }
    }

    return Array.from(uniqueByUrl.values())
  }

  async createEvent(
    calendarUrl: string,
    iCalString: string,
    filename: string
  ): Promise<{ url: string; etag: string }> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    const client = this.getClient()
    const calendar = await this.findCalendarByUrl(calendarUrl)

    const result = await client.createCalendarObject({
      calendar,
      filename,
      iCalString,
    })

    return {
      url: result.url,
      etag: '',
    }
  }

  async updateEvent(
    calendarUrl: string,
    eventUrl: string,
    iCalString: string,
    etag: string
  ): Promise<{ url: string; etag: string }> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    const client = this.getClient()
    await this.findCalendarByUrl(calendarUrl)

    const result = await client.updateCalendarObject({
      calendarObject: { url: eventUrl, etag, data: iCalString },
    })

    return {
      url: result.url,
      etag: '',
    }
  }

  async deleteEvent(eventUrl: string, etag: string): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    const client = this.getClient()

    await client.deleteCalendarObject({
      calendarObject: { url: eventUrl, etag },
    })
  }

  async createCalendar(options: CreateCalendarOptions): Promise<CalDAVCalendar> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }

    // Build the MKCALENDAR XML body
    const components = options.components || ['VEVENT', 'VTODO']
    const componentXml = components
      .map((comp) => `<C:comp name="${comp}"/>`)
      .join('\n          ')

    let colorXml = ''
    if (options.color) {
      // Try standard calendar-color first, fall back to Apple extension
      colorXml = `
        <C:calendar-color>${options.color}</C:calendar-color>`
    }

    let descriptionXml = ''
    if (options.description) {
      descriptionXml = `
        <C:calendar-description>${escapeXml(options.description)}</C:calendar-description>`
    }

    const xmlBody = `<?xml version="1.0" encoding="UTF-8" ?>
<C:mkcalendar xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <set>
    <prop>
      <displayname>${escapeXml(options.name)}</displayname>${descriptionXml}${colorXml}
      <C:resourcetype>
        <C:calendar/>
      </C:resourcetype>
      <C:supported-calendar-component-set>
          ${componentXml}
      </C:supported-calendar-component-set>
    </prop>
  </set>
</C:mkcalendar>`

    // Find the calendar home set by querying the principal
    const calendarHomeUrl = await this.findCalendarHome()

    // Create a new calendar collection under the calendar home
    const calendarUri = options.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const calendarUrl = `${calendarHomeUrl}${calendarUri}/`

    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`,
    }

    const response = await fetchWithTimeout(calendarUrl, {
      method: 'MKCALENDAR',
      headers,
      body: xmlBody,
    })

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      const errorText = await response.text()
      throw new Error(`Failed to create calendar: ${response.status} ${errorText}`)
    }

    // Return the created calendar
    return {
      id: calendarUrl,
      accountId: this.credentials.id,
      url: calendarUrl,
      name: options.name,
      color: options.color || '#4285F4',
      ctag: null,
      syncToken: null,
      isVisible: true,
      isDefault: false,
    }
  }

  private async findCalendarHome(): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`,
      Depth: '0',
    }

    // First, try to find the principal URL
    const principalXml = `<?xml version="1.0" encoding="UTF-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:principal-URL/>
  </d:prop>
</d:propfind>`

    const principalResponse = await fetchWithTimeout(this.serverUrl, {
      method: 'PROPFIND',
      headers,
      body: principalXml,
    })

    if (!principalResponse.ok) {
      throw new Error('Failed to find principal URL')
    }

    const principalText = await principalResponse.text()
    const principalMatch = principalText.match(/<d:principal-URL>\s*<d:href>([^<]+)<\/d:href>/)
    const principalUrl = principalMatch?.[1]

    if (!principalUrl) {
      throw new Error('Could not determine principal URL')
    }

    // Now find the calendar home set from the principal
    const homeXml = `<?xml version="1.0" encoding="UTF-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <C:calendar-home-set/>
  </d:prop>
</d:propfind>`

    const principalUrlFull = principalUrl.startsWith('http') 
      ? principalUrl 
      : `${this.serverUrl.replace(/\/$/, '')}${principalUrl}`

    const homeResponse = await fetchWithTimeout(principalUrlFull, {
      method: 'PROPFIND',
      headers,
      body: homeXml,
    })

    if (!homeResponse.ok) {
      throw new Error('Failed to find calendar home')
    }

    const homeText = await homeResponse.text()
    const homeMatch = homeText.match(/<C:calendar-home-set>\s*<d:href>([^<]+)<\/d:href>/)
    const homeUrl = homeMatch?.[1]

    if (!homeUrl) {
      throw new Error('Could not determine calendar home URL')
    }

    return homeUrl.startsWith('http') ? homeUrl : `${this.serverUrl.replace(/\/$/, '')}${homeUrl}`
  }

  async updateCalendar(calendarUrl: string, options: UpdateCalendarOptions): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }

    // Build PROPPATCH XML
    let propXml = '<prop>'
    if (options.name !== undefined) {
      propXml += `\n      <displayname>${escapeXml(options.name)}</displayname>`
    }
    if (options.description !== undefined) {
      propXml += `\n      <C:calendar-description xmlns:C="urn:ietf:params:xml:ns:caldav">${escapeXml(options.description)}</C:calendar-description>`
    }
    if (options.color !== undefined) {
      propXml += `\n      <C:calendar-color xmlns:C="urn:ietf:params:xml:ns:caldav">${options.color}</C:calendar-color>`
    }
    propXml += '\n    </prop>'

    const xmlBody = `<?xml version="1.0" encoding="UTF-8" ?>
<propertyupdate xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <set>
    ${propXml}
  </set>
</propertyupdate>`

    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`,
    }

    const response = await fetchWithTimeout(calendarUrl, {
      method: 'PROPPATCH',
      headers,
      body: xmlBody,
    })

    if (!response.ok && response.status !== 207) {
      const errorText = await response.text()
      throw new Error(`Failed to update calendar: ${response.status} ${errorText}`)
    }
  }

  async deleteCalendar(calendarUrl: string): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }

    const headers: Record<string, string> = {
      Authorization: `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`,
    }

    const response = await fetchWithTimeout(calendarUrl, {
      method: 'DELETE',
      headers,
    })

    if (!response.ok && response.status !== 204 && response.status !== 200) {
      const errorText = await response.text()
      throw new Error(`Failed to delete calendar: ${response.status} ${errorText}`)
    }
  }

  getServerUrl(): string {
    return this.serverUrl
  }

  getProxyUrl(): string | null {
    return this.proxyUrl
  }
}

export async function createCalDAVClient(
  serverUrl: string,
  credentials: CalDAVCredentials,
  proxyUrl: string | null = null
): Promise<CalDAVClient> {
  const client = new CalDAVClient(serverUrl, credentials, proxyUrl)
  await client.connect()
  return client
}
