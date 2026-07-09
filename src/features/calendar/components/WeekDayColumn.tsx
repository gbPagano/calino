import { memo } from 'react'
import type { JSX } from 'react'
import { parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useDndContext } from '@dnd-kit/core'
import type { CalendarEvent, Calendar } from '@/types'
import { EventCard } from './EventCard'
import { getEventColor } from '@/lib/eventColor'
import { formatTravelDuration } from '@/lib/events'
import { positionEvents } from '@/lib/eventPositioning'
import { positionedEventStyle, transparentEventStyle, travelBarStyle, taskPillStyle } from '../lib/eventLayout'
import { eventCardVariants } from '../lib/eventAnimations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import styles from './WeekView.module.css'

interface WeekDayColumnProps {
  events: CalendarEvent[]
  fragments: CalendarEvent[]
  timedTasks: CalendarEvent[]
  calendars: Calendar[]
  hourHeight: number
  openModal: (start?: string, endDate?: string, eventId?: string, mode?: 'event' | 'task') => void
}

const WeekDayColumn = memo(function WeekDayColumn({
  events,
  fragments,
  timedTasks,
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
  // Skip the exit animation when this event is the active drag — the
  // DragOverlay already shows the move visually, and the source exit
  // reads as a ghostly "jump back" to the original position.
  // Multi-day fragment draggables use `${event.id}::${date}` so strip
  // the date suffix to compare against `event.id`.
  const { active } = useDndContext()
  const activeMasterId = active ? active.id.toString().split('::')[0] : null
  const skipExit = (id: string): boolean => activeMasterId === id

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
        exit={skipExit(event.id) ? undefined : cardExit}
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
          exit={skipExit(event.id) ? undefined : cardExit}
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
        exit={skipExit(event.id) ? undefined : cardExit}
        transition={enterTransition}
        className={styles.eventPositioned}
        style={positionedEventStyle(event, column, totalColumns)}
      >
        <EventCard event={event} enableResize hideTopRadius={!!event.travelDuration} hourHeight={hourHeight} />
      </motion.div>
    )
  }

  // Timed tasks are anchored on the timeline at their due time as compact
  // pills (the same card used in the month/day task lists), layered above
  // events so they stay clickable. They carry no duration, so the pill sizes
  // to the card's own height rather than a duration-based block.
  for (const task of timedTasks) {
    elements.push(
      <motion.div
        key={task.id}
        variants={eventCardVariants}
        initial={cardInitial}
        animate="animate"
        exit={skipExit(task.id) ? undefined : cardExit}
        transition={enterTransition}
        className={`${styles.eventPositioned} ${styles.taskPositioned}`}
        style={taskPillStyle(task)}
      >
        <EventCard event={task} compact monthView enableResize={false} />
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
