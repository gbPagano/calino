import { parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types'

export interface PositionedEvent {
  event: CalendarEvent
  column: number
  totalColumns: number
}

interface ParsedEvent {
  event: CalendarEvent
  startMs: number
  endMs: number
}

/**
 * Positions opaque events into columns using a greedy first-fit overlap algorithm.
 * Transparent events are excluded from positioning and must be rendered separately.
 * Events are sorted by start time before column assignment.
 */
export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  // Pre-parse all dates once to avoid repeated parseISO() calls in hot loops
  const parsedEvents: ParsedEvent[] = events
    .filter((e) => e.transparency !== 'transparent')
    .map((event) => ({
      event,
      startMs: parseISO(event.start).getTime(),
      endMs: parseISO(event.end).getTime(),
    }))
    .sort((a, b) => {
      const startDiff = a.startMs - b.startMs
      if (startDiff !== 0) return startDiff
      // Secondary: longer events first (get priority in column assignment)
      return b.endMs - a.endMs
    })

  // Map event → parsed data for O(1) lookups in overlap checks
  const eventToParsed = new Map<CalendarEvent, ParsedEvent>()
  for (const pe of parsedEvents) {
    eventToParsed.set(pe.event, pe)
  }

  const positioned: { event: CalendarEvent; column: number }[] = []

  for (const pe of parsedEvents) {
    let column = 0
    while (true) {
      const hasCollision = positioned.some(
        (p) =>
          p.column === column &&
          eventToParsed.get(p.event)!.startMs < pe.endMs &&
          eventToParsed.get(p.event)!.endMs > pe.startMs
      )
      if (!hasCollision) break
      column++
    }
    positioned.push({ event: pe.event, column })
  }

  return positioned.map(({ event, column }) => {
    const pe = eventToParsed.get(event)!

    const overlapping = positioned.filter(
      (p) => {
        const pParsed = eventToParsed.get(p.event)!
        return pParsed.startMs < pe.endMs && pParsed.endMs > pe.startMs
      }
    )

    const totalColumns = overlapping.length > 0
      ? Math.max(...overlapping.map((p) => p.column)) + 1
      : 1

    return { event, column, totalColumns }
  })
}
