import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverServerUrl } from '../discovery'

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
        url: 'https://proxy.example.com/https%3A%2F%2Fcaldav.example.com%2Fdav.php',
        headers: new Headers({
          'X-Target-URL': 'https://caldav.example.com/dav.php',
        }),
      } as unknown as Response)
      vi.stubGlobal('fetch', fetchSpy)

      const proxyUrl = 'https://proxy.example.com'
      const target = 'https://caldav.example.com'
      await discoverServerUrl(target, proxyUrl)

      // Should have fetched through the proxy
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const callUrl = fetchSpy.mock.calls[0][0] as string
      expect(callUrl).toContain('proxy.example.com')
      expect(callUrl).toContain(encodeURIComponent('https://caldav.example.com/.well-known/caldav'))
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
})
