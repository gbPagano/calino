import type { JSX } from 'react'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ContextMenu } from '@/components/common/ContextMenu'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns'
import { config, TOAST_DURATION_MS } from '@/config'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { AddCalendarModal } from './AddCalendarModal'
import { MiniTasksSection } from './MiniTasksSection'
import styles from './Sidebar.module.css'

const CALENDAR_COLORS = [
  '#4285F4',
  '#EA4335',
  '#34A853',
  '#FBBC05',
  '#FF6D01',
  '#46BDC6',
  '#7B1FA2',
  '#C2185B',
  '#00796B',
  '#F57C00',
  '#455A64',
  '#5D4037',
]

function getNextColor(currentColor: string): string {
  const idx = CALENDAR_COLORS.indexOf(currentColor)
  return CALENDAR_COLORS[(idx + 1) % CALENDAR_COLORS.length]
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCompact, setIsCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 950 : false
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [miniDate, setMiniDate] = useState<Date | null>(null)
  const [miniDateInitialized, setMiniDateInitialized] = useState(false)
  const showYearDropdownRef = useRef(showYearDropdown)
  const showMonthDropdownRef = useRef(showMonthDropdown)
  const [isTasksExpanded, setIsTasksExpanded] = useState(false)
  const hasInitializedTasksExpandedRef = useRef(false)
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<Record<string, 'success' | 'error'>>({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    calendarId: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const currentDate = useCalendarStore((state) => state.currentDate)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const calendars = useCalendarStore((state) => state.calendars)
  const categories = useCalendarStore((state) => state.categories)
  const selectedCategoryId = useCalendarStore((state) => state.selectedCategoryId)
  const toggleCategoryFilter = useCalendarStore((state) => state.toggleCategoryFilter)
  const toggleCalendarVisibility = useCalendarStore((state) => state.toggleCalendarVisibility)
  const updateCalendar = useCalendarStore((state) => state.updateCalendar)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const hideCompletedTasksInMonthView = useSettingsStore((state) => state.hideCompletedTasksInMonthView)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const showAddCalendar = useCalendarStore((state) => state.showAddCalendar)
  const setShowAddCalendar = useCalendarStore((state) => state.setShowAddCalendar)
  const { syncAccount } = useCalDAV()
  const navigate = useNavigate()

  // Initialize miniDate from the store on first render
  useEffect(() => {
    if (!miniDateInitialized) {
      setMiniDate(parseISO(currentDate))
      setMiniDateInitialized(true)
    }
  }, [currentDate, miniDateInitialized])

  useEffect(() => {
    if (!hasInitializedTasksExpandedRef.current) {
      const events = useCalendarStore.getState().events
      if (events.length > 0) {
        setIsTasksExpanded(events.some((e) => e.type === 'task' && !e.completed))
        hasInitializedTasksExpandedRef.current = true
      }
    }
  })

  const effectiveMiniDate = miniDate ?? parseISO(currentDate)

  const handleSyncCalendar = async (calendarId: string, accountId?: string): Promise<void> => {
    if (!accountId || syncingCalendarId) return
    setSyncingCalendarId(calendarId)
    setSyncStatus((prev) => {
      const { [calendarId]: _, ...rest } = prev // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest
    })
    try {
      await syncAccount(accountId)
      setSyncStatus((prev) => ({ ...prev, [calendarId]: 'success' }))
      setTimeout(() => {
        setSyncStatus((prev) => {
          const { [calendarId]: _, ...rest } = prev // eslint-disable-line @typescript-eslint/no-unused-vars
          return rest
        })
      }, TOAST_DURATION_MS)
    } catch {
      setSyncStatus((prev) => ({ ...prev, [calendarId]: 'error' }))
      setTimeout(() => {
        setSyncStatus((prev) => {
          const { [calendarId]: _, ...rest } = prev // eslint-disable-line @typescript-eslint/no-unused-vars
          return rest
        })
      }, 3000)
    } finally {
      setSyncingCalendarId(null)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, calendarId: string): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, calendarId })
  }

  const closeContextMenu = (): void => {
    setContextMenu(null)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const handleMonthClick = (): void => {
    setShowMonthDropdown(!showMonthDropdown)
  }

  const handleMonthSelect = (monthIndex: number): void => {
    const newDate = new Date(effectiveMiniDate.getFullYear(), monthIndex, 1)
    setMiniDate(newDate)
    setShowMonthDropdown(false)
  }

  const handleYearClick = (): void => {
    setShowYearDropdown(!showYearDropdown)
  }

  const handleYearSelect = (year: number): void => {
    const newDate = new Date(effectiveMiniDate.getFullYear(), effectiveMiniDate.getMonth(), 1)
    newDate.setFullYear(year)
    setMiniDate(newDate)
    setShowYearDropdown(false)
  }

  useEffect(() => {
    showYearDropdownRef.current = showYearDropdown
  }, [showYearDropdown])

  useEffect(() => {
    showMonthDropdownRef.current = showMonthDropdown
  }, [showMonthDropdown])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowYearDropdown(false)
        setShowMonthDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStartRename = (id: string, name: string): void => {
    setEditingId(id)
    setEditName(name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleFinishRename = (): void => {
    if (editingId && editName.trim()) {
      updateCalendar(editingId, { name: editName.trim() })
    }
    setEditingId(null)
    setEditName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleFinishRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditName('')
    }
  }

  const handleColorClick = (calendarId: string, currentColor: string): void => {
    const nextColor = getNextColor(currentColor)
    updateCalendar(calendarId, { color: nextColor })
  }

  const miniCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(effectiveMiniDate)
    const monthEnd = endOfMonth(effectiveMiniDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [effectiveMiniDate, firstDayOfWeek])

  const weekdays = useMemo(() => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const idx = firstDayOfWeek || 0
    return [...days.slice(idx), ...days.slice(0, idx)]
  }, [firstDayOfWeek])

  const handlePrevMonth = (): void => {
    setMiniDate(subMonths(effectiveMiniDate, 1))
  }

  const handleNextMonth = (): void => {
    setMiniDate(addMonths(effectiveMiniDate, 1))
  }

  const handleDayClick = (day: Date): void => {
    setCurrentDate(format(day, 'yyyy-MM-dd'))
    setMiniDate(day)
  }

  const handleDayDoubleClick = (day: Date): void => {
    setCurrentDate(format(day, 'yyyy-MM-dd'))
    setMiniDate(day)
    navigate('/day')
  }

  const handleToday = (): void => {
    const today = new Date()
    setCurrentDate(format(today, 'yyyy-MM-dd'))
    setMiniDate(today)
  }

  useEffect(() => {
    if (isOpen && onClose) {
      const handleResize = (): void => {
        if (window.innerWidth > 950) {
          onClose()
        }
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    const check = (): void => setIsCompact(window.innerWidth <= 950)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sidebarClass = `${styles.sidebar}${isOpen ? ` ${styles.open}` : ''}`

  if (isCollapsed && !isCompact) {
    return (
      <div className={styles.collapsed}>
        <button
          className={styles.expandButton}
          onClick={() => setIsCollapsed(false)}
          title="Expand sidebar"
        >
          <ChevronRight />
        </button>
      </div>
    )
  }

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <div className={sidebarClass}>
        <div className={styles.miniCalendar}>
          <div className={styles.miniHeader}>
            <button onClick={handlePrevMonth} className={styles.miniNavBtn} aria-label="Previous month">
              <ChevronLeft />
            </button>
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <span className={styles.miniMonth}>
                <button onClick={handleMonthClick} className={styles.miniMonthButton}>
                  {format(effectiveMiniDate, 'MMMM')}
                </button>
                {showMonthDropdown && (
                  <div className={styles.yearDropdown}>
                    {months.map((month, index) => (
                      <button
                        key={month}
                        onClick={() => handleMonthSelect(index)}
                        className={`${styles.yearOption} ${
                          index === effectiveMiniDate.getMonth() ? styles.yearOptionSelected : ''
                        }`}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={handleYearClick} className={styles.miniMonthButton}>
                  {format(effectiveMiniDate, 'yyyy')}
                </button>
                {showYearDropdown && (
                  <div className={`${styles.yearDropdown} ${styles.yearDropdownRight}`}>
                    {years.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={`${styles.yearOption} ${
                          year === effectiveMiniDate.getFullYear() ? styles.yearOptionSelected : ''
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            </div>
            <button onClick={handleNextMonth} className={styles.miniNavBtn} aria-label="Next month">
              <ChevronRight />
            </button>
          </div>
          <div className={styles.miniWeekdays}>
            {weekdays.map((day, idx) => (
              <span key={idx} className={styles.miniWeekday}>
                {day}
              </span>
            ))}
          </div>
          <div className={styles.miniDays}>
            {miniCalendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, effectiveMiniDate)
              const isSelected = isSameDay(day, parseISO(currentDate))
              const isTodayDate = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  className={`${styles.miniDay} ${!isCurrentMonth ? styles.otherMonth : ''} ${
                    isSelected ? styles.selected : ''
                  } ${isTodayDate ? styles.today : ''}`}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => handleDayDoubleClick(day)}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
          <button className={styles.todayBtn} onClick={handleToday}>
            Today
          </button>
        </div>

        <div className={styles.calendars}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionTitle}>Calendars</span>
            <button
              className={styles.addCalendarButton}
              onClick={() => setShowAddCalendar(true)}
              title="Add calendar"
            >
              <PlusIcon />
            </button>
          </div>
          {calendars.map((calendar) => (
            <label
              key={calendar.id}
              className={styles.calendarItem}
              onContextMenu={(e) => handleContextMenu(e, calendar.id)}
            >
              <input
                type="checkbox"
                checked={calendar.isVisible}
                onChange={() => toggleCalendarVisibility(calendar.id)}
                className={styles.checkbox}
              />
              <button
                className={styles.colorDot}
                style={{ backgroundColor: calendar.color }}
                onClick={() => handleColorClick(calendar.id, calendar.color)}
                title="Click to change color"
              />
              {editingId === calendar.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={handleKeyDown}
                  className={styles.renameInput}
                />
              ) : (
                <span
                  className={styles.calendarName}
                  onDoubleClick={() => handleStartRename(calendar.id, calendar.name)}
                >
                  {calendar.name}
                </span>
              )}
              {calendar.accountId && (
                <button
                  className={`${styles.syncButton} ${syncingCalendarId === calendar.id ? styles.syncing : ''} ${syncStatus[calendar.id] === 'success' ? styles.success : ''} ${syncStatus[calendar.id] === 'error' ? styles.error : ''}`}
                  onClick={() => handleSyncCalendar(calendar.id, calendar.accountId)}
                  title="Sync calendar"
                  disabled={!!syncingCalendarId}
                >
                  {syncStatus[calendar.id] === 'success' ? (
                    <svg aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : syncStatus[calendar.id] === 'error' ? (
                    <svg aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  )}
                </button>
              )}
            </label>
          ))}
        </div>

        <MiniTasksSection
          isExpanded={isTasksExpanded}
          onToggle={() => setIsTasksExpanded(!isTasksExpanded)}
        />

        <div className={styles.stickyBottom}>
          {categories.length > 0 && (
            <div className={styles.categoriesWrapper}>
              <button
                className={styles.sectionHeader}
                onMouseEnter={() => setIsCategoriesExpanded(true)}
                onMouseLeave={() => setIsCategoriesExpanded(false)}
              >
                <span className={styles.sectionTitle}>Categories</span>
                <ChevronDown className={`${styles.chevron} ${isCategoriesExpanded ? styles.chevronExpanded : ''}`} />
              </button>
              <AnimatePresence>
                {isCategoriesExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                    className={styles.categoryCard}
                    onMouseEnter={() => setIsCategoriesExpanded(true)}
                    onMouseLeave={() => setIsCategoriesExpanded(false)}
                  >
                    <div className={styles.categoryCardList}>
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          className={`${styles.categoryItem} ${selectedCategoryId === category.id ? styles.categoryItemSelected : ''}`}
                          onClick={() => toggleCategoryFilter(category.id)}
                        >
                          <span
                            className={styles.categoryDot}
                            style={{ backgroundColor: category.color }}
                          />
                          <span className={styles.categoryName}>{category.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className={styles.footer}>
            <Link to="/privacy" className={styles.footerLink}>
              Privacy
            </Link>
            <a
              href={`https://github.com/${config.githubRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              GitHub
            </a>
          </div>
        </div>

        <AddCalendarModal isOpen={showAddCalendar} onClose={() => setShowAddCalendar(false)} />
        {contextMenu &&
          createPortal(
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={[
                {
                  label: calendars.find((c) => c.id === contextMenu.calendarId)?.showTasksInViews
                    ? 'Hide Tasks in Views'
                    : 'Show Tasks in Views',
                  onClick: () => {
                    const calendar = calendars.find((c) => c.id === contextMenu.calendarId)
                    if (calendar) {
                      updateCalendar(contextMenu.calendarId, {
                        showTasksInViews: !calendar.showTasksInViews,
                      })
                    }
                    closeContextMenu()
                  },
                },
                {
                  label: hideCompletedTasksInMonthView
                    ? 'Show Completed Tasks'
                    : 'Hide Completed Tasks',
                  onClick: () => {
                    updateSettings({ hideCompletedTasksInMonthView: !hideCompletedTasksInMonthView })
                    closeContextMenu()
                  },
                },
              ]}
              onClose={closeContextMenu}
              menuId="calendar-context"
            />,
            document.body
          )}
      </div>
    </>
  )
}

function ChevronLeft(): JSX.Element {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 12L6 8L10 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRight(): JSX.Element {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDown({ className }: { className?: string }): JSX.Element {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 3V11M3 7H11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
