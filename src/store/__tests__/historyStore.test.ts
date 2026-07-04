import { describe, it, expect, beforeEach } from 'vitest'
import { useCalendarStore } from '../calendarStore'
import { useHistoryStore } from '../historyStore'
import type { CalendarEvent } from '@/types'

function makeEvent(id: string, title = id): CalendarEvent {
  return {
    id,
    calendarId: 'default',
    title,
    start: '2024-03-15T10:00:00',
    end: '2024-03-15T11:00:00',
    isAllDay: false,
    type: 'event',
  }
}

describe('historyStore', () => {
  beforeEach(() => {
    useCalendarStore.setState({ events: [] })
    useHistoryStore.getState().clear()
  })

  it('undoes an added event', () => {
    useCalendarStore.getState().addEvent(makeEvent('a'))
    expect(useCalendarStore.getState().events).toHaveLength(1)

    expect(useHistoryStore.getState().undo()).toBe(true)
    expect(useCalendarStore.getState().events).toHaveLength(0)
  })

  it('redoes an undone event', () => {
    useCalendarStore.getState().addEvent(makeEvent('a'))
    useHistoryStore.getState().undo()
    expect(useCalendarStore.getState().events).toHaveLength(0)

    expect(useHistoryStore.getState().redo()).toBe(true)
    expect(useCalendarStore.getState().events).toHaveLength(1)
    expect(useCalendarStore.getState().events[0].id).toBe('a')
  })

  it('undoes updates and deletes', () => {
    const store = useCalendarStore.getState()
    store.addEvent(makeEvent('a', 'Original'))
    store.updateEvent('a', { title: 'Changed' })
    expect(useCalendarStore.getState().events[0].title).toBe('Changed')

    useHistoryStore.getState().undo()
    expect(useCalendarStore.getState().events[0].title).toBe('Original')

    store.deleteEvent('a')
    expect(useCalendarStore.getState().events).toHaveLength(0)
    useHistoryStore.getState().undo()
    expect(useCalendarStore.getState().events).toHaveLength(1)
  })

  it('clears the redo stack after a fresh mutation', () => {
    const store = useCalendarStore.getState()
    store.addEvent(makeEvent('a'))
    useHistoryStore.getState().undo()
    expect(useHistoryStore.getState().canRedo()).toBe(true)

    store.addEvent(makeEvent('b'))
    expect(useHistoryStore.getState().canRedo()).toBe(false)
  })

  it('returns false when there is nothing to undo/redo', () => {
    expect(useHistoryStore.getState().undo()).toBe(false)
    expect(useHistoryStore.getState().redo()).toBe(false)
  })

  it('does not record its own undo/redo swaps as history', () => {
    const store = useCalendarStore.getState()
    store.addEvent(makeEvent('a'))
    store.addEvent(makeEvent('b'))
    useHistoryStore.getState().undo() // back to [a]
    useHistoryStore.getState().undo() // back to []
    expect(useCalendarStore.getState().events).toHaveLength(0)
    useHistoryStore.getState().redo() // [a]
    useHistoryStore.getState().redo() // [a, b]
    expect(useCalendarStore.getState().events).toHaveLength(2)
  })
})
