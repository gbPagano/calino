import type { Command, CommandCategory } from '../types'

export type { Command, CommandCategory }
import { addDays, addWeeks, addMonths, subWeeks, subMonths, format } from 'date-fns'
import type { ThemeMode } from '@/types'

interface CommandFactoryDeps {
  navigate: (path: string) => void
  setCurrentView: (view: 'month' | 'week' | 'day' | 'agenda') => void
  setCurrentDate: (date: string) => void
  openModal: (date?: string, endDate?: string, eventId?: string, mode?: 'event' | 'task') => void
  toggleSidebar?: () => void
  triggerSync?: () => void
  themeMode?: ThemeMode
  caldavDebugMode?: boolean
  timeFormat?: '12h' | '24h'
  sidebarOpen?: boolean
  updateSettings?: (
    settings: Partial<{
      themeMode: ThemeMode
      lightTheme: string
      darkTheme: string
      caldavDebugMode: boolean
      timeFormat: '12h' | '24h'
    }>
  ) => void
}

// 16×16 stroke SVG icons
const ICONS = {
  calendar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v2M10.5 1.5v2"/></svg>',
  arrowRight: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>',
  skipForward: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4l6 4-6 4V4zM11 4l2 4-2 4"/></svg>',
  skipBack: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4L7 8l6 4V4zM5 4L3 8l2 4"/></svg>',
  chevronRight: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  circle: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M13.5 10a1.3 1.3 0 00.26 1.45l.05.05a1.58 1.58 0 11-2.23 2.23l-.05-.05A1.3 1.3 0 0010 13.5a1.3 1.3 0 00-.8 1.2v.1a1.58 1.58 0 01-3.16 0v-.1A1.3 1.3 0 005.28 13.5a1.3 1.3 0 00-1.45.26l-.05.05a1.58 1.58 0 11-2.23-2.23l.05-.05A1.3 1.3 0 002.5 10a1.3 1.3 0 00-1.2-.8H1.2a1.58 1.58 0 010-3.16h.1A1.3 1.3 0 002.5 5.28a1.3 1.3 0 00-.26-1.45l-.05-.05a1.58 1.58 0 112.23-2.23l.05.05A1.3 1.3 0 005.28 2.5a1.3 1.3 0 00.8-1.2V1.2a1.58 1.58 0 013.16 0v.1a1.3 1.3 0 00.8 1.2 1.3 1.3 0 001.45-.26l.05-.05a1.58 1.58 0 112.23 2.23l-.05.05A1.3 1.3 0 0013.5 5.28a1.3 1.3 0 001.2.8h.1a1.58 1.58 0 010 3.16h-.1a1.3 1.3 0 00-1.2.8z"/></svg>',
  bug: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1v2M8 13v2M3 5H1M3 11H1M13 5h2M13 11h2M5.5 2.5l-1 1M10.5 12.5l-1 1M5.5 12.5l-1-1M10.5 2.5l-1-1"/><rect x="3" y="5" width="10" height="8" rx="2"/><path d="M5 5V4a3 3 0 016 0v1"/></svg>',
  sidebar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M6 3v10"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 2.5"/></svg>',
  system: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="9" rx="2"/><path d="M5 15h6M8 12v3"/></svg>',
  sync: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 019.86-3.36M13.5 8a5.5 5.5 0 01-9.86 3.36"/><path d="M12.36 1v3.36H9M3.64 15v-3.36H7"/></svg>',
} as const

