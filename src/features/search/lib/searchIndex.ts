import Fuse, { type IFuseOptions } from 'fuse.js'
import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import type { CalendarEvent } from '@/types'
import type { SearchResult, SearchFilters, SearchOptions } from '../types'

const DEFAULT_WEIGHTS = {
  title: 2,
  location: 1.5,
  description: 1,
}

const DEFAULT_OPTIONS: IFuseOptions<CalendarEvent> = {
  keys: [
    { name: 'title', weight: DEFAULT_WEIGHTS.title },
    { name: 'location', weight: DEFAULT_WEIGHTS.location },
    { name: 'description', weight: DEFAULT_WEIGHTS.description },
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
}

let fuseInstance: Fuse<CalendarEvent> | null = null

export function initializeSearchIndex(events: CalendarEvent[], options?: SearchOptions): void {
  // Only pick valid IFuseOptions fields — don't spread the entire SearchOptions
  // (which includes runtime fields like `limit` and `weights` that Fuse ignores)
  const fuseOptions: IFuseOptions<CalendarEvent> = {
    ...DEFAULT_OPTIONS,
    ...(options?.threshold !== undefined && { threshold: options.threshold }),
  }

  // Always remap keys when provided — not just when weights are present
  if (options?.keys) {
    fuseOptions.keys = options.keys.map((key) => ({
      name: key,
      weight: options.weights?.[key] ?? 1,
    }))
  }

  fuseInstance = new Fuse(events, fuseOptions)
}

export function search(
  query: string,
  filters?: SearchFilters,
  options?: SearchOptions
): SearchResult[] {
  if (!fuseInstance) {
    console.warn('[Search] Index not initialized. Call initializeSearchIndex() first.')
    return []
  }

  if (!query.trim()) {
    if (!filters) return []
    // Filter-only mode: return all events matching filters without Fuse search
    return filterCollection(fuseInstance, filters)
  }

  const limit = options?.limit ?? 50

  // Don't pass limit to Fuse — we need all matches for proper sorting
  const results = fuseInstance.search(query)

  let filteredResults = results

  if (filters) {
    filteredResults = results.filter((result) => {
      const event = result.item
      let passesFilters = true

      if (filters.calendarIds && filters.calendarIds.length > 0) {
        passesFilters = passesFilters && filters.calendarIds.includes(event.calendarId)
      }

      if (filters.dateFrom || filters.dateTo) {
        const fromDate = filters.dateFrom ? startOfDay(parseISO(filters.dateFrom)) : null
        const toDate = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : null

        passesFilters = passesFilters && dateOverlapsRange(event, fromDate, toDate)
      }

      return passesFilters
    })
  }

  // Pre-parse start dates once for the sort
  const dateCache = new Map<string, number>()
  const getStartTime = (start: string): number => {
    let ts = dateCache.get(start)
    if (ts === undefined) {
      try {
        ts = parseISO(start).getTime()
      } catch {
        ts = 0
      }
      if (Number.isNaN(ts)) ts = 0
      dateCache.set(start, ts)
    }
    return ts
  }

  const now = Date.now()

  return filteredResults
    .sort((a, b) => {
      // Blend Fuse relevance with date recency
      const dateA = getStartTime(a.item.start)
      const dateB = getStartTime(b.item.start)
      const scoreA = a.score ?? 0
      const scoreB = b.score ?? 0
      // Lower Fuse score = better match
      const recencyA = 1 / (1 + (now - dateA) / (1000 * 60 * 60 * 24))
      const recencyB = 1 / (1 + (now - dateB) / (1000 * 60 * 60 * 24))
      const combinedA = (1 - scoreA) * 0.7 + recencyA * 0.3
      const combinedB = (1 - scoreB) * 0.7 + recencyB * 0.3
      return combinedB - combinedA
    })
    .slice(0, limit)
    .map((result) => ({
      event: result.item,
      score: result.score ?? 0,
      matches:
        result.matches?.map((match) => ({
          field: match.key as 'title' | 'description' | 'location',
          indices: match.indices as [number, number][],
          value: match.value ?? '',
        })) ?? [],
    }))
}

/**
 * Check if an event's time range overlaps with the given date bounds.
 */
function dateOverlapsRange(
  event: CalendarEvent,
  fromDate: Date | null,
  toDate: Date | null
): boolean {
  try {
    const eventStart = parseISO(event.start)
    const eventEnd = parseISO(event.end)

    if (fromDate && toDate) {
      return (
        isWithinInterval(eventStart, { start: fromDate, end: toDate }) ||
        isWithinInterval(eventEnd, { start: fromDate, end: toDate }) ||
        (eventStart <= fromDate && eventEnd >= toDate)
      )
    }
    if (fromDate) {
      return eventEnd >= fromDate
    }
    if (toDate) {
      return eventStart <= toDate
    }
    return true
  } catch {
    return false
  }
}

/**
 * Filter the full Fuse collection against the given filters (no query search).
 */
function filterCollection(
  instance: Fuse<CalendarEvent>,
  filters: SearchFilters
): SearchResult[] {
  const allEvents = instance.getIndex().docs as CalendarEvent[]

  const filtered = allEvents.filter((event) => {
    let passes = true

    if (filters.calendarIds && filters.calendarIds.length > 0) {
      passes = passes && filters.calendarIds.includes(event.calendarId)
    }

    if (filters.dateFrom || filters.dateTo) {
      const fromDate = filters.dateFrom ? startOfDay(parseISO(filters.dateFrom)) : null
      const toDate = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : null
      passes = passes && dateOverlapsRange(event, fromDate, toDate)
    }

    return passes
  })

  return filtered.map((event) => ({
    event,
    score: 0,
    matches: [],
  }))
}

export function getSearchInstance(): Fuse<CalendarEvent> | null {
  return fuseInstance
}

export function updateSearchIndex(
  events: CalendarEvent[],
  options?: SearchOptions
): void {
  if (fuseInstance) {
    if (options) {
      // Re-initialize with new options
      initializeSearchIndex(events, options)
    } else {
      fuseInstance.setCollection(events)
    }
  } else {
    initializeSearchIndex(events, options)
  }
}
