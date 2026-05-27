import { parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types'

export interface PositionedEvent {
  event: CalendarEvent
  column: number
  totalColumns: number
}

/**
 * Positions opaque events into columns using a greedy first-fit overlap algorithm.
 * Transparent events are excluded from positioning and must be rendered separately.
 * Events are sorted by start time before column assignment.
 */
export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  const opaqueEvents = events
    .filter((e) => e.transparency !== 'transparent')
    .sort((a, b) => {
      const startDiff = parseISO(a.start).getTime() - parseISO(b.start).getTime()
      if (startDiff !== 0) return startDiff
      // Secondary: longer events first (get priority in column assignment)
      return parseISO(b.end).getTime() - parseISO(a.end).getTime()
    })

  const positioned: { event: CalendarEvent; column: number }[] = []

  for (const event of opaqueEvents) {
    const eventStart = parseISO(event.start).getTime()
    const eventEnd = parseISO(event.end).getTime()

    let column = 0
    while (true) {
      const hasCollision = positioned.some(
        (p) =>
          p.column === column &&
          parseISO(p.event.start).getTime() < eventEnd &&
          parseISO(p.event.end).getTime() > eventStart
      )
      if (!hasCollision) break
      column++
    }

    positioned.push({ event, column })
  }

  return positioned.map(({ event, column }) => {
    const eventStart = parseISO(event.start).getTime()
    const eventEnd = parseISO(event.end).getTime()

    // Compute totalColumns from the actual column assignments of overlapping
    // events instead of sampling at 30-minute granularity, which misses
    // overlaps between short events.
    const overlapping = positioned.filter(
      (p) =>
        parseISO(p.event.start).getTime() < eventEnd &&
        parseISO(p.event.end).getTime() > eventStart
    )
    const totalColumns = overlapping.length > 0
      ? Math.max(...overlapping.map((p) => p.column)) + 1
      : 1

    return { event, column, totalColumns }
  })
}
