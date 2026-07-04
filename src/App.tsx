import type { JSX } from 'react'
import { useCallback, useEffect, useState, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useIsMobile } from './hooks/useIsMobile'
import { useCalendarStore } from './store/calendarStore'
import { useSettingsStore } from './store/settingsStore'
import {
  CalendarHeader,
  Sidebar,
  EventModal,
  EventPreviewPopup,
} from './features/calendar'
import { JournalDayModal } from './features/calendar/components/JournalDayModal'
import { SettingsPage, PrivacyPolicy } from './features/settings'
import { CommandPalette } from './features/commandPalette'
import { CookieConsent, ErrorBoundary } from './components/common'
import { CalendarSkeleton } from './components/common/Skeleton'
import { OnboardingModal } from './features/onboarding/OnboardingModal'
import { SetupPage } from './features/setup/SetupPage'
import { MasterPasswordPrompt } from './features/settings/components/MasterPasswordPrompt'
import { useConfigStore } from './store/configStore'
import { ThemeProvider } from './components/ThemeProvider'
import { useCardDAV } from './features/carddav/hooks/useCardDAV'
import type { ViewType } from './types'

import { extractOriginalEventId } from './lib/events'
import { motion, AnimatePresence } from 'framer-motion'

import './App.css'

const CalendarGrid = lazy(() => import('./features/calendar/components/CalendarGrid').then(m => ({ default: m.CalendarGrid })))
const WeekView = lazy(() => import('./features/calendar/components/WeekView').then(m => ({ default: m.WeekView })))
const DayView = lazy(() => import('./features/calendar/components/DayView').then(m => ({ default: m.DayView })))
const AgendaView = lazy(() => import('./features/calendar/components/AgendaView').then(m => ({ default: m.AgendaView })))
const TodoView = lazy(() => import('./features/calendar/components/TodoView').then(m => ({ default: m.TodoView })))
const JournalView = lazy(() => import('./features/calendar/components/JournalView').then(m => ({ default: m.JournalView })))
const ContactsView = lazy(() => import('./features/carddav/components/ContactsView').then(m => ({ default: m.ContactsView })))
const YearView = lazy(() => import('./features/calendar/components/YearView').then(m => ({ default: m.YearView })))

function ViewLoader({ children, viewKey }: { children: JSX.Element; viewKey: ViewType }): JSX.Element {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
      >
        <Suspense fallback={<CalendarSkeleton view={viewKey} />}>
          {children}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

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

const URL_TO_VIEW: Record<string, ViewType> = {
  '/month': 'month',
  '/year': 'year',
  '/week': 'week',
  '/day': 'day',
  '/agenda': 'agenda',
  '/tasks': 'todo',
  '/journal': 'journal',
  '/contacts': 'contacts',
}

const VIEW_ORDER: ViewType[] = ['month', 'year', 'week', 'day', 'agenda', 'todo', 'journal', 'contacts']

function useViewManager(): void {
  const navigate = useNavigate()
  const location = useLocation()
  const currentView = useCalendarStore((state) => state.currentView)
  const setCurrentView = useCalendarStore((state) => state.setCurrentView)
  const isMobile = useIsMobile()

  const isMounted = useRef(false)
  const lastUrlView = useRef<ViewType | null>(null)
  const currentViewRef = useRef(currentView)

  // Keep ref in sync with state
  useEffect(() => {
    currentViewRef.current = currentView
  }, [currentView])

  useEffect(() => {
    isMounted.current = true
  }, [])

  // Check if we're in the middle of a GitHub Pages redirect
  // The redirect URL format is /?/path or /?/path&query
  const isRedirecting = location.search.startsWith('?/')

  const isCalendarRoute = VIEW_ORDER.some((view) => location.pathname === VIEW_ROUTES[view])
  const isRootRoute = location.pathname === '/'

  // Sync URL -> State (only when URL changes externally)
  useEffect(() => {
    if (!isMounted.current) return
    if (isRedirecting) return // Wait for GitHub Pages redirect to complete

    // Handle root route - redirect to default view
    if (isRootRoute) {
      navigate(isMobile ? '/agenda' : '/month', { replace: true })
      return
    }

    if (!isCalendarRoute) return

    const viewFromUrl = URL_TO_VIEW[location.pathname]
    if (viewFromUrl && viewFromUrl !== lastUrlView.current) {
      lastUrlView.current = viewFromUrl
      if (viewFromUrl !== currentViewRef.current) {
        setCurrentView(viewFromUrl)
      }
    }
  }, [
    location.pathname,
    setCurrentView,
    isCalendarRoute,
    isRootRoute,
    isRedirecting,
    navigate,
    isMobile,
  ])

  // Handle keyboard shortcuts - navigate and update state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in an input, textarea, select, or contentEditable element
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return
      }

      // Ignore if a modal or overlay is open
      const { isModalOpen, isOverlayOpen } = useCalendarStore.getState()
      if (isModalOpen || isOverlayOpen) return

      // Ignore if Ctrl or Cmd is held (browser shortcuts like Ctrl+< etc.)
      if (e.ctrlKey || e.metaKey) return

      let newView: ViewType | null = null
      if (e.key === '<' || e.key === ',') {
        e.preventDefault()
        const currentIndex = VIEW_ORDER.indexOf(currentViewRef.current)
        const prevIndex = (currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length
        newView = VIEW_ORDER[prevIndex]
      } else if (e.key === '>' || e.key === '.') {
        e.preventDefault()
        const currentIndex = VIEW_ORDER.indexOf(currentViewRef.current)
        const nextIndex = (currentIndex + 1) % VIEW_ORDER.length
        newView = VIEW_ORDER[nextIndex]
      }

      if (newView) {
        lastUrlView.current = newView
        setCurrentView(newView)
        navigate(VIEW_ROUTES[newView], { replace: true })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentView, navigate])
}

