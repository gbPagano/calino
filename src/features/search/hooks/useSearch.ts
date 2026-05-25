import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { updateSearchIndex, search } from '../lib/searchIndex'
import type { SearchResult, SearchFilters } from '../types'

const DEBOUNCE_MS = 300
const MAX_RESULTS = 50

export function useSearch() {
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const events = useCalendarStore((state) => state.events)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  const indexTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Debounce index rebuild to avoid Fuse.js reconstructing on every
    // events mutation during bulk operations (sync, import, rapid edits).
    clearTimeout(indexTimerRef.current)
    indexTimerRef.current = setTimeout(() => {
      updateSearchIndex(events)
    }, 500)
    return () => clearTimeout(indexTimerRef.current)
  }, [events])

  const results = useMemo((): SearchResult[] => {
    if (!debouncedQuery.trim()) {
      return []
    }
    return search(debouncedQuery, filters, { limit: MAX_RESULTS })
  }, [debouncedQuery, filters])

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
  }, [])

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
  }, [])

  const openSearch = useCallback(() => {
    setIsSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setQuery('')
    setDebouncedQuery('')
  }, [])

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return {
    query,
    results,
    isSearchOpen,
    filters,
    debouncedQuery,
    isSearching: query !== debouncedQuery,
    hasResults: results.length > 0,
    totalResults: results.length,
    handleSearch,
    handleClear,
    openSearch,
    closeSearch,
    updateFilters,
    clearFilters,
  }
}
