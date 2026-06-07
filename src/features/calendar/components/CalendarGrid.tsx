import type { JSX } from 'react'
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  getISOWeek,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  startOfDay,
  endOfDay,
  addDays,
} from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { useIsMobile } from '@/hooks/useIsMobile'
import { safeCalDAVUpdate } from '@/lib/caldavHelpers'
import { EventCard } from './EventCard'
import { DayEventsPopup } from './DayEventsPopup'
import { ContextMenu } from '@/components/common/ContextMenu'
import { useGestures } from '@/hooks/useGestures'
import { hapticIfEnabled } from '@/lib/haptics'
import { useIsTallWindow, useIsWideWindow } from '@/hooks/useWindowHeight'
import { AgendaView } from './AgendaView'
import { DayView } from './DayView'
import type { CalendarEvent, ViewType } from '@/types'
import { getJournalDates } from '@/store/calendarStore'
import { JournalDayModal } from './JournalDayModal'
import styles from './CalendarGrid.module.css'

const VIEW_ROUTES: Record<ViewType, string> = {
  month: '/month',
  week: '/week',
  day: '/day',
  agenda: '/agenda',
  todo: '/tasks',
  journal: '/journal',
}

export function CalendarGrid(): JSX.Element {
  const currentDate = useCalendarStore((state) => state.currentDate)
  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)
  const categories = useCalendarStore((state) => state.categories)
  const selectedCategoryIds = useCalendarStore((state) => state.selectedCategoryIds)
  const selectedCategoryNames = useMemo(() =>
    selectedCategoryIds.length > 0
      ? categories
          .filter((c) => selectedCategoryIds.includes(c.id))
          .map((c) => c.name)
      : [],
    [selectedCategoryIds, categories]
  )
  const getEventsForDateRange = useCalendarStore((state) => state.getEventsForDateRange)
  const openModal = useCalendarStore((state) => state.openModal)
  const storeUpdateEvent = useCalendarStore((state) => state.updateEvent)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const setCurrentView = useCalendarStore((state) => state.setCurrentView)
  const isOverlayOpen = useCalendarStore((state) => state.isOverlayOpen)
  const navigate = useNavigate()
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const compactRecurringEvents = useSettingsStore((state) => state.compactRecurringEvents ?? false)
  const compressPastWeeks = useSettingsStore((state) => state.compressPastWeeks ?? false)
  const monthViewEventLimit = useSettingsStore((state) => state.monthViewEventLimit ?? 3)
  const showWeekNumbers = useSettingsStore((state) => state.showWeekNumbers)
  const hideCompletedTasksInMonthView = useSettingsStore(
    (state) => state.hideCompletedTasksInMonthView ?? true
  )

  const { updateEvent: caldavUpdateEvent } = useCalDAV()

  const { bind } = useGestures({
    onSwipe: (direction) => {
      if (direction === 'down' || direction === 'up') {
        changeMonth(direction)
      }
    },
    onPinch: (scaleValue) => {
      setScale(scaleValue)
    },
    swipeThreshold: 50,
    pinchScaleRange: { min: 1, max: 1.5 },
  })

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const draggedEventRef = useRef<CalendarEvent | null>(null)
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
  const [scale, setScale] = useState(1)
  const isMobile = useIsMobile()
  const isTallWindow = useIsTallWindow()
  const isWideWindow = useIsWideWindow()
  const [bottomPanelDay, setBottomPanelDay] = useState<string | null>(null)
  const [splitRatio, setSplitRatio] = useState(0.65)
  const [gridRatio, setGridRatio] = useState(0.6)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDateRef = useRef(currentDate)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track active resize listeners for cleanup on unmount
  const resizeCleanupRef = useRef<(() => void) | null>(null)
  // Journal day modal state
  const [journalModalDate, setJournalModalDate] = useState<string | null>(null)
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false)

  useEffect(() => {
    currentDateRef.current = currentDate
  }, [currentDate])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Clean up resize listeners on unmount
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.()
    }
  }, [])

  const changeMonth = useCallback(
    (direction: 'up' | 'down') => {
      // Read directly from the store to avoid lagging ref values
      const currentDate = useCalendarStore.getState().currentDate
      if (direction === 'down') {
        setCurrentDate(format(addMonths(parseISO(currentDate), 1), 'yyyy-MM-dd'))
      } else if (direction === 'up') {
        setCurrentDate(format(subMonths(parseISO(currentDate), 1), 'yyyy-MM-dd'))
      }
    },
    [setCurrentDate]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent): void => {
      if (e.ctrlKey) {
        // Zoom: Ctrl+scroll on the calendar grid
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setScale((s) => Math.min(Math.max(s + delta, 1), 1.5))
        return
      }

      // Month navigation: scroll on the calendar grid (not window, to avoid blocking page scroll)
      if (isOverlayOpen) return
      if (scrollCooldownRef.current) return
      if (Math.abs(e.deltaY) < 20) return

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      const direction = e.deltaY > 0 ? 'down' : 'up'
      setScrollDirection(direction)

      scrollCooldownRef.current = setTimeout(() => {
        scrollCooldownRef.current = null
      }, 400)

      scrollTimeoutRef.current = setTimeout(() => {
        changeMonth(direction)
        setScrollDirection(null)
      }, 0)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (scrollCooldownRef.current) {
        clearTimeout(scrollCooldownRef.current)
      }
    }
  }, [changeMonth, isOverlayOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isOverlayOpen) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const direction = e.key === 'ArrowDown' ? 'down' : 'up'
        changeMonth(direction)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (scrollCooldownRef.current) {
        clearTimeout(scrollCooldownRef.current)
      }
    }
  }, [changeMonth, isOverlayOpen])

  const handleDragStart = (event: DragStartEvent): void => {
    hapticIfEnabled('light')
    const eventId = String(event.active.id)
    const draggedEvent = events.find((e) => e.id === eventId)
    draggedEventRef.current = draggedEvent || null
    setActiveEvent(draggedEvent || null)
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    setActiveEvent(null)

    if (!over) return

    const droppableId = String(over.id)
    const dayStr = droppableId

    if (!dayStr) return

    const originalEvent = draggedEventRef.current
    draggedEventRef.current = null
    if (!originalEvent) return

    const originalStart = parseISO(originalEvent.start)
    const originalEnd = parseISO(originalEvent.end)
    const durationMs = originalEnd.getTime() - originalStart.getTime()

    const hours = originalStart.getHours().toString().padStart(2, '0')
    const minutes = originalStart.getMinutes().toString().padStart(2, '0')
    const newStart = parseISO(`${dayStr}T${hours}:${minutes}:00`)
    const newEnd = new Date(newStart.getTime() + durationMs)

    const isTask = originalEvent.type === 'task'

    // For tasks, preserve the time in dueDate if it exists
    let newDueDate = dayStr
    if (isTask && originalEvent.dueDate) {
      const originalDueDate = parseISO(originalEvent.dueDate)
      const hasTime =
        originalEvent.dueDate.includes('T') &&
        !originalEvent.dueDate.endsWith('T00:00:00') &&
        !originalEvent.dueDate.endsWith('T00:00')

      if (hasTime) {
        const timeHours = originalDueDate.getHours().toString().padStart(2, '0')
        const timeMinutes = originalDueDate.getMinutes().toString().padStart(2, '0')
        newDueDate = `${dayStr}T${timeHours}:${timeMinutes}:00`
      }
    }

    const updates = {
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
      ...(isTask && { dueDate: newDueDate }),
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

  const weekdays = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const idx = firstDayOfWeek || 0
    return [...days.slice(idx), ...days.slice(0, idx)]
  }, [firstDayOfWeek])

  const date = parseISO(currentDate)

  const days = useMemo(() => {
    const monthStart = startOfMonth(date)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek })
    const calendarEnd = endOfWeek(endOfMonth(date), { weekStartsOn: firstDayOfWeek })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [date, firstDayOfWeek])

  const numWeeks = Math.floor(days.length / 7)

  const weekNumbers = useMemo(() => {
    return Array.from({ length: numWeeks }, (_, i) => getISOWeek(days[i * 7]))
  }, [numWeeks, days])

  const eventsMap = useMemo(() => {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const monthEvents = getEventsForDateRange(
      format(monthStart, 'yyyy-MM-dd'),
      format(monthEnd, 'yyyy-MM-dd')
    )

    const map = new Map<string, CalendarEvent[]>()
    monthEvents
      .filter((event) => event.type !== 'task' && event.type !== 'journal')
      .forEach((event) => {
        const eventStart = parseISO(event.start)
        const eventEnd = parseISO(event.end)
        const startKey = format(eventStart, 'yyyy-MM-dd')
        const endKey = format(eventEnd, 'yyyy-MM-dd')

        if (startKey === endKey) {
          const eventDate = format(eventStart, 'yyyy-MM-dd')
          const existing = map.get(eventDate) || []
          map.set(eventDate, [...existing, event])
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
            const dayEvents = map.get(dayKey) || []
            map.set(dayKey, [...dayEvents, fragment])
            currentDay = addDays(currentDay, 1)
          }
        }
      })

    map.forEach((events, dateKey) => {
      const sorted = [...events].sort((a, b) => {
        if (a.isFragment && !b.isFragment) return -1
        if (!a.isFragment && b.isFragment) return 1
        return new Date(a.start).getTime() - new Date(b.start).getTime()
      })
      map.set(dateKey, sorted)
    })

    return map
  }, [date, events, calendars, selectedCategoryNames, getEventsForDateRange])

  const tasksMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id)
    const taskCalendarsWithTasks = calendars
      .filter((c) => c.showTasksInViews !== false)
      .map((c) => c.id)
    events
      .filter(
        (event) =>
          event.type === 'task' &&
          visibleCalendarIds.includes(event.calendarId) &&
          taskCalendarsWithTasks.includes(event.calendarId) &&
          !(hideCompletedTasksInMonthView && event.completed) &&
          (selectedCategoryNames.length === 0 || event.categories?.some((c) => selectedCategoryNames.includes(c)))
      )
      .forEach((task) => {
        const taskDate = task.dueDate
          ? format(parseISO(task.dueDate), 'yyyy-MM-dd')
          : format(parseISO(task.start), 'yyyy-MM-dd')
        const existing = map.get(taskDate) || []
        map.set(taskDate, [...existing, task])
      })
    return map
  }, [events, calendars, hideCompletedTasksInMonthView, selectedCategoryNames])

  const journalDates = useMemo(() => getJournalDates(events), [events])

  const handleGridResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    // Clean up any previous resize
    resizeCleanupRef.current?.()
    const startY = e.clientY
    const startRatio = gridRatio
    const containerHeight = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().height
    const onMove = (ev: MouseEvent): void => {
      const delta = (ev.clientY - startY) / containerHeight
      setGridRatio(Math.min(0.85, Math.max(0.35, startRatio + delta)))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeCleanupRef.current = null
    }
    resizeCleanupRef.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleResizeStart = (e: React.MouseEvent): void => {
    e.preventDefault()
    // Clean up any previous resize
    resizeCleanupRef.current?.()
    const startX = e.clientX
    const startRatio = splitRatio
    const containerWidth = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width
    const onMove = (ev: MouseEvent): void => {
      const delta = (ev.clientX - startX) / containerWidth
      setSplitRatio(Math.min(0.85, Math.max(0.25, startRatio + delta)))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeCleanupRef.current = null
    }
    resizeCleanupRef.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleDayClick = (day: Date): void => {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isTallWindow) {
      setBottomPanelDay((prev) => (prev === dateStr ? null : dateStr))
    } else {
      openModal(dateStr)
    }
  }

  const handleDayDoubleClick = (day: Date): void => {
    setCurrentDate(format(day, 'yyyy-MM-dd'))
    setCurrentView('day')
    navigate(VIEW_ROUTES.day, { replace: true })
  }

  const handleDayNumberClick = (day: Date): void => {
    setCurrentDate(format(day, 'yyyy-MM-dd'))
    setCurrentView('day')
    navigate(VIEW_ROUTES.day, { replace: true })
  }

  const handleWeekClick = (weekStart: Date): void => {
    setCurrentDate(format(weekStart, 'yyyy-MM-dd'))
    setCurrentView('week')
    navigate(VIEW_ROUTES.week, { replace: true })
  }

  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return

      const touchEndY = e.changedTouches[0].clientY
      const diff = touchStartY.current - touchEndY

      if (Math.abs(diff) > 50) {
        changeMonth(diff > 0 ? 'up' : 'down')
      }

      touchStartY.current = null
    },
    [changeMonth]
  )

  const rowHeight = Math.round(100 * scale)

  if (isTallWindow) {
    return (
      <>
      <div className={styles.splitContainer}>
        <div className={styles.gridTop} style={{ flex: `0 0 ${gridRatio * 100}%`, maxHeight: 800 * gridRatio / 0.6 }}>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className={styles.gridPanel} ref={containerRef} {...bind} style={{ touchAction: 'none' as const }}>
              <div
                className={styles.grid}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{ '--day-cell-height': `${rowHeight}px` } as React.CSSProperties}
              >
              <div className={`${styles.header} ${!showWeekNumbers ? styles.headerNoWeekNum : ''}`}>
                {showWeekNumbers && <div className={styles.weekNumHeader}>W#</div>}
                {weekdays.map((day) => (
                  <div key={day} className={styles.weekday}>
                    {day}
                  </div>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentDate}
                  className={styles.daysContainer}
                  initial={{ opacity: 0, y: scrollDirection === 'down' ? -10 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: scrollDirection === 'down' ? 10 : -10 }}
                  transition={{ duration: 0.1 }}
                >
                  {weekNumbers.map((weekNum, weekIdx) => {
                    const weekEnd = days[weekIdx * 7 + 6]
                    const today = startOfDay(new Date())
                    const isPastWeek = compressPastWeeks && isBefore(weekEnd, today)

                    return (
                      <div
                        key={weekIdx}
                        className={`${styles.weekRow} ${!showWeekNumbers ? styles.weekRowNoWeekNum : ''} ${isPastWeek ? styles.compressedWeek : ''}`}
                      >
                        {showWeekNumbers && (
                          <div
                            className={styles.weekNumber}
                            onClick={() => handleWeekClick(days[weekIdx * 7])}
                          >
                            {weekNum}
                          </div>
                        )}
                        {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                          const dateKey = format(day, 'yyyy-MM-dd')
                          const dayEvents = eventsMap.get(dateKey) || []
                          const dayTasks = tasksMap.get(dateKey) || []
                          const isCurrentMonth = isSameMonth(day, date)
                          const isTodayDate = isToday(day)
                          const dayOfWeek = getDay(day)
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                          return (
                            <DroppableDay
                              key={dateKey}
                              dateKey={dateKey}
                              day={day}
                              dayEvents={dayEvents}
                              dayTasks={dayTasks}
                              hasJournal={journalDates.has(dateKey)}
                              isCurrentMonth={isCurrentMonth}
                              isTodayDate={isTodayDate}
                              isWeekend={isWeekend}
                              isPastWeek={isPastWeek}
                              compactRecurringEvents={compactRecurringEvents}
                              monthViewEventLimit={monthViewEventLimit}
                              isMobile={isMobile}
                              onDayClick={handleDayClick}
                              onDayDoubleClick={handleDayDoubleClick}
                              onDayNumberClick={handleDayNumberClick}
                              onJournalIndicatorClick={(day) => {
                                setJournalModalDate(format(day, 'yyyy-MM-dd'))
                                setIsJournalModalOpen(true)
                              }}
                              onOpenJournalModal={(date) => {
                                setJournalModalDate(date)
                                setIsJournalModalOpen(true)
                              }}
                              openModal={openModal}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
            </div>
            <DragOverlay>{activeEvent ? <EventCard event={activeEvent} /> : null}</DragOverlay>
          </DndContext>
        </div>
        <div className={styles.splitHandleH} onMouseDown={handleGridResizeStart} />
        <div className={styles.agendaBottom} style={{ flex: 1 }}>
          {bottomPanelDay ? (
            isWideWindow ? (
              <>
                <div className={styles.splitDay} style={{ flex: `0 0 ${splitRatio * 100}%` }}><DayView key={bottomPanelDay} selectedDate={bottomPanelDay} /></div>
                <div className={styles.splitHandle} onMouseDown={handleResizeStart} />
                <div className={styles.splitAgenda} style={{ flex: 1 }}><AgendaView embedded /></div>
              </>
            ) : (
              <DayView key={bottomPanelDay} selectedDate={bottomPanelDay} />
            )
          ) : (
            <AgendaView embedded />
          )}
        </div>
      </div>
      {isJournalModalOpen && journalModalDate && (
        <JournalDayModal
          isOpen={isJournalModalOpen}
          date={journalModalDate}
          onClose={() => {
            setIsJournalModalOpen(false)
            setJournalModalDate(null)
          }}
        />
      )}
    </>
    )
  }

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.gridPanel} ref={containerRef} {...bind} style={{ touchAction: 'none' as const }}>
        <div
          className={styles.grid}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ '--day-cell-height': `${rowHeight}px` } as React.CSSProperties}
        >
        <div className={`${styles.header} ${!showWeekNumbers ? styles.headerNoWeekNum : ''}`}>
          {showWeekNumbers && <div className={styles.weekNumHeader}>W#</div>}
          {weekdays.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDate}
            className={styles.daysContainer}
            initial={{ opacity: 0, y: scrollDirection === 'down' ? -10 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: scrollDirection === 'down' ? 10 : -10 }}
            transition={{ duration: 0.1 }}
          >
            {weekNumbers.map((weekNum, weekIdx) => {
              const weekEnd = days[weekIdx * 7 + 6]
              const today = startOfDay(new Date())
              const isPastWeek = compressPastWeeks && isBefore(weekEnd, today)

              return (
                <div
                  key={weekIdx}
                  className={`${styles.weekRow} ${!showWeekNumbers ? styles.weekRowNoWeekNum : ''} ${isPastWeek ? styles.compressedWeek : ''}`}
                >
                  {showWeekNumbers && (
                    <div
                      className={styles.weekNumber}
                      onClick={() => handleWeekClick(days[weekIdx * 7])}
                    >
                      {weekNum}
                    </div>
                  )}
                  {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayEvents = eventsMap.get(dateKey) || []
                    const dayTasks = tasksMap.get(dateKey) || []
                    const isCurrentMonth = isSameMonth(day, date)
                    const isTodayDate = isToday(day)
                    const dayOfWeek = getDay(day)
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                    return (
                      <DroppableDay
                        key={dateKey}
                        dateKey={dateKey}
                        day={day}
                        dayEvents={dayEvents}
                        dayTasks={dayTasks}
                        hasJournal={journalDates.has(dateKey)}
                        isCurrentMonth={isCurrentMonth}
                        isTodayDate={isTodayDate}
                        isWeekend={isWeekend}
                        isPastWeek={isPastWeek}
                        compactRecurringEvents={compactRecurringEvents}
                        monthViewEventLimit={monthViewEventLimit}
                        isMobile={isMobile}
                        onDayClick={handleDayClick}
                        onDayDoubleClick={handleDayDoubleClick}
                        onDayNumberClick={handleDayNumberClick}
                        onJournalIndicatorClick={(day) => {
                          setJournalModalDate(format(day, 'yyyy-MM-dd'))
                          setIsJournalModalOpen(true)
                        }}
                        onOpenJournalModal={(date) => {
                          setJournalModalDate(date)
                          setIsJournalModalOpen(true)
                        }}
                        openModal={openModal}
                      />
                    )
                  })}
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
      <DragOverlay>{activeEvent ? <EventCard event={activeEvent} /> : null}</DragOverlay>
    </DndContext>
    {isJournalModalOpen && journalModalDate && (
      <JournalDayModal
        isOpen={isJournalModalOpen}
        date={journalModalDate}
        onClose={() => {
          setIsJournalModalOpen(false)
          setJournalModalDate(null)
        }}
      />
    )}
    </>
  )
}

interface DroppableDayProps {
  dateKey: string
  day: Date
  dayEvents: CalendarEvent[]
  dayTasks: CalendarEvent[]
  hasJournal: boolean
  isCurrentMonth: boolean
  isTodayDate: boolean
  isWeekend: boolean
  isPastWeek: boolean
  compactRecurringEvents: boolean
  monthViewEventLimit: number
  isMobile: boolean
  onDayClick: (day: Date) => void
  onDayDoubleClick: (day: Date) => void
  onDayNumberClick: (day: Date) => void
  onJournalIndicatorClick: (day: Date) => void
  onOpenJournalModal: (date: string) => void
  openModal: (date?: string, endDate?: string, eventId?: string, mode?: 'event' | 'task') => void
}

const DroppableDay = React.memo(function DroppableDay({
  dateKey,
  day,
  dayEvents,
  dayTasks,
  hasJournal,
  isCurrentMonth,
  isTodayDate,
  isWeekend,
  isPastWeek,
  compactRecurringEvents,
  monthViewEventLimit,
  isMobile,
  onDayClick,
  onDayDoubleClick,
  onDayNumberClick,
  onJournalIndicatorClick,
  onOpenJournalModal,
  openModal,
}: DroppableDayProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey })
  const [showPopup, setShowPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const moreEventsRef = useRef<HTMLButtonElement>(null)

  const handleMoreEventsClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (moreEventsRef.current) {
      const rect = moreEventsRef.current.getBoundingClientRect()
      setPopupPosition({ x: rect.left, y: rect.bottom + 4 })
    }
    setShowPopup(true)
  }

  const handlePopupEventClick = (event: CalendarEvent): void => {
    setShowPopup(false)
    openModal(undefined, undefined, event.id)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.day} ${!isCurrentMonth ? styles.otherMonth : ''} ${isTodayDate ? styles.today : ''} ${isWeekend ? styles.weekend : ''} ${isOver ? styles.dropTarget : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onDayClick(day)}
      onDoubleClick={() => onDayDoubleClick(day)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDayClick(day)
        }
      }}
      onContextMenu={handleContextMenu}
    >
      <div className={styles.dayHeader}>
        <button
          className={styles.dayNumber}
          onClick={(e) => {
            e.stopPropagation()
            onDayNumberClick(day)
          }}
        >
          {format(day, 'd')}
        </button>
        {hasJournal && (
          <button
            className={styles.journalIndicator}
            title="View journal entries"
            onClick={(e) => {
              e.stopPropagation()
              onJournalIndicatorClick(day)
            }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              <path d="M7.5 4.5l2 2" />
            </svg>
          </button>
        )}
      </div>
      {dayEvents.length > 0 && (
        <div className={styles.events}>
          <AnimatePresence>
            {dayEvents.slice(0, monthViewEventLimit).map((event) => {
              const isMultiDay = !isSameDay(parseISO(event.start), parseISO(event.end))
              const shouldCompact =
                isPastWeek ||
                (compactRecurringEvents && (!!event.rruleString || event.isAllDay || isMultiDay)) ||
                event.isFragment
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  compact={shouldCompact}
                  isMobileMonth={isMobile}
                />
              )
            })}
          </AnimatePresence>
          {dayEvents.length > monthViewEventLimit && (
            <button
              ref={moreEventsRef}
              className={styles.moreEvents}
              onClick={handleMoreEventsClick}
            >
              +{dayEvents.length - monthViewEventLimit} more
            </button>
          )}
        </div>
      )}
      {dayTasks.length > 0 && (
        <div className={styles.tasks}>
          <AnimatePresence mode="popLayout">
            {dayTasks.slice(0, monthViewEventLimit).map((task) => (
              <EventCard key={task.id} event={task} compact isMobileMonth={isMobile} />
            ))}
          </AnimatePresence>
          {dayTasks.length > monthViewEventLimit && (
            <div className={styles.moreEvents}>+{dayTasks.length - monthViewEventLimit} more</div>
          )}
        </div>
      )}
      {showPopup && (
        <DayEventsPopup
          date={day}
          events={dayEvents}
          position={popupPosition}
          onClose={() => setShowPopup(false)}
          onEventClick={handlePopupEventClick}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          menuId={`day-${day.getTime()}`}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Create event',
              onClick: () => {
                openModal(format(day, 'yyyy-MM-dd'))
                setContextMenu(null)
              },
            },
            {
              label: 'Create task',
              onClick: () => {
                openModal(format(day, 'yyyy-MM-dd'), undefined, undefined, 'task')
                setContextMenu(null)
              },
            },
            ...(useSettingsStore.getState().journalEnabled
              ? [
                  {
                    label: 'New journal entry',
                    onClick: () => {
                      onOpenJournalModal(format(day, 'yyyy-MM-dd'))
                      setContextMenu(null)
                    },
                  },
                ]
              : []),,
          ]}
        />
      )}
    </div>
  )
})