function PreviewPopupWrapper(): JSX.Element | null {
  const previewEventId = useCalendarStore((state) => state.previewEventId)
  const previewPosition = useCalendarStore((state) => state.previewPosition)
  const events = useCalendarStore((state) => state.events)

  if (!previewEventId || !previewPosition) return null

  const originalId = extractOriginalEventId(previewEventId)
  const event =
    events.find((e) => e.id === previewEventId) ??
    events.find((e) => originalId !== null && e.id === originalId)
  if (!event) return null

  return (
    <EventPreviewPopup event={event} position={previewPosition} clickedEventId={previewEventId} />
  )
}

function CalendarApp(): JSX.Element {
  const navigate = useNavigate()
  const currentView = useCalendarStore((state) => state.currentView)
  const setOverlayOpen = useCalendarStore((state) => state.setOverlayOpen)
  const setShowAddCalendar = useCalendarStore((state) => state.setShowAddCalendar)
  const openModal = useCalendarStore((state) => state.openModal)
  const isJournalModalOpen = useCalendarStore((state) => state.isJournalModalOpen)
  const journalModalDate = useCalendarStore((state) => state.journalModalDate)
  const journalStartInCompose = useCalendarStore((state) => state.journalStartInCompose)
  const closeJournalModal = useCalendarStore((state) => state.closeJournalModal)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false)

  // Initialize CardDAV sync
  useCardDAV()

  useViewManager()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in an input, textarea, select, or contentEditable element
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return
      }

      // Ignore if a modal or overlay is open
      const { isModalOpen, isOverlayOpen: overlayOpen } = useCalendarStore.getState()
      if (isModalOpen || overlayOpen) return

      // Cmd/Ctrl+K → open command palette (must be before the ctrlKey guard)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
        setOverlayOpen(true)
        return
      }

      // Ignore single-key shortcuts if Ctrl or Cmd is held
      if (e.ctrlKey || e.metaKey) return

      const path = window.location.pathname
      const isSettings = path.startsWith('/settings')

      // Escape in settings → go back to calendar
      if (e.key === 'Escape' && isSettings) {
        e.preventDefault()
        navigate('/')
        return
      }

      // Don't handle single-key shortcuts on settings or other non-calendar routes
      if (isSettings) return

      // T → go to today
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        const today = new Date().toISOString().split('T')[0]
        useCalendarStore.getState().setCurrentDate(today)
        return
      }

      // C → create new event
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        openModal()
        return
      }

      // K → create new task
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        openModal(undefined, undefined, undefined, 'task')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setOverlayOpen, navigate, openModal])

  const renderView = (): JSX.Element => {
    const viewElement = (() => {
      switch (currentView) {
        case 'month':
          return <CalendarGrid />
        case 'year':
          return <YearView />
        case 'week':
          return <WeekView />
        case 'day':
          return <DayView />
        case 'agenda':
          return <AgendaView />
        case 'todo':
          return <TodoView />
        case 'journal':
          return <JournalView />
        case 'contacts':
          return <ContactsView />
        default:
          return <CalendarGrid />
      }
    })()
    // Key the boundary on the view so switching views remounts a fresh
    // boundary and recovers from a crashed view without a full reload.
    return <ErrorBoundary key={currentView}><ViewLoader viewKey={currentView}>{viewElement}</ViewLoader></ErrorBoundary>
  }

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth <= 950) {
      setIsSidebarOpen((prev) => !prev)
    } else {
      updateSettings({ sidebarCollapsed: !sidebarCollapsed })
    }
  }, [sidebarCollapsed, updateSettings])

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const handleOpenCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true)
    setOverlayOpen(true)
  }, [setOverlayOpen])

  const handleFabAction = useCallback(
    (action: 'event' | 'task' | 'commandPalette' | 'settings' | 'sidebar') => {
      setIsFabMenuOpen(false)
      if (action === 'commandPalette') {
        handleOpenCommandPalette()
      } else if (action === 'settings') {
        navigate('/settings')
      } else if (action === 'sidebar') {
        handleToggleSidebar()
      } else {
        openModal(undefined, undefined, undefined, action)
      }
    },
    [openModal, handleOpenCommandPalette, navigate, handleToggleSidebar]
  )

  return (
    <div className="app">
      <CalendarHeader
        onToggleSidebar={handleToggleSidebar}
        onOpenCommandPalette={handleOpenCommandPalette}
      />
      <div className="appContent" data-sidebar-collapsed={sidebarCollapsed || undefined}>
        <ErrorBoundary fallback={null}>
          <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} isCollapsed={sidebarCollapsed} onCollapsedChange={(v) => updateSettings({ sidebarCollapsed: v })} />
        </ErrorBoundary>
        <main className="main">{renderView()}</main>
      </div>
      <MobileFAB
        onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
        isOpen={isFabMenuOpen}
        onAction={handleFabAction}
      />
      <ErrorBoundary fallback={null}>
        <EventModal />
      </ErrorBoundary>
      {isJournalModalOpen && journalModalDate && (
        <JournalDayModal
          isOpen={isJournalModalOpen}
          date={journalModalDate}
          startInCompose={journalStartInCompose}
          onClose={closeJournalModal}
        />
      )}
      <PreviewPopupWrapper />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => {
          setIsCommandPaletteOpen(false)
          setOverlayOpen(false)
        }}
        toggleSidebar={handleToggleSidebar}
        sidebarOpen={window.innerWidth <= 950 ? isSidebarOpen : !sidebarCollapsed}
      />
      <OnboardingModal onAddCalendar={() => setShowAddCalendar(true)} />
    </div>
  )
}

