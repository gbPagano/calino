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
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())

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

    let totalColumns = 1
    const eventStartMinutes = eventStart / 60000
    const eventEndMinutes = eventEnd / 60000

    for (let t = eventStartMinutes; t < eventEndMinutes; t += 30) {
      const overlapping = positioned.filter(
        (p) =>
          parseISO(p.event.start).getTime() / 60000 < t + 30 &&
          parseISO(p.event.end).getTime() / 60000 > t
      ).length
      totalColumns = Math.max(totalColumns, overlapping)
    }

    return { event, column, totalColumns }
  })
}
