import type { CalendarEvent } from '@/types'
import type { SyncResult, ConflictResolution } from '../types'
import { CalDAVClient } from '../client/CalDAVClient'
import { eventToICAL, parseICALData, taskToICAL } from '../adapter/iCalendarAdapter'
import * as storage from './accountStorage'

export class SyncEngine {
  private client: CalDAVClient
  private calendarId: string

  constructor(client: CalDAVClient, calendarId: string) {
    this.client = client
    this.calendarId = calendarId
  }

  async fullSync(
    start: string,
    end: string,
    existingEvents: CalendarEvent[]
  ): Promise<{ events: CalendarEvent[]; result: SyncResult }> {
    const calendar = storage.getAllCalendars().find((c) => c.id === this.calendarId)

    if (!calendar) {
      throw new Error(`Calendar not found: ${this.calendarId}`)
    }

    const serverEventsRaw = await this.client.fetchEvents(calendar.url, start, end)

    const parsedEvents: CalendarEvent[] = []
    for (const serverEvent of serverEventsRaw) {
      const events = parseICALData(serverEvent.data, this.calendarId)
      for (const event of events) {
        parsedEvents.push({
          ...event,
          etag: serverEvent.etag,
        })
      }
    }

    const result: SyncResult = {
      added: [],
      updated: [],
      deleted: [],
      conflicts: [],
    }

    const serverEventIds = new Set(parsedEvents.map((e) => e.id))

    for (const serverEvent of parsedEvents) {
      const localEvent = existingEvents.find((e) => e.id === serverEvent.id)

      if (!localEvent) {
        result.added.push(serverEvent.id)
      } else if (this.hasConflict(localEvent, serverEvent)) {
        const conflictResolved = this.resolveVersionConflict(localEvent, serverEvent)
        if (conflictResolved === 'server') {
          result.updated.push(serverEvent.id)
        } else if (conflictResolved === 'local') {
          // Keep local version, mark as needing push
          result.conflicts.push(serverEvent.id)
        } else {
          result.conflicts.push(serverEvent.id)
        }
      } else if (this.isNewer(serverEvent, localEvent)) {
        result.updated.push(serverEvent.id)
      }
    }

    for (const localEvent of existingEvents) {
      if (!serverEventIds.has(localEvent.id)) {
        result.deleted.push(localEvent.id)
      }
    }

    return {
      events: parsedEvents,
      result,
    }
  }

  async pushEvent(event: CalendarEvent): Promise<{ url: string; etag: string }> {
    const calendar = storage.getAllCalendars().find((c) => c.id === this.calendarId)

    if (!calendar) {
      throw new Error(`Calendar not found: ${this.calendarId}`)
    }

    const iCalString = event.type === 'task' ? taskToICAL(event) : eventToICAL(event)
    const filename = `${event.id}.ics`

    return this.client.createEvent(calendar.url, iCalString, filename)
  }

  async updateEvent(event: CalendarEvent, etag: string): Promise<{ url: string; etag: string }> {
    const calendar = storage.getAllCalendars().find((c) => c.id === this.calendarId)

    if (!calendar) {
      throw new Error(`Calendar not found: ${this.calendarId}`)
    }

    const iCalString = event.type === 'task' ? taskToICAL(event) : eventToICAL(event)
    const eventUrl = `${calendar.url}${event.id}.ics`

    return this.client.updateEvent(calendar.url, eventUrl, iCalString, etag)
  }

  async deleteEvent(eventUrl: string, etag: string): Promise<void> {
    return this.client.deleteEvent(eventUrl, etag)
  }

  private hasConflict(local: CalendarEvent, server: CalendarEvent): boolean {
    if (local.start !== server.start || local.end !== server.end || local.title !== server.title) {
      return true
    }
    if (local.description !== server.description) {
      return true
    }
    if (local.location !== server.location) {
      return true
    }
    return false
  }

  private isNewer(server: CalendarEvent, local: CalendarEvent): boolean {
    const serverSeq = server.sequence ?? 0
    const localSeq = local.sequence ?? 0

    if (serverSeq > localSeq) {
      return true
    }

    if (serverSeq === localSeq) {
      const serverTime = new Date(server.start).getTime()
      const localTime = new Date(local.start).getTime()
      return serverTime > localTime
    }

    return false
  }

  private resolveVersionConflict(
    local: CalendarEvent,
    server: CalendarEvent
  ): 'server' | 'local' | 'conflict' {
    const serverSeq = server.sequence ?? 0
    const localSeq = local.sequence ?? 0

    if (serverSeq > localSeq) {
      return 'server'
    }

    if (localSeq > serverSeq) {
      return 'local'
    }

    return 'conflict'
  }

  resolveConflict(
    _event: CalendarEvent,
    resolution: ConflictResolution,
    localVersion: CalendarEvent,
    serverVersion: CalendarEvent
  ): CalendarEvent {
    switch (resolution) {
      case 'server-wins':
        return serverVersion
      case 'local-wins':
        return localVersion
      case 'merge':
        return {
          ...serverVersion,
          title: localVersion.title || serverVersion.title,
          description: localVersion.description || serverVersion.description,
          location: localVersion.location || serverVersion.location,
        }
      default:
        return serverVersion
    }
  }
}

export function createSyncEngine(client: CalDAVClient, calendarId: string): SyncEngine {
  return new SyncEngine(client, calendarId)
}
