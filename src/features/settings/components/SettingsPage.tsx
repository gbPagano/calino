import type { JSX } from 'react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GeneralSettings } from './GeneralSettings'
import { ThemeSettings } from './ThemeSettings'
import { CalendarSettings } from './CalendarSettings'
import { NotificationSettings } from './NotificationSettings'
import { DataSettings } from './DataSettings'
import { CalDAVSettings } from './CalDAVSettings'
import { CategoriesSettings } from './CategoriesSettings'
import { useCalendarStore } from '@/store/calendarStore'
import styles from './Settings.module.css'

type SettingsTab = 'general' | 'theme' | 'calendar' | 'categories' | 'notifications' | 'caldav' | 'data'

interface NavItem {
  id: SettingsTab
  label: string
  icon: JSX.Element
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    id: 'theme',
    label: 'Appearance',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2a7 7 0 100 14A4 4 0 009 2z" />
        <circle cx="6" cy="7" r="1" />
        <circle cx="11" cy="5.5" r="1" />
        <circle cx="13" cy="10" r="1" />
        <circle cx="7.5" cy="12.5" r="1" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="14" height="13" rx="3" />
        <path d="M2 7h14M6 2v2M12 2v2" />
      </svg>
    ),
  },
  {
    id: 'categories',
    label: 'Categories',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h14M2 9h14M2 14h8" />
        <circle cx="14" cy="14" r="2.5" />
        <path d="M14 12.5v1.5h1.5" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2a5 5 0 00-5 5c0 3-1.5 4-1.5 4h13S14 10 14 7a5 5 0 00-5-5z" />
        <path d="M7.5 15a1.5 1.5 0 003 0" />
      </svg>
    ),
  },
  {
    id: 'caldav',
    label: 'Sync',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9a6 6 0 0110.7-3.7M15 9a6 6 0 01-10.7 3.7" />
        <path d="M12.5 5l1.2 1.2-1.2 1.2M5.5 13l-1.2-1.2 1.2-1.2" />
      </svg>
    ),
  },
  {
    id: 'data',
    label: 'Data',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="9" cy="5" rx="6" ry="2.5" />
        <path d="M3 5v4c0 1.4 2.7 2.5 6 2.5S15 10.4 15 9V5" />
        <path d="M3 9v4c0 1.4 2.7 2.5 6 2.5S15 14.4 15 13V9" />
      </svg>
    ),
  },
]

const VALID_TABS: SettingsTab[] = ['general', 'theme', 'calendar', 'categories', 'notifications', 'caldav', 'data']

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const brokenEventsCount = useCalendarStore((state) => state.brokenEvents.length)

  const initialTab = ((): SettingsTab => {
    const tabParam = searchParams.get('tab')
    if (tabParam && VALID_TABS.includes(tabParam as SettingsTab)) {
      return tabParam as SettingsTab
    }
    return 'general'
  })()

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab)

  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />
      case 'theme':
        return <ThemeSettings />
      case 'calendar':
        return <CalendarSettings />
      case 'categories':
        return <CategoriesSettings />
      case 'notifications':
        return <NotificationSettings />
      case 'caldav':
        return <CalDAVSettings />
      case 'data':
        return <DataSettings />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <div className={styles.container} data-component="settings-page">
      <div className={styles.backMobile}>
        <button className={styles.back} onClick={() => navigate('/')}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2L4 7l5 5" />
          </svg>
          Back to Calendar
        </button>
      </div>
      <div className={styles.body}>
        <aside className={styles.nav} data-component="settings-sidebar">
          <h1 className={styles.navTitle}>Settings</h1>
          {/* Dropdown for ≤500px */}
          <div className={styles.navDropdown} ref={dropdownRef}>
            <button
              className={styles.navDropdownButton}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="Select settings category"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {activeItem?.icon}
                {activeItem?.label}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4.5L6 7.5L9 4.5" />
              </svg>
            </button>
            {isDropdownOpen && (
              <div className={styles.navDropdownMenu}>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className={`${styles.navDropdownItem} ${activeTab === item.id ? styles.navDropdownItemActive : ''}`}
                    onClick={() => {
                      setActiveTab(item.id)
                      setIsDropdownOpen(false)
                    }}
                  >
                    {item.icon}
                    {item.label}
                    {item.id === 'data' && brokenEventsCount > 0 && (
                      <span className={styles.navBadge}>{brokenEventsCount}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Regular nav items for >500px */}
          <nav className={styles.navList} aria-label="Settings">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
                data-component="settings-nav-item"
                data-tab={item.id}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
                {item.id === 'data' && brokenEventsCount > 0 && (
                  <span className={styles.navBadge}>{brokenEventsCount}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>
        <main className={styles.main} data-component="settings-panel">
          <div className={styles.header}>
            <button className={styles.back} onClick={() => navigate('/')}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2L4 7l5 5" />
              </svg>
              Back to Calendar
            </button>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
