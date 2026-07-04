import { create } from 'zustand'
import type { CalendarEvent } from '@/types'
import { useCalendarStore } from './calendarStore'

// Snapshot-based undo/redo for the events array. Because the calendar store
// replaces `events` with a new array on every mutation, we can keep cheap
// reference snapshots in a past/future stack and swap them back in on
// undo/redo. This covers add / update / delete / duplicate uniformly without
// per-command inverse logic. Note: it restores the *local* events only —
// CalDAV reconciliation of an undone change is out of scope and left to the
// next sync.

const HISTORY_LIMIT = 50

interface HistoryState {
  past: CalendarEvent[][]
  future: CalendarEvent[][]
  /** Guards the store subscription while we're applying an undo/redo. */
  isApplying: boolean
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => boolean
  redo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  isApplying: false,

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: (): boolean => {
    const { past, future } = get()
    if (past.length === 0) return false
    const previous = past[past.length - 1]
    const current = useCalendarStore.getState().events
    set({ isApplying: true })
    useCalendarStore.setState({ events: previous })
    set({
      past: past.slice(0, -1),
      future: [...future, current],
      isApplying: false,
    })
    return true
  },

  redo: (): boolean => {
    const { past, future } = get()
    if (future.length === 0) return false
    const next = future[future.length - 1]
    const current = useCalendarStore.getState().events
    set({ isApplying: true })
    useCalendarStore.setState({ events: next })
    set({
      past: [...past, current],
      future: future.slice(0, -1),
      isApplying: false,
    })
    return true
  },

  clear: (): void => {
    set({ past: [], future: [] })
  },
}))

// Record a snapshot of the previous events array whenever it changes through a
// normal mutation (i.e. not our own undo/redo swap). Guarded so that test
// suites which mock the calendar store (without a `subscribe`) don't blow up.
if (typeof useCalendarStore.subscribe === 'function') {
  useCalendarStore.subscribe((state, prevState) => {
    if (useHistoryStore.getState().isApplying) return
    if (state.events === prevState.events) return
    useHistoryStore.setState((h) => ({
      past: [...h.past, prevState.events].slice(-HISTORY_LIMIT),
      future: [],
    }))
  })
}
