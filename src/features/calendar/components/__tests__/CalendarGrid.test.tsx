import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CalendarGrid } from '../CalendarGrid'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { useGestures } from '@/hooks/useGestures'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useIsTallWindow, useIsWideWindow } from '@/hooks/useWindowHeight'

vi.mock('@/features/caldav/hooks/useCalDAV')
vi.mock('@/hooks/useGestures')
vi.mock('@/hooks/useIsMobile')
vi.mock('@/hooks/useWindowHeight')

const mockUseCalDAV = vi.mocked(useCalDAV)
const mockUseGestures = vi.mocked(useGestures)
const mockUseIsMobile = vi.mocked(useIsMobile)
const mockUseIsTallWindow = vi.mocked(useIsTallWindow)
const mockUseIsWideWindow = vi.mocked(useIsWideWindow)

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('CalendarGrid', () => {
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

    mockUseIsMobile.mockReturnValue(false)
    mockUseIsTallWindow.mockReturnValue(false)
    mockUseIsWideWindow.mockReturnValue(false)

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

  it('renders the calendar grid with weekdays', () => {
    renderWithRouter(<CalendarGrid />)
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
  })

  it('changeMonth reads from store directly instead of lagging ref (Bug #64)', () => {
    renderWithRouter(<CalendarGrid />)

    const store = useCalendarStore.getState()
    expect(store.currentDate).toBe('2024-03-15')

    // Simulate ArrowDown key to trigger changeMonth('down') -> next month
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    const storeAfter = useCalendarStore.getState()
    expect(storeAfter.currentDate).toBe('2024-04-15')
  })

  it('changeMonth navigates to previous month with ArrowUp (Bug #64)', () => {
    renderWithRouter(<CalendarGrid />)

    const store = useCalendarStore.getState()
    expect(store.currentDate).toBe('2024-03-15')

    // Simulate ArrowUp key to trigger changeMonth('up') -> previous month
    fireEvent.keyDown(window, { key: 'ArrowUp' })

    const storeAfter = useCalendarStore.getState()
    expect(storeAfter.currentDate).toBe('2024-02-15')
  })

  it('ArrowRight moves keyboard focus to the next day cell', () => {
    const { container } = renderWithRouter(<CalendarGrid />)
    const cell = container.querySelector<HTMLElement>('[data-date="2024-03-15"]')!
    cell.focus()
    fireEvent.keyDown(cell, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(
      container.querySelector('[data-date="2024-03-16"]')
    )
  })

  it('ArrowDown moves keyboard focus one week down without changing the month', () => {
    const { container } = renderWithRouter(<CalendarGrid />)
    const cell = container.querySelector<HTMLElement>('[data-date="2024-03-15"]')!
    cell.focus()
    fireEvent.keyDown(cell, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      container.querySelector('[data-date="2024-03-22"]')
    )
    // Focus navigation must not trigger the window-level month change.
    expect(useCalendarStore.getState().currentDate).toBe('2024-03-15')
  })

  it('changeMonth uses current store value not stale ref on rapid calls (Bug #64)', () => {
    renderWithRouter(<CalendarGrid />)

    // Rapidly navigate forward twice - each call should read the current store value
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    const store = useCalendarStore.getState()
    // Should be May 2024 (two months forward from March)
    expect(store.currentDate).toBe('2024-05-15')
  })
})
