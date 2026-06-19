import type { JSX } from 'react'
import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react'
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
import { MOBILE_BREAKPOINT, TABLET_BREAKPOINT, COMPACT_MOBILE_BREAKPOINT } from '@/config'
const SIDEBAR_BREAKPOINT = 950
import { useSettingsStore } from '@/store/settingsStore'
import { useConfigStore } from '@/store/configStore'
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
  { value: 'journal', label: 'Journal' },
]

const VIEW_ROUTES: Record<ViewType, string> = {
  month: '/month',
  week: '/week',
  day: '/day',
  agenda: '/agenda',
  todo: '/tasks',
  journal: '/journal',
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
  const hideCompletedTasksInMonthView = useSettingsStore((state) => state.hideCompletedTasksInMonthView)
  const themeMode = useSettingsStore((state) => state.themeMode)
  const journalEnabled = useSettingsStore((state) => state.journalEnabled)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const hasPreconfiguredAccounts = useConfigStore((state) => state.hasPreconfiguredAccounts)
  const lock = useConfigStore((state) => state.lock)

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth < TABLET_BREAKPOINT : false
  )
  const [isCompactMobile, setIsCompactMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < COMPACT_MOBILE_BREAKPOINT : false
  )
  const [isCompact, setIsCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth < SIDEBAR_BREAKPOINT : false
  )
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false)
  const viewDropdownRef = useRef<HTMLDivElement>(null)
  const viewDropdownCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const viewTabsRef = useRef<HTMLDivElement>(null)
  const viewTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Sliding indicator for view tabs
  useLayoutEffect(() => {
    const container = viewTabsRef.current
    const activeTab = viewTabRefs.current.get(currentView)
    if (container && activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      })
    }
  }, [currentView])

  const [showQuickSettings, setShowQuickSettings] = useState(false)
  const quickSettingsTimeoutRef = useState(() => ({ current: undefined as ReturnType<typeof setTimeout> | undefined }))[0]

  useEffect(() => {
    const checkMobile = () => {
      const w = window.innerWidth
      setIsMobile(w < MOBILE_BREAKPOINT)
      setIsTablet(w < TABLET_BREAKPOINT)
      setIsCompactMobile(w < COMPACT_MOBILE_BREAKPOINT)
      setIsCompact(w < SIDEBAR_BREAKPOINT)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!isViewDropdownOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isViewDropdownOpen])

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
      case 'journal':
        newDate = direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1)
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
    <div className={styles.header} {...bind} data-component="header">
      {/* Brand + Hamburger — both always rendered, CSS handles visibility */}
      <div className={`${styles.brand} ${isMobile || isCompact ? styles.brandHidden : ''}`}>
        <div className={styles.brandDiamond} />
        <span className={styles.brandName}>Calino</span>
      </div>
      <button
        className={`${styles.hamburger} ${(!isMobile && !isCompact) || isCompactMobile ? styles.hamburgerHidden : ''}`}
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
      >
        <HamburgerIcon />
      </button>

      {/* Navigator - prev/today/next */}
      {currentView !== 'todo' ? (
        <div className={styles.navigator}>
          <button
            className={styles.navArrow}
            onClick={() => handleNavigate('prev')}
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          {!isCompact && (
            <button className={styles.navToday} onClick={handleToday} data-component="today-button">
              Today
            </button>
          )}
          <button
            className={styles.navArrow}
            onClick={() => handleNavigate('next')}
            aria-label="Next"
          >
            <ChevronRight />
          </button>
        </div>
      ) : (
        <div />
      )}

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
        {/* Search - hidden in compact mobile (available in FAB) */}
        {!isCompactMobile && (
          <button
            className={styles.iconButton}
            onClick={onOpenCommandPalette}
            aria-label="Search or commands"
          >
            <SearchIcon />
          </button>
        )}

        {/* View Tabs - always rendered, CSS handles visibility */}
        <div className={`${styles.viewTabs} ${isMobile || isTablet ? styles.viewTabsHidden : ''}`} ref={viewTabsRef} data-component="view-switcher">
          <div
            className={styles.viewTabIndicator}
            style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          />
          {VIEWS.filter(v => journalEnabled || v.value !== 'journal').map((view, index) => (
            <React.Fragment key={view.value}>
              {index === 3 && <div className={styles.viewTabDivider} />}
              <button
                ref={(el) => {
                  if (el) viewTabRefs.current.set(view.value, el)
                  else viewTabRefs.current.delete(view.value)
                }}
                className={`${styles.viewTab} ${currentView === view.value ? styles.viewTabActive : ''}`}
                onClick={() => handleViewChange(view.value)}
              >
                {view.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div
          className={`${styles.viewDropdown} ${!isTablet ? styles.viewDropdownHidden : ''}`}
          ref={viewDropdownRef}
          onMouseEnter={() => {
            // Skip on touch devices — click handles toggle
            if ('ontouchstart' in window) return
            if (viewDropdownCloseTimer.current) {
              clearTimeout(viewDropdownCloseTimer.current)
              viewDropdownCloseTimer.current = null
            }
            setIsViewDropdownOpen(true)
          }}
          onMouseLeave={() => {
            if ('ontouchstart' in window) return
            viewDropdownCloseTimer.current = setTimeout(() => {
              setIsViewDropdownOpen(false)
              viewDropdownCloseTimer.current = null
            }, 150)
          }}
        >
          <button
            className={styles.viewDropdownButton}
            onClick={() => setIsViewDropdownOpen((prev) => !prev)}
          >
            {VIEWS.find((v) => v.value === currentView)?.label}
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" className={`${styles.viewDropdownArrow} ${isViewDropdownOpen ? styles.viewDropdownArrowOpen : ''}`}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isViewDropdownOpen && (
            <div className={styles.viewDropdownMenu}>
              {VIEWS.filter(v => journalEnabled || v.value !== 'journal').map((view, index) => (
                <React.Fragment key={view.value}>
                  {index === 3 && <div className={styles.viewDropdownDivider} />}
                  <button
                    className={`${styles.viewDropdownItem} ${currentView === view.value ? styles.viewDropdownItemActive : ''}`}
                    onClick={() => {
                      handleViewChange(view.value)
                      setIsViewDropdownOpen(false)
                    }}
                  >
                    {view.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Settings - hidden in compact mobile (available in FAB) */}
        {!isCompactMobile && (
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
              <div className={styles.quickSettingsItem}>
                <span className={styles.quickSettingsLabel}>Dark mode</span>
                <button
                  className={`${styles.toggleSwitch} ${themeMode === 'dark' ? styles.toggleActive : ''}`}
                  onClick={() => updateSettings({ themeMode: themeMode === 'dark' ? 'light' : 'dark' })}
                  aria-label="Toggle dark mode"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
              <div className={styles.quickSettingsItem}>
                <span className={styles.quickSettingsLabel}>Hide completed tasks</span>
                <button
                  className={`${styles.toggleSwitch} ${hideCompletedTasksInMonthView ? styles.toggleActive : ''}`}
                  onClick={() => updateSettings({ hideCompletedTasksInMonthView: !hideCompletedTasksInMonthView })}
                  aria-label="Toggle hide completed tasks"
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
              <div className={styles.quickSettingsDivider} />
              <div className={styles.quickSettingsFooter}>
                <button
                  className={styles.quickSettingsLink}
                  onClick={() => navigate('/settings')}
                >
                  All settings →
                </button>
                {hasPreconfiguredAccounts && (
                  <button
                    className={styles.quickSettingsLock}
                    onClick={() => lock()}
                    aria-label="Lock Calino"
                    title="Lock"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="7" width="10" height="7" rx="2" />
                      <path d="M5 7V5a3 3 0 016 0v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        )}
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

function SettingsIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
