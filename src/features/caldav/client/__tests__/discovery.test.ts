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
  // Bug 30: Discovery errors silently swallowed
  // -----------------------------------------------------------------------
  describe('Bug 30: Discovery errors are logged, not silently swallowed', () => {
    it('logs a warning with all errors when all paths fail', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Make all fetch calls throw
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure'))
      )

      await discoverServerUrl('https://caldav.example.com')

      // Should have logged a warning with all errors
      expect(warnSpy).toHaveBeenCalledTimes(1)
      const warnCall = warnSpy.mock.calls[0]
      expect(warnCall[0]).toContain('[CalDAV] Discovery')
      expect(warnCall[0]).toContain('all')
      expect(warnCall[0]).toContain('paths failed')

      // The second argument should be an array of error objects
      const errorDetails = warnCall[1] as Array<{ path: string; message: string }>
      expect(Array.isArray(errorDetails)).toBe(true)
      expect(errorDetails.length).toBeGreaterThan(0)
      for (const detail of errorDetails) {
        expect(detail).toHaveProperty('path')
        expect(detail).toHaveProperty('message')
        expect(detail.message).toBe('Network failure')
      }

      warnSpy.mockRestore()
    })

    it('does not log when at least one path succeeds', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++
          // Fail on first few paths, succeed on a later one
          if (callCount <= 3) {
            return Promise.reject(new Error('Network failure'))
          }
          return Promise.resolve(new Response(null, { status: 200 }))
        })
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      // Should NOT have logged a warning since a path succeeded
      expect(warnSpy).not.toHaveBeenCalled()
      expect(result).toBeTruthy()

      warnSpy.mockRestore()
    })

    it('includes the base URL in the warning message', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('timeout'))
      )

      await discoverServerUrl('https://myserver.com')

      const warnCall = warnSpy.mock.calls[0]
      expect(warnCall[0]).toContain('https://myserver.com')

      warnSpy.mockRestore()
    })

    it('returns the normalized base URL when all paths fail', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network failure'))
      )

      const result = await discoverServerUrl('https://caldav.example.com')
      expect(result).toBe('https://caldav.example.com')
    })

    it('collects errors from multiple failed paths', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++
          // Succeed on last path only
          if (callCount < 7) {
            const errors = ['timeout', 'ECONNREFUSED', '403 Forbidden']
            return Promise.reject(new Error(errors[callCount % 3]))
          }
          return Promise.resolve(new Response(null, { status: 401 }))
        })
      )

      const result = await discoverServerUrl('https://caldav.example.com')

      // Should succeed and not log
      expect(warnSpy).not.toHaveBeenCalled()
      expect(result).toContain('caldav.example.com')

      warnSpy.mockRestore()
    })

    it('includes error count in the warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('fail'))
      )

      await discoverServerUrl('https://test.com')

      const warnCall = warnSpy.mock.calls[0]
      // Should mention the number of paths that failed
      expect(warnCall[0]).toMatch(/\d+ paths failed/)

      warnSpy.mockRestore()
    })
  })
})
