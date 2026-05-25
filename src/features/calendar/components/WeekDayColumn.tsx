import { memo } from 'react'
import { parseISO, format } from 'date-fns'
import type { CalendarEvent, Calendar } from '@/types'
import { EventCard } from './EventCard'
import { DEFAULT_CALENDAR_COLOR } from '@/config'
import { formatTravelDuration } from '@/lib/events'
import styles from './WeekView.module.css'

interface WeekDayColumnProps {
  day: Date
  events: CalendarEvent[]
  fragments: CalendarEvent[]
  calendars: Calendar[]
  hourHeight: number
  openModal: (start?: string, endDate?: string, eventId?: string, type?: string) => void
}

const WeekDayColumn = memo(function WeekDayColumn({
  day,
  events,
  fragments,
  calendars,
  hourHeight,
  openModal,
}: WeekDayColumnProps): JSX.Element[] {
  const allDayEvents = [...events, ...fragments]

  const sortedEvents = [...allDayEvents].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  )

  const transparentEvents = sortedEvents.filter((e) => e.transparency === 'transparent')
  const opaqueEvents = sortedEvents.filter((e) => e.transparency !== 'transparent')

  const elements: JSX.Element[] = []

  for (const event of transparentEvents) {
    const start = parseISO(event.start)
    const end = parseISO(event.end)
    const startHour = start.getHours()
    const startMinutes = start.getMinutes()
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    const heightPct = Math.max((durationMinutes / (24 * 60)) * 100, 1.4)

    const calendar = calendars.find((c: Calendar) => c.id === event.calendarId)
    const eventColor = event.color || calendar?.color || DEFAULT_CALENDAR_COLOR

    const gap = 2
    const leftPercent = gap / 2
    const widthPercent = 100 - gap

    elements.push(
      <div
        key={event.id}
        className={`${styles.eventPositioned} ${styles.eventTransparent}`}
        style={{
          top: `${((startHour * 60 + startMinutes) / (24 * 60)) * 100}%`,
          height: `${heightPct}%`,
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
          backgroundColor: `${eventColor}20`,
        }}
      >
        <EventCard event={event} enableResize transparent hourHeight={hourHeight} />
      </div>
    )
  }

  const positioned: { event: CalendarEvent; column: number }[] = []

  opaqueEvents.forEach((event) => {
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
  })

  const withTotals = positioned.map(({ event, column }) => {
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

  for (const { event, column, totalColumns } of withTotals) {
    const start = parseISO(event.start)
    const end = parseISO(event.end)

    const startHour = start.getHours()
    const startMinutes = start.getMinutes()
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    const heightPct = Math.max((durationMinutes / (24 * 60)) * 100, 1.4)

    const gap = 4
    const leftPercent = (column / totalColumns) * 100 + gap / 2
    const widthPercent = 100 / totalColumns - gap

    const calendar = calendars.find((c: Calendar) => c.id === event.calendarId)
    const eventColor = event.color || calendar?.color || DEFAULT_CALENDAR_COLOR

    if (event.travelDuration && event.travelDuration > 0) {
      const travelStart = new Date(start.getTime() - event.travelDuration * 60 * 1000)
      const travelStartHour = travelStart.getHours()
      const travelStartMinutes = travelStart.getMinutes()
      const travelDurationMinutes = event.travelDuration
      const travelHeightPct = Math.max((travelDurationMinutes / (24 * 60)) * 100, 1.1)

      elements.push(
        <div
          key={`${event.id}-travel`}
          className={styles.travelBar}
          style={{
            top: `${((travelStartHour * 60 + travelStartMinutes) / (24 * 60)) * 100}%`,
            height: `${travelHeightPct}%`,
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            backgroundColor: `${eventColor}15`,
          }}
          onClick={() => openModal(undefined, undefined, event.id)}
        >
          <span className={styles.travelBarInner}>
            {formatTravelDuration(event.travelDuration)} travel
          </span>
        </div>
      )
    }

    elements.push(
      <div
        key={event.id}
        className={styles.eventPositioned}
        style={{
          top: `${((startHour * 60 + startMinutes) / (24 * 60)) * 100}%`,
          height: `${heightPct}%`,
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
        }}
      >
        <EventCard event={event} enableResize hideTopRadius={!!event.travelDuration} hourHeight={hourHeight} />
      </div>
    )
  }

  return elements
})

export default WeekDayColumn
