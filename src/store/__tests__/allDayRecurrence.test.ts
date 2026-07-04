import { describe, it, expect, beforeEach } from 'vitest'
import { useCalendarStore } from '../calendarStore'

// Regression tests for all-day recurring expansion: occurrences must land on the
// correct calendar day and keep whole-day duration even across DST boundaries.
describe('all-day recurrence expansion', () => {
  beforeEach(() => {
    const store = useCalendarStore.getState()
    store.events.forEach((e) => store.deleteEvent(e.id))
    store.calendars.forEach((c) => {
      if (!c.isDefault) store.deleteCalendar(c.id)
    })
    useCalendarStore.setState({ selectedCategoryIds: [] })
  })

  const defaultCalId = () =>
    useCalendarStore.getState().calendars.find((c) => c.isDefault)!.id

  it('keeps a daily all-day event on its own day across a spring-forward DST boundary', () => {
    const store = useCalendarStore.getState()
    // US spring-forward 2026 is 2026-03-08. Cover a window straddling it.
    store.addEvent({
      id: 'anniv',
      calendarId: defaultCalId(),
      title: 'Daily marker',
      start: '2026-03-06T00:00:00',
      end: '2026-03-06T00:00:00',
      isAllDay: true,
      rruleString: 'FREQ=DAILY',
    })

    const events = useCalendarStore
      .getState()
      .getEventsForDateRange('2026-03-06', '2026-03-11')

    // One occurrence per day, each starting at floating midnight of its own day.
    const startDays = events.map((e) => e.start.split('T')[0]).sort()
    expect(startDays).toEqual([
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ])
    // Every occurrence is floating midnight, not shifted by an hour.
    for (const e of events) {
      expect(e.start.endsWith('T00:00:00')).toBe(true)
    }
  })

  it('preserves a multi-day all-day span in each occurrence', () => {
    const store = useCalendarStore.getState()
    // 3-day all-day event: end is exclusive midnight 3 days later.
    store.addEvent({
      id: 'trip',
      calendarId: defaultCalId(),
      title: 'Long weekend',
      start: '2026-03-06T00:00:00',
      end: '2026-03-09T00:00:00',
      isAllDay: true,
      rruleString: 'FREQ=WEEKLY',
    })

    const events = useCalendarStore
      .getState()
      .getEventsForDateRange('2026-03-06', '2026-03-06')

    expect(events.length).toBe(1)
    expect(events[0].start).toBe('2026-03-06T00:00:00')
    expect(events[0].end).toBe('2026-03-09T00:00:00')
  })
})
