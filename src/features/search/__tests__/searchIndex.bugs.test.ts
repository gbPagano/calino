import { describe, it, expect, beforeEach } from 'vitest'
import { initializeSearchIndex, search, updateSearchIndex } from '../lib/searchIndex'
import type { CalendarEvent } from '@/types'

// --- Bug #99: filterCollection uses stored events, not Fuse internals ---

describe('Bug #99: filterCollection uses stored events instead of Fuse internals', () => {
  const events: CalendarEvent[] = [
    {
      id: '1',
      calendarId: 'cal1',
      title: 'Team Meeting',
      start: '2024-03-15T09:00:00Z',
      end: '2024-03-15T10:00:00Z',
      isAllDay: false,
    },
    {
      id: '2',
      calendarId: 'cal2',
      title: 'Lunch',
      start: '2024-03-15T12:00:00Z',
      end: '2024-03-15T13:00:00Z',
      isAllDay: false,
    },
  ]

  beforeEach(() => {
    initializeSearchIndex(events)
  })

  it('filter-only mode (empty query + filters) returns correct results', () => {
    const results = search('', { calendarIds: ['cal1'] })
    expect(results).toHaveLength(1)
    expect(results[0].event.id).toBe('1')
  })

  it('filter-only mode returns all matching events', () => {
    const results = search('', { calendarIds: ['cal1', 'cal2'] })
    expect(results).toHaveLength(2)
  })

  it('updateSearchIndex preserves filter-only functionality', async () => {
    const newEvents = [
      ...events,
      {
        id: '3',
        calendarId: 'cal3',
        title: 'New Meeting',
        start: '2024-04-01T10:00:00Z',
        end: '2024-04-01T11:00:00Z',
        isAllDay: false,
      },
    ]
    // R4.5: indexedEvents (used by filter-only mode) is updated
    // synchronously, so this test doesn't strictly need to await —
    // but awaiting matches the new contract and makes the intent clear.
    await updateSearchIndex(newEvents)

    const results = search('', { calendarIds: ['cal3'] })
    expect(results).toHaveLength(1)
    expect(results[0].event.title).toBe('New Meeting')
  })

  it('filter-only mode returns empty array when no filters match', () => {
    const results = search('', { calendarIds: ['nonexistent'] })
    expect(results).toHaveLength(0)
  })
})

// --- Bug #100: Recurring events expanded in search date filter ---

describe('Bug #100: Recurring events appear in search date filter results', () => {
  const recurringEvents: CalendarEvent[] = [
    {
      id: '1',
      calendarId: 'cal1',
      title: 'Weekly Standup',
      start: '2024-01-01T09:00:00Z',
      end: '2024-01-01T09:30:00Z',
      isAllDay: false,
      recurrence: { frequency: 'weekly', interval: 1 },
    },
    {
      id: '2',
      calendarId: 'cal1',
      title: 'Daily Report',
      start: '2024-02-01T17:00:00Z',
      end: '2024-02-01T17:30:00Z',
      isAllDay: false,
      rruleString: 'FREQ=DAILY;INTERVAL=1',
    },
    {
      id: '3',
      calendarId: 'cal1',
      title: 'One-time Event',
      start: '2024-01-15T10:00:00Z',
      end: '2024-01-15T11:00:00Z',
      isAllDay: false,
    },
  ]

  beforeEach(() => {
    initializeSearchIndex(recurringEvents)
  })

  it('finds recurring event with rruleString via date filter', () => {
    // The rruleString event starts Feb 1, 2024; filter to March 2024
    // where the daily recurrence should still produce occurrences
    const results = search('', {
      dateFrom: '2024-03-01',
      dateTo: '2024-03-31',
    })
    const dailyReport = results.find((r) => r.event.title === 'Daily Report')
    expect(dailyReport).toBeDefined()
  })

  it('finds recurring event with recurrence object via date filter', () => {
    // The weekly standup starts Jan 1; filter to June 2024
    // where the weekly recurrence should still produce occurrences
    const results = search('', {
      dateFrom: '2024-06-01',
      dateTo: '2024-06-30',
    })
    const standup = results.find((r) => r.event.title === 'Weekly Standup')
    expect(standup).toBeDefined()
  })

  it('does not find non-recurring event outside date range', () => {
    const results = search('', {
      dateFrom: '2024-06-01',
      dateTo: '2024-06-30',
    })
    const oneTime = results.find((r) => r.event.title === 'One-time Event')
    expect(oneTime).toBeUndefined()
  })

  it('finds non-recurring event within date range', () => {
    const results = search('', {
      dateFrom: '2024-01-14',
      dateTo: '2024-01-16',
    })
    const oneTime = results.find((r) => r.event.title === 'One-time Event')
    expect(oneTime).toBeDefined()
  })

  it('finds recurring event via text search + date filter', () => {
    const results = search('standup', {
      dateFrom: '2024-06-01',
      dateTo: '2024-06-30',
    })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].event.title).toBe('Weekly Standup')
  })

  it('finds daily recurring event in distant date range', () => {
    const results = search('', {
      dateFrom: '2024-12-01',
      dateTo: '2024-12-31',
    })
    const dailyReport = results.find((r) => r.event.title === 'Daily Report')
    expect(dailyReport).toBeDefined()
  })
})
