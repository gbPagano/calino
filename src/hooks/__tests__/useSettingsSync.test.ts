import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createLocalStorageMock } from '@/test/storageMock'
import { useSettingsSync } from '../useSettingsSync'
import { useSettingsStore } from '@/store/settingsStore'
import {
  getPrimaryAccountId,
  getEtag,
  setPrimaryAccountId,
  clearSyncKeys,
  getLastSyncedAt,
} from '@/lib/settingsSync'
import * as accountStorage from '@/features/caldav/sync/accountStorage'
import { getCredentialById } from '@/features/caldav/client/credentials'
import { createCalDAVClient } from '@/features/caldav/client/CalDAVClient'

// In-memory localStorage
const storage = createLocalStorageMock()

// Mock CalDAV client methods
const mockFetchSettingsEvent = vi.fn()
const mockExtractSettingsFromVEVENT = vi.fn()
const mockPutSettingsEvent = vi.fn()
const mockDeleteSettingsEvent = vi.fn()
const mockDeleteSettingsCalendar = vi.fn()
const mockDiscoverSettingsCalendar = vi.fn()
const mockCreateSettingsCalendar = vi.fn()

const mockClient = {
  fetchSettingsEvent: mockFetchSettingsEvent,
  extractSettingsFromVEVENT: mockExtractSettingsFromVEVENT,
  putSettingsEvent: mockPutSettingsEvent,
  deleteSettingsEvent: mockDeleteSettingsEvent,
  deleteSettingsCalendar: mockDeleteSettingsCalendar,
  discoverSettingsCalendar: mockDiscoverSettingsCalendar,
  createSettingsCalendar: mockCreateSettingsCalendar,
  fetchCalendars: vi.fn().mockResolvedValue([]),
} as const

vi.mock('@/features/caldav/client/CalDAVClient', () => ({
  createCalDAVClient: vi.fn(),
}))
vi.mock('@/features/caldav/client/credentials', () => ({
  getCredentialById: vi.fn(),
}))
vi.mock('@/features/caldav/sync/accountStorage', () => ({
  getAllAccounts: vi.fn(),
  getAccountById: vi.fn(),
  getCalendarsByAccountId: vi.fn(),
}))

