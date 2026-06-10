import type { CalendarEvent } from '@/types'
import { showToast } from './toast'

type CalDAVCreateFn = (calendarId: string, event: CalendarEvent) => Promise<void>
type CalDAVDeleteFn = (calendarId: string, eventId: string) => Promise<void>

interface DeleteWithUndoOptions {
  event: CalendarEvent
  deleteEvent: (id: string) => void
  addEvent: (event: CalendarEvent) => void
  createCalDAVEvent?: CalDAVCreateFn
  deleteCalDAVEvent?: CalDAVDeleteFn
  message?: string
}

/**
 * Delete an event locally, fire-and-forget the server deletion, and show
 * an undo toast. Follows the same pattern as JournalView's existing undo.
 *
 * Call-site is responsible for closing any open context menu / modal.
 */
export function deleteEventWithUndo({
  event,
  deleteEvent,
  addEvent,
  createCalDAVEvent,
  deleteCalDAVEvent,
  message = 'Event deleted',
}: DeleteWithUndoOptions): void {
  // Fire-and-forget server deletion *before* the local delete so the CalDAV
  // hook can snapshot the etag from the store while the event still exists.
  if (deleteCalDAVEvent && event.calendarId !== 'default') {
    deleteCalDAVEvent(event.calendarId, event.id).catch(() => {
      showToast('Failed to sync deletion. It will be retried.')
    })
  }

  // Optimistic local delete
  deleteEvent(event.id)

  // Undo toast
  showToast(message, {
    duration: 8000,
    onUndo: () => {
      addEvent(event)

      if (createCalDAVEvent && event.calendarId !== 'default') {
        createCalDAVEvent(event.calendarId, event).catch(() => {
          showToast('Failed to restore event.')
        })
      }
    },
  })
}
