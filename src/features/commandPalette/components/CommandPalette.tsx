import type { JSX } from 'react'
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { CommandItem } from './CommandItem'
import { showToast } from '@/lib/toast'
import styles from './CommandPalette.module.css'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  toggleSidebar?: () => void
  sidebarOpen?: boolean
}

const PLACEHOLDERS = [
  'Hang out with Batman tomorrow at 9',
  'Toggle dark mode',
  'Sync calendars',
  'Go to next week',
  'Toggle sidebar',
  'New event',
]

const TYPING_SPEED = 45
const PAUSE_AFTER_TYPING = 2000
const ERASING_SPEED = 25

// Group order for display
const GROUP_ORDER = ['actions', 'navigation', 'settings', 'event', 'quick-add', 'search']

export function CommandPalette({ isOpen, onClose, toggleSidebar, sidebarOpen }: CommandPaletteProps): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const { query, setQuery, results, selectedIndex, setSelectedIndex, executeSelected } =
    useCommandPalette({ isOpen, toggleSidebar, sidebarOpen })

  const timeFormat = useSettingsStore((state) => state.timeFormat)

  // Group results by category and assign visual indices (top-to-bottom order)
  const { flatResults, originalToVisual, maxVisualIndex, groupedResults, orderedCategories } = useMemo(() => {
    const grouped: Record<string, Array<{ type: string; item: unknown; score: number; originalIndex: number }>> = {}
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      let category = 'command'
      if (result.type === 'event') category = 'event'
      if (result.type === 'calendar') category = 'calendar'
      if (result.type === 'quick-add') category = 'quick-add'
      if (result.type === 'command') {
        const cmd = result.item as { category: string }
        category = cmd.category
      }
      if (!grouped[category]) grouped[category] = []
      grouped[category].push({ ...result, originalIndex: i })
    }

    const ordered = GROUP_ORDER.filter((cat) => grouped[cat])

    // Flat list in visual order with sequential indices
    const flat: Array<{ type: string; item: unknown; score: number; originalIndex: number; visualIndex: number }> = []
    let visIdx = 0
    for (const cat of ordered) {
      for (const r of grouped[cat]) {
        flat.push({ ...r, visualIndex: visIdx++ })
      }
    }

    const origToVis = new Map(flat.map((r) => [r.originalIndex, r.visualIndex]))

    return {
      flatResults: flat,
      originalToVisual: origToVis,
      maxVisualIndex: flat.length - 1,
      groupedResults: grouped,
      orderedCategories: ordered,
    }
  }, [results])

  // Typewriter animation
  useEffect(() => {
    if (!isOpen || query) return

    const target = PLACEHOLDERS[placeholderIndex]
    let timeout: ReturnType<typeof setTimeout>

    if (isTyping) {
      // Typing phase
      if (displayedText.length < target.length) {
        timeout = setTimeout(() => {
          setDisplayedText(target.slice(0, displayedText.length + 1))
        }, TYPING_SPEED)
      } else {
        // Done typing, pause then start erasing
        timeout = setTimeout(() => {
          setIsTyping(false)
        }, PAUSE_AFTER_TYPING)
      }
    } else {
      // Erasing phase
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1))
        }, ERASING_SPEED)
      } else {
        // Done erasing, move to next placeholder
        setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length)
        setIsTyping(true)
      }
    }

    return () => clearTimeout(timeout)
  }, [isOpen, query, displayedText, isTyping, placeholderIndex])

  // Reset animation when opened
  useEffect(() => {
    if (isOpen) {
      setPlaceholderIndex(0)
      setDisplayedText('')
      setIsTyping(true)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, maxVisualIndex))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        // Convert visual index back to original index for executeSelected
        const originalIndex = flatResults[selectedIndex]?.originalIndex
        if (originalIndex !== undefined) {
          const result = await executeSelected(originalIndex)
          if (result?.success && result.message) {
            showToast(result.message)
          }
        }
        onClose()
      }
    },
    [maxVisualIndex, flatResults, selectedIndex, executeSelected, onClose, setSelectedIndex]
  )

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!resultsRef.current || results.length === 0) return

    const selectedElement = resultsRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null
    if (selectedElement?.scrollIntoView) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, results.length])

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
        return
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleItemClick = async (visualIdx: number) => {
    const originalIndex = flatResults[visualIdx]?.originalIndex
    if (originalIndex === undefined) return
    const result = await executeSelected(originalIndex)
    if (result?.success && result.message) {
      showToast(result.message)
    }
    onClose()
  }

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      actions: 'Actions',
      navigation: 'Navigation',
      settings: 'Settings',
      search: 'Search Results',
      event: 'Events',
      'quick-add': 'Quick Add',
    }
    return labels[category] || category
  }

  return (
    <div className={styles.container} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputWrapper}>
          <svg
            className={styles.inputIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
          <div className={styles.inputContainer}>
            {!query && displayedText && (
              <span className={styles.placeholder}>
                {displayedText}
                <span className={styles.cursor} />
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          {!query && <span className={styles.escBadge}>Esc</span>}
        </div>

        <div className={styles.results} ref={resultsRef}>
          {results.length === 0 && query && (
            <div className={styles.empty}>No results found. Try a different search term.</div>
          )}
          {results.length === 0 && !query && (
            <div className={styles.empty}>Type to search commands, events, or calendars.</div>
          )}
          {orderedCategories.map((category, catIndex) => {
            const items = groupedResults[category]
            return (
              <div key={category}>
                {catIndex > 0 && <div className={styles.separator} />}
                <div className={styles.groupLabel}>{getCategoryLabel(category)}</div>
                {items.map((result) => {
                  const item = result.item as { id?: string; title?: string }
                  const visIdx = originalToVisual.get(result.originalIndex) ?? 0
                  const stableKey = item.id ?? `${category}-${item.title ?? visIdx}`
                  return (
                    <CommandItem
                      key={stableKey}
                      data-index={visIdx}
                      item={result.item as Parameters<typeof CommandItem>[0]['item']}
                      type={result.type as 'command' | 'event' | 'calendar' | 'quick-add'}
                      isSelected={selectedIndex === visIdx}
                      onClick={() => handleItemClick(visIdx)}
                      timeFormat={timeFormat}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            <span className={styles.hintKbd}>↑↓</span>
            Navigate
          </span>
          <span className={styles.hint}>
            <span className={styles.hintKbd}>↵</span>
            Select
          </span>
          <span className={styles.hint}>
            <span className={styles.hintKbd}>Esc</span>
            Close
          </span>
        </div>
      </div>
    </div>
  )
}
