import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllAccounts, getAllCalendars, getPendingChanges } from '../accountStorage'

describe('accountStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Bug 36: JSON.parse failure warnings', () => {
    function mockLocalStorage(getItemReturn: string | null) {
      const mock = {
        getItem: vi.fn().mockReturnValue(getItemReturn),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      }
      Object.defineProperty(window, 'localStorage', { value: mock, writable: true })
      Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true })
      return mock
    }

    describe('getAllAccounts', () => {
      it('logs a warning when stored accounts are corrupted JSON', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        mockLocalStorage('{invalid json}')

        const result = getAllAccounts()

        expect(result).toEqual([])
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('[CalDAV]')
        expect(warnSpy.mock.calls[0][0]).toContain('accounts')
        expect(warnSpy.mock.calls[0][0]).toContain('corrupted')

        warnSpy.mockRestore()
      })

      it('returns empty array when localStorage is empty', () => {
        mockLocalStorage(null)

        const result = getAllAccounts()

        expect(result).toEqual([])
      })
    })

    describe('getAllCalendars', () => {
      it('logs a warning when stored calendars are corrupted JSON', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        mockLocalStorage('broken{json')

        const result = getAllCalendars()

        expect(result).toEqual([])
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('[CalDAV]')
        expect(warnSpy.mock.calls[0][0]).toContain('calendars')
        expect(warnSpy.mock.calls[0][0]).toContain('corrupted')

        warnSpy.mockRestore()
      })

      it('returns empty array when localStorage is empty', () => {
        mockLocalStorage(null)

        const result = getAllCalendars()

        expect(result).toEqual([])
      })
    })

    describe('getPendingChanges', () => {
      it('logs a warning when stored pending changes are corrupted JSON', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        mockLocalStorage('["unclosed')

        const result = getPendingChanges()

        expect(result).toEqual([])
        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain('[CalDAV]')
        expect(warnSpy.mock.calls[0][0]).toContain('pending changes')
        expect(warnSpy.mock.calls[0][0]).toContain('corrupted')

        warnSpy.mockRestore()
      })

      it('returns empty array when localStorage is empty', () => {
        mockLocalStorage(null)

        const result = getPendingChanges()

        expect(result).toEqual([])
      })
    })
  })
})
