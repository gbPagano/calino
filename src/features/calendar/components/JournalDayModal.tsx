import type { JSX } from 'react'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { v4 as uuidv4 } from 'uuid'
import type { CalendarEvent } from '@/types'
import styles from './JournalDayModal.module.css'

interface JournalDayModalProps {
  isOpen: boolean
  date: string // ISO date string (yyyy-MM-dd)
  startInCompose?: boolean
  onClose: () => void
}

type ModalMode = 'view' | 'compose' | 'edit'

export function JournalDayModal({ isOpen, date, startInCompose = false, onClose }: JournalDayModalProps): JSX.Element | null {
  const events = useCalendarStore((state) => state.events)
  const addEvent = useCalendarStore((state) => state.addEvent)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const calendars = useCalendarStore((state) => state.calendars)
  const { createEvent: createCalDAVEvent, updateEvent: updateCalDAVEvent } = useCalDAV()

  const [mode, setMode] = useState<ModalMode>('view')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyInputRef = useRef<HTMLTextAreaElement>(null)

  // Get journal entries for this date
  const entries = events.filter((e) => e.type === 'journal' && e.start === date)

  // Parse the date for display
  const dateObj = parseISO(date)
  const dayNum = format(dateObj, 'd')
  const weekday = format(dateObj, 'EEEE')
  const monthYear = format(dateObj, 'MMMM yyyy')

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen) {
      if (startInCompose) {
        setMode('compose')
      } else {
        setMode('view')
      }
      setEditingId(null)
      setTitle('')
      setBody('')
    }
  }, [isOpen, date, startInCompose])

  // Focus input when entering compose/edit mode
  useEffect(() => {
    if (mode === 'compose' || mode === 'edit') {
      setTimeout(() => titleInputRef.current?.focus(), 80)
    }
  }, [mode])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (mode === 'view') {
          onClose()
        } else {
          setMode('view')
          setEditingId(null)
          setTitle('')
          setBody('')
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (mode === 'compose' || mode === 'edit') {
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, mode, title, body, editingId, date])

  const handleSave = useCallback((): void => {
    const trimmedBody = body.trim()
    if (!trimmedBody) {
      bodyInputRef.current?.focus()
      return
    }

    const trimmedTitle = title.trim()
    const now = new Date().toISOString()

    if (mode === 'edit' && editingId) {
      // Update existing entry
      const existing = events.find((e) => e.id === editingId)
      if (existing) {
        const updates: Partial<CalendarEvent> = {
          title: trimmedTitle,
          description: trimmedBody,
          lastModified: now,
        }
        updateEvent(editingId, updates)

        // Sync to CalDAV if needed
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
        start: date,
        end: date,
        isAllDay: true,
        type: 'journal',
        created: now,
        lastModified: now,
      }
      addEvent(newEntry)

      // Sync to CalDAV if needed
      if (defaultCalendar?.id !== 'default') {
        createCalDAVEvent(newEntry)
      }
    }

    setMode('view')
    setEditingId(null)
    setTitle('')
    setBody('')
  }, [mode, editingId, title, body, date, events, calendars, addEvent, updateEvent, createCalDAVEvent, updateCalDAVEvent])

  const handleStartEdit = useCallback((entry: CalendarEvent): void => {
    setEditingId(entry.id)
    setTitle(entry.title || '')
    setBody(entry.description || '')
    setMode('edit')
  }, [])

  const handleStartCompose = useCallback((): void => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setMode('compose')
  }, [])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const saveHint = `${isMac ? '⌘' : 'Ctrl+'} Return to save · Esc to cancel`

  return (
    <div className={styles.scrim}>
      <div className={styles.panel} ref={panelRef}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>

        <div className={styles.dateCol}>
          <span className={styles.day}>{dayNum}</span>
          <span className={styles.weekday}>{weekday}</span>
          <span className={styles.month}>{monthYear}</span>
        </div>

        <div className={styles.content}>
          {mode === 'view' && (
            <>
              <div className={styles.entries}>
                {entries.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    {index > 0 && (
                      <div className={styles.entrySep}>
                        <span>· · ·</span>
                      </div>
                    )}
                    <div
                      className={styles.entry}
                      onDoubleClick={() => handleStartEdit(entry)}
                    >
                      {entry.title && (
                        <div className={styles.summary}>{entry.title}</div>
                      )}
                      <div className={styles.body}>
                        {(entry.description || '').split('\n\n').map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <button className={styles.addEntry} onClick={handleStartCompose}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                Add entry
              </button>
            </>
          )}

          {(mode === 'compose' || mode === 'edit') && (
            <>
              <input
                ref={titleInputRef}
                className={styles.inputTitle}
                type="text"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                ref={bodyInputRef}
                className={styles.inputBody}
                placeholder="Write something…"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className={styles.composeHint}>{saveHint}</div>
              <div className={styles.composeActions}>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setMode('view')
                    setEditingId(null)
                    setTitle('')
                    setBody('')
                  }}
                >
                  Cancel
                </button>
                <button className={styles.btnAccent} onClick={handleSave}>
                  {mode === 'edit' ? 'Save changes' : 'Save entry'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
