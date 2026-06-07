import type { JSX } from 'react'
import { useCallback, useEffect, useState, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useIsMobile } from './hooks/useIsMobile'
import { useCalendarStore } from './store/calendarStore'
import { useSettingsStore } from './store/settingsStore'
import {
  CalendarHeader,
  Sidebar,
  EventModal,
  EventPreviewPopup,
} from './features/calendar'
import { SettingsPage, PrivacyPolicy } from './features/settings'
import { CommandPalette } from './features/commandPalette'
import { CookieConsent, ErrorBoundary } from './components/common'
import { CalendarSkeleton } from './components/common/Skeleton'
import { OnboardingModal } from './features/onboarding/OnboardingModal'
import { ThemeProvider } from './components/ThemeProvider'
import type { ViewType } from './types'
import { TOAST_DURATION_MS } from './config'

import { extractOriginalEventId } from './lib/events'
import { motion, AnimatePresence } from 'framer-motion'

import './App.css'

const CalendarGrid = lazy(() => import('./features/calendar/components/CalendarGrid').then(m => ({ default: m.CalendarGrid })))
const WeekView = lazy(() => import('./features/calendar/components/WeekView').then(m => ({ default: m.WeekView })))
const DayView = lazy(() => import('./features/calendar/components/DayView').then(m => ({ default: m.DayView })))
const AgendaView = lazy(() => import('./features/calendar/components/AgendaView').then(m => ({ default: m.AgendaView })))
const TodoView = lazy(() => import('./features/calendar/components/TodoView').then(m => ({ default: m.TodoView })))
const JournalView = lazy(() => import('./features/calendar/components/JournalView').then(m => ({ default: m.JournalView })))

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
  week: '/week',
  day: '/day',
  agenda: '/agenda',
  todo: '/tasks',
  journal: '/journal',
}

const URL_TO_VIEW: Record<string, ViewType> = {
  '/month': 'month',
  '/week': 'week',
  '/day': 'day',
  '/agenda': 'agenda',
  '/tasks': 'todo',
  '/journal': 'journal',
}

const VIEW_ORDER: ViewType[] = ['month', 'week', 'day', 'agenda', 'todo', 'journal']

function Toast(): JSX.Element | null {
  const [message, setMessage] = useState<string | null>(null)
  const [hasUndo, setHasUndo] = useState(false)
  // Use a ref for the callback to avoid React's functional-updater trap
  // (passing a function to useState calls it as an updater)
  const undoActionRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleShowToast = (e: CustomEvent) => {
      // Clear any existing timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setMessage(e.detail.message)
      undoActionRef.current = e.detail.onUndo ?? null
      setHasUndo(!!e.detail.onUndo)
      timeoutRef.current = setTimeout(() => {
        setMessage(null)
        undoActionRef.current = null
        setHasUndo(false)
      }, e.detail.duration ?? TOAST_DURATION_MS)
    }

    window.addEventListener('show-toast', handleShowToast as EventListener)
    return () => {
      window.removeEventListener('show-toast', handleShowToast as EventListener)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!message) return null

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toastIcon">✓</span>
      {message}
      {hasUndo && (
        <button
          className="toastUndo"
          onClick={() => {
            undoActionRef.current?.()
            setMessage(null)
            undoActionRef.current = null
            setHasUndo(false)
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}

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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false)

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

      // Cmd/Ctrl+K → open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
        setOverlayOpen(true)
        return
      }

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
        default:
          return <CalendarGrid />
      }
    })()
    return <ErrorBoundary><ViewLoader viewKey={currentView}>{viewElement}</ViewLoader></ErrorBoundary>
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
    (action: 'event' | 'task') => {
      setIsFabMenuOpen(false)
      openModal(undefined, undefined, undefined, action)
    },
    [openModal]
  )

  return (
    <div className="app">
      <CalendarHeader
        onToggleSidebar={handleToggleSidebar}
        onOpenCommandPalette={handleOpenCommandPalette}
      />
      <div className="appContent">
        <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} isCollapsed={sidebarCollapsed} onCollapsedChange={(v) => updateSettings({ sidebarCollapsed: v })} />
        <main className="main">{renderView()}</main>
      </div>
      <MobileFAB
        onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
        isOpen={isFabMenuOpen}
        onAction={handleFabAction}
      />
      <EventModal />
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
  onAction: (action: 'event' | 'task') => void
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
            d="M12 5V19M5 12H19"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        </div>
      )}
    </>
  )
}

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Toast />
        <CookieConsent />
        <Routes>
          <Route path="/month" element={<CalendarApp />} />
          <Route path="/week" element={<CalendarApp />} />
          <Route path="/day" element={<CalendarApp />} />
          <Route path="/agenda" element={<CalendarApp />} />
          <Route path="/tasks" element={<CalendarApp />} />
          <Route path="/journal" element={<CalendarApp />} />
          <Route path="/" element={<CalendarApp />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
