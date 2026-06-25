import ICAL from 'ical.js'
import type { CalendarEvent } from '@/types'
import { SETTINGS_EVENT_UID } from '@/lib/settingsSync'
import {
  icalEventToCalendarEvent,
  icalVtodoToCalendarEvent,
  icalVjournalToCalendarEvent,
  calendarEventToIcalComponent,
  calendarEventToIcalVtodo,
  calendarEventToIcalVjournal,
} from './icalTypeMapping'

export function parseICALEvent(iCalData: string, calendarId: string): CalendarEvent[] {
  if (!iCalData || !iCalData.trim()) {
    return []
  }

  let jCal: string | unknown[]
  try {
    jCal = ICAL.parse(iCalData) as string | unknown[]
  } catch (e) {
    console.error('ICAL.parse failed:', e)
    return []
  }

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
    try {
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
    } catch (e) {
      console.error('Failed to parse vevent:', e)
      continue
    }
  }

  return events
}

export function parseICALTask(iCalData: string, calendarId: string): CalendarEvent[] {
  if (!iCalData || !iCalData.trim()) {
    return []
  }

  let jCal: string | unknown[]
  try {
    jCal = ICAL.parse(iCalData) as string | unknown[]
  } catch (e) {
    console.error('ICAL.parse failed for tasks:', e)
    return []
  }

  const comp = new ICAL.Component(jCal)

  const vtodos = comp.getAllSubcomponents('vtodo')
  const tasks: CalendarEvent[] = []
  for (const vtodo of vtodos) {
    try {
      tasks.push(icalVtodoToCalendarEvent(vtodo, calendarId))
    } catch (e) {
      console.error('Failed to parse vtodo:', e)
      continue
    }
  }
  return tasks
}

export function parseICALData(iCalData: string, calendarId: string): CalendarEvent[] {
  const events = parseICALEvent(iCalData, calendarId)
  const tasks = parseICALTask(iCalData, calendarId)
  const journals = parseICALJournal(iCalData, calendarId)
  // Filter out the Calino Settings sync event — it's not a real calendar event
  const all = [...events, ...tasks, ...journals]
  return all.filter((e) => e.id !== SETTINGS_EVENT_UID)
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

export function parseICALJournal(iCalData: string, calendarId: string): CalendarEvent[] {
  if (!iCalData || !iCalData.trim()) {
    return []
  }

  let jCal: string | unknown[]
  try {
    jCal = ICAL.parse(iCalData) as string | unknown[]
  } catch (e) {
    console.error('ICAL.parse failed for journals:', e)
    return []
  }

  const comp = new ICAL.Component(jCal)

  const vjournals = comp.getAllSubcomponents('vjournal')
  const entries: CalendarEvent[] = []
  for (const vjournal of vjournals) {
    try {
      entries.push(icalVjournalToCalendarEvent(vjournal, calendarId))
    } catch (e) {
      console.error('Failed to parse vjournal:', e)
      continue
    }
  }
  return entries
}

export function journalToICAL(entry: CalendarEvent): string {
  const comp = new ICAL.Component('vcalendar')
  comp.updatePropertyWithValue('version', '2.0')
  comp.updatePropertyWithValue('prodid', '-//Calino//EN')
  comp.updatePropertyWithValue('calscale', 'GREGORIAN')

  const vjournal = calendarEventToIcalVjournal(entry)
  comp.addSubcomponent(vjournal)

  return comp.toString()
}