import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventCard } from '../components/EventCard'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import type { CalendarEvent } from '@/types'

vi.mock('@/features/caldav/hooks/useCalDAV')

const mockUseCalDAV = vi.mocked(useCalDAV)

const mockEvent: CalendarEvent = {
  id: 'test-event-1',
  calendarId: 'default',
  title: 'Test Meeting',
  start: '2024-03-15T10:00:00',
  end: '2024-03-15T11:00:00',
  isAllDay: false,
}

describe('EventCard', () => {
  const mockDeleteCalDAVEvent = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCalDAV.mockReturnValue({
      accounts: [],
      calendars: [],
      syncState: { status: 'idle', lastSyncAt: null, error: null, pendingChanges: 0 },
      addAccount: vi.fn(),
      removeAccount: vi.fn(),
      syncAccount: vi.fn(),
      syncAll: vi.fn(),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: mockDeleteCalDAVEvent,
    } as unknown as ReturnType<typeof useCalDAV>)

    const store = useCalendarStore.getState()
    store.events.forEach((e) => store.deleteEvent(e.id))
    store.calendars.forEach((c) => store.deleteCalendar(c.id))
    store.addCalendar({
      id: 'default',
      name: 'Default Calendar',
      color: '#4285F4',
      isVisible: true,
      isDefault: true,
      showTasksInViews: true,
    })
  })

  it('renders event title', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Test Meeting')).toBeInTheDocument()
  })

  it('renders event time when not all-day', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText(/10:00.*11:00/)).toBeInTheDocument()
  })

  it('renders "All day" for all-day events', () => {
    const allDayEvent: CalendarEvent = {
      ...mockEvent,
      isAllDay: true,
    }
    render(<EventCard event={allDayEvent} />)
    expect(screen.getByText('All day')).toBeInTheDocument()
  })

  it('renders location when present', () => {
    const eventWithLocation: CalendarEvent = {
      ...mockEvent,
      location: 'Conference Room A',
    }
    render(<EventCard event={eventWithLocation} />)
    expect(screen.getByText('Conference Room A')).toBeInTheDocument()
  })

  it('does not show time in compact mode', () => {
    render(<EventCard event={mockEvent} compact />)
    expect(screen.queryByText(/10:00/)).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<EventCard event={mockEvent} onClick={handleClick} />)

    await user.click(screen.getByText('Test Meeting'))

    expect(handleClick).toHaveBeenCalledWith(mockEvent)
  })

  it('deletes event from CalDAV when using context menu delete', async () => {
    const user = userEvent.setup()
    const store = useCalendarStore.getState()
    store.addEvent(mockEvent)

    render(<EventCard event={mockEvent} />)

    // Trigger context menu (right-click)
    const card = screen.getByText('Test Meeting')
    fireEvent.contextMenu(card)

    // Click delete in context menu
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)

    expect(mockDeleteCalDAVEvent).toHaveBeenCalledWith('default', 'test-event-1')
  })

  it('removes old resize listeners before adding new ones (Bug #61)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<EventCard event={mockEvent} />)

    // Find the resize handle
    const resizeHandle = document.querySelector('[class*="resizeHandle"]')
    expect(resizeHandle).toBeInTheDocument()

    // Simulate first resize start
    fireEvent.pointerDown(resizeHandle!, {
      clientX: 100,
      clientY: 200,
      bubbles: true,
    })

    // Should have added pointermove and pointerup listeners
    const pointermoveCallsAfterFirst = addSpy.mock.calls.filter(
      (c) => c[0] === 'pointermove'
    )
    const pointerupCallsAfterFirst = addSpy.mock.calls.filter(
      (c) => c[0] === 'pointerup'
    )
    expect(pointermoveCallsAfterFirst.length).toBeGreaterThanOrEqual(1)
    expect(pointerupCallsAfterFirst.length).toBeGreaterThanOrEqual(1)

    const firstMoveHandler = pointermoveCallsAfterFirst[pointermoveCallsAfterFirst.length - 1][1]
    const firstUpHandler = pointerupCallsAfterFirst[pointerupCallsAfterFirst.length - 1][1]

    // Simulate second resize start (without ending the first)
    addSpy.mockClear()
    removeSpy.mockClear()

    fireEvent.pointerDown(resizeHandle!, {
      clientX: 100,
      clientY: 200,
      bubbles: true,
    })

    // The old listeners should have been removed before new ones were added
    expect(removeSpy).toHaveBeenCalledWith('pointermove', firstMoveHandler)
    expect(removeSpy).toHaveBeenCalledWith('pointerup', firstUpHandler)

    // New listeners should have been added
    const pointermoveCallsAfterSecond = addSpy.mock.calls.filter(
      (c) => c[0] === 'pointermove'
    )
    const pointerupCallsAfterSecond = addSpy.mock.calls.filter(
      (c) => c[0] === 'pointerup'
    )
    expect(pointermoveCallsAfterSecond.length).toBe(1)
    expect(pointerupCallsAfterSecond.length).toBe(1)

    addSpy.mockRestore()
    removeSpy.mockRestore()
    unmount()
  })
})
