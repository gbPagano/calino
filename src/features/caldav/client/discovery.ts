import { createDAVClient } from 'tsdav'

const DISCOVERY_TIMEOUT_MS = 8_000

/**
 * Discover the CalDAV base URL by probing /.well-known/caldav (RFC 6749 §3.1).
 *
 * The server responds with a redirect (301/302) to its actual CalDAV endpoint:
 *   - Baikal:  → /dav.php
 *   - Radicale: → /
 *   - Nextcloud: → /remote.php/dav
 *
 * When a proxy is used, redirects are followed manually because the Location
 * header is relative to the target server, not the proxy.
 */
export async function discoverServerUrl(baseUrl: string, proxyUrl?: string): Promise<string> {
  const normalizedUrl = normalizeUrl(baseUrl)

  try {
    const discovered = await probeWellKnown(normalizedUrl, proxyUrl)
    if (discovered) {
      // Sanity check: the base must NOT be the .well-known/caldav URL itself.
      // If it is, the proxy followed the redirect internally and we never saw
      // the real Location header — discard and fall back to the base URL.
      const wellKnownPath = '/.well-known/caldav'
      if (discovered.endsWith(wellKnownPath) || discovered.endsWith(wellKnownPath + '/')) {
        console.log('[CalDAV] Discovery: probe returned .well-known/caldav as base — proxy likely followed redirect. Falling back.')
      } else {
        console.log('[CalDAV] Discovery: well-known probe succeeded:', discovered)
        return discovered
      }
    }
  } catch (error) {
    console.warn(
      '[CalDAV] Discovery: well-known probe failed:',
      error instanceof Error ? error.message : String(error)
    )
  }

  console.log('[CalDAV] Discovery: falling back to base URL:', normalizedUrl)
  return normalizedUrl.replace(/\/$/, '')
}

/**
 * Probe /.well-known/caldav and follow the redirect to the real CalDAV base.
 * Returns null if the server doesn't support well-known (e.g. returns 404).
 */
async function probeWellKnown(
  baseUrl: string,
  proxyUrl?: string
): Promise<string | null> {
  const wellKnownUrl = new URL('/.well-known/caldav', baseUrl).href

  if (proxyUrl) {
    return probeWellKnownViaProxy(wellKnownUrl, baseUrl, proxyUrl)
  }

  return probeWellKnownDirect(wellKnownUrl, baseUrl)
}

/** Direct fetch (no probe): use redirect: 'manual' and resolve Location ourselves. */
async function probeWellKnownDirect(
  wellKnownUrl: string,
  baseUrl: string
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS)
  try {
    const response = await fetch(wellKnownUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })

    // 3xx redirect — extract Location and resolve against the target server
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location')
      if (location) {
        const resolved = new URL(location, baseUrl)
        const path = resolved.pathname
        return buildBaseUrl(baseUrl, path)
      }
    }

    // 200 direct response at .well-known (no redirect needed)
    if (response.ok) {
      const finalUrl = new URL(response.url)
      const path = finalUrl.pathname
      return buildBaseUrl(baseUrl, path)
    }

    // 404/405 — server doesn't support well-known
    if (response.status === 404 || response.status === 405) {
      return null
    }

    // Other non-redirect status — treat as unsupported
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Proxy fetch: follow redirects manually since Location is relative to target. */
async function probeWellKnownViaProxy(
  wellKnownUrl: string,
  baseUrl: string,
  proxyUrl: string
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS)
  try {
    const response = await proxyFetch(proxyUrl, wellKnownUrl, {
      method: 'GET',
      redirect: 'manual', // don't follow — Location is relative to target
      signal: controller.signal,
    })

    // 3xx redirect — extract Location and resolve against the target server
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location')
      if (location) {
        const resolved = new URL(location, baseUrl)
        const path = resolved.pathname
        return buildBaseUrl(baseUrl, path)
      }
    }

    // 200 direct response at .well-known (no redirect needed)
    if (response.ok) {
      const path = new URL(wellKnownUrl).pathname
      return buildBaseUrl(baseUrl, path)
    }

    // 404/405 — server doesn't support well-known
    if (response.status === 404 || response.status === 405) {
      return null
    }

    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Build a normalized base URL from the server's origin + discovered path. */
function buildBaseUrl(serverBaseUrl: string, discoveredPath: string): string {
  const origin = new URL(serverBaseUrl).origin
  // CalDAV base URLs should not end with / (tsdav appends paths like /principals/...)
  const path = discoveredPath.endsWith('/') ? discoveredPath.slice(0, -1) : discoveredPath
  // Root path becomes just the origin (e.g. https://radicale.example.com)
  return path === '' ? origin : `${origin}${path}`
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
    return proxyFetch(proxyUrl, url, init)
  }
}

async function proxyFetch(
  proxyUrl: string,
  targetUrl: string,
  init?: RequestInit
): Promise<Response> {
  const encodedTarget = encodeURIComponent(targetUrl)
  const proxyBase = proxyUrl.replace(/\/$/, '')
  const proxiedUrl = `${proxyBase}/${encodedTarget}`
  return fetch(proxiedUrl, init)
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
