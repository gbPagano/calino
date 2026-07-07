import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverServerUrl, suggestCalDAVUrl, expandProviderUrl } from '../discovery'

describe('discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // Well-known probe — Baikal (redirect to /dav.php)
  // -----------------------------------------------------------------------
  describe('well-known probe: Baikal (redirects to /dav.php)', () => {
    it('follows 301 redirect to /dav.php', async () => {
      // With redirect:'follow', browser follows the redirect and returns
      // the final response at /dav.php with the redirected URL
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://caldav.example.com/dav.php',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('https://caldav.example.com')

      expect(result).toBe('https://caldav.example.com/dav.php')
    })

    it('follows 302 redirect to /dav.php', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://caldav.example.com/dav.php',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('https://caldav.example.com')

      expect(result).toBe('https://caldav.example.com/dav.php')
    })
  })

  // -----------------------------------------------------------------------
  // Well-known probe — Radicale (redirect to /)
  // -----------------------------------------------------------------------
  describe('well-known probe: Radicale (redirects to /)', () => {
    it('follows 301 redirect to /', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://radicale.example.com/',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('https://radicale.example.com')

      expect(result).toBe('https://radicale.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // Well-known probe — Nextcloud (redirect to /remote.php/dav)
  // -----------------------------------------------------------------------
  describe('well-known probe: Nextcloud (redirects to /remote.php/dav)', () => {
    it('follows 301 redirect to /remote.php/dav', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://nextcloud.example.com/remote.php/dav',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('https://nextcloud.example.com')

      expect(result).toBe('https://nextcloud.example.com/remote.php/dav')
    })
  })

  // -----------------------------------------------------------------------
  // Well-known probe — server doesn't support well-known (404)
  // -----------------------------------------------------------------------
  describe('well-known probe: server returns 404', () => {
    it('falls back to base URL', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(null, { status: 404 })
        )
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      expect(result).toBe('https://caldav.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // Well-known probe — direct 200 response (no redirect, unsupported)
  // -----------------------------------------------------------------------
  describe('well-known probe: direct 200 response (no redirect)', () => {
    it('falls back to base URL when server responds at .well-known without redirecting', async () => {
      // RFC 5785: the actual service MUST NOT be at .well-known, so a 200
      // at .well-known/caldav means the server doesn't support discovery.
      const responseUrl = 'https://caldav.example.com/.well-known/caldav'
      const mockResponse = {
        status: 200,
        ok: true,
        url: responseUrl,
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockResponse)
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      // Falls back to base URL since .well-known/caldav is not a valid endpoint
      expect(result).toBe('https://caldav.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // Well-known probe — network failure
  // -----------------------------------------------------------------------
  describe('well-known probe: network failure', () => {
    it('falls back to base URL', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure'))
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      expect(result).toBe('https://caldav.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // Proxy support
  // -----------------------------------------------------------------------
  describe('proxy support', () => {
    it('probes well-known through proxy', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://proxy.example.com/https%3A%2F%2Fcaldav.example.com/.well-known/caldav',
        headers: new Headers({
          'X-Target-URL': 'https://caldav.example.com/dav.php',
        }),
      } as unknown as Response)
      vi.stubGlobal('fetch', fetchSpy)

      const proxyUrl = 'https://proxy.example.com'
      const target = 'https://caldav.example.com'
      await discoverServerUrl(target, proxyUrl)

      // Should have fetched through the proxy with origin encoded as first segment
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const callUrl = fetchSpy.mock.calls[0][0] as string
      expect(callUrl).toContain('proxy.example.com')
      expect(callUrl).toContain(encodeURIComponent('https://caldav.example.com'))
      expect(callUrl).toContain('/.well-known/caldav')
    })

    it('follows redirect manually through proxy', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://proxy.example.com/https%3A%2F%2Fcaldav.example.com%2Fdav.php',
        headers: new Headers({
          'X-Target-URL': 'https://caldav.example.com/dav.php',
        }),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl(
        'https://caldav.example.com',
        'https://proxy.example.com'
      )

      expect(result).toBe('https://caldav.example.com/dav.php')
    })

    it('preserves trailing slash from proxy redirect (Davis)', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://proxy.example.com/https%3A%2F%2Fdavis.example.com%2Fdav%2F',
        headers: new Headers({
          'X-Target-URL': 'https://davis.example.com/dav/',
        }),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl(
        'https://davis.example.com',
        'https://proxy.example.com'
      )

      // Davis requires trailing slash — must be preserved
      expect(result).toBe('https://davis.example.com/dav/')
    })

    it('falls back when proxy followed redirect (returned 200 at .well-known)', async () => {
      // Simulates the proxy following the redirect internally and
      // returning 200 at .well-known/caldav (no Location header).
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const mockResponse = {
        status: 200,
        ok: true,
        url: 'https://proxy.example.com/https%3A%2F%2Fradicale.example.com%2F.well-known%2Fcaldav',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockResponse)
      )

      const result = await discoverServerUrl(
        'https://radicale.example.com',
        'https://proxy.example.com'
      )

      // Should fall back to base URL, NOT return .well-known/caldav
      expect(result).toBe('https://radicale.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // URL normalization
  // -----------------------------------------------------------------------
  describe('URL normalization', () => {
    it('adds https:// if missing', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://caldav.example.com/dav.php',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('caldav.example.com')

      expect(result).toBe('https://caldav.example.com/dav.php')
    })

    it('preserves existing protocol', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'http://localhost:5233/dav.php',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('http://localhost:5233')

      expect(result).toBe('http://localhost:5233/dav.php')
    })

    it('strips trailing slash from base URL before well-known probe', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        url: 'https://caldav.example.com/dav.php',
        headers: new Headers(),
      } as unknown as Response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

      const result = await discoverServerUrl('https://caldav.example.com/')

      expect(result).toBe('https://caldav.example.com/dav.php')
    })
  })

  // -----------------------------------------------------------------------
  // Fallback behavior
  // -----------------------------------------------------------------------
  describe('fallback behavior', () => {
    it('falls back to base URL when all probes fail', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn()
          // First call: well-known probe fails
          .mockRejectedValueOnce(new Error('Connection refused'))
          // Should not be called again, but just in case
          .mockRejectedValue(new Error('Connection refused'))
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      expect(result).toBe('https://caldav.example.com')
    })
  })

  // -----------------------------------------------------------------------
  // caldav. subdomain fallback
  // -----------------------------------------------------------------------
  describe('caldav. subdomain fallback', () => {
    it('tries caldav. subdomain when .well-known fails on main domain', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            // First call: .well-known on www.fastmail.com → 404
            return Promise.resolve(new Response(null, { status: 404 }))
          }
          // Second call: .well-known on caldav.fastmail.com → 301 redirect
          // With redirect:'follow', the final URL is the redirect target
          return Promise.resolve({
            ok: true,
            status: 200,
            url: 'https://caldav.fastmail.com/dav/calendars',
            headers: new Headers(),
          } as unknown as Response)
        })
      )

      const result = await discoverServerUrl('https://www.fastmail.com/dav/user@fastmail.com/')

      // Should discover through caldav. subdomain, using the redirect target's origin
      expect(result).toBe('https://caldav.fastmail.com/dav/calendars')
    })

    it('does not try caldav. subdomain when it is already the hostname', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
      )

      const result = await discoverServerUrl('https://caldav.fastmail.com/')

      // Only one fetch call (no caldav. subdomain retry since it's already caldav.)
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
      expect(result).toBe('https://caldav.fastmail.com')
    })

    it('strips www. prefix before trying caldav. subdomain', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve(new Response(null, { status: 404 }))
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            url: 'https://caldav.example.com/dav.php',
            headers: new Headers(),
          } as unknown as Response)
        })
      )

      const result = await discoverServerUrl('https://www.example.com/dav/')

      expect(result).toBe('https://caldav.example.com/dav.php')
    })

    it('falls back to base URL when caldav. subdomain also fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
      )

      const result = await discoverServerUrl('https://www.example.com/dav/')

      expect(result).toBe('https://www.example.com/dav')
    })

    it('preserves port when trying caldav. subdomain', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve(new Response(null, { status: 404 }))
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            url: 'http://caldav.example.local:8080/dav.php',
            headers: new Headers(),
          } as unknown as Response)
        })
      )

      const result = await discoverServerUrl('http://www.example.local:8080/dav/')

      expect(result).toBe('http://caldav.example.local:8080/dav.php')
    })
  })

  // -----------------------------------------------------------------------
  // Cross-domain redirect origin handling
  // -----------------------------------------------------------------------
  describe('cross-domain redirect origin', () => {
    it('uses redirect target origin when well-known redirects to different host', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      // Simulate www.fastmail.com/.well-known/caldav redirecting to caldav.fastmail.com
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          url: 'https://caldav.fastmail.com/dav/calendars',
          headers: new Headers(),
        } as unknown as Response)
      )

      const result = await discoverServerUrl('https://www.fastmail.com/')

      // Must use caldav.fastmail.com's origin, NOT www.fastmail.com's origin
      expect(result).toBe('https://caldav.fastmail.com/dav/calendars')
    })
  })

  // -----------------------------------------------------------------------
  // suggestCalDAVUrl helper
  // -----------------------------------------------------------------------
  describe('suggestCalDAVUrl', () => {
    it('returns hint for Fastmail URLs', () => {
      const hint = suggestCalDAVUrl('https://www.fastmail.com/dav/user@fastmail.com/')
      expect(hint).toContain('fastmail.com')
      expect(hint).toContain('caldav.fastmail.com')
      expect(hint).toContain('your-email@fastmail.com')
    })

    it('returns hint for caldav. subdomain of Fastmail', () => {
      const hint = suggestCalDAVUrl('https://caldav.fastmail.com/')
      expect(hint).toContain('fastmail.com')
    })

    it('returns null for unknown providers', () => {
      const hint = suggestCalDAVUrl('https://caldav.example.com/')
      expect(hint).toBeNull()
    })

    it('returns null for invalid URLs', () => {
      const hint = suggestCalDAVUrl('not-a-url')
      expect(hint).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // expandProviderUrl helper
  // -----------------------------------------------------------------------
  describe('expandProviderUrl', () => {
    it('expands Fastmail base URL using email username', () => {
      const result = expandProviderUrl('https://caldav.fastmail.com/', 'user@fastmail.com')
      expect(result).toBe('https://caldav.fastmail.com/dav/principals/user/user%40fastmail.com/')
    })

    it('expands www. Fastmail URL using email username', () => {
      const result = expandProviderUrl('https://www.fastmail.com/', 'alice@example.com')
      expect(result).toBe('https://caldav.fastmail.com/dav/principals/user/alice%40example.com/')
    })

    it('does not expand if URL already has /principals/ path', () => {
      const result = expandProviderUrl(
        'https://caldav.fastmail.com/dav/principals/user/user@fastmail.com/',
        'user@fastmail.com'
      )
      expect(result).toBeNull()
    })

    it('does not expand if URL has a specific CalDAV path like /dav/calendars/', () => {
      const result = expandProviderUrl('https://caldav.fastmail.com/dav/calendars/', 'user@fastmail.com')
      expect(result).toBeNull()
    })

    it('does not expand if username is not an email', () => {
      const result = expandProviderUrl('https://caldav.fastmail.com/', 'just-a-username')
      expect(result).toBeNull()
    })

    it('returns null for unknown providers', () => {
      const result = expandProviderUrl('https://caldav.example.com/', 'user@example.com')
      expect(result).toBeNull()
    })

    it('returns null for invalid URLs', () => {
      const result = expandProviderUrl('not-a-url', 'user@example.com')
      expect(result).toBeNull()
    })
  })
})