interface MobileFABProps {
  onClick: () => void
  isOpen: boolean
  onAction: (action: 'event' | 'task' | 'commandPalette' | 'settings' | 'sidebar') => void
}

function MobileFAB({ onClick, isOpen, onAction }: MobileFABProps): JSX.Element {
  return (
    <>
      <button className="mobile-fab" onClick={onClick} aria-label="Quick actions">
        <svg aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="mobile-fab-menu">
          <button className="mobile-fab-option" onClick={() => onAction('event')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 2v4M8 2v4M3 10h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Create Event
          </button>
          <button className="mobile-fab-option" onClick={() => onAction('task')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 11l3 3L22 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Create Task
          </button>
          <button className="mobile-fab-option" onClick={() => onAction('sidebar')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 3v18" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Calendar & CalDAV
          </button>
          <button className="mobile-fab-option" onClick={() => onAction('commandPalette')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Search & Commands
          </button>
          <button className="mobile-fab-option" onClick={() => onAction('settings')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Settings
          </button>
        </div>
      )}
    </>
  )
}

function GitHubPagesRedirect(): null {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.search.startsWith('?/')) {
      const query = location.search.slice(2)
      const parts = query.split('&')
      const path = parts[0].replace(/~and~/g, '&')
      const search = parts[1] ? '?' + parts[1].replace(/~and~/g, '&') : ''
      navigate(path + search + location.hash, { replace: true })
    }
  }, [location, navigate])

  return null
}

function App(): JSX.Element {
  const loadConfigFile = useConfigStore((state) => state.loadConfigFile)

  // Load self-hosted config on mount
  useEffect(() => {
    loadConfigFile()
  }, [loadConfigFile])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <GitHubPagesRedirect />
        <Toaster richColors position="bottom-right" duration={5000} />
        <CookieConsent />
        <MasterPasswordPrompt />
        <Routes>
          <Route path="/month" element={<CalendarApp />} />
          <Route path="/year" element={<CalendarApp />} />
          <Route path="/week" element={<CalendarApp />} />
          <Route path="/day" element={<CalendarApp />} />
          <Route path="/agenda" element={<CalendarApp />} />
          <Route path="/tasks" element={<CalendarApp />} />
          <Route path="/journal" element={<CalendarApp />} />
          <Route path="/contacts" element={<CalendarApp />} />
          <Route path="/" element={<CalendarApp />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/setup" element={<SetupPage />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
