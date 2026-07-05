import { type JSX } from 'react'
import { useMemo, useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { format, startOfDay, endOfDay, parseISO, isToday, addDays } from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { getEventColor } from '@/lib/eventColor'
import { safeCalDAVUpdate } from '@/lib/caldavHelpers'
import { EventCard } from './EventCard'
import { ContextMenu } from '@/components/common/ContextMenu'
import { useGestures } from '@/hooks/useGestures'
import { useContextMenuStore } from '@/store/contextMenuStore'
import { useWindowHeight } from '@/hooks/useWindowHeight'
import { hapticIfEnabled } from '@/lib/haptics'
import { formatTravelDuration } from '@/lib/events'
import { positionEvents } from '@/lib/eventPositioning'
import { positionedEventStyle, transparentEventStyle, travelBarStyle } from '../lib/eventLayout'
import { pad2 } from '@/lib/datetime'
import { HOURS } from '@/lib/hours'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import type { CalendarEvent } from '@/types'
import styles from './DayView.module.css'


const DRAG_ACTIVATION_CONSTRAINT = 8
const MINUTE_SNAP_INTERVAL = 15

interface HourCellProps {
  hour: Date
  dateStr: string
  timeFormat: string
  onCellClick: (hour: Date) => void
  onDragStart: (hour: Date, e: React.MouseEvent) => void
}

function HourCell({ hour, dateStr, timeFormat, onCellClick, onDragStart }: HourCellProps): JSX.Element {
  const droppableId = `${dateStr}-${format(hour, 'HH:mm')}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div className={styles.hourRow}>
      <div className={styles.timeLabel}>
        {format(hour, timeFormat === '24h' ? 'HH:mm' : 'h a')}
      </div>
      <div
        ref={setNodeRef}
        className={`${styles.cell} ${isOver ? styles.dropTarget : ''}`}
        onClick={() => onCellClick(hour)}
        onMouseDown={(e) => onDragStart(hour, e)}
      />
    </div>
  )
}

export function DayView({ selectedDate: propDate, onBack }: { selectedDate?: string; onBack?: () => void } = {}): JSX.Element {
  const storeDate = useCalendarStore((state) => state.currentDate)
  const currentDate = propDate || storeDate
  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)
  const getEventsForDateRange = useCalendarStore((state) => state.getEventsForDateRange)
  const openModal = useCalendarStore((state) => state.openModal)
  const storeUpdateEvent = useCalendarStore((state) => state.updateEvent)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const timeFormat = useSettingsStore((state) => state.timeFormat)

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [isDraggingToCreate, setIsDraggingToCreate] = useState(false)
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const openMenuId = useContextMenuStore((state) => state.openMenuId)
  const openMenu = useContextMenuStore((state) => state.openMenu)
  const closeMenu = useContextMenuStore((state) => state.closeMenu)

  const { updateEvent: caldavUpdateEvent } = useCalDAV()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hour?: number } | null>(
    null
  )
  const bodyRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventsOverlayRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const windowHeight = useWindowHeight()
  const stretchFactor = windowHeight > 1570 ? windowHeight / 1570 : 1
  const effectiveScale = scale * stretchFactor

  useEffect(() => {
    if (openMenuId !== null && openMenuId !== 'dayview' && contextMenu) {
      setContextMenu(null)
    }
  }, [openMenuId])

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      const date = parseISO(currentDate)
      let newDate: Date

      if (direction === 'left') {
        newDate = addDays(date, 1)
      } else if (direction === 'right') {
        newDate = addDays(date, -1)
      } else if (direction === 'up') {
        newDate = addDays(date, 7)
      } else {
        newDate = addDays(date, -7)
      }

      setCurrentDate(newDate.toISOString().split('T')[0])
    },
    [currentDate, setCurrentDate]
  )

  const handlePinch = useCallback((scaleValue: number) => {
    setScale(scaleValue)
  }, [])

  const { bind } = useGestures({
    onSwipe: handleSwipe,
    onPinch: handlePinch,
    swipeThreshold: 50,
    pinchScaleRange: { min: 1, max: 1.5 },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_CONSTRAINT,
      },
    })
  )

  // Prefer the droppable directly under the pointer (so dropping on the thin
  // header strip registers), falling back to rect overlap for the hour grid.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args)
  }, [])

  useEffect(() => {
    const handleWheelZoom = (e: WheelEvent): void => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setScale((s) => Math.min(Math.max(s + delta, 1), 1.5))
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheelZoom, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheelZoom)
      }
    }
  }, [])

  const date = useMemo(() => parseISO(currentDate), [currentDate])
  const dateKey = format(date, 'yyyy-MM-dd')

  // The header doubles as a drop target: dragging a timed event onto it turns
  // the event into an all-day event (the inverse of dragging a pill down).
  const { setNodeRef: setAllDayDropRef, isOver: isAllDayDropOver } = useDroppable({
    id: `allday::${dateKey}`,
  })

  const allDayEvents = useMemo(() => {
    return getEventsForDateRange(dateKey, dateKey).filter((e) => e.type !== 'task' && e.type !== 'journal' && e.isAllDay)
  }, [dateKey, getEventsForDateRange, events])

  const dayEvents = useMemo(() => {
    const eventsForDay = getEventsForDateRange(dateKey, dateKey).filter(
      (e) => e.type !== 'task' && !e.isAllDay
    )

    const fragmentedEvents: CalendarEvent[] = []

    for (const event of eventsForDay) {
      const eventStart = parseISO(event.start)
      const eventEnd = parseISO(event.end)
      const eventStartKey = format(eventStart, 'yyyy-MM-dd')
      const eventEndKey = format(eventEnd, 'yyyy-MM-dd')

      if (eventStartKey === eventEndKey) {
        fragmentedEvents.push(event)
      } else {
        const isFirst = eventStartKey === dateKey
        const isLast = eventEndKey === dateKey

        const fragment: CalendarEvent = {
          ...event,
          start: isFirst ? event.start : format(startOfDay(date), "yyyy-MM-dd'T'HH:mm:ss"),
          end: isLast ? event.end : format(endOfDay(date), "yyyy-MM-dd'T'HH:mm:ss"),
          isFragment: true,
          isFirstFragment: isFirst,
          isLastFragment: isLast,
          originalStart: event.start,
          originalEnd: event.end,
        }
        fragmentedEvents.push(fragment)
      }
    }

    return fragmentedEvents
  }, [dateKey, date, getEventsForDateRange, events])

  const dayTasks = useMemo(() => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id)
    return events.filter(
      (e) =>
        e.type === 'task' &&
        visibleCalendarIds.includes(e.calendarId) &&
        (e.dueDate
          ? format(parseISO(e.dueDate), 'yyyy-MM-dd') === dateKey
          : format(parseISO(e.start), 'yyyy-MM-dd') === dateKey)
    )
  }, [date, events, calendars])

  const [isScrolled, setIsScrolled] = useState(false)
  const lastDateRef = useRef(date.toISOString())
  const hasScrolledForDate = useRef(false)

  useLayoutEffect(() => {
    if (!bodyRef.current) return

    const currentDateStr = date.toISOString()

    if (lastDateRef.current !== currentDateStr) {
      lastDateRef.current = currentDateStr
      hasScrolledForDate.current = false
    }

    if (hasScrolledForDate.current) return

    const rafId = requestAnimationFrame(() => {
      if (!bodyRef.current) return

      const scrollToNow = isToday(date)

      if (scrollToNow) {
        // Scroll to current time with 2h padding above
        const now = new Date()
        const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
        const fraction = minutesSinceMidnight / (24 * 60)
        const scrollTop = fraction * bodyRef.current.scrollHeight - bodyRef.current.clientHeight * 0.3
        bodyRef.current.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
      } else if (dayEvents.length > 0) {
        // Scroll to first event
        const sortedEvents = [...dayEvents].sort(
          (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
        )
        const firstEvent = sortedEvents[0]
        const eventStart = parseISO(firstEvent.start)
        const hours = eventStart.getHours()
        const minutes = eventStart.getMinutes()
        const fraction = (hours * 60 + minutes) / (24 * 60)
        const scrollTop = fraction * bodyRef.current.scrollHeight - 60
        bodyRef.current.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
      }

      hasScrolledForDate.current = true
    })

    return () => cancelAnimationFrame(rafId)
  }, [dayEvents, date])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    setIsScrolled(e.currentTarget.scrollTop > 0)
  }

  const handleCellClick = useCallback(
    (hour: Date): void => {
      const hourStr = format(hour, 'HH:mm')
      openModal(`${format(date, 'yyyy-MM-dd')}T${hourStr}`)
    },
    [date, openModal]
  )

  const handleDragStartFromCell = useCallback(
    (hour: Date, e: React.MouseEvent): void => {
      if (e.button !== 0) return
      e.preventDefault()
      const hourStr = format(hour, 'HH:mm')
      const startTime = `${format(date, 'yyyy-MM-dd')}T${hourStr}`
      setIsDraggingToCreate(true)
      setDragStart(startTime)
      setDragEnd(startTime)
    },
    [date]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (!isDraggingToCreate || !dragStart) return

      const overlay = eventsOverlayRef.current
      if (!overlay) return

      const rect = overlay.getBoundingClientRect()
      const y = e.clientY - rect.top
      const totalMinutes = (y / rect.height) * 24 * 60
      const snappedMinutes = Math.round(totalMinutes / MINUTE_SNAP_INTERVAL) * MINUTE_SNAP_INTERVAL
      const hours = Math.floor(snappedMinutes / 60)
      const mins = snappedMinutes % 60
      const timeStr = `${pad2(hours)}:${pad2(mins)}`
      const endTime = `${format(date, 'yyyy-MM-dd')}T${timeStr}`
      setDragEnd(endTime)
    },
    [isDraggingToCreate, dragStart, date]
  )

  const handleMouseUp = useCallback((): void => {
    if (!isDraggingToCreate || !dragStart || !dragEnd) return

    const startDateTime = parseISO(dragStart)
    const endDateTime = parseISO(dragEnd)

    if (endDateTime <= startDateTime) {
      setIsDraggingToCreate(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }

    const startDateStr = format(startDateTime, 'yyyy-MM-dd')
    const startTimeStr = format(startDateTime, 'HH:mm')
    const endDateStr = format(endDateTime, 'yyyy-MM-dd')
    const endTimeStr = format(endDateTime, 'HH:mm')

    const selectedDate = `${startDateStr}T${startTimeStr}`
    const endDateTimeStr = `${endDateStr}T${endTimeStr}`
    openModal(selectedDate, endDateTimeStr)

    setIsDraggingToCreate(false)
    setDragStart(null)
    setDragEnd(null)
  }, [isDraggingToCreate, dragStart, dragEnd, openModal])

  const selectionOverlay = useMemo(() => {
    if (!isDraggingToCreate || !dragStart || !dragEnd) return null

    const start = parseISO(dragStart)
    const end = parseISO(dragEnd)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
        return (
      <div
        className={styles.selectionOverlay}
        style={{ top: `calc(var(--hour-height, 60px) * ${startMinutes / 60})`, height: `calc(var(--hour-height, 60px) * ${Math.max((endMinutes - startMinutes) / 60, 0.1)})` }}
      />
    )
  }, [isDraggingToCreate, dragStart, dragEnd])

  const handleDragStart = (event: DragStartEvent): void => {
    hapticIfEnabled('light')
    const eventId = String(event.active.id)
    const draggedEvent = events.find((e) => e.id === eventId)
    setActiveEvent(draggedEvent || null)
  }

  const handleDragEnd = async (dragEvent: DragEndEvent): Promise<void> => {
    const { active, over } = dragEvent
    setActiveEvent(null)

    if (!over) return

    const droppableId = String(over.id)

    // Dropped on the header → convert a timed event into an all-day event.
    if (droppableId.startsWith('allday::')) {
      const dayStr = droppableId.slice('allday::'.length)
      const originalEvent = events.find((e) => e.id === active.id)
      if (!originalEvent || originalEvent.isAllDay) return

      const allDayUpdates = {
        start: `${dayStr}T00:00:00`,
        end: `${dayStr}T00:00:00`,
        isAllDay: true,
      }
      storeUpdateEvent(String(active.id), allDayUpdates)
      await safeCalDAVUpdate(
        caldavUpdateEvent,
        originalEvent.calendarId,
        { ...originalEvent, ...allDayUpdates },
        allDayUpdates,
        'Failed to sync dragged event'
      )
      return
    }

    const lastDashIndex = droppableId.lastIndexOf('-')
    const dayStr = droppableId.substring(0, lastDashIndex)
    const hourStr = droppableId.substring(lastDashIndex + 1)

    if (!dayStr || !hourStr) return

    const newStart = parseISO(`${dayStr}T${hourStr}`)
    const originalEvent = events.find((e) => e.id === active.id)
    if (!originalEvent) return

    // Dragging an all-day event into the timed grid turns it into a regular
    // timed event: default it to a 1-hour block starting at the drop time.
    // Otherwise preserve the event's existing duration.
    let updates: { start: string; end: string; isAllDay?: boolean }
    if (originalEvent.isAllDay) {
      const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000)
      updates = {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        isAllDay: false,
      }
    } else {
      const originalStart = parseISO(originalEvent.start)
      const originalEnd = parseISO(originalEvent.end)
      const durationMs = originalEnd.getTime() - originalStart.getTime()
      const newEnd = new Date(newStart.getTime() + durationMs)
      updates = {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      }
    }

    storeUpdateEvent(String(active.id), updates)

    await safeCalDAVUpdate(
      caldavUpdateEvent,
      originalEvent.calendarId,
      { ...originalEvent, ...updates },
      updates,
      'Failed to sync dragged event'
    )
  }

  const renderEvents = (): JSX.Element[] => {
    const sortedEvents = [...dayEvents].sort(
      (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
    )

    const transparentEvents = sortedEvents.filter((e) => e.transparency === 'transparent')

    const elements: JSX.Element[] = []

    for (const event of transparentEvents) {
      const eventColor = getEventColor(event, { categories: [], calendars, useCategoryColors: false })
      const style = transparentEventStyle(event, 4)

      elements.push(
        <div
          key={event.id}
          className={`${styles.eventPositioned} ${styles.eventTransparent}`}
          style={{ ...style, backgroundColor: `${eventColor}20` }}
        >
          <EventCard event={event} transparent />
        </div>
      )
    }

    const positionedEvents = positionEvents(sortedEvents)

    for (const { event, column, totalColumns } of positionedEvents) {
      const eventColor = getEventColor(event, { categories: [], calendars, useCategoryColors: false })
      const style = positionedEventStyle(event, column, totalColumns)

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
          style={{ ...style, zIndex: event.isFragment ? 1 : 2 }}
        >
          <EventCard event={event} hideTopRadius={!!event.travelDuration} />
        </div>
      )
    }

    return elements
  }

  const isCurrentDay = isToday(date)
  const dateStr = format(date, 'yyyy-MM-dd')

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className={styles.container}
        ref={containerRef}
        style={{ '--hour-height': `${60 * effectiveScale}px`, touchAction: 'none' } as React.CSSProperties}
        onContextMenu={(e) => {
          e.preventDefault()
          openMenu('dayview')
          const bodyRect = bodyRef.current?.getBoundingClientRect()
          const bodyTop = bodyRect?.top ?? e.currentTarget.getBoundingClientRect().top
          const bodyHeight = bodyRect?.height ?? 24 * 60 * effectiveScale
          const y = e.clientY - bodyTop
          const hourClicked = Math.max(0, Math.min(23, Math.floor((y / bodyHeight) * 24)))
          setContextMenu({ x: e.clientX, y: e.clientY, hour: hourClicked })
        }}
        {...bind}
      >
        <div
          ref={setAllDayDropRef}
          className={`${styles.header} ${isScrolled ? styles.headerShadow : ''} ${allDayEvents.length > 0 ? styles.hasAllDayEvents : ''} ${isAllDayDropOver && activeEvent && !activeEvent.isAllDay ? styles.headerDropActive : ''}`}
        >
          {onBack && (
            <button className={styles.backButton} onClick={onBack} aria-label="Back to agenda">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div className={styles.dayInfo}>
            <div className={styles.dayName}>{format(date, 'EEEE')}</div>
            <div className={`${styles.dayNumber} ${isCurrentDay ? styles.today : ''}`}>
              {format(date, 'd')}
            </div>
            {allDayEvents.length > 0 && (
              <div className={styles.allDayEventsInHeader}>
                {allDayEvents.map((event) => (
                  <EventCard key={event.id} event={event} compact monthView enableResize={false} />
                ))}
              </div>
            )}
            {dayTasks.length > 0 && (
              <div className={styles.allDayEventsInHeader}>
                {dayTasks.map((task) => (
                  <EventCard key={task.id} event={task} compact monthView enableResize={false} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          ref={bodyRef}
          className={styles.body}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onScroll={handleScroll}
        >
          {HOURS.map((hour) => (
            <HourCell
              key={hour.toISOString()}
              hour={hour}
              dateStr={dateStr}
              timeFormat={timeFormat}
              onCellClick={handleCellClick}
              onDragStart={handleDragStartFromCell}
            />
          ))}
          <div ref={eventsOverlayRef} className={styles.eventsOverlay}>
            {selectionOverlay}
            {renderEvents()}
            {isCurrentDay && (
              <CurrentTimeIndicator hourHeight={60 * effectiveScale} timeFormat={timeFormat} />
            )}
          </div>
        </div>
      </div>
      <DragOverlay>{activeEvent ? <EventCard event={activeEvent} isDragging /> : null}</DragOverlay>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          menuId="dayview"
          onClose={() => {
            closeMenu()
            setContextMenu(null)
          }}
          items={[
            {
              label: 'Create event',
              onClick: () => {
                const hourStr =
                  contextMenu.hour !== undefined
                    ? `T${pad2(contextMenu.hour)}:00`
                    : ''
                openModal(`${format(date, 'yyyy-MM-dd')}${hourStr}`)
                setContextMenu(null)
              },
            },
            {
              label: 'Create task',
              onClick: () => {
                const dateStr = format(date, 'yyyy-MM-dd')
                openModal(dateStr, undefined, undefined, 'task')
                setContextMenu(null)
              },
            },
          ]}
        />
      )}
    </DndContext>
  )
}
