import { createDAVClient } from 'tsdav'
import type { CalDAVCredentials } from '@/features/caldav/types'
import type { AddressBook, Contact } from '../types'
import { parseVCard, contactToVCard } from '../adapter/vCardAdapter'
import { buildProxyUrl } from '@/features/caldav/client/CalDAVClient'

const NETWORK_TIMEOUT_MS = 15_000

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

export class CardDAVClient {
  private client: Awaited<ReturnType<typeof createDAVClient>> | null = null
  private serverUrl: string
  private proxyUrl: string | null
  private credentials: CalDAVCredentials
  private authHeader: string
  private proxyFetch: (url: string | URL, init?: RequestInit) => Promise<Response>

  constructor(serverUrl: string, credentials: CalDAVCredentials, proxyUrl: string | null = null) {
    this.serverUrl = serverUrl
    this.proxyUrl = proxyUrl
    this.credentials = credentials
    this.authHeader = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
    this.proxyFetch = proxyUrl ? createProxyFetch(proxyUrl) : fetchWithTimeout
  }

  async connect(): Promise<void> {
    this.client = await createDAVClient({
      serverUrl: this.serverUrl,
      credentials: {
        username: this.credentials.username,
        password: this.credentials.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'carddav',
      fetch: this.proxyUrl ? createProxyFetch(this.proxyUrl) : undefined,
    })
  }

  private getClient() {
    if (!this.client) {
      throw new Error('Client not connected. Call connect() first.')
    }
    return this.client
  }

  /**
   * Fetch all address books from the server.
   */
  async fetchAddressBooks(): Promise<AddressBook[]> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const client = this.getClient()
    const davAddressBooks = await client.fetchAddressBooks()
    
    return davAddressBooks.map((ab, index) => ({
      id: ab.url || `ab-${index}-${crypto.randomUUID()}`,
      accountId: '', // Will be set by caller
      url: ab.url || '',
      name: typeof ab.displayName === 'string' ? ab.displayName : 'Unnamed Address Book',
      description: undefined,
      ctag: ab.ctag || null,
      syncToken: ab.syncToken || null,
      isVisible: true,
    }))
  }

  /**
   * Fetch all contacts from an address book.
   */
  async fetchContacts(addressBook: AddressBook): Promise<Contact[]> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const client = this.getClient()
    
    // Find the raw DAV address book object
    const davAddressBooks = await client.fetchAddressBooks()
    const davAb = davAddressBooks.find(ab => ab.url === addressBook.url)
    
    if (!davAb) {
      throw new Error(`Address book not found: ${addressBook.url}`)
    }
    
    const vcards = await client.fetchVCards({
      addressBook: davAb,
    })
    
    const contacts: Contact[] = []
    
    for (const vcard of vcards) {
      if (vcard.data) {
        const contact = parseVCard(vcard.data as string, addressBook.id, addressBook.accountId)
        if (contact) {
          contact.etag = vcard.etag || undefined
          contacts.push(contact)
        }
      }
    }
    
    return contacts
  }

  /**
   * Fetch a single contact by URL.
   */
  async fetchContact(contactUrl: string): Promise<Contact | null> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      Authorization: this.authHeader,
      Depth: '0',
    }
    
    const propfindXml = `<?xml version="1.0" encoding="UTF-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag/>
    <C:address-data/>
  </d:prop>
</d:propfind>`
    
    const response = await this.proxyFetch(contactUrl, {
      method: 'PROPFIND',
      headers,
      body: propfindXml,
    })
    
    if (!response.ok && response.status !== 207) {
      return null
    }
    
    const text = await response.text()
    
    // Extract response blocks
    const responseBlocks = text.match(/<d:response>[\s\S]*?<\/d:response>/g) || []
    
    for (const block of responseBlocks) {
      const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/)
      const etagMatch = block.match(/<d:getetag>([^<]+)<\/d:getetag>/)
      const dataMatch = block.match(/<[^:]*:address-data[^>]*>([\s\S]*?)<\/[^:]*:address-data>/)
      
      if (hrefMatch?.[1] && dataMatch?.[1]) {
        const vcardData = dataMatch[1].trim()
        const contact = parseVCard(vcardData, '', '')
        if (contact) {
          contact.url = hrefMatch[1]
          contact.etag = etagMatch?.[1] || undefined
          return contact
        }
      }
    }
    
    return null
  }

  /**
   * Create a new contact in an address book.
   */
  async createContact(
    addressBook: AddressBook,
    contact: Contact,
    filename: string
  ): Promise<{ url: string; etag: string }> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const client = this.getClient()
    
    // Find the raw DAV address book object
    const davAddressBooks = await client.fetchAddressBooks()
    const davAb = davAddressBooks.find(ab => ab.url === addressBook.url)
    
    if (!davAb) {
      throw new Error(`Address book not found: ${addressBook.url}`)
    }
    
    const vCardString = contactToVCard(contact)
    
    const result = await client.createCalendarObject({
      calendar: davAb,
      filename,
      iCalString: vCardString,
    })
    
    const etag = result.headers?.get('etag') || ''
    
    return {
      url: result.url,
      etag,
    }
  }

  /**
   * Update an existing contact.
   */
  async updateContact(
    contactUrl: string,
    contact: Contact,
    etag: string
  ): Promise<{ url: string; etag: string }> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const client = this.getClient()
    const vCardString = contactToVCard(contact)
    
    const result = await client.updateCalendarObject({
      calendarObject: { url: contactUrl, etag, data: vCardString },
    })
    
    const newEtag = result.headers?.get('etag') || etag
    
    return {
      url: result.url,
      etag: newEtag,
    }
  }

  /**
   * Delete a contact.
   */
  async deleteContact(contactUrl: string, etag: string): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('No network connection. Please check your internet connection.')
    }
    
    const client = this.getClient()
    
    await client.deleteCalendarObject({
      calendarObject: { url: contactUrl, etag },
    })
  }

  /**
   * Check if the server supports CardDAV by trying to fetch address books.
   */
  async checkCardDAVSupport(): Promise<boolean> {
    try {
      await this.fetchAddressBooks()
      return true
    } catch {
      return false
    }
  }

  getServerUrl(): string {
    return this.serverUrl
  }

  getProxyUrl(): string | null {
    return this.proxyUrl
  }
}

export async function createCardDAVClient(
  serverUrl: string,
  credentials: CalDAVCredentials,
  proxyUrl: string | null = null
): Promise<CardDAVClient> {
  const client = new CardDAVClient(serverUrl, credentials, proxyUrl)
  await client.connect()
  return client
}
