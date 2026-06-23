import { memo } from 'react'
import type { JSX } from 'react'
import { parseISO } from 'date-fns'
import type { CalendarEvent, Calendar } from '@/types'
import { EventCard } from './EventCard'
import { getEventColor } from '@/lib/eventColor'
import { formatTravelDuration } from '@/lib/events'
import { positionEvents } from '@/lib/eventPositioning'
import { positionedEventStyle, transparentEventStyle, travelBarStyle } from '../lib/eventLayout'
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
    const eventColor = getEventColor(event, { categories: [], calendars, useCategoryColors: false })
    const style = transparentEventStyle(event, 2)

    elements.push(
      <div
        key={event.id}
        className={`${styles.eventPositioned} ${styles.eventTransparent}`}
        style={{ ...style, backgroundColor: `${eventColor}20` }}
      >
        <EventCard event={event} enableResize transparent hourHeight={hourHeight} />
      </div>
    )
  }

  const positionedEvents = positionEvents(sortedEvents)

  for (const { event, column, totalColumns } of positionedEvents) {
    const eventColor = getEventColor(event, { categories: [], calendars, useCategoryColors: false })

    if (event.travelDuration && event.travelDuration > 0) {
      elements.push(
        <div
          key={`${event.id}-travel`}
          className={styles.travelBar}
          style={{ ...travelBarStyle(event, column, totalColumns), backgroundColor: `${eventColor}15` }}
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
        style={positionedEventStyle(event, column, totalColumns)}
      >
        <EventCard event={event} enableResize hideTopRadius={!!event.travelDuration} hourHeight={hourHeight} />
      </div>
    )
  }

  return elements
})

export default WeekDayColumn
