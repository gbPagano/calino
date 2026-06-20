import type { JSX } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GeneralSettings } from './GeneralSettings'
import { ThemeSettings } from './ThemeSettings'
import { CalendarSettings } from './CalendarSettings'
import { EventDefaultsSettings } from './EventDefaultsSettings'
import { NotificationSettings } from './NotificationSettings'
import { DataSettings } from './DataSettings'
import { CalDAVSettings } from './CalDAVSettings'
import { CategoriesSettings } from './CategoriesSettings'
import { BrokenEventsSettings } from './BrokenEventsSettings'
import { useCalendarStore } from '@/store/calendarStore'
import styles from './Settings.module.css'

type SettingsTab = 'general' | 'theme' | 'calendar' | 'events' | 'categories' | 'notifications' | 'caldav' | 'data' | 'data-issues'

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
    label: 'Theme',
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
    id: 'events',
    label: 'Events',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2l1.8 4 4.2.6-3 3 .7 4.2L9 12l-3.7 1.8.7-4.2-3-3 4.2-.6L9 2z" />
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
  {
    id: 'data-issues',
    label: 'Data Issues',
    icon: (
      <svg className={styles.navIcon} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7" />
        <path d="M9 5v4M9 12h.01" />
      </svg>
    ),
  },
]

const VALID_TABS: SettingsTab[] = ['general', 'theme', 'calendar', 'events', 'categories', 'notifications', 'caldav', 'data', 'data-issues']

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

  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />
      case 'theme':
        return <ThemeSettings />
      case 'calendar':
        return <CalendarSettings />
      case 'events':
        return <EventDefaultsSettings />
      case 'categories':
        return <CategoriesSettings />
      case 'notifications':
        return <NotificationSettings />
      case 'caldav':
        return <CalDAVSettings />
      case 'data':
        return <DataSettings />
      case 'data-issues':
        return <BrokenEventsSettings />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.backMobile}>
        <button className={styles.back} onClick={() => navigate('/')}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2L4 7l5 5" />
          </svg>
          Back to Calendar
        </button>
      </div>
      <div className={styles.body}>
        <aside className={styles.nav}>
          <h1 className={styles.navTitle}>Settings</h1>
          <nav className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
                {item.id === 'data-issues' && brokenEventsCount > 0 && (
                  <span className={styles.navBadge}>{brokenEventsCount}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>
        <main className={styles.main}>
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
