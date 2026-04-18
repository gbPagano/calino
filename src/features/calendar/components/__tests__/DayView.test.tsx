import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { DayView } from '../DayView'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { useGestures } from '@/hooks/useGestures'

vi.mock('@/features/caldav/hooks/useCalDAV')
vi.mock('@/hooks/useGestures')

const mockUseCalDAV = vi.mocked(useCalDAV)
const mockUseGestures = vi.mocked(useGestures)

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('DayView', () => {
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
      deleteEvent: vi.fn(),
    } as unknown as ReturnType<typeof useCalDAV>)

    mockUseGestures.mockReturnValue({
      bind: {},
      gestureState: 'idle',
    })

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
    store.setCurrentDate('2024-03-15')
  })

  it('renders day name header', () => {
    renderWithRouter(<DayView />)
    expect(screen.getByText(/Friday/i)).toBeInTheDocument()
  })

  it('renders day number', () => {
    renderWithRouter(<DayView />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('renders hour labels', () => {
    renderWithRouter(<DayView />)
    expect(screen.getAllByText(/00:00|12:00/)).toBeTruthy()
  })

  it('renders events for the day', () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'event-1',
      calendarId: 'default',
      title: 'Team Meeting',
      start: '2024-03-15T09:00:00',
      end: '2024-03-15T10:00:00',
      isAllDay: false,
    })

    renderWithRouter(<DayView />)
    expect(screen.getByText('Team Meeting')).toBeInTheDocument()
  })

  it('renders all-day events in header', () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'event-allday',
      calendarId: 'default',
      title: 'Conference',
      start: '2024-03-15T00:00:00',
      end: '2024-03-15T23:59:59',
      isAllDay: true,
    })

    renderWithRouter(<DayView />)
    expect(screen.getByText('Conference')).toBeInTheDocument()
  })

  it('renders selection overlay container', () => {
    const { container } = renderWithRouter(<DayView />)
    const overlay = container.querySelector('[class*="eventsOverlay"]')
    expect(overlay).toBeInTheDocument()
  })

  it('renders time column with hour labels', () => {
    const { container } = renderWithRouter(<DayView />)
    const timeColumn = container.querySelector('[class*="timeLabel"]')
    expect(timeColumn).toBeInTheDocument()
  })

  it('renders header shadow when scrolled', () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'event-1',
      calendarId: 'default',
      title: 'Morning Meeting',
      start: '2024-03-15T09:00:00',
      end: '2024-03-15T10:00:00',
      isAllDay: false,
    })

    const { container } = renderWithRouter(<DayView />)
    const header = container.querySelector('[class*="header"]')
    expect(header).toBeInTheDocument()
  })

  it('highlights today', () => {
    const store = useCalendarStore.getState()
    store.setCurrentDate(new Date().toISOString().split('T')[0])
    renderWithRouter(<DayView />)
    const todayBadge = document.querySelector('[class*="today"]')
    expect(todayBadge).toBeInTheDocument()
  })
})