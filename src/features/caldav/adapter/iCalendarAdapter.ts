import ICAL from 'ical.js'
import type { CalendarEvent } from '@/types'
import {
  icalEventToCalendarEvent,
  icalVtodoToCalendarEvent,
  calendarEventToIcalComponent,
  calendarEventToIcalVtodo,
} from './icalTypeMapping'

export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

export function parseICALEvent(iCalData: string, calendarId: string): CalendarEvent[] {
  if (!iCalData || !iCalData.trim()) {
    return []
  }

  const jCal = ICAL.parse(iCalData)
  const comp = new ICAL.Component(jCal)

  const vtimezones = comp.getAllSubcomponents('vtimezone')
  for (const vtz of vtimezones) {
    try {
      const tz = new ICAL.Timezone(vtz)
      ICAL.TimezoneService.register(tz)
    } catch {
      // Fall back to UTC for unknown timezones
    }
  }

  const vevents = comp.getAllSubcomponents('vevent')
  const uidToIndex = new Map<string, number>()
  const events: CalendarEvent[] = []

  for (const vevent of vevents) {
    const event = icalEventToCalendarEvent(vevent, calendarId)
    const uid = event.id

    if (uid) {
      const existingIndex = uidToIndex.get(uid)
      if (existingIndex !== undefined) {
        const existing = events[existingIndex]
        if (!existing.rruleString && event.rruleString) {
          events[existingIndex] = event
        }
      } else {
        uidToIndex.set(uid, events.length)
        events.push(event)
      }
    } else {
      events.push(event)
    }
  }

  return events
}

export function parseICALTask(iCalData: string, calendarId: string): CalendarEvent[] {
  if (!iCalData || !iCalData.trim()) {
    return []
  }

  const jCal = ICAL.parse(iCalData)
  const comp = new ICAL.Component(jCal)

  const vtodos = comp.getAllSubcomponents('vtodo')
  return vtodos.map(vtodo => icalVtodoToCalendarEvent(vtodo, calendarId))
}

export function parseICALData(iCalData: string, calendarId: string): CalendarEvent[] {
  const events = parseICALEvent(iCalData, calendarId)
  const tasks = parseICALTask(iCalData, calendarId)
  return [...events, ...tasks]
}

export function eventToICAL(event: CalendarEvent): string {
  const comp = new ICAL.Component('vcalendar')
  comp.updatePropertyWithValue('version', '2.0')
  comp.updatePropertyWithValue('prodid', '-//Calino//EN')
  comp.updatePropertyWithValue('calscale', 'GREGORIAN')

  const vevent = calendarEventToIcalComponent(event)
  comp.addSubcomponent(vevent)

  return comp.toString()
}

export function taskToICAL(task: CalendarEvent): string {
  const comp = new ICAL.Component('vcalendar')
  comp.updatePropertyWithValue('version', '2.0')
  comp.updatePropertyWithValue('prodid', '-//Calino//EN')
  comp.updatePropertyWithValue('calscale', 'GREGORIAN')

  const vtodo = calendarEventToIcalVtodo(task)
  comp.addSubcomponent(vtodo)

  return comp.toString()
}