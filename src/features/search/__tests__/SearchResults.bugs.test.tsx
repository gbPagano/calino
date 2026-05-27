import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchResults } from '../components/SearchResults'
import type { SearchResult } from '../types'
import type { CalendarEvent } from '@/types'

vi.mock('@/store/calendarStore', () => ({
  useCalendarStore: vi.fn((selector) => {
    const state = {
      events: [],
      calendars: [
        { id: 'cal1', name: 'Calendar 1', color: '#4285F4', isVisible: true, isDefault: true },
      ],
    }
    return selector(state as never)
  }),
}))

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    return selector({ timeFormat: '12h' })
  }),
}))

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    calendarId: 'cal1',
    title: 'Test Event',
    start: '2024-03-15T09:00:00Z',
    end: '2024-03-15T10:00:00Z',
    isAllDay: false,
    ...overrides,
  }
}

describe('Bug #106: Highlight indices bounds check', () => {
  it('renders title text normally when indices are within bounds', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'Team Meeting' }),
        score: 0.1,
        matches: [{ field: 'title', indices: [[0, 3]], value: 'Team Meeting' }],
      },
    ]

    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    // Text is split into highlight spans, so check the container text content
    expect(container.textContent).toContain('Team Meeting')
  })

  it('renders plain text when highlight index exceeds text length', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'Test' }),
        score: 0.1,
        matches: [{ field: 'title', indices: [[0, 100]], value: 'Test' }],
      },
    ]

    // Should not throw and should render the text
    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    expect(container.textContent).toContain('Test')
  })

  it('renders plain text when start index is negative', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'Hello' }),
        score: 0.1,
        matches: [{ field: 'title', indices: [[-1, 2]], value: 'Hello' }],
      },
    ]

    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    expect(container.textContent).toContain('Hello')
  })

  it('renders plain text when start > end in index pair', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'Hello' }),
        score: 0.1,
        matches: [{ field: 'title', indices: [[5, 2]], value: 'Hello' }],
      },
    ]

    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    expect(container.textContent).toContain('Hello')
  })

  it('handles empty indices array', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'No Highlights' }),
        score: 0.1,
        matches: [{ field: 'title', indices: [], value: 'No Highlights' }],
      },
    ]

    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    expect(container.textContent).toContain('No Highlights')
  })

  it('renders location with valid indices', () => {
    const results: SearchResult[] = [
      {
        event: makeEvent({ title: 'Event', location: 'Conference Room' }),
        score: 0.1,
        matches: [{ field: 'location', indices: [[0, 9]], value: 'Conference Room' }],
      },
    ]

    const { container } = render(<SearchResults results={results} onSelectEvent={vi.fn()} />)
    expect(container.textContent).toContain('Conference Room')
  })
})
