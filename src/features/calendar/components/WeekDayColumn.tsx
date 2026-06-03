import { memo } from 'react'
import type { JSX } from 'react'
import { parseISO } from 'date-fns'
import type { CalendarEvent, Calendar } from '@/types'
import { EventCard } from './EventCard'
import { DEFAULT_CALENDAR_COLOR } from '@/config'
import { formatTravelDuration } from '@/lib/events'
import { positionEvents } from '@/lib/eventPositioning'
import styles from './WeekView.module.css'

interface WeekDayColumnProps {
  events: CalendarEvent[]
  fragments: CalendarEvent[]
  calendars: Calendar[]
  hourHeight: number
  openModal: (start?: string, endDate?: string, eventId?: string, mode?: 'event' | 'task') => void
}

const WeekDayColumn = memo(function WeekDayColumn({
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
  const elements: JSX.Element[] = []

  for (const event of transparentEvents) {
    const start = parseISO(event.start)
    const end = parseISO(event.end)
    const startHour = start.getHours()
    const startMinutes = start.getMinutes()
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)

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
          top: `calc(var(--hour-height, 60px) * ${startHour + startMinutes / 60})`,
          height: `calc(var(--hour-height, 60px) * ${durationMinutes / 60})`,
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
          backgroundColor: `${eventColor}20`,
        }}
      >
        <EventCard event={event} enableResize transparent hourHeight={hourHeight} />
      </div>
    )
  }

  const positionedEvents = positionEvents(sortedEvents)

  for (const { event, column, totalColumns } of positionedEvents) {
    const start = parseISO(event.start)
    const end = parseISO(event.end)

    const startHour = start.getHours()
    const startMinutes = start.getMinutes()
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)

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

      elements.push(
        <div
          key={`${event.id}-travel`}
          className={styles.travelBar}
          style={{
            top: `calc(var(--hour-height, 60px) * ${travelStartHour + travelStartMinutes / 60})`,
            height: `calc(var(--hour-height, 60px) * ${travelDurationMinutes / 60})`,
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
          top: `calc(var(--hour-height, 60px) * ${startHour + startMinutes / 60})`,
          height: `calc(var(--hour-height, 60px) * ${durationMinutes / 60})`,
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
