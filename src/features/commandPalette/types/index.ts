import type { ViewType } from '@/types'

export type CommandCategory = 'navigation' | 'actions' | 'settings' | 'event'

export interface Command {
  id: string
  label: string
  description?: string
  category: CommandCategory
  keywords: string[]
  shortcut?: string
  icon?: string
  action: () => string | void
}

export interface QuickAddResult {
  title: string
  startDate: Date
  endDate?: Date
  location?: string
  isAllDay: boolean
  isTask: boolean
  confidence: number
}

export interface CalendarResult {
  id: string
  name: string
  color: string
}

export interface EventResult {
  id: string
  title: string
  start: string
  calendarId: string
}

export interface ExecuteResult {
  success: boolean
  message: string
  linkText?: string
  onLinkClick?: () => void
}

export type CommandPaletteItemGroup =
  | 'navigation'
  | 'actions'
  | 'settings'
  | 'calendars'
  | 'event'
  | 'quick-add'

export type CommandPaletteItemData = Command | CalendarResult | EventResult | QuickAddResult

export interface CommandPaletteItem {
  id: string
  value: string
  group: CommandPaletteItemGroup
  keywords: string[]
  shortcut?: string
  onSelect: () => Promise<ExecuteResult | undefined>
  data: CommandPaletteItemData
  itemType: 'command' | 'event' | 'calendar' | 'quick-add'
}



export type DateNavigationTarget =
  | 'today'
  | 'tomorrow'
  | 'next-week'
  | 'prev-week'
  | 'next-month'
  | 'prev-month'
  | ViewType
  | 'settings'
  | 'new-event'
  | 'sync'
  | 'toggle-sidebar'

export interface ParsedInput {
  type: 'command' | 'navigation' | 'search' | 'quick-add' | 'empty'
  raw: string
  command?: string
  dateRef?: string
}
