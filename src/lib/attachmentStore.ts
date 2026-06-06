/**
 * IndexedDB-backed storage for calendar event attachments.
 * Keeps large base64 data out of localStorage (which has a ~5-10MB quota).
 */

import type { CalendarAttachment } from '@/types'

const DB_NAME = 'calino-attachments'
const DB_VERSION = 1
const STORE_NAME = 'attachments'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'eventId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, mode)
  return tx.objectStore(STORE_NAME)
}

/**
 * Store attachments for an event. Overwrites any existing attachments.
 */
export async function putAttachments(eventId: string, attachments: CalendarAttachment[]): Promise<void> {
  const store = await getStore('readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put({ eventId, attachments })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Retrieve attachments for an event. Returns empty array if none found.
 */
export async function getAttachments(eventId: string): Promise<CalendarAttachment[]> {
  const store = await getStore('readonly')
  return new Promise((resolve, reject) => {
    const request = store.get(eventId)
    request.onsuccess = () => {
      resolve(request.result?.attachments ?? [])
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete attachments for an event.
 */
export async function deleteAttachments(eventId: string): Promise<void> {
  const store = await getStore('readwrite')
  return new Promise((resolve, reject) => {
    const request = store.delete(eventId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Bulk delete attachments for all events in a calendar.
 * Requires iterating all records since we index by eventId, not calendarId.
 */
export async function deleteAttachmentsByCalendar(
  calendarId: string,
  getEventCalendarId: (eventId: string) => string | undefined
): Promise<void> {
  const store = await getStore('readwrite')
  return new Promise((resolve, reject) => {
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const eventId = cursor.value.eventId as string
      if (getEventCalendarId(eventId) === calendarId) {
        cursor.delete()
      }
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all event IDs that have attachments in IndexedDB.
 * Useful for migration or cleanup.
 */
export async function getAllEventIds(): Promise<string[]> {
  const store = await getStore('readonly')
  return new Promise((resolve, reject) => {
    const request = store.getAllKeys()
    request.onsuccess = () => resolve(request.result as string[])
    request.onerror = () => reject(request.error)
  })
}