describe('useSettingsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.install()
    useSettingsStore.getState().resetSettings()
    vi.mocked(createCalDAVClient).mockResolvedValue(mockClient as unknown as Awaited<ReturnType<typeof createCalDAVClient>>)
    vi.mocked(getCredentialById).mockResolvedValue({
      id: 'cred-1', serverUrl: 'https://example.com', username: 'user', password: 'pass',
    })
    vi.mocked(accountStorage.getAccountById).mockReturnValue({
      id: 'account-1', name: 'Test', serverUrl: 'https://example.com', proxyUrl: null,
      username: 'user', credentialId: 'cred-1', createdAt: '2025-01-01T00:00:00Z', lastSyncAt: null,
    })
    vi.mocked(accountStorage.getCalendarsByAccountId).mockReturnValue([{
      id: 'cal-1', url: 'https://example.com/dav.php/calendars/user/cal/',
      name: 'Cal', color: '#4285F4', ctag: null, syncToken: null, isVisible: true, isDefault: true,
    }])
    vi.mocked(accountStorage.getAllAccounts).mockReturnValue([])
  })

  afterEach(() => {
    clearSyncKeys()
    storage.reset()
  })

  describe('initial state', () => {
    it('should be disabled when no primary account', () => {
      const { result } = renderHook(() => useSettingsSync())
      expect(result.current.enabled).toBe(false)
      expect(result.current.syncing).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should be enabled when primary account is set', () => {
      setPrimaryAccountId('account-1')
      const { result } = renderHook(() => useSettingsSync())
      expect(result.current.enabled).toBe(true)
    })
  })

  describe('disable', () => {
    it('should clear primaryAccountId without deleting remote', async () => {
      setPrimaryAccountId('account-1')
      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.disable(false) })
      expect(result.current.enabled).toBe(false)
      expect(mockDeleteSettingsCalendar).not.toHaveBeenCalled()
    })

    it('should delete remote calendar when requested', async () => {
      setPrimaryAccountId('account-1')
      mockDiscoverSettingsCalendar.mockResolvedValue({ url: 'https://example.com/dav.php/calendars/user/calino-settings/' })
      mockDeleteSettingsCalendar.mockResolvedValue(undefined)
      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.disable(true) })
      expect(result.current.enabled).toBe(false)
      expect(mockDeleteSettingsCalendar).toHaveBeenCalled()
    })
  })

  describe('enable', () => {
    it('should create settings calendar and enable sync', async () => {
      mockDiscoverSettingsCalendar.mockResolvedValue(null)
      mockCreateSettingsCalendar.mockResolvedValue('https://example.com/dav.php/calendars/user/calino-settings/')
      mockFetchSettingsEvent.mockResolvedValue(null)
      mockPutSettingsEvent.mockResolvedValue('"etag-1"')

      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.enable('account-1') })

      expect(mockCreateSettingsCalendar).toHaveBeenCalled()
      expect(result.current.enabled).toBe(true)
      expect(getPrimaryAccountId()).toBe('account-1')
    })

    it('should reuse existing settings calendar', async () => {
      mockDiscoverSettingsCalendar.mockResolvedValue({ url: 'https://example.com/dav.php/calendars/user/calino-settings/' })
      mockFetchSettingsEvent.mockResolvedValue(null)
      mockPutSettingsEvent.mockResolvedValue('"etag-1"')

      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.enable('account-1') })

      expect(mockCreateSettingsCalendar).not.toHaveBeenCalled()
      expect(result.current.enabled).toBe(true)
    })

    it('should throw and clear keys on failure', async () => {
      vi.mocked(accountStorage.getAccountById).mockReturnValue(undefined)
      const { result } = renderHook(() => useSettingsSync())
      await act(async () => {
        try { await result.current.enable('nonexistent') } catch { /* expected */ }
      })
      expect(result.current.enabled).toBe(false)
      expect(getPrimaryAccountId()).toBeNull()
    })
  })

  describe('push', () => {
    it('should serialize and push settings', async () => {
      setPrimaryAccountId('account-1')
      mockDiscoverSettingsCalendar.mockResolvedValue({ url: 'https://example.com/dav.php/calendars/user/calino-settings/' })
      mockFetchSettingsEvent.mockResolvedValue(null)
      mockPutSettingsEvent.mockResolvedValue('"new-etag"')

      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.push() })

      expect(mockPutSettingsEvent).toHaveBeenCalled()
      expect(getEtag()).toBe('"new-etag"')
    })
  })

  describe('pull', () => {
    it('should fetch and merge remote settings', async () => {
      setPrimaryAccountId('account-1')
      mockDiscoverSettingsCalendar.mockResolvedValue({ url: 'https://example.com/dav.php/calendars/user/calino-settings/' })

      const remotePayload = {
        version: 1, syncedAt: '2099-01-01T00:00:00Z',
        settings: { timezone: 'Pacific/Auckland' },
      }
      mockFetchSettingsEvent.mockResolvedValue({
        data: 'BEGIN:VCALENDAR\r\n...ATTACH;ENCODING=BASE64;FMTTYPE=app/json:' + btoa(JSON.stringify(remotePayload)) + '\r\n...',
        etag: '"remote-etag"', href: 'https://example.com/calino-settings.ics',
        dtstamp: '20990101T000000Z',
      })
      mockExtractSettingsFromVEVENT.mockReturnValue(JSON.stringify(remotePayload))

      const { result } = renderHook(() => useSettingsSync())
      await act(async () => { await result.current.pull() })

      const settings = useSettingsStore.getState()
      expect(settings.timezone).toBe('Pacific/Auckland')
      expect(getLastSyncedAt()).toBeTruthy()
    })

    it('should return early when no remote event exists', async () => {
      setPrimaryAccountId('account-1')
      mockDiscoverSettingsCalendar.mockResolvedValue({ url: 'https://example.com/dav.php/calendars/user/calino-settings/' })
      mockFetchSettingsEvent.mockResolvedValue(null)

      const { result } = renderHook(() => useSettingsSync())
      const originalTimezone = useSettingsStore.getState().timezone
      await act(async () => { await result.current.pull() })

      // Settings should not be modified when there's no remote event
      expect(useSettingsStore.getState().timezone).toBe(originalTimezone)
    })
  })
})
