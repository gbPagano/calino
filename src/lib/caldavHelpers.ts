import { showToast } from './toast'

type CalDAVUpdateFn = (
  calendarId: string,
  event: { id: string; [key: string]: unknown }
) => Promise<void>

type CalDAVDeleteFn = (calendarId: string, eventId: string) => Promise<void>

export async function safeCalDAVUpdate(
  caldavUpdateEvent: CalDAVUpdateFn,
  calendarId: string,
  event: { id: string; [key: string]: unknown },
  updates: Record<string, unknown>,
  errorMessage = 'Failed to sync with CalDAV server. It will be retried.'
): Promise<boolean> {
  try {
    await caldavUpdateEvent(calendarId, { ...event, ...updates })
    return true
  } catch {
    showToast(errorMessage)
    return false
  }
}

export async function safeCalDAVDelete(
  caldavDeleteEvent: CalDAVDeleteFn,
  calendarId: string,
  eventId: string,
  errorMessage = 'Failed to sync deletion with CalDAV server. It will be retried.'
): Promise<boolean> {
  try {
    await caldavDeleteEvent(calendarId, eventId)
    return true
  } catch {
    showToast(errorMessage)
    return false
  }
}
