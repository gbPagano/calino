import type { JSX } from 'react'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, isSameDay } from 'date-fns'
import { useDraggable } from '@dnd-kit/core'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { ContextMenu } from '@/components/common/ContextMenu'
import { RecurringIcon } from '@/components/common/icons'
import { DeleteDialog } from './DeleteDialog'
import type { CalendarEvent } from '@/types'
import { DEFAULT_CALENDAR_COLOR } from '@/config'
import { useGestures } from '@/hooks/useGestures'
import { useContextMenuStore } from '@/store/contextMenuStore'
import { safeCalDAVUpdate, safeCalDAVDelete } from '@/lib/caldavHelpers'

import { isUUID } from '@/features/caldav/adapter/iCalendarAdapter'
import { extractOriginalEventId, hasDueTime, formatTravelDuration } from '@/lib/events'
import { hapticIfEnabled } from '@/lib/haptics'
import styles from './EventCard.module.css'



interface EventCardProps {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
  compact?: boolean
  isDragging?: boolean
  enableResize?: boolean
  hideTopRadius?: boolean
  isMobileMonth?: boolean
  transparent?: boolean
  hourHeight?: number
}

export function EventCard({
  event,
  onClick,
  compact = false,
  isDragging = false,
  enableResize = true,
  hideTopRadius = false,
  isMobileMonth = false,
  transparent = false,
  hourHeight = 60,
}: EventCardProps): JSX.Element {
  const calendars = useCalendarStore((state) => state.calendars)
  const categories = useCalendarStore((state) => state.categories)
  const openModal = useCalendarStore((state) => state.openModal)
  const openPreview = useCalendarStore((state) => state.openPreview)
  const closePreview = useCalendarStore((state) => state.closePreview)
  const previewEventId = useCalendarStore((state) => state.previewEventId)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const deleteEvent = useCalendarStore((state) => state.deleteEvent)
  const duplicateEvent = useCalendarStore((state) => state.duplicateEvent)
  const timeFormat = useSettingsStore((state) => state.timeFormat)
  const { deleteEvent: deleteCalDAVEvent, updateEvent: updateCalDAVEvent } = useCalDAV()
  const openMenuId = useContextMenuStore((state) => state.openMenuId)
  const openMenu = useContextMenuStore((state) => state.openMenu)
  const closeMenu = useContextMenuStore((state) => state.closeMenu)

  const menuId = `event-${event.id}`
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const originalEventId = extractOriginalEventId(event.id)

  const [isResizing, setIsResizing] = useState(false)
  const [didInteract, setDidInteract] = useState(false)
  const resizeStartY = useRef<number | null>(null)
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null)
  const resizeStartEnd = useRef<Date | null>(null)
  const handleResizeMoveRef = useRef<((e: PointerEvent) => void) | null>(null)
  const handleResizeEndRef = useRef<(() => void) | null>(null)

  const { bind } = useGestures({
    onLongPress: ({ x, y }) => {
      hapticIfEnabled('medium')
      openMenu(menuId)
      setContextMenu({ x, y })
    },
    onTap: ({ x, y }) => {
      pointerStartPos.current = { x, y }
    },
    longPressDelay: 400,
    swipeThreshold: 30,
  })

  useEffect(() => {
    if (openMenuId !== null && openMenuId !== menuId && contextMenu) {
      setContextMenu(null)
    }
  }, [openMenuId, menuId])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isCurrentDragging,
  } = useDraggable({
    id: event.id,
  })

  const calendar = calendars.find((c) => c.id === event.calendarId)
  const firstCategory = event.categories && event.categories.length > 0
    ? categories.find((cat) => {
        const catValue = event.categories![0]
        // Check if it's a UUID (ID) or a name
        if (isUUID(catValue)) {
          return cat.id === catValue
        }
        return cat.name === catValue
      })
    : undefined
  const eventColor = event.color || firstCategory?.color || calendar?.color || DEFAULT_CALENDAR_COLOR
  const isTask = event.type === 'task'
  const isRecurring = !!event.recurrence || !!event.rruleString
  const isMultiDay = !isSameDay(parseISO(event.start), parseISO(event.end))
  const isFragmentMiddle = event.isFragment && !event.isFirstFragment && !event.isLastFragment
  const isFragmentFirst = event.isFragment && event.isFirstFragment
  const isFragmentLast = event.isFragment && event.isLastFragment

  const handleClick = (e: React.MouseEvent): void => {
    let moved = false
    if (pointerStartPos.current) {
      const dx = e.clientX - pointerStartPos.current.x
      const dy = e.clientY - pointerStartPos.current.y
      moved = Math.abs(dx) > 5 || Math.abs(dy) > 5
      pointerStartPos.current = null
    }

    if (isCurrentDragging || isResizing || didInteract || moved) {
      e.stopPropagation()
      setDidInteract(false)
      return
    }
    e.stopPropagation()

    if (previewEventId === event.id) {
      closePreview()
      openModal(undefined, undefined, event.id)
      return
    }

    if (onClick) {
      onClick(event)
    } else {
      openPreview(event.id, { x: e.clientX, y: e.clientY })
    }
  }

  const handleResizeStart = (e: React.PointerEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(true)
    setDidInteract(true)
    resizeStartY.current = e.clientY
    resizeStartEnd.current = parseISO(event.end)

    // Remove any previously attached listeners to prevent accumulation
    if (handleResizeMoveRef.current) {
      document.removeEventListener('pointermove', handleResizeMoveRef.current)
    }
    if (handleResizeEndRef.current) {
      document.removeEventListener('pointerup', handleResizeEndRef.current)
    }

    const handleResizeMove = (moveEvent: PointerEvent): void => {
      if (resizeStartY.current === null || resizeStartEnd.current === null) return

      const deltaY = moveEvent.clientY - resizeStartY.current
      const rawDeltaMinutes = (deltaY / hourHeight) * 60
      const deltaMinutes = Math.round(rawDeltaMinutes / 15) * 15
      const newEnd = new Date(resizeStartEnd.current.getTime() + deltaMinutes * 60 * 1000)

      if (newEnd > parseISO(event.start)) {
        updateEvent(event.id, { end: newEnd.toISOString() })
      }
    }

    const handleResizeEnd = (): void => {
      setIsResizing(false)
      resizeStartY.current = null
      resizeStartEnd.current = null
      document.removeEventListener('pointermove', handleResizeMove)
      document.removeEventListener('pointerup', handleResizeEnd)
      handleResizeMoveRef.current = null
      handleResizeEndRef.current = null
    }

    handleResizeMoveRef.current = handleResizeMove
    handleResizeEndRef.current = handleResizeEnd
    document.addEventListener('pointermove', handleResizeMove)
    document.addEventListener('pointerup', handleResizeEnd)
  }

  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      if (handleResizeMoveRef.current) {
        document.removeEventListener('pointermove', handleResizeMoveRef.current)
      }
      if (handleResizeEndRef.current) {
        document.removeEventListener('pointerup', handleResizeEndRef.current)
      }
    }
  }, [])

  const formatTime = (dateString: string): string => {
    const pattern = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
    return format(parseISO(dateString), pattern)
  }

  const style = transform
    ? ({
        '--event-color': eventColor,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        cursor: 'grabbing',
        zIndex: 1000,
        opacity: 0,
      } as React.CSSProperties)
    : ({
        '--event-color': eventColor,
        cursor: 'grab',
      } as React.CSSProperties)

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    openMenu(menuId)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCheckboxClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const newCompleted = !event.completed
    updateEvent(event.id, { completed: newCompleted })
    if (!event.calendarId) return
    await safeCalDAVUpdate(
      updateCalDAVEvent,
      event.calendarId,
      { ...event, completed: newCompleted },
      { completed: newCompleted }
    )
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        data-event-card
        className={`${styles.card} ${compact ? styles.compact : ''} ${isCurrentDragging || isDragging ? styles.dragging : ''} ${isResizing ? styles.resizing : ''} ${hideTopRadius ? styles.noTopRadius : ''} ${isTask ? styles.task : ''} ${event.completed ? styles.completed : ''} ${event.completed ? styles.isDone : ''} ${isMobileMonth ? styles.mobileMonth : ''} ${transparent ? styles.transparent : ''} ${isMultiDay ? styles.multiDay : ''} ${isFragmentMiddle ? styles.fragmentMiddle : ''} ${isFragmentFirst ? styles.fragmentFirst : ''} ${isFragmentLast ? styles.fragmentLast : ''}`}
        onContextMenu={handleContextMenu}
        {...bind}
      >
        {event.syncStatus === 'failed' && (
          <div className={styles.syncFailedIcon} title="Sync failed - changes not saved to server">
            <SyncWarningIcon />
          </div>
        )}
        {isRecurring && (
          <div className={styles.recurringIcon}>
            <RecurringIcon />
          </div>
        )}
        {isTask && (
          <button
            className={`${styles.checkbox} ${styles.taskCheckbox}`}
            onClick={handleCheckboxClick}
            aria-label="Toggle completion"
          >
            {event.completed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </button>
        )}
        {isTask ? (
          <div
            className={styles.dragContent}
            onClick={handleClick}
            onPointerDown={(e) => {
              e.stopPropagation()
              pointerStartPos.current = { x: e.clientX, y: e.clientY }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                handleClick(e as unknown as React.MouseEvent)
              }
            }}
            {...listeners}
            {...attributes}
          >
            <div className={styles.title} title={event.title}>{event.title}</div>
            {hasDueTime(event) && event.dueDate && (
              <div className={styles.dueDate}>{format(parseISO(event.dueDate), 'h:mm a')}</div>
            )}
          </div>
        ) : (
          <>
            <div
              className={styles.dragContent}
              onClick={handleClick}
              onPointerDown={(e) => {
                e.stopPropagation()
                pointerStartPos.current = { x: e.clientX, y: e.clientY }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleClick(e as unknown as React.MouseEvent)
                }
              }}
              {...listeners}
              {...attributes}
          >
            <div className={styles.title} title={event.title}>{event.title}</div>
            {!compact && !event.isAllDay && (
                <div className={styles.time}>
                  {isFragmentFirst
                    ? `${formatTime(event.start)} - ${format(parseISO(event.originalEnd || event.end), 'MMM d')}`
                    : isFragmentMiddle
                    ? `${format(parseISO(event.originalStart || event.start), 'MMM d')} - ${format(parseISO(event.originalEnd || event.end), 'MMM d')}`
                    : isFragmentLast
                    ? `${format(parseISO(event.originalStart || event.start), 'MMM d')} - ${formatTime(event.end)}`
                    : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                </div>
              )}
              {event.isAllDay && <div className={styles.time}>All day</div>}
              {event.travelDuration && (
                <div className={styles.travelTime}>
                  <TravelIcon />
                  <span>{formatTravelDuration(event.travelDuration)}</span>
                </div>
              )}
              {event.location && <div className={styles.location}>{event.location}</div>}
            </div>
            {enableResize && (
              <div
                className={styles.resizeHandle}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleResizeStart(e)
                }}
              />
            )}
          </>
        )}
      </div>
      {contextMenu &&
        createPortal(
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            menuId={menuId}
            onClose={() => {
              closeMenu()
              setContextMenu(null)
            }}
            items={[
              {
                label: 'Edit',
                onClick: () => {
                  openModal(undefined, undefined, event.id)
                },
                icon: <EditIcon />,
              },
              {
                label: isTask ? 'Convert to event' : 'Convert to task',
                onClick: async () => {
                  const newType = isTask ? 'event' : 'task'
                  updateEvent(event.id, { type: newType })
                  await safeCalDAVUpdate(
                    updateCalDAVEvent,
                    event.calendarId,
                    { ...event, type: newType },
                    { type: newType }
                  )
                },
                icon: <EditIcon />,
              },
              {
                label: 'Duplicate',
                onClick: () => duplicateEvent(event.id),
                icon: <DuplicateIcon />,
              },
              {
                label: 'Delete',
                onClick: async () => {
                  const isRecurring = !!event.recurrence || !!event.rruleString || !!originalEventId
                  if (isRecurring) {
                    setShowDeleteDialog(true)
                  } else {
                    deleteEvent(event.id)
                    await safeCalDAVDelete(deleteCalDAVEvent, event.calendarId, event.id)
                  }
                },
                icon: <DeleteIcon />,
                danger: true,
              },
            ]}
          />,
          document.body
        )}
      {showDeleteDialog &&
        createPortal(
          <DeleteDialog
            isOpen={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            onConfirm={async (mode) => {
              if (mode === 'this' && originalEventId) {
                const masterEvent = useCalendarStore.getState().events.find((e) => e.id === originalEventId)
                if (masterEvent) {
                  const dateMatch = event.id.match(/(\d{4}-\d{2}-\d{2})/)
                  const dateStr = dateMatch ? dateMatch[1] : null
                  if (dateStr) {
                    const excludedDates = masterEvent.excludedDates || []
                    if (!excludedDates.includes(dateStr)) {
                      const updatedExcludedDates = [...excludedDates, dateStr]
                      updateEvent(originalEventId, {
                        excludedDates: updatedExcludedDates,
                      })
                      await safeCalDAVUpdate(
                        updateCalDAVEvent,
                        masterEvent.calendarId,
                        { ...masterEvent, excludedDates: updatedExcludedDates },
                        { excludedDates: updatedExcludedDates }
                      )
                    }
                  }
                }
              } else if (originalEventId) {
                deleteEvent(originalEventId)
                await safeCalDAVDelete(deleteCalDAVEvent, event.calendarId, originalEventId)
              } else {
                deleteEvent(event.id)
                await safeCalDAVDelete(deleteCalDAVEvent, event.calendarId, event.id)
              }
              setShowDeleteDialog(false)
            }}
          />,
          document.body
        )}
    </>
  )
}

function DeleteIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}

function DuplicateIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function EditIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TravelIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-3-5H9L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M8 12h8" />
    </svg>
  )
}

function CheckedIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function UncheckedIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

function SyncWarningIcon(): JSX.Element {
  return (
    <svg aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

