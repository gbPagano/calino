import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotifications } from '../useNotifications'
import type { CalendarEvent } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockShowNotification = vi.fn()

vi.mock('@/lib/notifications', () => ({
  showNotification: (...args: unknown[]) => mockShowNotification(...args),
  createNotificationId: (eventId: string, reminderId: string) =>
    `calino-${eventId}-${reminderId}`,
}))

// Minimal zustand store mock: we directly mutate the returned state references
// and trigger re-renders via act().
let currentEvents: CalendarEvent[] = []
let currentEnableNotifications = true
let currentDefaultReminderMinutes = 15

vi.mock('@/store/calendarStore', () => ({
  useCalendarStore: (selector: (s: { events: CalendarEvent[] }) => unknown) =>
    selector({ events: currentEvents }),
}))

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (
    selector: (s: {
      enableDesktopNotifications: boolean
      defaultReminderMinutes: number
    }) => unknown
  ) =>
    selector({
      enableDesktopNotifications: currentEnableNotifications,
      defaultReminderMinutes: currentDefaultReminderMinutes,
    }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEvent(
  id: string,
  start: Date,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    calendarId: 'cal1',
    title: `Event ${id}`,
    start: start.toISOString(),
    end: new Date(start.getTime() + 60 * 60_000).toISOString(),
    isAllDay: false,
    type: 'event',
    reminders: [{ id: 'rem1', minutesBefore: 15, method: 'popup' }],
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useNotifications - Bug #81+90: shownReminders behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    currentEvents = []
    currentEnableNotifications = true
    currentDefaultReminderMinutes = 15

    // Mock Notification API
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires a reminder when an event enters the check window', () => {
    // Event starts in exactly 15 minutes so the reminder should fire now
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart)]

    renderHook(() => useNotifications())

    expect(mockShowNotification).toHaveBeenCalledTimes(1)
    expect(mockShowNotification).toHaveBeenCalledWith(
      'Event evt1',
      expect.any(String),
      'evt1',
      expect.any(String)
    )
  })

  it('does not re-fire the same reminder on subsequent checks', () => {
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart)]

    renderHook(() => useNotifications())
    expect(mockShowNotification).toHaveBeenCalledTimes(1)

    // Advance time by one check interval — reminder should NOT fire again
    act(() => {
      vi.advanceTimersByTime(5 * 60_1000)
    })

    expect(mockShowNotification).toHaveBeenCalledTimes(1)
  })

  it('re-fires reminder when event is edited (start time changes)', () => {
    const now = new Date()

    // Event starts in 15 min → reminder fires
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart)]

    const { rerender } = renderHook(() => useNotifications())
    expect(mockShowNotification).toHaveBeenCalledTimes(1)

    // Edit: move event so it starts in 15 min again from new "now"
    const later = new Date(now.getTime() + 60_000) // advance now by 1 min
    vi.setSystemTime(later)
    const newEventStart = new Date(later.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', newEventStart)]

    act(() => {
      rerender()
    })

    // The trigger time changed, so the reminder should re-fire
    expect(mockShowNotification).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate reminders after toggling notifications off then on', () => {
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart)]

    const { rerender } = renderHook(() => useNotifications())
    expect(mockShowNotification).toHaveBeenCalledTimes(1)

    // Disable notifications
    currentEnableNotifications = false
    act(() => {
      rerender()
    })

    // Re-enable notifications
    currentEnableNotifications = true
    act(() => {
      rerender()
    })

    // The reminder should NOT fire again — it was already shown
    expect(mockShowNotification).toHaveBeenCalledTimes(1)
  })

  it('fires reminders for multiple events independently', () => {
    const now = new Date()
    const start1 = new Date(now.getTime() + 15 * 60_000)
    const start2 = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', start1), makeEvent('evt2', start2)]

    renderHook(() => useNotifications())

    expect(mockShowNotification).toHaveBeenCalledTimes(2)
    const ids = mockShowNotification.mock.calls.map(
      (call: unknown[]) => call[2]
    )
    expect(ids).toContain('evt1')
    expect(ids).toContain('evt2')
  })

  it('does not fire when enableNotifications is false', () => {
    currentEnableNotifications = false
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart)]

    renderHook(() => useNotifications())

    expect(mockShowNotification).not.toHaveBeenCalled()
  })

  it('does not fire when task event has no reminders and no default applies', () => {
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart, { type: 'task', reminders: [] })]

    renderHook(() => useNotifications())

    // Tasks with empty reminders array do not get default reminders
    expect(mockShowNotification).not.toHaveBeenCalled()
  })

  it('applies default reminder for event with empty reminders array', () => {
    const now = new Date()
    const eventStart = new Date(now.getTime() + 15 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart, { reminders: [] })]

    renderHook(() => useNotifications())

    // Regular events with empty reminders still get the default reminder
    expect(mockShowNotification).toHaveBeenCalledTimes(1)
  })

  it('uses defaultReminderMinutes when event has no explicit reminders', () => {
    currentDefaultReminderMinutes = 30
    const now = new Date()
    // Event starts in 30 min → should fire with default reminder
    const eventStart = new Date(now.getTime() + 30 * 60_000)
    currentEvents = [makeEvent('evt1', eventStart, { reminders: undefined })]

    renderHook(() => useNotifications())

    expect(mockShowNotification).toHaveBeenCalledTimes(1)
  })
})
