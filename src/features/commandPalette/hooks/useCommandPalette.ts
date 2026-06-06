import { useMemo, useCallback, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  useCalendarStore,
  selectOpenModal,
  selectAddEvent,
  selectEvents,
  selectCalendars,
  selectSetCurrentView,
  selectSetCurrentDate,
} from '@/store/calendarStore'
import { useSettingsStore, selectThemeMode, selectUpdateSettings } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { createCommandRegistry, type Command } from '../commands'
import { parseNaturalLanguage, type NLPParseResult } from '@/features/nlp'
import type {
  CommandResult,
  ParsedInput,
  EventResult,
  CalendarResult,
  QuickAddResult,
} from '../types'

interface UseCommandPaletteProps {
  isOpen: boolean
  toggleSidebar?: () => void
  sidebarOpen?: boolean
}

export interface ExecuteResult {
  success: boolean
  message: string
}

export function useCommandPalette({ isOpen, toggleSidebar, sidebarOpen }: UseCommandPaletteProps): {
  query: string
  setQuery: (q: string) => void
  results: CommandResult[]
  selectedIndex: number
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
  preview: NLPParseResult | null
  executeSelected: (index?: number) => Promise<ExecuteResult | undefined>
  handleKeyDown: (e: React.KeyboardEvent) => void
  parseInput: (query: string) => ParsedInput
} {
  const navigate = useNavigate()
  const [query, setQueryState] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setSelectedIndex(0)
  }, [])
  const setCurrentView = useCalendarStore(selectSetCurrentView)
  const setCurrentDate = useCalendarStore(selectSetCurrentDate)
  const openModal = useCalendarStore(selectOpenModal)
  const addEvent = useCalendarStore(selectAddEvent)
  const events = useCalendarStore(selectEvents)
  const calendars = useCalendarStore(selectCalendars)

  const themeMode = useSettingsStore(selectThemeMode)
  const updateSettings = useSettingsStore(selectUpdateSettings)
  const caldavDebugMode = useSettingsStore((state) => state.caldavDebugMode)

  const { syncAll, createEvent: createCalDAVEvent } = useCalDAV()

  const timeFormat = useSettingsStore((state) => state.timeFormat)

  const commands = useMemo(() => {
    return createCommandRegistry({
      navigate,
      setCurrentView,
      setCurrentDate,
      openModal,
      themeMode,
      caldavDebugMode,
      timeFormat,
      sidebarOpen,
      toggleSidebar,
      updateSettings,
      triggerSync: syncAll,
    })
  }, [
    navigate,
    setCurrentView,
    setCurrentDate,
    openModal,
    themeMode,
    caldavDebugMode,
    timeFormat,
    sidebarOpen,
    toggleSidebar,
    updateSettings,
    syncAll,
  ])

  const parseInput = useCallback((input: string): ParsedInput => {
    const trimmed = input.trim().toLowerCase()

    if (!trimmed) {
      return { type: 'empty', raw: input }
    }

    // Explicit command prefix
    if (trimmed.startsWith('>')) {
      const cmd = trimmed.slice(1).trim()
      return { type: 'command', raw: input, command: cmd }
    }

    // Explicit navigation prefix
    if (trimmed.startsWith('@')) {
      const ref = trimmed.slice(1).trim()
      return { type: 'navigation', raw: input, dateRef: ref }
    }

    // Pure date navigation keywords (no event title, just a date reference)
    const pureDateKeywords = [
      'today',
      'tomorrow',
      'yesterday',
      'next week',
      'last week',
      'next month',
      'last month',
      'next year',
      'last year',
      'this weekend',
      'next weekend',
    ]

    // Day names - navigate to that day
    const dayNames = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]

    // Month names - navigate to that month
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ]

    // Check for pure date navigation (exact or starts with date keyword)
    for (const keyword of pureDateKeywords) {
      if (trimmed === keyword || trimmed.startsWith(keyword)) {
        return { type: 'navigation', raw: input, dateRef: trimmed }
      }
    }

    // Check for day names ("monday", "next monday", "this friday")
    for (const day of dayNames) {
      if (trimmed === day || trimmed.endsWith(day)) {
        return { type: 'navigation', raw: input, dateRef: trimmed }
      }
    }

    // Check for month names ("march", "march 2024", "show march")
    for (const month of monthNames) {
      if (trimmed.includes(month)) {
        return { type: 'navigation', raw: input, dateRef: trimmed }
      }
    }

    // Check for year patterns ("2024", "2025")
    if (/^\d{4}$/.test(trimmed)) {
      return { type: 'navigation', raw: input, dateRef: trimmed }
    }

    // Check for event creation intent (has time or duration indicators)
    const hasTimeIndicator = /\bat\s+\d|\bat\s+noon|\bat\s+midnight|\bat\s+lunch|\bat\s+dinner|\d{1,2}\s*(am|pm)|\d{1,2}:\d{2}/.test(trimmed)
    const hasDurationIndicator = /for\s+\d+\s*(min|hour|hr)/.test(trimmed)
    const hasLocationIndicator = /\bat\s+(?!\d|noon|midnight|lunch|dinner)/.test(trimmed)

    // If has time/duration/location, try quick-add
    if (hasTimeIndicator || hasDurationIndicator || hasLocationIndicator) {
      const result = parseNaturalLanguage(input)
      if (result.confidence > 0.6 && result.title) {
        return { type: 'quick-add', raw: input }
      }
    }

    // Default: search
    return { type: 'search', raw: input }
  }, [])

  const searchEvents = useCallback(
    (searchQuery: string): EventResult[] => {
      if (!searchQuery.trim()) return []

      const lowerQuery = searchQuery.toLowerCase()
      return events
        .filter(
          (event) =>
            event.title.toLowerCase().includes(lowerQuery) ||
            (event.location && event.location.toLowerCase().includes(lowerQuery))
        )
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          calendarId: event.calendarId,
        }))
    },
    [events]
  )

  const searchCalendars = useCallback(
    (searchQuery: string): CalendarResult[] => {
      if (!searchQuery.trim()) return []

      const lowerQuery = searchQuery.toLowerCase()
      return calendars
        .filter((cal) => cal.name.toLowerCase().includes(lowerQuery))
        .slice(0, 3)
        .map((cal) => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
        }))
    },
    [calendars]
  )

  const filterCommands = useCallback(
    (searchQuery: string): Command[] => {
      if (!searchQuery.trim()) {
        return commands.slice(0, 8)
      }

      const lowerQuery = searchQuery.toLowerCase()

      return commands
        .filter((cmd) => {
          const labelMatch = cmd.label.toLowerCase().includes(lowerQuery.replace(/^>/, ''))
          const keywordMatch = cmd.keywords.some((kw) =>
            kw.toLowerCase().includes(lowerQuery.replace(/^>/, ''))
          )
          const descMatch = cmd.description?.toLowerCase().includes(lowerQuery.replace(/^>/, ''))
          return labelMatch || keywordMatch || descMatch
        })
        .sort((a, b) => {
          const aExact = a.label.toLowerCase() === lowerQuery.replace(/^>/, '') ? 0 : 1
          const bExact = b.label.toLowerCase() === lowerQuery.replace(/^>/, '') ? 0 : 1
          return aExact - bExact
        })
        .slice(0, 8)
    },
    [commands]
  )

  const results = ((): CommandResult[] => {
    if (!query.trim()) {
      const defaultCommands = filterCommands('')
      return defaultCommands.map((cmd) => ({
        type: 'command' as const,
        item: cmd,
        score: 1,
      }))
    }

    const parsed = parseInput(query)

    // Direct navigation - navigate to date
    if (parsed.type === 'navigation') {
      const dateRef = parsed.dateRef || query
      const parsedDate = parseNaturalLanguage(dateRef)
      
      // Create a navigation command on the fly
      const navCmd = {
        id: 'nav-quick',
        label: `Go to ${dateRef}`,
        description: format(parsedDate.startDate, 'EEEE, d MMMM yyyy'),
        category: 'navigation' as const,
        keywords: ['navigate', 'go', 'date'],
        icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v2M10.5 1.5v2"/></svg>',
        action: () => {
          setCurrentDate(format(parsedDate.startDate, 'yyyy-MM-dd'))
          if (parsedDate.startDate.getMonth() !== new Date().getMonth() ||
              parsedDate.startDate.getFullYear() !== new Date().getFullYear()) {
            setCurrentView('month')
          }
          return `Navigated to ${format(parsedDate.startDate, 'EEEE, d MMMM yyyy')}`
        },
      }
      return [{ type: 'command' as const, item: navCmd, score: 1 }]
    }

    // Explicit command prefix
    if (parsed.type === 'command') {
      const filtered = filterCommands(parsed.command || query)
      return filtered.map((cmd) => ({
        type: 'command' as const,
        item: cmd,
        score:
          cmd.label.toLowerCase() === (parsed.command || query).toLowerCase() ? 1 : 0.5,
      }))
    }

    if (parsed.type === 'quick-add') {
      const nlpResult = parseNaturalLanguage(query)
      if (nlpResult.confidence > 0.5 && nlpResult.title) {
        const quickAddItem: QuickAddResult = {
          title: nlpResult.title,
          startDate: nlpResult.startDate,
          endDate: nlpResult.endDate ?? undefined,
          location: nlpResult.location,
          isAllDay: nlpResult.isAllDay,
          isTask: nlpResult.isTask,
          confidence: nlpResult.confidence,
        }
        return [
          {
            type: 'quick-add' as const,
            item: quickAddItem,
            score: nlpResult.confidence,
          },
        ]
      }
      return []
    }

    const commandResults = filterCommands(query).map((cmd) => ({
      type: 'command' as const,
      item: cmd,
      score: 0.8,
    }))

    const eventResults = searchEvents(query).map((event) => ({
      type: 'event' as const,
      item: event,
      score: 0.6,
    }))

    const calendarResults = searchCalendars(query).map((cal) => ({
      type: 'calendar' as const,
      item: cal,
      score: 0.7,
    }))

    return [...commandResults, ...calendarResults, ...eventResults]
  })()

  const preview = useMemo((): NLPParseResult | null => {
    const parsed = parseInput(query)
    if (parsed.type === 'quick-add') {
      const nlpResult = parseNaturalLanguage(query)
      if (nlpResult.confidence > 0.5) {
        return nlpResult
      }
    }
    return null
  }, [query, parseInput])

  const executeSelected = useCallback(
    async (index?: number) => {
      const executeIndex = index ?? selectedIndex
      const selected = results[executeIndex]
      if (!selected) return { success: false, message: '' }

      if (selected.type === 'command') {
        const cmd = selected.item as Command
        const message = cmd.action()
        return { success: true, message: message || 'Executed' }
      }

      if (selected.type === 'event') {
        const event = selected.item as EventResult
        openModal(event.start, undefined, event.id)
        return { success: true, message: `Opened: ${event.title}` }
      }

      if (selected.type === 'calendar') {
        const cal = selected.item as CalendarResult
        navigate(`/settings?tab=calendars&calendar=${cal.id}`)
        return { success: true, message: `Opened calendar: ${cal.name}` }
      }

      if (selected.type === 'quick-add') {
        const qa = selected.item as QuickAddResult
        const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0]
        const calendarId = defaultCalendar?.id || 'default'

        if (qa.isTask) {
          const newEvent = {
            id: crypto.randomUUID(),
            calendarId,
            title: qa.title,
            location: qa.location,
            start: qa.startDate.toISOString(),
            end: qa.endDate ? qa.endDate.toISOString() : qa.startDate.toISOString(),
            isAllDay: qa.isAllDay,
            type: 'task' as const,
            dueDate: format(qa.startDate, 'yyyy-MM-dd'),
          }
          addEvent(newEvent)
          try {
            await createCalDAVEvent(calendarId, newEvent)
          } catch {
            // error already handled by useCalDAV
          }
          return { success: true, message: `Created task: ${qa.title}` }
        }

        const newEvent = {
          id: crypto.randomUUID(),
          calendarId,
          title: qa.title,
          location: qa.location,
          start: qa.startDate.toISOString(),
          end: qa.endDate ? qa.endDate.toISOString() : qa.startDate.toISOString(),
          isAllDay: qa.isAllDay,
        }
        addEvent(newEvent)
        try {
          await createCalDAVEvent(calendarId, newEvent)
        } catch {
          // error already handled by useCalDAV
        }
        return { success: true, message: `Created event: ${qa.title}` }
      }

      return { success: false, message: '' }
    },
    [results, selectedIndex, openModal, navigate, addEvent, calendars, createCalDAVEvent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        executeSelected()
      }
    },
    [results.length, executeSelected]
  )
  useEffect(() => {
    if (!isOpen) {
      setQueryState('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  return {
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    preview,
    executeSelected,
    handleKeyDown,
    parseInput,
  }
}
