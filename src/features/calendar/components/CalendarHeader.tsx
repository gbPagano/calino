import type { JSX } from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  format,
  addMonths,
  addWeeks,
  addDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  subMonths,
  subWeeks,
  subDays,
} from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useCalendarStore } from '@/store/calendarStore'
import { MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from '@/config'
const SIDEBAR_BREAKPOINT = 950
import { useSettingsStore } from '@/store/settingsStore'
import { useGestures } from '@/hooks/useGestures'
import type { ViewType } from '@/types'
import styles from './CalendarHeader.module.css'

interface CalendarHeaderProps {
  onToggleSidebar?: () => void
  onOpenCommandPalette?: () => void
}

const VIEWS: { value: ViewType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'todo', label: 'Tasks' },
]

const VIEW_ROUTES: Record<ViewType, string> = {
  month: '/month',
  week: '/week',
  day: '/day',
  agenda: '/agenda',
  todo: '/tasks',
}

export function CalendarHeader({
  onToggleSidebar,
  onOpenCommandPalette,
}: CalendarHeaderProps): JSX.Element {
  const navigate = useNavigate()
  const currentDate = useCalendarStore((state) => state.currentDate)
  const currentView = useCalendarStore((state) => state.currentView)
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate)
  const setCurrentView = useCalendarStore((state) => state.setCurrentView)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const showWeekNumbers = useSettingsStore((state) => state.showWeekNumbers)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth < TABLET_BREAKPOINT : false
  )
  const [isCompact, setIsCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth < SIDEBAR_BREAKPOINT : false
  )
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false)
  const viewDropdownRef = useRef<HTMLDivElement>(null)
  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const quickSettingsTimeoutRef = useState(() => ({ current: undefined as ReturnType<typeof setTimeout> | undefined }))[0]

  useEffect(() => {
    const checkMobile = () => {
      const w = window.innerWidth
      setIsMobile(w < MOBILE_BREAKPOINT)
      setIsTablet(w < TABLET_BREAKPOINT)
      setIsCompact(w < SIDEBAR_BREAKPOINT)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const date = parseISO(currentDate)
  const year = format(date, 'yyyy')

  const getTitle = (): { month: string; year: string } | string => {
    switch (currentView) {
      case 'month':
        return { month: format(date, 'MMMM'), year }
      case 'week': {
        const weekStart = startOfWeek(date, { weekStartsOn: firstDayOfWeek })
        const weekEnd = endOfWeek(date, { weekStartsOn: firstDayOfWeek })
        if (format(weekStart, 'MMM') === format(weekEnd, 'MMM')) {
          return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd')}`
        }
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`
      }
      case 'day':
        return format(date, 'EEE, MMMM d')
      case 'agenda':
        return format(date, 'MMMM')
      case 'todo':
        return 'Tasks'
      default:
        return format(date, 'MMMM')
    }
  }

  const title = getTitle()

  const handleNavigate = (direction: 'prev' | 'next'): void => {
    let newDate: Date
    switch (currentView) {
      case 'month':
        newDate = direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1)
        break
      case 'week':
        newDate = direction === 'prev' ? subWeeks(date, 1) : addWeeks(date, 1)
        break
      case 'day':
        newDate = direction === 'prev' ? subDays(date, 1) : addDays(date, 1)
        break
      case 'agenda':
        newDate = direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1)
        break
      case 'todo':
        newDate = date
        break
      default:
        newDate = date
    }
    setCurrentDate(format(newDate, 'yyyy-MM-dd'))
  }

  const handleToday = (): void => {
    setCurrentDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleViewChange = useCallback(
    (view: ViewType) => {
      setCurrentView(view)
      navigate(VIEW_ROUTES[view], { replace: true })
    },
    [setCurrentView, navigate]
  )

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      const dir = direction === 'left' ? 'next' : direction === 'right' ? 'prev' : null
      if (!dir) return

      let newDate: Date
      switch (currentView) {
        case 'month':
          newDate = dir === 'prev' ? subMonths(date, 1) : addMonths(date, 1)
          break
        case 'week':
          newDate = dir === 'prev' ? subWeeks(date, 1) : addWeeks(date, 1)
          break
        case 'day':
          newDate = dir === 'prev' ? subDays(date, 1) : addDays(date, 1)
          break
        case 'agenda':
          newDate = dir === 'prev' ? subMonths(date, 1) : addMonths(date, 1)
          break
        case 'todo':
          newDate = date
          break
        default:
          newDate = date
      }
      setCurrentDate(format(newDate, 'yyyy-MM-dd'))
    },
    [currentView, date, setCurrentDate]
  )

  const { bind } = useGestures({
    onSwipe: handleSwipe,
    swipeThreshold: 50,
  })

  return (
    <div className={styles.header} {...bind}>
      {/* Brand Mark - only on desktop */}
      {!isMobile && (
        <div className={styles.brand}>
          <div className={styles.brandDiamond} />
          <span className={styles.brandName}>Calino</span>
        </div>
      )}

      {/* Hamburger — shown when sidebar is hidden (compact/mobile) */}
      {(isMobile || isCompact) && (
        <button className={styles.hamburger} onClick={onToggleSidebar} aria-label="Toggle menu">
          <HamburgerIcon />
        </button>
      )}

      {/* Navigator - grouped segmented control (placeholder on todo to keep grid aligned) */}
      {!isMobile && currentView !== 'todo' ? (
        <div className={styles.navigator}>
          <button
            className={styles.navArrow}
            onClick={() => handleNavigate('prev')}
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          <button className={styles.navToday} onClick={handleToday}>
            Today
          </button>
          <button
            className={styles.navArrow}
            onClick={() => handleNavigate('next')}
            aria-label="Next"
          >
            <ChevronRight />
          </button>
        </div>
      ) : !isMobile ? (
        <div />
      ) : null}

      {/* Month Title */}
      <div className={styles.titleGroup}>
        {typeof title === 'object' ? (
          <>
            <h1 className={styles.monthTitle}>{title.month}</h1>
            <span className={styles.yearTitle}>{title.year}</span>
          </>
        ) : (
          <h1 className={styles.viewTitle}>{title}</h1>
        )}
      </div>

      {/* Spacer */}
      <div className={styles.spacer} />

      {/* Right cluster */}
      <div className={styles.rightCluster}>
        {/* Search */}
        <button
          className={styles.iconButton}
          onClick={onOpenCommandPalette}
          aria-label="Search or commands"
        >
          <SearchIcon />
        </button>

        {/* View Tabs - segmented control or dropdown */}
        {!isMobile && !isTablet && (
          <div className={styles.viewTabs}>
            {VIEWS.map((view) => (
              <button
                key={view.value}
                className={`${styles.viewTab} ${currentView === view.value ? styles.viewTabActive : ''}`}
                onClick={() => handleViewChange(view.value)}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
        {!isMobile && isTablet && (
          <div
            className={styles.viewDropdown}
            ref={viewDropdownRef}
            onMouseEnter={() => setIsViewDropdownOpen(true)}
            onMouseLeave={() => setIsViewDropdownOpen(false)}
          >
            <button
              className={styles.viewDropdownButton}
            >
              {VIEWS.find((v) => v.value === currentView)?.label}
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" className={`${styles.viewDropdownArrow} ${isViewDropdownOpen ? styles.viewDropdownArrowOpen : ''}`}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isViewDropdownOpen && (
              <div className={styles.viewDropdownMenu}>
                {VIEWS.map((view) => (
                  <button
                    key={view.value}
                    className={`${styles.viewDropdownItem} ${currentView === view.value ? styles.viewDropdownItemActive : ''}`}
                    onClick={() => {
                      handleViewChange(view.value)
                      setIsViewDropdownOpen(false)
                    }}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Display toggle (theme) */}
        <button className={styles.iconButton} aria-label="Toggle display">
          <DisplayIcon />
        </button>

        {/* Settings with quick dropdown */}
        <div
          className={styles.settingsWrapper}
          onMouseEnter={() => {
            clearTimeout(quickSettingsTimeoutRef.current)
            setShowQuickSettings(true)
          }}
          onMouseLeave={() => {
            quickSettingsTimeoutRef.current = setTimeout(() => setShowQuickSettings(false), 200)
          }}
        >
          <button
            className={styles.iconButton}
            onClick={() => navigate('/settings')}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
          {showQuickSettings && !isMobile && (
            <div className={styles.quickSettingsDropdown}>
              <div className={styles.quickSettingsItem}>
                <span className={styles.quickSettingsLabel}>Week numbers</span>
                <button
                  className={`${styles.toggleSwitch} ${showWeekNumbers ? styles.toggleActive : ''}`}
                  onClick={() => updateSettings({ showWeekNumbers: !showWeekNumbers })}
                  aria-label="Toggle week numbers"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
              <div className={styles.quickSettingsDivider} />
              <button
                className={styles.quickSettingsLink}
                onClick={() => navigate('/settings')}
              >
                All settings →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile view switcher */}
      {isMobile && (
        <div className={styles.mobileViewTabs}>
          {VIEWS.map((view) => (
            <button
              key={view.value}
              className={`${styles.mobileViewTab} ${currentView === view.value ? styles.mobileViewTabActive : ''}`}
              onClick={() => handleViewChange(view.value)}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChevronLeft(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8L10 4" />
    </svg>
  )
}

function ChevronRight(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4L10 8L6 12" />
    </svg>
  )
}

function HamburgerIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 10H17M3 6H17M3 14H17" />
    </svg>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21L16.65 16.65" />
    </svg>
  )
}

function DisplayIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21H16M12 17V21" />
    </svg>
  )
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
