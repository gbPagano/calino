import type { CalendarEvent } from '@/types'

export interface SearchMatch {
  field: 'title' | 'description' | 'location'
  indices: [number, number][]
  value: string
}

export interface SearchResult {
  event: CalendarEvent
  matches: SearchMatch[]
  score: number
}

export interface SearchFilters {
  dateFrom?: string
  dateTo?: string
  calendarIds?: string[]
  types?: ('event' | 'task' | 'journal')[]
  categoryIds?: string[]
}

export interface SearchOptions {
  threshold?: number
  limit?: number
  keys?: string[]
  weights?: Record<string, number>
}
