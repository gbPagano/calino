import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { CalendarEvent } from '@/types'

// ---------------------------------------------------------------------------
// Mock every module that useCalDAV imports from
// ---------------------------------------------------------------------------
vi.mock('../../client/discovery')
vi.mock('../../client/credentials')
vi.mock('../../sync/accountStorage')
vi.mock('../../adapter/iCalendarAdapter')
vi.mock('../../client/CalDAVClient')
vi.mock('../../sync/syncEngine')

// ---------------------------------------------------------------------------
// Helper: typed access to mocked modules
// ---------------------------------------------------------------------------
import * as discovery from '../../client/discovery'
import * as credentials from '../../client/credentials'
import * as accountStorage from '../../sync/accountStorage'
import * as CalDAVClientModule from '../../client/CalDAVClient'
import * as SyncEngineModule from '../../sync/syncEngine'
import { useCalDAV } from '../useCalDAV'

type MockDiscovery = typeof discovery & {
  discoverServerUrl: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
}
type MockCredentials = typeof credentials & {
  saveCredentials: ReturnType<typeof vi.fn>
  getCredentialById: ReturnType<typeof vi.fn>
  deleteCredential: ReturnType<typeof vi.fn>
}
type MockAccountStorage = typeof accountStorage & {
  getAllAccounts: ReturnType<typeof vi.fn>
  getAllCalendars: ReturnType<typeof vi.fn>
  getPendingChanges: ReturnType<typeof vi.fn>
  saveAccount: ReturnType<typeof vi.fn>
  deleteAccount: ReturnType<typeof vi.fn>
  getAccountById: ReturnType<typeof vi.fn>
  getCalendarsByAccountId: ReturnType<typeof vi.fn>
  updateAccountLastSync: ReturnType<typeof vi.fn>
  addPendingChange: ReturnType<typeof vi.fn>
  removePendingChange: ReturnType<typeof vi.fn>
  updatePendingChangeRetry: ReturnType<typeof vi.fn>
  saveCalendar: ReturnType<typeof vi.fn>
  deleteCalendarsByAccountId: ReturnType<typeof vi.fn>
  deleteCalendar: ReturnType<typeof vi.fn>
  updateCalendar: ReturnType<typeof vi.fn>
}
type MockCalDAVClient = typeof CalDAVClientModule & {
  createCalDAVClient: ReturnType<typeof vi.fn>
}
type MockSyncEngine = typeof SyncEngineModule & {
  SyncEngine: ReturnType<typeof vi.fn>
}

const mockDiscovery = discovery as unknown as MockDiscovery
const mockCredentials = credentials as unknown as MockCredentials
const mockAccountStorage = accountStorage as unknown as MockAccountStorage
const mockCalDAVClient = CalDAVClientModule as unknown as MockCalDAVClient
const mockSyncEngine = SyncEngineModule as unknown as MockSyncEngine

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockEvent: CalendarEvent = {
  id: 'evt-1',
  calendarId: 'cal-1',
  title: 'Test Event',
  start: '2025-06-01T10:00:00',
  end: '2025-06-01T11:00:00',
  isAllDay: false,
}

const mockAccount = {
  id: 'acc-1',
  name: 'Test Account',
  serverUrl: 'https://caldav.example.com',
  proxyUrl: null,
  username: 'user',
  credentialId: 'cred-1',
  createdAt: '2025-01-01T00:00:00Z',
  lastSyncAt: null,
}

