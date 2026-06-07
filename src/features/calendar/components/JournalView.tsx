import type { JSX } from 'react'
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { v4 as uuidv4 } from 'uuid'
import { getJournalEntriesForMonth } from '@/store/calendarStore'
import type { CalendarEvent } from '@/types'
import styles from './JournalView.module.css'

export function JournalView(): JSX.Element {
  const navigate = useNavigate()
  const events = useCalendarStore((state) => state.events)
  const addEvent = useCalendarStore((state) => state.addEvent)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const deleteEvent = useCalendarStore((state) => state.deleteEvent)
  const calendars = useCalendarStore((state) => state.calendars)
  const { createEvent: createCalDAVEvent, updateEvent: updateCalDAVEvent, deleteEvent: deleteCalDAVEvent } = useCalDAV()

  const [isComposing, setIsComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingDate, setEditingDate] = useState(new Date().toISOString().split('T')[0])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyInputRef = useRef<HTMLTextAreaElement>(null)

  // Group journal entries by month
  const groupedEntries = useMemo(() => {
    const entries = events.filter((e) => e.type === 'journal')
    const groups = new Map<string, CalendarEvent[]>()

    for (const entry of entries) {
      const monthKey = entry.start.slice(0, 7) // yyyy-MM
      const existing = groups.get(monthKey) || []
      groups.set(monthKey, [...existing, entry])
    }

    // Sort months descending
    const sortedMonths = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a))
    return sortedMonths.map((monthKey) => ({
      monthKey,
      entries: groups.get(monthKey) || [],
    }))
  }, [events])

  const totalCount = useMemo(
    () => events.filter((e) => e.type === 'journal').length,
    [events]
  )

  // Focus input when composing
  useEffect(() => {
    if (isComposing) {
      setTimeout(() => titleInputRef.current?.focus(), 80)
    }
  }, [isComposing])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isComposing) {
        setIsComposing(false)
        setTitle('')
        setBody('')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isComposing) {
        e.preventDefault()
        handleSaveEntry()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isComposing, title, body])

  const handleSaveEntry = useCallback((): void => {
    const trimmedBody = body.trim()
    if (!trimmedBody) {
      bodyInputRef.current?.focus()
      return
    }

    const trimmedTitle = title.trim()
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    if (editingId) {
      // Update existing entry
      const existing = events.find((e) => e.id === editingId)
      if (existing) {
        const updates: Partial<CalendarEvent> = {
          title: trimmedTitle,
          description: trimmedBody,
          start: editingDate,
          end: editingDate,
          lastModified: now,
        }
        updateEvent(editingId, updates)
        if (existing.calendarId !== 'default') {
          updateCalDAVEvent({ ...existing, ...updates })
        }
      }
    } else {
      // Create new entry
      const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0]
      const newEntry: CalendarEvent = {
        id: uuidv4(),
        calendarId: defaultCalendar?.id || 'default',
        title: trimmedTitle,
        description: trimmedBody,
        start: editingDate,
        end: editingDate,
        isAllDay: true,
        type: 'journal',
        created: now,
        lastModified: now,
      }
      addEvent(newEntry)
      if (defaultCalendar?.id !== 'default') {
        createCalDAVEvent(newEntry)
      }
    }

    setIsComposing(false)
    setEditingId(null)
    setTitle('')
    setBody('')
    setShowDatePicker(false)
  }, [editingId, editingDate, title, body, events, calendars, addEvent, updateEvent, createCalDAVEvent, updateCalDAVEvent])

  const handleStartEdit = useCallback((entry: CalendarEvent): void => {
    setEditingId(entry.id)
    setTitle(entry.title || '')
    setBody(entry.description || '')
    setEditingDate(entry.start)
    setIsComposing(true)
    setShowDatePicker(false)
  }, [])

  const handleStartCompose = useCallback((): void => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setIsComposing(true)
  }, [])

  const handleDelete = useCallback((entryId: string): void => {
    if (confirmDeleteId === entryId) {
      // Actually delete
      const entry = events.find((e) => e.id === entryId)
      deleteEvent(entryId)
      if (entry && entry.calendarId !== 'default') {
        deleteCalDAVEvent(entry)
      }
      setConfirmDeleteId(null)
    } else {
      // First click — show confirm
      setConfirmDeleteId(entryId)
    }
  }, [confirmDeleteId, events, deleteEvent, deleteCalDAVEvent])

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const saveHint = `${isMac ? '⌘' : 'Ctrl+'} Return to save · Esc to cancel`

  // Format date for display in entry
  const formatEntryDate = (dateStr: string): { day: string; weekday: string } => {
    const d = parseISO(dateStr)
    return {
      day: format(d, 'd'),
      weekday: format(d, 'EEE').toUpperCase(),
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Top bar */}
        <div className={styles.bar}>
          <div className={styles.count}>
            <b>{totalCount}</b> {totalCount === 1 ? 'entry' : 'entries'}
          </div>
          <button className={styles.addEntry} onClick={handleStartCompose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5.5 1v9M1 5.5h9" />
            </svg>
            New entry
          </button>
        </div>

        {/* Compose form (at top when composing new entry only) */}
        {isComposing && !editingId && (
          <div className={styles.compose}>
            <div className={styles.composeDateCol}>
              {showDatePicker ? (
                <input
                  type="date"
                  className={styles.dateInput}
                  value={editingDate}
                  onChange={(e) => {
                    setEditingDate(e.target.value)
                    setShowDatePicker(false)
                  }}
                  onBlur={() => setShowDatePicker(false)}
                  autoFocus
                />
              ) : (
                <button
                  className={styles.dateButton}
                  onClick={() => setShowDatePicker(true)}
                  title="Click to change date"
                >
                  <span className={styles.composeDay}>
                    {formatEntryDate(editingDate).day}
                  </span>
                  <span className={styles.composeWeekday}>
                    {formatEntryDate(editingDate).weekday}
                  </span>
                </button>
              )}
            </div>
            <div className={styles.composeFields}>
              <input
                ref={titleInputRef}
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                ref={bodyInputRef}
                placeholder="Write something…"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className={styles.composeHint}>{saveHint}</div>
              <div className={styles.composeActions}>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setIsComposing(false)
                    setEditingId(null)
                    setTitle('')
                    setBody('')
                  }}
                >
                  Cancel
                </button>
                <button className={styles.btnAccent} onClick={handleSaveEntry}>
                  {editingId ? 'Save changes' : 'Save entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry list */}
        {groupedEntries.length === 0 && !isComposing ? (
          <div className={styles.empty}>
            <strong>Nothing written yet</strong>
            Start capturing your days — one entry at a time.
          </div>
        ) : (
          groupedEntries.map(({ monthKey, entries }) => {
            const [year, month] = monthKey.split('-').map(Number)
            const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy')

            return (
              <section key={monthKey} className={styles.monthGroup}>
                <div className={styles.monthHead}>{monthLabel}</div>
                {entries.map((entry) => {
                  const { day, weekday } = formatEntryDate(entry.start)

                  // If this entry is being edited, show compose form inline
                  if (editingId === entry.id) {
                    return (
                      <div key={entry.id} className={styles.compose}>
                        <div className={styles.composeDateCol}>
                          {showDatePicker ? (
                            <input
                              type="date"
                              className={styles.dateInput}
                              value={editingDate}
                              onChange={(e) => {
                                setEditingDate(e.target.value)
                                setShowDatePicker(false)
                              }}
                              onBlur={() => setShowDatePicker(false)}
                              autoFocus
                            />
                          ) : (
                            <button
                              className={styles.dateButton}
                              onClick={() => setShowDatePicker(true)}
                              title="Click to change date"
                            >
                              <span className={styles.composeDay}>
                                {formatEntryDate(editingDate).day}
                              </span>
                              <span className={styles.composeWeekday}>
                                {formatEntryDate(editingDate).weekday}
                              </span>
                            </button>
                          )}
                        </div>
                        <div className={styles.composeFields}>
                          <input
                            ref={titleInputRef}
                            type="text"
                            placeholder="Title (optional)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                          />
                          <textarea
                            ref={bodyInputRef}
                            placeholder="Write something…"
                            rows={4}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                          />
                          <div className={styles.composeHint}>{saveHint}</div>
                          <div className={styles.composeActions}>
                            <button
                              className={styles.btnGhost}
                              onClick={() => {
                                setIsComposing(false)
                                setEditingId(null)
                                setTitle('')
                                setBody('')
                              }}
                            >
                              Cancel
                            </button>
                            <button className={styles.btnAccent} onClick={handleSaveEntry}>
                              Save changes
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <article
                      key={entry.id}
                      className={styles.entry}
                      onDoubleClick={() => handleStartEdit(entry)}
                    >
                      <div className={styles.dateCol}>
                        <span className={styles.dayNum}>{day}</span>
                        <span className={styles.weekday}>{weekday}</span>
                      </div>
                      <div className={styles.content}>
                        {entry.title && (
                          <div className={styles.summary}>{entry.title}</div>
                        )}
                        <div className={styles.body}>
                          {(entry.description || '').split('\n\n').map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        </div>
                      </div>
                      <button
                        className={`${styles.deleteBtn} ${confirmDeleteId === entry.id ? styles.deleteBtnConfirm : ''}`}
                        title={confirmDeleteId === entry.id ? 'Click again to confirm delete' : 'Delete entry'}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handleDelete(entry.id)
                        }}
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 4h12" />
                          <path d="M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4" />
                          <path d="M12.667 4v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4" />
                        </svg>
                      </button>
                    </article>
                  )
                })}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
