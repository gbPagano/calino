import type { JSX } from 'react'
import { useMemo, useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  startOfDay,
  endOfDay,
  isToday,
  parseISO,
  getISOWeek,
  addWeeks,
  addDays,
} from 'date-fns'
import type { CalendarEvent, Calendar } from '@/types'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { DEFAULT_CALENDAR_COLOR } from '@/config'
import { EventCard } from './EventCard'
import { ContextMenu } from '@/components/common/ContextMenu'
import { useGestures } from '@/hooks/useGestures'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useContextMenuStore } from '@/store/contextMenuStore'
import { hapticIfEnabled } from '@/lib/haptics'
import { formatTravelDuration } from '@/lib/events'
import styles from './WeekView.module.css'

const HOURS = eachHourOfInterval({
  start: startOfDay(new Date()),
  end: endOfDay(new Date()),
})

const BASE_HOUR_HEIGHT = 60
const MINUTE_SNAP_INTERVAL = 15

interface DroppableCellProps {
  day: Date
  hour: Date
  onClick: () => void
  onMouseDown: (e: React.MouseEvent) => void
}

function DroppableCell({ day, hour, onClick, onMouseDown }: DroppableCellProps): JSX.Element {
  const droppableId = `${format(day, 'yyyy-MM-dd')}-${format(hour, 'HH:mm')}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cell} ${isOver ? styles.dropTarget : ''}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
    />
  )
}

export function WeekView(): JSX.Element {
  const currentDate = useCalendarStore((state) => state.currentDate)
  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)
  const getEventsForDateRange = useCalendarStore((state) => state.getEventsForDateRange)
  const openModal = useCalendarStore((state) => state.openModal)
  const storeUpdateEvent = useCalendarStore((state) => state.updateEvent)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const timeFormat = useSettingsStore((state) => state.timeFormat)
  const openMenuId = useContextMenuStore((state) => state.openMenuId)
  const openMenu = useContextMenuStore((state) => state.openMenu)
  const closeMenu = useContextMenuStore((state) => state.closeMenu)

  const { updateEvent: caldavUpdateEvent } = useCalDAV()

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [isDraggingToCreate, setIsDraggingToCreate] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    day: Date
    hour?: number
  } | null>(null)
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const daysContainerRef = useRef<HTMLDivElement>(null)
  const hourHeight = BASE_HOUR_HEIGHT * scale

  useEffect(() => {
    if (openMenuId !== null && openMenuId !== 'weekview' && contextMenu) {
      setContextMenu(null)
    }
  }, [openMenuId])

  const isMobile = useIsMobile()

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      const date = parseISO(currentDate)
      let newDate: Date

      if (direction === 'left' || direction === 'right') {
        newDate = direction === 'left' ? addWeeks(date, 1) : addWeeks(date, -1)
      } else {
        newDate = direction === 'up' ? addDays(date, 7) : addDays(date, -7)
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
        distance: 8,
      },
    })
  )

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

  useEffect(() => {
    if (!isMobile) return

    const headerEl = headerScrollRef.current
    const bodyEl = bodyScrollRef.current
    if (!headerEl || !bodyEl) return

    let isSyncing = false

    const syncScroll = (source: HTMLElement, target: HTMLElement) => () => {
      if (isSyncing) return
      isSyncing = true
      target.scrollLeft = source.scrollLeft
      requestAnimationFrame(() => {
        isSyncing = false
      })
    }

    const handleHeaderScroll = syncScroll(headerEl, bodyEl)
    const handleBodyScroll = syncScroll(bodyEl, headerEl)

    headerEl.addEventListener('scroll', handleHeaderScroll)
    bodyEl.addEventListener('scroll', handleBodyScroll)

    return () => {
      headerEl.removeEventListener('scroll', handleHeaderScroll)
      bodyEl.removeEventListener('scroll', handleBodyScroll)
    }
  }, [isMobile])

  const date = parseISO(currentDate)

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek || 0 })
    const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek || 0 })
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [date, firstDayOfWeek])

  const { allDayEventsMap, eventsMap, timedFragmentsMap } = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek || 0 })
    const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek || 0 })
    const weekEvents = getEventsForDateRange(
      format(weekStart, 'yyyy-MM-dd'),
      format(weekEnd, 'yyyy-MM-dd')
    )

    const allDay = new Map<string, CalendarEvent[]>()
    const timed = new Map<string, CalendarEvent[]>()
    const timedFragments = new Map<string, CalendarEvent[]>()

    for (const event of weekEvents) {
      const eventStart = parseISO(event.start)
      const eventEnd = parseISO(event.end)
      const startKey = format(eventStart, 'yyyy-MM-dd')
      const endKey = format(eventEnd, 'yyyy-MM-dd')

      if (event.type !== 'task' && event.isAllDay) {
        allDay.set(startKey, [...(allDay.get(startKey) || []), event])
      } else if (event.type !== 'task' ? !event.isAllDay : !event.isAllDay && event.start && event.dueDate) {
        if (startKey === endKey) {
          timed.set(startKey, [...(timed.get(startKey) || []), event])
        } else {
          let currentDay = eventStart
          while (currentDay <= eventEnd) {
            const dayKey = format(currentDay, 'yyyy-MM-dd')
            const isFirst = dayKey === startKey
            const isLast = dayKey === endKey
            const fragment: CalendarEvent = {
              ...event,
              start: isFirst ? event.start : format(startOfDay(currentDay), "yyyy-MM-dd'T'HH:mm:ss"),
              end: isLast ? event.end : format(endOfDay(currentDay), "yyyy-MM-dd'T'HH:mm:ss"),
              isFragment: true,
              isFirstFragment: isFirst,
              isLastFragment: isLast,
              originalStart: event.start,
              originalEnd: event.end,
            }
            timedFragments.set(dayKey, [...(timedFragments.get(dayKey) || []), fragment])
            currentDay = addDays(currentDay, 1)
          }
        }
      }
    }

    return { allDayEventsMap: allDay, eventsMap: timed, timedFragmentsMap: timedFragments }
  }, [date, firstDayOfWeek, getEventsForDateRange, events])

  const tasksMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id)
    events
      .filter(
        (event) =>
          event.type === 'task' && event.isAllDay && visibleCalendarIds.includes(event.calendarId)
      )
      .forEach((task) => {
        const taskDate = task.dueDate
          ? format(parseISO(task.dueDate), 'yyyy-MM-dd')
          : format(parseISO(task.start), 'yyyy-MM-dd')
        const existing = map.get(taskDate) || []
        map.set(taskDate, [...existing, task])
      })
    return map
  }, [events, calendars])

  const bodyRef = useRef<HTMLDivElement>(null)
  const lastDateRef = useRef(date.toISOString())
  const hasScrolledForDate = useRef(false)

  useLayoutEffect(() => {
    if (isMobile || !bodyRef.current) return

    const currentDateStr = date.toISOString()

    if (lastDateRef.current !== currentDateStr) {
      lastDateRef.current = currentDateStr
      hasScrolledForDate.current = false
    }

    if (hasScrolledForDate.current) return

    const rafId = requestAnimationFrame(() => {
      if (!bodyRef.current) return

      const sortedAllEvents: CalendarEvent[] = []
      eventsMap.forEach((dayEvents) => {
        sortedAllEvents.push(...dayEvents)
      })

      if (sortedAllEvents.length === 0) return

      sortedAllEvents.sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
      const firstEvent = sortedAllEvents[0]
      const eventStart = parseISO(firstEvent.start)
      const hours = eventStart.getHours()
      const minutes = eventStart.getMinutes()
      const fraction = (hours * 60 + minutes) / (24 * 60)
      const scrollTop = fraction * bodyRef.current.scrollHeight - 60

      bodyRef.current.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
      hasScrolledForDate.current = true
    })

    return () => cancelAnimationFrame(rafId)
  }, [eventsMap, date, isMobile, hourHeight])

  useLayoutEffect(() => {
    if (isMobile) return

    const measure = () => {
      const body = bodyRef.current
      const container = containerRef.current
      if (!body || !container) return
      const scrollbarWidth = body.offsetWidth - body.clientWidth
      container.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`)
    }

    measure()

    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isMobile])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    setIsScrolled(e.currentTarget.scrollTop > 0)
  }

  const handleCellClick = (day: Date, hour: Date): void => {
    const hourStr = format(hour, 'HH:mm')
    openModal(`${format(day, 'yyyy-MM-dd')}T${hourStr}`)
  }

  const handleDragStartFromCell = useCallback(
    (day: Date, hour: Date, e: React.MouseEvent): void => {
      if (e.button !== 0) return
      e.preventDefault()
      const hourStr = format(hour, 'HH:mm')
      const startTime = `${format(day, 'yyyy-MM-dd')}T${hourStr}`
      setIsDraggingToCreate(true)
      setDragStart(startTime)
      setDragEnd(startTime)
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (!isDraggingToCreate || !dragStart) return

      const daysContainer = daysContainerRef.current
      if (!daysContainer) return

      const rect = daysContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const dayWidth = rect.width / 7
      const dayIndex = Math.floor(x / dayWidth)
      const y = e.clientY - rect.top

      const day = weekDays[Math.min(Math.max(dayIndex, 0), 6)]
      if (!day) return

      const totalMinutes = (y / rect.height) * 24 * 60
      const snappedMinutes = Math.round(totalMinutes / MINUTE_SNAP_INTERVAL) * MINUTE_SNAP_INTERVAL
      const hours = Math.floor(snappedMinutes / 60)
      const mins = snappedMinutes % 60
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      const endTime = `${format(day, 'yyyy-MM-dd')}T${timeStr}`
      setDragEnd(endTime)
    },
    [isDraggingToCreate, dragStart, weekDays, daysContainerRef]
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

    const startDateKey = format(start, 'yyyy-MM-dd')
    const endDateKey = format(end, 'yyyy-MM-dd')
    const startDayIndex = weekDays.findIndex((d) => format(d, 'yyyy-MM-dd') === startDateKey)
    const endDayIndex = weekDays.findIndex((d) => format(d, 'yyyy-MM-dd') === endDateKey)

    if (startDayIndex === -1 || endDayIndex === -1) return null

    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    const topPct = (startMinutes / (24 * 60)) * 100
    const heightPct = ((endMinutes - startMinutes) / (24 * 60)) * 100

    const dayWidth = 100 / 7
    const left = startDayIndex * dayWidth
    const width = (endDayIndex - startDayIndex + 1) * dayWidth

    return (
      <div
        className={styles.selectionOverlay}
        style={{
          top: `${topPct}%`,
          height: `${Math.max(heightPct, 0.5)}%`,
          left: `${left}%`,
          width: `${width}%`,
        }}
      />
    )
  }, [isDraggingToCreate, dragStart, dragEnd, weekDays])

  const renderDayEvents = (day: Date): JSX.Element[] => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayEvents = eventsMap.get(dateKey) || []
    const dayFragments = timedFragmentsMap.get(dateKey) || []
    const allDayEvents = [...dayEvents, ...dayFragments]

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
  }

  const handleDragStart = (event: DragStartEvent): void => {
    hapticIfEnabled('light')
    const eventId = event.active.id as string
    const draggedEvent = events.find((e) => e.id === eventId)
    setActiveEvent(draggedEvent || null)
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    // Defer clearing active event to avoid scroll jump
    setTimeout(() => setActiveEvent(null), 0)

    if (!over) return

    const droppableId = over.id as string
    const lastDashIndex = droppableId.lastIndexOf('-')
    const dayStr = droppableId.substring(0, lastDashIndex)
    const hourStr = droppableId.substring(lastDashIndex + 1)

    if (!dayStr || !hourStr) return

    const newStart = parseISO(`${dayStr}T${hourStr}`)

    const originalEvent = events.find((e) => e.id === active.id)
    if (!originalEvent) return

    const originalStart = parseISO(originalEvent.start)
    const originalEnd = parseISO(originalEvent.end)
    const durationMs = originalEnd.getTime() - originalStart.getTime()
    const newEnd = new Date(newStart.getTime() + durationMs)

    const updates = {
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    }

    storeUpdateEvent(active.id as string, updates)

    try {
      await caldavUpdateEvent(originalEvent.calendarId, {
        ...originalEvent,
        ...updates,
      })
    } catch {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to sync dragged event' } }))
    }
  }

  const weekNumber = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek || 0 })
    return getISOWeek(weekStart)
  }, [date, firstDayOfWeek])

  const renderMobileContent = () => (
    <div ref={mobileScrollRef} className={styles.mobileContainer}>
      <div className={styles.mobileHeader}>
        <div className={styles.weekNumberHeader}>W{weekNumber}</div>
        <div className={styles.headerDays}>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`${styles.dayHeader} ${isToday(day) ? styles.today : ''}`}
            >
              <div className={styles.dayName}>{format(day, 'EEE')}</div>
              <div className={styles.dayNumber}>{format(day, 'd')}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.mobileBody}>
        <div className={styles.timeColumn}>
          {HOURS.map((hour) => (
            <div key={hour.toISOString()} className={styles.timeCell}>
              {format(hour, timeFormat === '24h' ? 'HH:mm' : 'h a')}
            </div>
          ))}
        </div>
        <div ref={daysContainerRef} className={styles.daysContainer}>
          {weekDays.map((day) => {
            return (
              <div
                key={day.toISOString()}
                className={styles.dayColumn}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openMenu('weekview')
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const hourClicked = Math.max(0, Math.min(23, Math.floor((y / rect.height) * 24)))
                  setContextMenu({ x: e.clientX, y: e.clientY, day, hour: hourClicked })
                }}
              >
                <div className={styles.hourCells}>
                  {HOURS.map((hour) => (
                    <DroppableCell
                      key={`${day.toISOString()}-${hour.toISOString()}`}
                      day={day}
                      hour={hour}
                      onClick={() => handleCellClick(day, hour)}
                      onMouseDown={(e) => handleDragStartFromCell(day, hour, e)}
                    />
                  ))}
                </div>
                <div className={styles.eventsOverlay}>
                  {day === weekDays[0] && selectionOverlay}
                  {renderDayEvents(day)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderDesktopContent = () => {
    const allDayEventsByDay = weekDays.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd')
      return allDayEventsMap.get(dateKey) || []
    })

    return (
      <>
        <div className={`${styles.header} ${isScrolled ? styles.headerShadow : ''}`}>
          <div className={styles.weekNumberHeader}>W{weekNumber}</div>
          <div className={styles.headerDays}>
            {weekDays.map((day, idx) => {
              const dayAllDayEvents = allDayEventsByDay[idx]
              return (
                <div
                  key={day.toISOString()}
                  className={`${styles.dayHeader} ${isToday(day) ? styles.today : ''} ${dayAllDayEvents.length > 0 ? styles.hasAllDayEvents : ''}`}
                >
                  <div className={styles.dayName}>{format(day, 'EEE')}</div>
                  <div className={styles.dayNumber}>{format(day, 'd')}</div>
                  {dayAllDayEvents.length > 0 && (
                    <div className={styles.allDayEventsInHeader}>
                      {dayAllDayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={styles.allDayEvent}
                          style={{
                            backgroundColor: `${event.color || calendars.find((c) => c.id === event.calendarId)?.color || DEFAULT_CALENDAR_COLOR}20`,
                            borderLeftColor:
                              event.color ||
                              calendars.find((c) => c.id === event.calendarId)?.color ||
                              DEFAULT_CALENDAR_COLOR,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openModal(undefined, undefined, event.id)
                          }}
                        >
                          <span className={styles.allDayEventTitle}>{event.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
          <div className={styles.timeColumn}>
            {HOURS.map((hour) => (
              <div key={hour.toISOString()} className={styles.timeCell}>
                {format(hour, timeFormat === '24h' ? 'HH:mm' : 'h a')}
              </div>
            ))}
          </div>
          <div ref={daysContainerRef} className={styles.daysContainer}>
            {weekDays.map((day) => {
              return (
                <div
                  key={day.toISOString()}
                  className={styles.dayColumn}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openMenu('weekview')
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const hourClicked = Math.max(0, Math.min(23, Math.floor((y / rect.height) * 24)))
                    setContextMenu({ x: e.clientX, y: e.clientY, day, hour: hourClicked })
                  }}
                >
                  <div className={styles.hourCells}>
                    {HOURS.map((hour) => (
                      <DroppableCell
                        key={`${day.toISOString()}-${hour.toISOString()}`}
                        day={day}
                        hour={hour}
                        onClick={() => handleCellClick(day, hour)}
                        onMouseDown={(e) => handleDragStartFromCell(day, hour, e)}
                      />
                    ))}
                  </div>
                  <div className={styles.eventsOverlay}>
                    {day === weekDays[0] && selectionOverlay}
                    {renderDayEvents(day)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className={styles.container}
        ref={containerRef}
        style={{ '--hour-height': `${60 * scale}px`, touchAction: 'none' } as React.CSSProperties}
        {...bind}
      >
        {isMobile ? renderMobileContent() : renderDesktopContent()}
        {(() => {
          const tasksByDay: CalendarEvent[][] = Array(7)
            .fill(null)
            .map(() => [])
          weekDays.forEach((day, idx) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayTasks = tasksMap.get(dayKey) || []
            dayTasks.filter((t) => t.isAllDay).forEach((t) => tasksByDay[idx].push(t))
          })
          const hasTasks = tasksByDay.some((arr) => arr.length > 0)
          if (!hasTasks) return null
          return (
            <div className={styles.tasksFixedFooter}>
              <div></div>
              {tasksByDay.map((tasks, idx) => (
                <div key={idx} className={styles.tasksFixedFooterCol}>
                  {tasks.map((task) => (
                    <EventCard key={task.id} event={task} compact />
                  ))}
                </div>
              ))}
            </div>
          )
        })()}
      </div>
      <DragOverlay>{activeEvent ? <EventCard event={activeEvent} isDragging /> : null}</DragOverlay>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          menuId="weekview"
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
                    ? `T${String(contextMenu.hour).padStart(2, '0')}:00`
                    : ''
                openModal(`${format(contextMenu.day, 'yyyy-MM-dd')}${hourStr}`)
                setContextMenu(null)
              },
            },
            {
              label: 'Create task',
              onClick: () => {
                const dateStr = format(contextMenu.day, 'yyyy-MM-dd')
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
