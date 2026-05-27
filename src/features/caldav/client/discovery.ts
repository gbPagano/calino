import { createDAVClient } from 'tsdav'

const COMMON_PATHS = [
  '/dav.php',
  '/caldav.php',
  '/caldav',
  '/dav/calendars',
  '/dav/caldav',
  '/calendar/dav',
  '/principals/users',
]

export async function discoverServerUrl(baseUrl: string, proxyUrl?: string): Promise<string> {
  const normalizedUrl = normalizeUrl(baseUrl)
  const DISCOVERY_TIMEOUT_MS = 5_000
  const errors: Array<{ path: string; error: unknown }> = []

  for (const path of COMMON_PATHS) {
    const tryUrl = new URL(path, normalizedUrl).href
    try {
      let fetchUrl = tryUrl
      if (proxyUrl) {
        const encodedTarget = encodeURIComponent(tryUrl)
        const proxyBase = proxyUrl.replace(/\/$/, '')
        fetchUrl = `${proxyBase}/${encodedTarget}`
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(fetchUrl, {
          method: 'OPTIONS',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (response.ok || response.status === 401) {
        return tryUrl.replace(/\/$/, '')
      }
    } catch (error) {
      // Bug 30 fix: collect errors instead of silently swallowing them
      errors.push({ path, error })
      continue
    }
  }

  // Bug 30 fix: log all discovery errors after the loop completes
  if (errors.length > 0) {
    console.warn(
      `[CalDAV] Discovery: all ${errors.length} paths failed for ${baseUrl}. Errors:`,
      errors.map((e) => ({
        path: e.path,
        message: e.error instanceof Error ? e.error.message : String(e.error),
      }))
    )
  }

  return normalizedUrl.replace(/\/$/, '')
}

export async function testConnection(
  serverUrl: string,
  credentials: { username: string; password: string },
  proxyUrl?: string | null
): Promise<boolean> {
  try {
    const fetchFn = proxyUrl ? createProxyFetch(proxyUrl) : undefined

    const client = await createDAVClient({
      serverUrl,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
      fetch: fetchFn,
    })

    await client.fetchCalendars()
    return true
  } catch {
    return false
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
    const encodedTarget = encodeURIComponent(url)
    const proxyBase = proxyUrl.replace(/\/$/, '')
    const proxiedUrl = `${proxyBase}/${encodedTarget}`
    return fetch(proxiedUrl, init)
  }
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