const mockCalendar = {
  id: 'cal-1',
  accountId: 'acc-1',
  url: 'https://caldav.example.com/cal/main/',
  name: 'Main Calendar',
  color: '#4285F4',
  ctag: null,
  syncToken: null,
  isVisible: true,
  isDefault: true,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useCalDAV', () => {
  // Track sync engine instance mocks so tests can configure pushEvent etc.
  let mockSyncEngineInstance: {
    pushEvent: ReturnType<typeof vi.fn>
    updateEvent: ReturnType<typeof vi.fn>
    deleteEvent: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock returns for store lookups
    mockAccountStorage.getAllAccounts.mockReturnValue([])
    mockAccountStorage.getAllCalendars.mockReturnValue([])
    mockAccountStorage.getPendingChanges.mockReturnValue([])
    mockAccountStorage.getCalendarsByAccountId.mockReturnValue([])
    mockAccountStorage.getAccountById.mockReturnValue(undefined)
    mockAccountStorage.addPendingChange.mockReturnValue(undefined)
    mockAccountStorage.removePendingChange.mockReturnValue(undefined)
    mockAccountStorage.updatePendingChangeRetry.mockReturnValue(undefined)
    mockAccountStorage.updateAccountLastSync.mockReturnValue(undefined)

    // Discovery defaults
    mockDiscovery.discoverServerUrl.mockResolvedValue('https://caldav.example.com')
    mockDiscovery.testConnection.mockResolvedValue(true)
    mockCredentials.saveCredentials.mockReturnValue({
      id: 'cred-1',
      serverUrl: '',
      username: '',
      password: '',
    })
    mockCredentials.getCredentialById.mockReturnValue({
      id: 'cred-1',
      serverUrl: 'https://caldav.example.com',
      username: 'test',
      password: 'test',
    })
    mockCredentials.deleteCredential.mockReturnValue(undefined)

    // Default client (fetchEvents returns empty)
    mockCalDAVClient.createCalDAVClient.mockResolvedValue({
      fetchEvents: vi.fn().mockResolvedValue([]),
      fetchCalendars: vi.fn().mockResolvedValue([]),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof CalDAVClientModule.createCalDAVClient>>)

    // SyncEngine instance mock
    mockSyncEngineInstance = {
      pushEvent: vi.fn().mockResolvedValue({ url: 'https://...', etag: 'abc' }),
      updateEvent: vi.fn().mockResolvedValue({ url: 'https://...', etag: 'def' }),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
    }
    mockSyncEngine.SyncEngine.mockImplementation(function () {
      return mockSyncEngineInstance
    })

    // Reset Zustand stores
    const calStore = useCalendarStore.getState()
    calStore.events.forEach((e) => calStore.deleteEvent(e.id))
    calStore.calendars.forEach((c) => calStore.deleteCalendar(c.id))
    calStore.addCalendar({
      id: 'default',
      name: 'Offline calendar',
      color: '#4285F4',
      isVisible: true,
      isDefault: true,
      showTasksInViews: true,
    })

    // Reset settings to defaults
    useSettingsStore.getState().updateSettings({
      caldavDebugMode: false,
      conflictResolution: 'server-wins',
    })
  })

  // -----------------------------------------------------------------------
  // Bug 18: No retry limit on pending changes
  // -----------------------------------------------------------------------
  describe('Bug 18: pending change retry limit', () => {
    it('drops pending changes that have exceeded MAX_RETRIES (10)', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-exhausted',
          type: 'create',
          eventId: 'evt-exhausted',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 10, // at limit
        },
      ] as any)

      renderHook(() => useCalDAV())

      // Should have been removed without attempting to push
      await waitFor(() => {
        expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-exhausted')
      })

      expect(mockSyncEngineInstance.pushEvent).not.toHaveBeenCalled()
    })

    it('drops pending changes that have exceeded MAX_RETRIES (11)', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-over',
          type: 'update',
          eventId: 'evt-over',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 15, // way over limit
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-over')
      })

      expect(mockSyncEngineInstance.updateEvent).not.toHaveBeenCalled()
    })

    it('still processes pending changes below the retry limit', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-ok',
          type: 'create',
          eventId: 'evt-ok',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 3, // below limit of 10
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalled()
      })

      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-ok')
    })

    it('processes pending changes at retryCount 9 (just below limit)', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-ninth',
          type: 'create',
          eventId: 'evt-ninth',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 9, // one below limit
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalled()
      })

      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-ninth')
    })

    it('processes a mix of exhausted and valid pending changes', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-exhausted',
          type: 'create',
          eventId: 'evt-exhausted',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 10,
        },
        {
          id: 'pc-valid',
          type: 'create',
          eventId: 'evt-valid',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 2,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalled()
      })

      // The exhausted one was removed, the valid one was processed and removed
      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-exhausted')
      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-valid')
      // Only one push (for the valid one)
      expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalledTimes(1)
    })

    it('does not call updatePendingChangeRetry for exhausted changes', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-exhausted',
          type: 'create',
          eventId: 'evt-exhausted',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 10,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-exhausted')
      })

      expect(mockAccountStorage.updatePendingChangeRetry).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // Bug 17: deleteEvent uses etag from store
  // -----------------------------------------------------------------------
  describe('Bug 17: deleteEvent uses stored etag', () => {
    beforeEach(() => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
    })

    it('passes the event etag from the store to deleteEvent', async () => {
      // Add event with etag to the Zustand store
      const eventWithEtag: CalendarEvent = {
        ...mockEvent,
        etag: '"server-etag-abc"',
      }
      act(() => {
        useCalendarStore.getState().addEvent(eventWithEtag)
      })

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.deleteEvent('cal-1', 'evt-1')
      })

      expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalledWith(
        'https://caldav.example.com/cal/main/evt-1.ics',
        '"server-etag-abc"'
      )
    })

    it('falls back to empty string when event has no etag', async () => {
      // Add event without etag
      act(() => {
        useCalendarStore.getState().addEvent(mockEvent)
      })

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.deleteEvent('cal-1', 'evt-1')
      })

      expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalledWith(
        'https://caldav.example.com/cal/main/evt-1.ics',
        ''
      )
    })

    it('falls back to empty string when event is no longer in the store', async () => {
      // Event not added to the store (e.g., optimistic delete removed it)
      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.deleteEvent('cal-1', 'evt-gone')
      })

      expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalledWith(
        'https://caldav.example.com/cal/main/evt-gone.ics',
        ''
      )
    })

    it('passes stored etag when pending change processing triggers a delete', async () => {
      // Add event with etag to the store
      const eventWithEtag: CalendarEvent = {
        ...mockEvent,
        etag: '"pending-etag-xyz"',
      }
      act(() => {
        useCalendarStore.getState().addEvent(eventWithEtag)
      })

      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-del',
          type: 'delete',
          eventId: 'evt-1',
          calendarId: 'cal-1',
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalled()
      })

      // Bug 17: should use the etag from the store, not empty string
      expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalledWith(
        'https://caldav.example.com/cal/main/evt-1.ics',
        '"pending-etag-xyz"'
      )
    })
  })

  // -----------------------------------------------------------------------
  // createEvent
  // -----------------------------------------------------------------------
  describe('createEvent', () => {
    beforeEach(() => {
      // Set up storage to return a known account + calendar
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
    })

    it('pushes event to the server via SyncEngine and records last sync', async () => {
      const { result } = renderHook(() => useCalDAV())
      // Wait for mount effect
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.createEvent('cal-1', mockEvent)
      })

      expect(mockSyncEngine.SyncEngine).toHaveBeenCalledWith(
        expect.anything(),
        'cal-1'
      )
      expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt-1', title: 'Test Event', sequence: 0 })
      )
      expect(mockAccountStorage.updateAccountLastSync).toHaveBeenCalledWith('acc-1')
    })

    it('adds a pending change and re-throws when server push fails', async () => {
      mockSyncEngineInstance.pushEvent.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.createEvent('cal-1', mockEvent)).rejects.toThrow(
          'Network error'
        )
      })

      expect(mockAccountStorage.addPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'create',
          eventId: 'evt-1',
          calendarId: 'cal-1',
        })
      )
    })

    it('bumps pendingChanges count in syncState on failure', async () => {
      mockSyncEngineInstance.pushEvent.mockRejectedValue(new Error('Fail'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.createEvent('cal-1', mockEvent)).rejects.toThrow()
      })

      expect(result.current.syncState.pendingChanges).toBe(1)
    })

    it('gracefully handles missing calendar without throwing', async () => {
      // No calendars or accounts in storage
      mockAccountStorage.getAllAccounts.mockReturnValue([])
      mockAccountStorage.getAllCalendars.mockReturnValue([])

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(0))

      await act(async () => {
        // Should NOT throw
        await result.current.createEvent('non-existent', mockEvent)
      })

      expect(mockSyncEngineInstance.pushEvent).not.toHaveBeenCalled()
      expect(mockAccountStorage.addPendingChange).not.toHaveBeenCalled()
    })

    it('throws "Credentials not found" when credential lookup fails', async () => {
      mockCredentials.getCredentialById.mockReturnValue(undefined)

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.createEvent('cal-1', mockEvent)).rejects.toThrow(
          'Credentials not found'
        )
      })
    })

    it('stores serialised event data in the pending change', async () => {
      mockSyncEngineInstance.pushEvent.mockRejectedValue(new Error('Fail'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.createEvent('cal-1', mockEvent)).rejects.toThrow()
      })

      expect(mockAccountStorage.addPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          data: JSON.stringify(mockEvent),
        })
      )
    })
  })

  // -----------------------------------------------------------------------
  // updateEvent
  // -----------------------------------------------------------------------
  describe('updateEvent', () => {
    beforeEach(() => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
    })

    it('calls SyncEngine.updateEvent with incremented sequence', async () => {
      const eventWithSeq: CalendarEvent = { ...mockEvent, sequence: 2, etag: 'old-etag' }

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.updateEvent('cal-1', eventWithSeq)
      })

      expect(mockSyncEngineInstance.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt-1', sequence: 3 }),
        'old-etag'
      )
    })

    it('adds a pending change when update fails', async () => {
      mockSyncEngineInstance.updateEvent.mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.updateEvent('cal-1', mockEvent)).rejects.toThrow(
          'Update failed'
        )
      })

      expect(mockAccountStorage.addPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'update', eventId: 'evt-1', calendarId: 'cal-1' })
      )
    })

    it('bumps pendingChanges count on update failure', async () => {
      mockSyncEngineInstance.updateEvent.mockRejectedValue(new Error('Fail'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.updateEvent('cal-1', mockEvent)).rejects.toThrow()
      })

      expect(result.current.syncState.pendingChanges).toBe(1)
    })

    it('gracefully handles missing calendar on update', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([])
      mockAccountStorage.getAllCalendars.mockReturnValue([])

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(0))

      await act(async () => {
        await result.current.updateEvent('non-existent', mockEvent)
      })

      expect(mockSyncEngineInstance.updateEvent).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // deleteEvent (direct, not via pending changes)
  // -----------------------------------------------------------------------
  describe('deleteEvent', () => {
    beforeEach(() => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
    })

    it('calls SyncEngine.deleteEvent with the correct URL and removes from store', async () => {
      // Add event to the Zustand store so we can verify it gets removed
      act(() => {
        useCalendarStore.getState().addEvent(mockEvent)
      })

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.deleteEvent('cal-1', 'evt-1')
      })

      expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalledWith(
        'https://caldav.example.com/cal/main/evt-1.ics',
        ''
      )

      // Verify the event was removed from the store
      const store = useCalendarStore.getState()
      expect(store.events.find((e) => e.id === 'evt-1')).toBeUndefined()
    })

    it('adds a pending change when server delete fails', async () => {
      mockSyncEngineInstance.deleteEvent.mockRejectedValue(new Error('Delete failed'))

      act(() => {
        useCalendarStore.getState().addEvent(mockEvent)
      })

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.deleteEvent('cal-1', 'evt-1')).rejects.toThrow('Delete failed')
      })

      expect(mockAccountStorage.addPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'delete', eventId: 'evt-1', calendarId: 'cal-1' })
      )
    })

    it('bumps pendingChanges count on delete failure', async () => {
      mockSyncEngineInstance.deleteEvent.mockRejectedValue(new Error('Fail'))

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.deleteEvent('cal-1', 'evt-1')).rejects.toThrow()
      })

      expect(result.current.syncState.pendingChanges).toBe(1)
    })

    it('returns early if calendar not found', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([])
      mockAccountStorage.getAllCalendars.mockReturnValue([])

      const { result } = renderHook(() => useCalDAV())

      await act(async () => {
        // Should not throw
        await result.current.deleteEvent('non-existent-cal', 'event-1')
      })

      expect(mockSyncEngineInstance.deleteEvent).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // Pending change queue processing
  // -----------------------------------------------------------------------
  describe('pending change queue', () => {
    it('processes pending creates on mount', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-1',
          type: 'create',
          eventId: 'evt-pc',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      // processPendingChanges runs on mount, should call pushEvent
      await waitFor(() => {
        expect(mockSyncEngineInstance.pushEvent).toHaveBeenCalled()
      })

      // After successful processing, the change is removed
      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-1')
    })

    it('processes pending updates on mount', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-upd',
          type: 'update',
          eventId: 'evt-upd',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.updateEvent).toHaveBeenCalled()
      })

      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-upd')
    })

    it('processes pending deletes on mount', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-del',
          type: 'delete',
          eventId: 'evt-del',
          calendarId: 'cal-1',
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockSyncEngineInstance.deleteEvent).toHaveBeenCalled()
      })

      expect(mockAccountStorage.removePendingChange).toHaveBeenCalledWith('pc-del')
    })

    it('retries pending changes on 30-second interval', async () => {
      vi.useFakeTimers()

      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-int',
          type: 'create',
          eventId: 'evt-int',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      // Mount processes pending changes
      await vi.advanceTimersByTimeAsync(100)

      const callsAfterMount = mockSyncEngineInstance.pushEvent.mock.calls.length
      expect(callsAfterMount).toBeGreaterThanOrEqual(1)

      // Advance 30 seconds - should re-process
      const callsBeforeInterval = mockSyncEngineInstance.pushEvent.mock.calls.length
      await vi.advanceTimersByTimeAsync(30000)
      expect(mockSyncEngineInstance.pushEvent.mock.calls.length).toBeGreaterThan(
        callsBeforeInterval
      )

      vi.useRealTimers()
    })

    it('increments retry count when a pending change fails', async () => {
      mockSyncEngineInstance.pushEvent.mockRejectedValue(new Error('Still failing'))

      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-fail',
          type: 'create',
          eventId: 'evt-fail',
          calendarId: 'cal-1',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      await waitFor(() => {
        expect(mockAccountStorage.updatePendingChangeRetry).toHaveBeenCalledWith('pc-fail')
      })
    })

    it('handles missing calendar or account for a pending change gracefully', async () => {
      // Only a pending change exists, no accounts/calendars loaded
      mockAccountStorage.getAllAccounts.mockReturnValue([])
      mockAccountStorage.getAllCalendars.mockReturnValue([])
      mockAccountStorage.getPendingChanges.mockReturnValue([
        {
          id: 'pc-orphan',
          type: 'create',
          eventId: 'evt-orphan',
          calendarId: 'cal-missing',
          data: JSON.stringify(mockEvent),
          timestamp: '2025-01-01T00:00:00Z',
          retryCount: 0,
        },
      ] as any)

      renderHook(() => useCalDAV())

      // Should not have called pushEvent since no calendar/account found
      await waitFor(() => {
        expect(mockAccountStorage.updatePendingChangeRetry).toHaveBeenCalled()
      })

      expect(mockSyncEngineInstance.pushEvent).not.toHaveBeenCalled()
    })

    it('cleans the interval on unmount', async () => {
      vi.useFakeTimers()

      mockAccountStorage.getPendingChanges.mockReturnValue([])

      const clearSpy = vi.spyOn(globalThis, 'clearInterval')

      const { unmount } = renderHook(() => useCalDAV())

      unmount()

      expect(clearSpy).toHaveBeenCalled()

      clearSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  // -----------------------------------------------------------------------
  // removeAccount
  // -----------------------------------------------------------------------
  describe('removeAccount', () => {
    it('removes account, credentials, and associated calendars', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([mockCalendar])
      mockAccountStorage.getAccountById.mockReturnValue(mockAccount)

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.removeAccount('acc-1')
      })

      expect(mockCredentials.deleteCredential).toHaveBeenCalledWith('cred-1')
      expect(mockAccountStorage.deleteCalendarsByAccountId).toHaveBeenCalledWith('acc-1')
      expect(mockAccountStorage.deleteAccount).toHaveBeenCalledWith('acc-1')
    })
  })

  // -----------------------------------------------------------------------
  // syncAccount
  // -----------------------------------------------------------------------
  describe('syncAccount', () => {
    it('skips sync when account is not found in storage', async () => {
      mockAccountStorage.getAccountById.mockReturnValue(undefined)

      const { result } = renderHook(() => useCalDAV())

      await act(async () => {
        await result.current.syncAccount('non-existent')
      })

      // Should return early without creating a client
      expect(mockCalDAVClient.createCalDAVClient).not.toHaveBeenCalled()
    })

    it('sets syncState to error when credentials are missing', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAccountById.mockReturnValue(mockAccount)
      mockCredentials.getCredentialById.mockReturnValue(undefined)

      const { result } = renderHook(() => useCalDAV())
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await expect(result.current.syncAccount('acc-1')).rejects.toThrow('Credentials not found')
      })

      expect(result.current.syncState.status).toBe('error')
      expect(result.current.syncState.error).toBe('Credentials not found')
    })
  })

  // -----------------------------------------------------------------------
  // syncAll
  // -----------------------------------------------------------------------
  describe('syncAll', () => {
    it('syncs all accounts', async () => {
      mockAccountStorage.getAllAccounts.mockReturnValue([mockAccount])
      mockAccountStorage.getAllCalendars.mockReturnValue([])
      mockAccountStorage.getAccountById.mockReturnValue(mockAccount)
      mockAccountStorage.getCalendarsByAccountId.mockReturnValue([])

      const { result } = renderHook(() => useCalDAV())
      // Wait for mount effect
      await waitFor(() => expect(result.current.accounts.length).toBe(1))

      await act(async () => {
        await result.current.syncAll()
      })

      expect(mockAccountStorage.updateAccountLastSync).toHaveBeenCalled()
    })
  })
})
