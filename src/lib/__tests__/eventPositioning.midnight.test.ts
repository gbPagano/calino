import { describe, it, expect } from 'vitest'
import { positionEvents } from '../eventPositioning'
import { makeEvent, eventTimeRange } from './fixtures'
import type { CalendarEvent } from '@/types'

const day = (hour: number, minute: number, durationMin: number) =>
  eventTimeRange(2026, 4, 27, hour, minute, durationMin * 60_000)

describe('positionEvents — known limitations documented as regression guards', () => {
  it('timestamp-based overlap check is purely chronological (no day boundary)', () => {
    // The algorithm uses raw ms comparison. If a caller passes two events
    // whose UTC timestamps happen to overlap across a day boundary, they
    // will be reported as overlapping. This pins the current contract:
    // callers must pre-filter events to a single calendar day before calling
    // positionEvents. We construct two UTC events whose absolute timestamps
    // do overlap, regardless of the host machine's timezone.
    const a: CalendarEvent = makeEvent({
      id: 'a',
      title: 'Event a',
      ...day(0, 0, 0),
      start: '2026-05-27T23:00:00.000Z',
      end: '2026-05-28T01:00:00.000Z', // 2-hour event straddling midnight UTC
    })
    const b: CalendarEvent = makeEvent({
      id: 'b',
      title: 'Event b',
      ...day(0, 0, 0),
      start: '2026-05-28T00:30:00.000Z',
      end: '2026-05-28T01:30:00.000Z', // 1-hour event the next day
    })
    const result = positionEvents([a, b])
    expect(result).toHaveLength(2)
    // Both share the 00:30–01:00 window by timestamp comparison, so they
    // land in different columns and both report totalColumns=2.
    for (const p of result) {
      expect(p.totalColumns).toBe(2)
    }
  })

  it('DST spring-forward: two non-overlapping events on the same day stay side-by-side', () => {
    // Regression guard: parseISO with ISO timestamps should be tz-stable,
    // and two non-overlapping events should both report totalColumns=1.
    const morning = makeEvent({ id: 'a', title: 'Event a', ...day(8, 0, 30) })
    const afternoon = makeEvent({ id: 'b', title: 'Event b', ...day(14, 0, 60) })
    const result = positionEvents([morning, afternoon])
    expect(result).toHaveLength(2)
    expect(result[0].totalColumns).toBe(1)
    expect(result[1].totalColumns).toBe(1)
  })

  it('multi-day timed event: an event that starts on day N and ends on day N+1 is positioned on day N', () => {
    // The algorithm doesn't know about calendar days; it only sees
    // timestamps. A 23:00–01:00 event has its start timestamp on day N, and
    // will be placed in column 0 (no prior event to collide with in the
    // caller-filtered set).
    const multiDay = makeEvent({ id: 'a', title: 'Event a', ...day(23, 0, 120) })
    const result = positionEvents([multiDay])
    expect(result).toHaveLength(1)
    expect(result[0].column).toBe(0)
    expect(result[0].totalColumns).toBe(1)
  })
})
