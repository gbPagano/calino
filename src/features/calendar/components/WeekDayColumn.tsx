import { memo } from 'react'
import type { JSX } from 'react'
import { parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import type { CalendarEvent, Calendar } from '@/types'
import { EventCard } from './EventCard'
import { getEventColor } from '@/lib/eventColor'
import { formatTravelDuration } from '@/lib/events'
import { positionEvents } from '@/lib/eventPositioning'
import { positionedEventStyle, transparentEventStyle, travelBarStyle } from '../lib/eventLayout'
import { eventCardVariants } from '../lib/eventAnimations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
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
}: WeekDayColumnProps): JSX.Element {
  const reducedMotion = useReducedMotion()
  const enterTransition = { duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' as const }
  // Reduced-motion handling matches the DayView / DayEventsPopup
  // pattern: skip the `initial` state entirely, opacity-only exit.
  const cardInitial = reducedMotion ? false : 'initial'
  const cardExit = reducedMotion ? { opacity: 0 } : 'exit'

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
      <motion.div
        key={event.id}
        variants={eventCardVariants}
        initial={cardInitial}
        animate="animate"
        exit={cardExit}
        transition={enterTransition}
        className={`${styles.eventPositioned} ${styles.eventTransparent}`}
        style={{ ...style, backgroundColor: `${eventColor}20` }}
      >
        <EventCard event={event} enableResize transparent hourHeight={hourHeight} />
      </motion.div>
    )
  }

  const positionedEvents = positionEvents(sortedEvents)

  for (const { event, column, totalColumns } of positionedEvents) {
    const eventColor = getEventColor(event, { categories: [], calendars, useCategoryColors: false })

    if (event.travelDuration && event.travelDuration > 0) {
      elements.push(
        <motion.div
          key={`${event.id}-travel`}
          variants={eventCardVariants}
          initial={cardInitial}
          animate="animate"
          exit={cardExit}
          transition={enterTransition}
          className={styles.travelBar}
          style={{ ...travelBarStyle(event, column, totalColumns), backgroundColor: `${eventColor}15` }}
          onClick={() => openModal(undefined, undefined, event.id)}
        >
          <span className={styles.travelBarInner}>
            {formatTravelDuration(event.travelDuration)} travel
          </span>
        </motion.div>
      )
    }

    elements.push(
      <motion.div
        key={event.id}
        variants={eventCardVariants}
        initial={cardInitial}
        animate="animate"
        exit={cardExit}
        transition={enterTransition}
        className={styles.eventPositioned}
        style={positionedEventStyle(event, column, totalColumns)}
      >
        <EventCard event={event} enableResize hideTopRadius={!!event.travelDuration} hourHeight={hourHeight} />
      </motion.div>
    )
  }

  // `initial={false}` on AnimatePresence: only animate children that
  // join later (create, undo). Children that leave (delete) animate
  // out. Without this, the first mount animates every visible event
  // AND exit animations get confused with re-mounts.
  return <AnimatePresence initial={false}>{elements}</AnimatePresence>
})

export default WeekDayColumn
