import type { JSX } from 'react'
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { v4 as uuidv4 } from 'uuid'
import { renderMarkdown } from '@/lib/markdown'
import { showToast } from '@/lib/toast'
import { putAttachments, getAttachments, deleteAttachments } from '@/lib/attachmentStore'
import type { CalendarEvent, CalendarAttachment } from '@/types'
import { AttachmentSection } from './AttachmentSection'
import styles from './JournalView.module.css'

// ── Shared compose form ──────────────────────────────────────────────────────

interface JournalComposeFormProps {
  editingId: string | null
  editingDate: string
  title: string
  body: string
  selectedCategories: string[]
  attachments: CalendarAttachment[]
  url: string
  relatedTo: string[]
  titleRef: React.RefObject<HTMLInputElement | null>
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  saveHint: string
  formatEntryDate: (dateStr: string) => { day: string; weekday: string }
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onDateChange: (value: string) => void
  onCategoriesChange: (categories: string[]) => void
  onAttachmentsChange: (attachments: CalendarAttachment[]) => void
  onUrlChange: (url: string) => void
  onRelatedToChange: (ids: string[]) => void
  onSave: () => void
  onCancel: () => void
}

function JournalComposeForm({
  editingId,
  editingDate,
  title,
  body,
  selectedCategories,
  attachments,
  url,
  relatedTo,
  titleRef,
  bodyRef,
  saveHint,
  formatEntryDate,
  onTitleChange,
  onBodyChange,
  onDateChange,
  onCategoriesChange,
  onAttachmentsChange,
  onUrlChange,
  onRelatedToChange,
  onSave,
  onCancel,
}: JournalComposeFormProps): JSX.Element {
  const categories = useCalendarStore((state) => state.categories)
  const events = useCalendarStore((state) => state.events)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const { day, weekday } = formatEntryDate(editingDate)

  // Determine which add sections have content
  const hasCategories = selectedCategories.length > 0
  const hasUrl = url.length > 0
  const hasAttachments = attachments.length > 0
  const hasRelated = relatedTo.length > 0
  const hasAnyContent = hasCategories || hasUrl || hasAttachments || hasRelated

  // Non-journal events on the same day for linking
  const sameDayEvents = useMemo(() => {
    const dayKey = editingDate // yyyy-MM-dd
    return events.filter((e) => e.type !== 'journal' && e.id !== editingId && e.start.startsWith(dayKey))
  }, [events, editingId, editingDate])

  const otherDayEvents = useMemo(() => {
    const dayKey = editingDate
    return events.filter((e) => e.type !== 'journal' && e.id !== editingId && !e.start.startsWith(dayKey))
  }, [events, editingId, editingDate])

  const [showAllRelated, setShowAllRelated] = useState(false)
  const linkableEvents = showAllRelated ? [...sameDayEvents, ...otherDayEvents] : sameDayEvents

  return (
    <div className={styles.compose}>
      <div className={styles.composeDateCol}>
        {showDatePicker ? (
          <input
            type="date"
            className={styles.dateInput}
            value={editingDate}
            onChange={(e) => {
              onDateChange(e.target.value)
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
            <span className={styles.composeDay}>{day}</span>
            <span className={styles.composeWeekday}>{weekday}</span>
          </button>
        )}
      </div>
      <div className={styles.composeFields}>
        <input
          ref={titleRef}
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <textarea
          ref={bodyRef}
          placeholder="Write something…"
          rows={8}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
        />
        {/* Add panel — categories, link, attachments */}
        {categories.length > 0 || true ? (
          <div className={styles.addPanel}>
            {!showAddPanel ? (
              <button
                type="button"
                className={styles.addToggle}
                onClick={() => setShowAddPanel(true)}
              >
                + Add
              </button>
            ) : (
              <div className={styles.addPanelContent}>
                <button
                  type="button"
                  className={styles.addToggle}
                  onClick={() => setShowAddPanel(false)}
                >
                  − Hide
                </button>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className={styles.addSection}>
                    <div className={styles.addSectionHeader}>
                      <span className={styles.addSectionLabel}>Categories</span>
                      {hasCategories && (
                        <button
                          type="button"
                          className={styles.removeFieldButton}
                          onClick={() => onCategoriesChange([])}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className={styles.categoryPicker}>
                      {categories.map((cat) => {
                        const isSelected = selectedCategories.includes(cat.name)
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            className={`${styles.categoryChip} ${isSelected ? styles.categoryChipActive : ''}`}
                            style={{
                              '--chip-color': cat.color,
                            } as React.CSSProperties}
                            onClick={() => {
                              if (isSelected) {
                                onCategoriesChange(selectedCategories.filter((c) => c !== cat.name))
                              } else {
                                onCategoriesChange([...selectedCategories, cat.name])
                              }
                            }}
                          >
                            <span
                              className={styles.categoryDot}
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* URL */}
                <div className={styles.addSection}>
                  <div className={styles.addSectionHeader}>
                    <span className={styles.addSectionLabel}>Link</span>
                    {hasUrl && (
                      <button
                        type="button"
                        className={styles.removeFieldButton}
                        onClick={() => onUrlChange('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    className={styles.urlInput}
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => onUrlChange(e.target.value)}
                  />
                </div>

                {/* Attachments */}
                <div className={styles.addSection}>
                  <AttachmentSection
                    attachments={attachments}
                    onAttachmentsChange={onAttachmentsChange}
                    eventId={editingId || 'new'}
                    showLabel={false}
                  />
                </div>

                {/* Related To */}
                <div className={styles.addSection}>
                  <div className={styles.addSectionHeader}>
                    <span className={styles.addSectionLabel}>Related to</span>
                    {hasRelated && (
                      <button
                        type="button"
                        className={styles.removeFieldButton}
                        onClick={() => onRelatedToChange([])}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {(linkableEvents.length > 0 || (showAllRelated && otherDayEvents.length > 0)) ? (
                    <>
                      <div className={styles.relatedList}>
                        {linkableEvents.map((event) => {
                          const isSelected = relatedTo.includes(event.id)
                          return (
                            <button
                              key={event.id}
                              type="button"
                              className={`${styles.relatedChip} ${isSelected ? styles.relatedChipActive : ''}`}
                              onClick={() => {
                                if (isSelected) {
                                  onRelatedToChange(relatedTo.filter((id) => id !== event.id))
                                } else {
                                  onRelatedToChange([...relatedTo, event.id])
                                }
                              }}
                            >
                              <span className={styles.relatedChipTitle}>
                                {event.title || '(untitled)'}
                              </span>
                              <span className={styles.relatedChipDate}>
                                {event.start.split('T')[1]?.slice(0, 5) || ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {otherDayEvents.length > 0 && (
                        <button
                          type="button"
                          className={styles.relatedToggle}
                          onClick={() => setShowAllRelated(!showAllRelated)}
                        >
                          {showAllRelated ? '↑ Hide other days' : `+ ${otherDayEvents.length} other event${otherDayEvents.length === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className={styles.relatedEmpty}>No events on this day to link</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
        <div className={styles.composeActions}>
          <button className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.btnAccent} onClick={onSave}>
            {editingId ? 'Save changes' : 'Save entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [attachments, setAttachments] = useState<CalendarAttachment[]>([])
  const [url, setUrl] = useState('')
  const [relatedTo, setRelatedTo] = useState<string[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  // Use store's currentDate for month filtering
  const currentDate = useCalendarStore((state) => state.currentDate)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyInputRef = useRef<HTMLTextAreaElement>(null)

  // Refs for stable values used in callbacks (#9)
  const eventsRef = useRef(events)
  eventsRef.current = events
  const calendarsRef = useRef(calendars)
  calendarsRef.current = calendars

  // Group journal entries by month — viewed month only
  const groupedEntries = useMemo(() => {
    const monthKey = currentDate.slice(0, 7) // yyyy-MM
    const entries = events
      .filter((e) => e.type === 'journal' && e.start.startsWith(monthKey))
      .sort((a, b) => b.start.localeCompare(a.start)) // newest first

    if (entries.length === 0) return []

    return [{
      monthKey,
      entries,
    }]
  }, [events, currentDate])

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

  // Reset confirmDeleteId when switching entries or entering/exiting compose
  useEffect(() => {
    setConfirmDeleteId(null)
  }, [editingId, isComposing])

  const handleSaveEntry = useCallback((): void => {
    const trimmedBody = body.trim()
    if (!trimmedBody) {
      bodyInputRef.current?.focus()
      return
    }

    const trimmedTitle = title.trim()
    const now = new Date().toISOString()
    const currentEvents = eventsRef.current
    const currentCalendars = calendarsRef.current

    if (editingId) {
      // Update existing entry
      const existing = currentEvents.find((e) => e.id === editingId)
      if (existing) {
        const updates: Partial<CalendarEvent> = {
          title: trimmedTitle,
          description: trimmedBody,
          start: editingDate,
          end: editingDate,
          lastModified: now,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          url: url || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
        }
        updateEvent(editingId, updates)
        // Sync attachments to IDB, then push to server
        if (attachments.length > 0) {
          putAttachments(editingId, attachments).then(() => {
            if (existing.calendarId !== 'default') {
              updateCalDAVEvent(existing.calendarId, { ...existing, ...updates }).catch(() => {
                showToast('Failed to sync update. It will be retried.')
              })
            }
          }).catch(() => {
            showToast('Failed to save attachments locally')
          })
        } else {
          deleteAttachments(editingId).catch(() => {})
          if (existing.calendarId !== 'default') {
            updateCalDAVEvent(existing.calendarId, { ...existing, ...updates }).catch(() => {
              showToast('Failed to sync update. It will be retried.')
            })
          }
        }
      }
    } else {
      // Create new entry
      const defaultCalendar = currentCalendars.find((c) => c.isDefault) || currentCalendars[0]
      const newId = uuidv4()
      const newEntry: CalendarEvent = {
        id: newId,
        calendarId: defaultCalendar?.id || 'default',
        title: trimmedTitle,
        description: trimmedBody,
        start: editingDate,
        end: editingDate,
        isAllDay: true,
        type: 'journal',
        created: now,
        lastModified: now,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        url: url || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
      }
      addEvent(newEntry)
      if (attachments.length > 0) {
        // Await IDB write before pushing to server (C2 race condition fix)
        putAttachments(newId, attachments).then(() => {
          // Clean up the 'new' key used during composition
          deleteAttachments('new').catch(() => {})
          if (defaultCalendar?.id !== 'default') {
            createCalDAVEvent(newEntry.calendarId, newEntry).catch(() => {
              showToast('Failed to sync entry. It will be retried.')
            })
          }
        }).catch(() => {
          showToast('Failed to save attachments locally')
        })
      } else {
        deleteAttachments('new').catch(() => {})
        if (defaultCalendar?.id !== 'default') {
          createCalDAVEvent(newEntry.calendarId, newEntry).catch(() => {
            showToast('Failed to sync entry. It will be retried.')
          })
        }
      }
    }

    setIsComposing(false)
    setEditingId(null)
    setTitle('')
    setBody('')
    setSelectedCategories([])
    setAttachments([])
    setUrl('')
  }, [editingId, editingDate, title, body, selectedCategories, attachments, url, addEvent, updateEvent, createCalDAVEvent, updateCalDAVEvent])

  // Keyboard shortcuts — use ref for handleSaveEntry to avoid stale closure (#10)
  const handleSaveEntryRef = useRef(handleSaveEntry)
  handleSaveEntryRef.current = handleSaveEntry

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isComposing) {
        setIsComposing(false)
        setTitle('')
        setBody('')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isComposing) {
        e.preventDefault()
        handleSaveEntryRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isComposing])

  const handleStartEdit = useCallback((entry: CalendarEvent): void => {
    setEditingId(entry.id)
    setTitle(entry.title || '')
    setBody(entry.description || '')
    setEditingDate(entry.start)
    setSelectedCategories(entry.categories || [])
    setUrl(entry.url || '')
    setRelatedTo(entry.relatedTo || [])
    setIsComposing(true)
    // Open add panel if entry has any extra content
    const hasExtra = (entry.categories?.length ?? 0) > 0 || (entry.url?.length ?? 0) > 0 || (entry.attachments?.length ?? 0) > 0 || (entry.relatedTo?.length ?? 0) > 0
    setShowAddPanel(hasExtra)
    // Load attachments from IndexedDB
    getAttachments(entry.id).then((loaded) => {
      setAttachments(loaded.length > 0 ? loaded : entry.attachments || [])
    }).catch(() => {
      setAttachments(entry.attachments || [])
    })
  }, [])

  const handleStartCompose = useCallback((): void => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setEditingDate(new Date().toISOString().split('T')[0])
    setSelectedCategories([])
    setAttachments([])
    setUrl('')
    setRelatedTo([])
    setShowAddPanel(false)
    setIsComposing(true)
  }, [])

  const handleDelete = useCallback((entryId: string): void => {
    if (confirmDeleteId === entryId) {
      // Actually delete
      const entry = eventsRef.current.find((e) => e.id === entryId)
      // Sync CalDAV first so it can capture the etag before the local delete
      if (entry && entry.calendarId !== 'default') {
        deleteCalDAVEvent(entry.calendarId, entry.id).catch(() => {
          showToast('Failed to sync deletion. It will be retried.')
        })
      }
      deleteEvent(entryId)
      setConfirmDeleteId(null)

      // Show undo toast (#17)
      if (entry) {
        showToast('Entry deleted', {
          duration: 8000,
          onUndo: () => {
            addEvent(entry)
            if (entry.calendarId !== 'default') {
              createCalDAVEvent(entry.calendarId, entry).catch(() => {
                showToast('Failed to restore entry.')
              })
            }
          },
        })
      }
    } else {
      // First click — show confirm
      setConfirmDeleteId(entryId)
    }
  }, [confirmDeleteId, deleteEvent, deleteCalDAVEvent, addEvent, createCalDAVEvent])

  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
  const saveHint = `${isMac ? '⌘' : 'Ctrl+'} Return to save · Esc to cancel`

  // Format date for display in entry
  const formatEntryDate = useCallback((dateStr: string): { day: string; weekday: string } => {
    const d = parseISO(dateStr)
    return {
      day: format(d, 'd'),
      weekday: format(d, 'EEE').toUpperCase(),
    }
  }, [])

  const handleCancel = useCallback(() => {
    setIsComposing(false)
    setEditingId(null)
    setTitle('')
    setBody('')
    setSelectedCategories([])
    setAttachments([])
    setUrl('')
    setRelatedTo([])
  }, [])

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
          <JournalComposeForm
            editingId={editingId}
            editingDate={editingDate}
            title={title}
            body={body}
            selectedCategories={selectedCategories}
            attachments={attachments}
            url={url}
            relatedTo={relatedTo}
            titleRef={titleInputRef}
            bodyRef={bodyInputRef}
            saveHint={saveHint}
            formatEntryDate={formatEntryDate}
            onTitleChange={setTitle}
            onBodyChange={setBody}
            onDateChange={setEditingDate}
            onCategoriesChange={setSelectedCategories}
            onAttachmentsChange={setAttachments}
            onUrlChange={setUrl}
            onRelatedToChange={setRelatedTo}
            onSave={handleSaveEntry}
            onCancel={handleCancel}
          />
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
                      <JournalComposeForm
                        key={entry.id}
                        editingId={editingId}
                        editingDate={editingDate}
                        title={title}
                        body={body}
                        selectedCategories={selectedCategories}
                        attachments={attachments}
                        url={url}
                        relatedTo={relatedTo}
                        titleRef={titleInputRef}
                        bodyRef={bodyInputRef}
                        saveHint={saveHint}
                        formatEntryDate={formatEntryDate}
                        onTitleChange={setTitle}
                        onBodyChange={setBody}
                        onDateChange={setEditingDate}
                        onCategoriesChange={setSelectedCategories}
                        onAttachmentsChange={setAttachments}
                        onUrlChange={setUrl}
                        onRelatedToChange={setRelatedTo}
                        onSave={handleSaveEntry}
                        onCancel={handleCancel}
                      />
                    )
                  }

                  return (
                    <article
                      key={entry.id}
                      className={styles.entry}
                      data-date={entry.start}
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
                        <div
                          className={styles.body}
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.description || '') }}
                        />
                        {entry.categories && entry.categories.length > 0 && (
                          <div className={styles.entryCategories}>
                            {entry.categories.map((cat) => (
                              <span key={cat} className={styles.entryCategoryTag}>{cat}</span>
                            ))}
                          </div>
                        )}
                        {entry.url && (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.entryLink}
                          >
                            🔗 {entry.url}
                          </a>
                        )}
                        {entry.relatedTo && entry.relatedTo.length > 0 && (
                          <div className={styles.entryRelated}>
                            {entry.relatedTo.map((relId) => {
                              const relatedEvent = events.find((e) => e.id === relId)
                              if (!relatedEvent) return null
                              return (
                                <span key={relId} className={styles.entryRelatedTag}>
                                  ↗ {relatedEvent.title || '(untitled)'}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        className={`${styles.deleteBtn} ${confirmDeleteId === entry.id ? styles.deleteBtnConfirm : ''}`}
                        title={confirmDeleteId === entry.id ? 'Click to confirm delete' : 'Delete entry'}
                        onClick={(e) => {
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
