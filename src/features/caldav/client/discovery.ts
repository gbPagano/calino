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

/**
 * Check whether a path is (or contains) the .well-known/caldav endpoint.
 * If the server responded at .well-known itself (no redirect happened),
 * we treat it as unsupported and fall back to the base URL.
 */
function isWellKnownPath(pathname: string): boolean {
  const wellKnownSuffix = '/.well-known/caldav'
  return pathname === wellKnownSuffix || pathname === wellKnownSuffix + '/'
}

/** Direct fetch: follow redirect and compare final URL to detect .well-known discovery. */
async function probeWellKnownDirect(
  wellKnownUrl: string,
  baseUrl: string
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS)
  try {
    // Use redirect:'follow' — cross-origin redirect:'manual' returns an opaque
    // response (status 0, empty headers) in browsers, even with CORS exposed headers.
    const response = await fetch(wellKnownUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })

    const finalUrl = new URL(response.url)
    // Keep trailing slash — some servers (Davis) require it for PROPFIND.
    const finalPath = finalUrl.pathname

    // If the final URL is still .well-known/caldav, no redirect happened.
    // RFC 5785 says the actual service MUST NOT be at .well-known, so this
    // means the server doesn't support well-known discovery.
    if (isWellKnownPath(finalPath)) {
      return null
    }

    // We were redirected to a different path — that's the real CalDAV endpoint.
    return buildBaseUrl(baseUrl, finalPath)
  } finally {
    clearTimeout(timer)
  }
}

/** Proxy fetch: same logic as direct — the proxy handles redirects. */
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
      redirect: 'follow',
      signal: controller.signal,
    })

    // Same logic as probeWellKnownDirect: check if we ended up somewhere else.
    // If the proxy followed a redirect, the X-Target-URL header reveals the
    // real endpoint. Preserve trailing slash — some servers (Davis) require it.
    const targetUrl = response.headers.get('X-Target-URL')
    if (targetUrl) {
      const finalUrl = new URL(targetUrl)
      const finalPath = finalUrl.pathname
      if (!isWellKnownPath(finalPath)) {
        return buildBaseUrl(baseUrl, finalPath)
      }
    }

    // No X-Target-URL: infer from status.
    // 401/403 could mean the redirect requires authentication — we can't
    // determine the actual path, so fall back to base URL.
    if (response.status === 401 || response.status === 403) {
      return null
    }

    // 200 at .well-known itself — server doesn't redirect (unsupported)
    if (response.ok) {
      return null
    }

    // 404/405 — not supported
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Build a normalized base URL from the server's origin + discovered path. */
function buildBaseUrl(serverBaseUrl: string, discoveredPath: string): string {
  const origin = new URL(serverBaseUrl).origin
  // Keep trailing slash if the server redirected to one (e.g. Davis → /dav/).
  // Some servers (Davis) require the trailing slash for PROPFIND to work;
  // others (Baikal, Radicale) work either way. tsdav uses new URL() which
  // handles both forms correctly.
  // Root path becomes just the origin (e.g. https://radicale.example.com)
  return discoveredPath === '' || discoveredPath === '/' ? origin : `${origin}${discoveredPath}`
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
  // The proxy expects the server origin encoded as the first path segment,
  // with the rest of the path as unencoded segments.
  // e.g. proxy.calino.io/https%3A%2F%2Fdav.example.com/principals/user
  const parsed = new URL(targetUrl)
  const encodedOrigin = encodeURIComponent(parsed.origin)
  const path = parsed.pathname + parsed.search + parsed.hash
  const proxyBase = proxyUrl.replace(/\/$/, '')
  const proxiedUrl = `${proxyBase}/${encodedOrigin}${path}`
  return fetch(proxiedUrl, init)
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