const createNavigationCommands = (deps: CommandFactoryDeps): Command[] => {
  const today = new Date()
  return [
    {
      id: 'nav-today',
      label: 'Go to Today',
      description: format(today, 'EEEE, d MMMM yyyy'),
      category: 'navigation',
      keywords: ['today', 'current', 'now', 'home'],
      shortcut: 'T',
      icon: ICONS.calendar,
      action: () => {
        deps.setCurrentDate(format(today, 'yyyy-MM-dd'))
        return 'Navigated to today'
      },
    },
    {
      id: 'nav-tomorrow',
      label: 'Go to Tomorrow',
      description: format(addDays(today, 1), 'EEEE, d MMMM yyyy'),
      category: 'navigation',
      keywords: ['tomorrow', 'next day'],
      icon: ICONS.chevronRight,
      action: () => {
        deps.setCurrentDate(format(addDays(today, 1), 'yyyy-MM-dd'))
        return 'Navigated to tomorrow'
      },
    },
    {
      id: 'nav-next-week',
      label: 'Next Week',
      description: `${format(addWeeks(today, 1), 'd MMM')} – ${format(addWeeks(today, 1), 'd MMM')}`,
      category: 'navigation',
      keywords: ['next week', 'forward'],
      icon: ICONS.skipForward,
      shortcut: ']',
      action: () => {
        deps.setCurrentDate(format(addWeeks(today, 1), 'yyyy-MM-dd'))
        return 'Navigated to next week'
      },
    },
    {
      id: 'nav-prev-week',
      label: 'Previous Week',
      description: `${format(subWeeks(today, 1), 'd MMM')} – ${format(subWeeks(today, 1), 'd MMM')}`,
      category: 'navigation',
      keywords: ['previous week', 'last week', 'back'],
      icon: ICONS.skipBack,
      shortcut: '[',
      action: () => {
        deps.setCurrentDate(format(subWeeks(today, 1), 'yyyy-MM-dd'))
        return 'Navigated to previous week'
      },
    },
    {
      id: 'nav-next-month',
      label: 'Next Month',
      description: format(addMonths(today, 1), 'MMMM yyyy'),
      category: 'navigation',
      keywords: ['next month'],
      icon: ICONS.skipForward,
      shortcut: '⇧]',
      action: () => {
        deps.setCurrentDate(format(addMonths(today, 1), 'yyyy-MM-dd'))
        return 'Navigated to next month'
      },
    },
    {
      id: 'nav-prev-month',
      label: 'Previous Month',
      description: format(subMonths(today, 1), 'MMMM yyyy'),
      category: 'navigation',
      keywords: ['previous month', 'last month'],
      icon: ICONS.skipBack,
      shortcut: '⇧[',
      action: () => {
        deps.setCurrentDate(format(subMonths(today, 1), 'yyyy-MM-dd'))
        return 'Navigated to previous month'
      },
    },
    {
      id: 'view-month',
      label: 'Month View',
      category: 'navigation',
      keywords: ['month view', 'month', 'calendar'],
      icon: ICONS.calendar,
      action: () => {
        deps.setCurrentView('month')
        deps.navigate('/month')
        return 'Switched to month view'
      },
    },
    {
      id: 'view-week',
      label: 'Week View',
      category: 'navigation',
      keywords: ['week view', 'week'],
      icon: ICONS.calendar,
      action: () => {
        deps.setCurrentView('week')
        deps.navigate('/week')
        return 'Switched to week view'
      },
    },
    {
      id: 'view-day',
      label: 'Day View',
      category: 'navigation',
      keywords: ['day view', 'day', 'today'],
      icon: ICONS.calendar,
      action: () => {
        deps.setCurrentView('day')
        deps.navigate('/day')
        return 'Switched to day view'
      },
    },
    {
      id: 'view-agenda',
      label: 'Agenda View',
      category: 'navigation',
      keywords: ['agenda view', 'agenda', 'list'],
      icon: ICONS.calendar,
      action: () => {
        deps.setCurrentView('agenda')
        deps.navigate('/agenda')
        return 'Switched to agenda view'
      },
    },
  ]
}

