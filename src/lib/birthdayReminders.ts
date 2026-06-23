import { v4 as uuidv4 } from 'uuid'
import type { CalendarEvent } from '@/types'
import { toLocalDateString } from './datetime'

interface CreateBirthdayEventOptions {
  contactId: string
  contactName: string
  birthday: string // YYYY-MM-DD
  calendarId: string
}

/**
 * Create an annual recurring all-day event for a contact's birthday.
 */
export function createBirthdayEvent(
  options: CreateBirthdayEventOptions
): CalendarEvent {
  const { contactId, contactName, birthday, calendarId } = options

  // Parse month and day from birthday
  const parts = birthday.split('-')
  const month = parseInt(parts[1] ?? '1', 10)
  const day = parseInt(parts[2] ?? '1', 10)

  // Use a fixed year for DTSTART — the RRULE BYMONTH/BYDAY handles recurrence
  const year = new Date().getFullYear()
  const startDate = new Date(year, month - 1, day)

  const dateStr = toLocalDateString(startDate)

  return {
    id: uuidv4(),
    calendarId,
    title: `🎂 ${contactName}'s birthday`,
    description: `Birthday of ${contactName}`,
    start: `${dateStr}T00:00:00.000Z`,
    end: `${dateStr}T23:59:59.000Z`,
    isAllDay: true,
    recurrence: {
      frequency: 'yearly',
      interval: 1,
    },
    categories: ['birthday'],
    // Link back to the contact
    url: `calino:contact:${contactId}`,
  }
}

/**
 * Check if a birthday event already exists for this contact.
 */
export function hasBirthdayEvent(
  contactId: string,
  events: CalendarEvent[]
): boolean {
  return events.some((e) => e.url === `calino:contact:${contactId}`)
}
