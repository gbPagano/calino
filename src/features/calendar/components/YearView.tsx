import type { JSX } from 'react'
import { useMemo, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format,
  parseISO,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { ViewType } from '@/types'
import styles from './YearView.module.css'

const VIEW_ROUTES: Record<ViewType, string> = {
  month: '/month',
  year: '/year',
  week: '/week',
  day: '/day',
  agenda: '/agenda',
  todo: '/tasks',
  journal: '/journal',
  contacts: '/contacts',
}

export function YearView(): JSX.Element {
  const currentDate = useCalendarStore((state) => state.currentDate)
  const events = useCalendarStore((state) => state.events)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const setCurrentView = useCalendarStore((state) => state.setCurrentView)
  const getEventsForDateRange = useCalendarStore((state) => state.getEventsForDateRange)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const navigate = useNavigate()

  const date = useMemo(() => parseISO(currentDate), [currentDate])

  const months = useMemo(
    () => eachMonthOfInterval({ start: startOfYear(date), end: endOfYear(date) }),
    [date]
  )

  const weekdayInitials = useMemo(() => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const idx = firstDayOfWeek || 0
    return [...days.slice(idx), ...days.slice(0, idx)]
  }, [firstDayOfWeek])

  const eventDayKeys = useMemo(() => {
    const yearStart = startOfYear(date)
    const yearEnd = endOfYear(date)
    const yearEvents = getEventsForDateRange(
      format(yearStart, 'yyyy-MM-dd'),
      format(yearEnd, 'yyyy-MM-dd')
    )
    const keys = new Set<string>()
    yearEvents.forEach((event) => {
      try {
        keys.add(format(parseISO(event.start), 'yyyy-MM-dd'))
      } catch {
        // ignore malformed dates
      }
    })
    return keys
  }, [date, events, getEventsForDateRange])

  const handleMonthClick = (monthStart: Date): void => {
    setCurrentDate(format(monthStart, 'yyyy-MM-dd'))
    setCurrentView('month')
    navigate(VIEW_ROUTES.month, { replace: true })
  }

  const handleDayClick = (day: Date, e: MouseEvent): void => {
    e.stopPropagation()
    setCurrentDate(format(day, 'yyyy-MM-dd'))
    setCurrentView('day')
    navigate(VIEW_ROUTES.day, { replace: true })
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {months.map((m) => {
          const days = eachDayOfInterval({
            start: startOfWeek(startOfMonth(m), { weekStartsOn: firstDayOfWeek }),
            end: endOfWeek(endOfMonth(m), { weekStartsOn: firstDayOfWeek }),
          })

          return (
            <div
              key={m.toISOString()}
              className={styles.month}
              role="button"
              tabIndex={0}
              onClick={() => handleMonthClick(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleMonthClick(m)
                }
              }}
            >
              <div className={styles.monthHeader}>{format(m, 'MMMM')}</div>
              <div className={styles.weekdayRow}>
                {weekdayInitials.map((w, i) => (
                  <span key={i} className={styles.weekdayInitial}>
                    {w}
                  </span>
                ))}
              </div>
              <div className={styles.dayGrid}>
                {days.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd')
                  const isOutside = !isSameMonth(day, m)

                  if (isOutside) {
                    return <span key={dayKey} className={styles.emptyDay} aria-hidden="true" />
                  }

                  const isTodayDate = isToday(day)
                  const hasEvents = eventDayKeys.has(dayKey)

                  return (
                    <button
                      key={dayKey}
                      className={`${styles.day} ${isTodayDate ? styles.today : ''}`}
                      onClick={(e) => handleDayClick(day, e)}
                    >
                      {format(day, 'd')}
                      {hasEvents && <span className={styles.eventDot} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