const createActionCommands = (deps: CommandFactoryDeps): Command[] => [
  {
    id: 'action-new-event',
    label: 'Create Event',
    category: 'actions',
    keywords: ['new event', 'create', 'add', 'event'],
    shortcut: 'C',
    icon: ICONS.plus,
    action: () => {
      deps.openModal()
      return 'Event modal opened'
    },
  },
  {
    id: 'action-new-task',
    label: 'New Task',
    category: 'actions',
    keywords: ['new task', 'task', 'todo'],
    shortcut: 'K',
    icon: ICONS.circle,
    action: () => {
      deps.openModal(undefined, undefined, undefined, 'task')
      return 'Task modal opened'
    },
  },
  {
    id: 'settings-open',
    label: 'Open Settings',
    category: 'actions',
    keywords: ['settings', 'preferences', 'options', 'config'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings')
      return 'Opened settings'
    },
  },
  {
    id: 'toggle-sidebar',
    label: deps.sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar',
    category: 'actions',
    keywords: ['sidebar', 'toggle', 'panel', 'show', 'hide'],
    icon: ICONS.sidebar,
    action: () => {
      deps.toggleSidebar?.()
      return deps.sidebarOpen ? 'Sidebar shown' : 'Sidebar hidden'
    },
  },
  {
    id: 'toggle-dark-mode',
    label: deps.themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
    category: 'actions',
    keywords: ['dark mode', 'light mode', 'theme', 'toggle', 'appearance'],
    icon: deps.themeMode === 'dark' ? ICONS.sun : ICONS.moon,
    action: () => {
      const newMode: ThemeMode = deps.themeMode === 'dark' ? 'light' : 'dark'
      deps.updateSettings?.({ themeMode: newMode })
      return `Switched to ${newMode} mode`
    },
  },
  {
    id: 'toggle-theme-mode',
    label: 'Cycle Theme (Light → Dark → System)',
    description: `Current: ${deps.themeMode === 'auto' ? 'System' : deps.themeMode === 'dark' ? 'Dark' : 'Light'}`,
    category: 'actions',
    keywords: ['theme', 'cycle', 'light', 'dark', 'system', 'appearance', 'mode'],
    icon: deps.themeMode === 'auto' ? ICONS.system : deps.themeMode === 'dark' ? ICONS.moon : ICONS.sun,
    action: () => {
      const order: ThemeMode[] = ['light', 'dark', 'auto']
      const currentIdx = order.indexOf(deps.themeMode ?? 'auto')
      const nextMode = order[(currentIdx + 1) % order.length]
      deps.updateSettings?.({ themeMode: nextMode })
      const label = nextMode === 'auto' ? 'System' : nextMode === 'dark' ? 'Dark' : 'Light'
      return `Theme set to ${label}`
    },
  },
  {
    id: 'toggle-time-format',
    label: deps.timeFormat === '24h' ? 'Switch to 12-hour Format' : 'Switch to 24-hour Format',
    category: 'actions',
    keywords: ['time format', '12h', '24h', 'clock', 'toggle'],
    icon: ICONS.clock,
    action: () => {
      const newFormat = deps.timeFormat === '24h' ? '12h' : '24h'
      deps.updateSettings?.({ timeFormat: newFormat })
      return `Time format set to ${newFormat}`
    },
  },
  {
    id: 'sync-calendars',
    label: 'Sync Calendars',
    category: 'actions',
    keywords: ['sync', 'caldav', 'refresh', 'update'],
    icon: ICONS.sync,
    action: () => {
      deps.triggerSync?.()
      return 'Syncing calendars...'
    },
  },
]

const createSettingsCommands = (deps: CommandFactoryDeps): Command[] => [
  {
    id: 'debug-toggle',
    label: 'Toggle CalDAV Debug Mode',
    description: 'Enable or disable CalDAV sync debug logging',
    category: 'settings',
    keywords: ['debug', 'caldav', 'sync', 'logging', 'console'],
    icon: ICONS.bug,
    action: () => {
      const newValue = !deps.caldavDebugMode
      deps.updateSettings?.({ caldavDebugMode: newValue })
      return newValue ? 'CalDAV debug mode enabled' : 'CalDAV debug mode disabled'
    },
  },
  {
    id: 'settings-general',
    label: 'General Settings',
    category: 'settings',
    keywords: ['general', 'general settings'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=general')
      return 'Opened general settings'
    },
  },
  {
    id: 'settings-theme',
    label: 'Theme Settings',
    category: 'settings',
    keywords: ['theme', 'dark mode', 'light mode', 'appearance'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=theme')
      return 'Opened theme settings'
    },
  },
  {
    id: 'settings-calendars',
    label: 'Calendar Settings',
    category: 'settings',
    keywords: ['calendars', 'calendar settings'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=calendar')
      return 'Opened calendar settings'
    },
  },
  {
    id: 'settings-events',
    label: 'Event Settings',
    category: 'settings',
    keywords: ['event defaults', 'event settings'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=events')
      return 'Opened event settings'
    },
  },
  {
    id: 'settings-sync',
    label: 'Sync Settings',
    category: 'settings',
    keywords: ['sync settings', 'caldav', 'account'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=caldav')
      return 'Opened sync settings'
    },
  },
  {
    id: 'settings-data',
    label: 'Data Settings',
    category: 'settings',
    keywords: ['data', 'import', 'export', 'backup'],
    icon: ICONS.settings,
    action: () => {
      deps.navigate('/settings?tab=data')
      return 'Opened data settings'
    },
  },
]

export const createCommandRegistry = (deps: CommandFactoryDeps): Command[] => [
  ...createActionCommands(deps),
  ...createNavigationCommands(deps),
  ...createSettingsCommands(deps),
]

export const getCommandsByCategory = (commands: Command[]): Record<CommandCategory, Command[]> => {
  return commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = []
      }
      acc[cmd.category].push(cmd)
      return acc
    },
    {} as Record<CommandCategory, Command[]>
  )
}
