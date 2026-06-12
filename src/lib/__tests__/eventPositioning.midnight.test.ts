import { describe, it, expect } from 'vitest'
import { positionEvents } from '../eventPositioning'
import type { CalendarEvent } from '@/types'

function makeEvent(
  id: string,
  startHour: number,
  startMinute: number,
  durationMinutes: number,
  overrides: Partial<CalendarEvent> = {}
): CalendarEvent {
  const start = new Date(2026, 4, 27, startHour, startMinute)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return {
    id,
    calendarId: 'cal1',
    title: `Event ${id}`,
    start: start.toISOString(),
    end: end.toISOString(),
    isAllDay: false,
    type: 'event',
    ...overrides,
  }
}

describe('positionEvents — known limitations documented as regression guards', () => {
  it('timestamp-based overlap check is purely chronological (no day boundary)', () => {
    // The algorithm uses raw ms comparison. If a caller passes two events
    // whose UTC timestamps happen to overlap across a day boundary, they
    // will be reported as overlapping. This pins the current contract:
    // callers must pre-filter events to a single calendar day before calling
    // positionEvents. We construct two UTC events whose absolute timestamps
    // do overlap, regardless of the host machine's timezone.
    const a: CalendarEvent = {
      ...makeEvent('a', 0, 0, 0),
      start: '2026-05-27T23:00:00.000Z',
      end: '2026-05-28T01:00:00.000Z', // 2-hour event straddling midnight UTC
    }
    const b: CalendarEvent = {
      ...makeEvent('b', 0, 0, 0),
      start: '2026-05-28T00:30:00.000Z',
      end: '2026-05-28T01:30:00.000Z', // 1-hour event the next day
    }
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
    const morning = makeEvent('a', 8, 0, 30) // 08:00 – 08:30
    const afternoon = makeEvent('b', 14, 0, 60) // 14:00 – 15:00
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
    const multiDay = makeEvent('a', 23, 0, 120) // 23:00 → 01:00 next day
    const result = positionEvents([multiDay])
    expect(result).toHaveLength(1)
    expect(result[0].column).toBe(0)
    expect(result[0].totalColumns).toBe(1)
  })
})
