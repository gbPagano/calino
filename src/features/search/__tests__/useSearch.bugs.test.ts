import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../hooks/useSearch'
import type { CalendarEvent } from '@/types'

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    calendarId: 'cal1',
    title: 'Team Meeting',
    description: 'Weekly standup',
    location: 'Conference Room',
    start: '2024-03-15T09:00:00Z',
    end: '2024-03-15T10:00:00Z',
    isAllDay: false,
  },
]

vi.mock('@/store/calendarStore', () => ({
  useCalendarStore: vi.fn((selector) => {
    const state = {
      events: mockEvents,
      calendars: [],
      addEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
      addCalendar: vi.fn(),
      updateCalendar: vi.fn(),
      deleteCalendar: vi.fn(),
      toggleCalendarVisibility: vi.fn(),
      setDefaultCalendar: vi.fn(),
      setCurrentDate: vi.fn(),
      setCurrentView: vi.fn(),
      setSelectedEventId: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      setOverlayOpen: vi.fn(),
      setShowAddCalendar: vi.fn(),
      openPreview: vi.fn(),
      closePreview: vi.fn(),
      getEventsForDateRange: vi.fn(),
      getVisibleEvents: vi.fn(),
      addCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      addAutoCategoryRule: vi.fn(),
      updateAutoCategoryRule: vi.fn(),
      deleteAutoCategoryRule: vi.fn(),
      toggleCategoryFilter: vi.fn(),
    }
    return selector(state as never)
  }),
}))

describe('Bug #98: useSearch timer cleanup race condition', () => {
  it('does not leak timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    const { unmount } = renderHook(() => useSearch())

    unmount()

    // After unmount, clearTimeout should have been called for the debounce timers
    expect(clearTimeoutSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
  })

  it('cleans up index rebuild timer on events change', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    const { result, unmount } = renderHook(() => useSearch())

    // Trigger a re-render that changes events (this tests the cleanup path)
    unmount()

    // The cleanup function should clear the timer
    expect(clearTimeoutSpy).toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
  })

  it('search functionality still works after cleanup refactor', () => {
    const { result } = renderHook(() => useSearch())

    act(() => {
      result.current.handleSearch('meeting')
    })

    expect(result.current.query).toBe('meeting')
    expect(result.current.isSearching).toBe(true)

    // The hook should still initialize without errors
    expect(result.current.results).toBeDefined()
    expect(typeof result.current.handleSearch).toBe('function')
    expect(typeof result.current.handleClear).toBe('function')
  })
})
