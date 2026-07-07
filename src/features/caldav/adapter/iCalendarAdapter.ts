import ICAL from 'ical.js'
import type { CalendarEvent } from '@/types'
import { SETTINGS_EVENT_UID_PREFIX } from '@/lib/settingsSync'
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
  // Filter out the Calino Settings sync event — it's not a real calendar event.
  // Match by prefix (R1.9) because the full UID is per-instance.
  const all = [...events, ...tasks, ...journals]
  return all.filter((e) => !e.id.startsWith(SETTINGS_EVENT_UID_PREFIX))
}

/**
 * RFC 5545 §3.1 — every physical line of an iCalendar object MUST be
 * ≤75 octets (the spec says SHOULD, but servers and other clients
 * reject content that exceeds it). ical.js v2.2.1's toString() has
 * an upstream foldline bug that sometimes emits a 76-octet line for
 * long single-line content (e.g. a 1000-char DESCRIPTION). This
 * helper re-folds any line that exceeds 75 octets. Continuation
 * lines are prefixed with a single space per §3.1.
 *
 * Note: octets are measured in UTF-8. For non-ASCII content, a
 * split point at exactly 75 / 74 octets may land inside a multi-byte
 * character; the TextDecoder's `fatal: false` mode replaces such
 * sequences with U+FFFD rather than throwing. In practice every
 * field we fold (DESCRIPTION, ATTACH payload, LOCATION) is ASCII
 * in our use cases — settings JSON is base64, descriptions are
 * user text that's almost always ASCII. A v1.1 hardening would
 * back up to a safe character boundary; for v1.0 this is fine.
 */
export function foldICalLines(s: string): string {
  const lines = s.split('\r\n')
  const folded: string[] = []
  const decoder = new TextDecoder('utf-8', { fatal: false })
  for (const line of lines) {
    const octets = new TextEncoder().encode(line)
    if (octets.length <= 75) {
      folded.push(line)
      continue
    }
    // First chunk: 75 octets of content (no leading space).
    // Continuation chunks: 1 leading space + 74 octets of content
    // = 75 octets per line, per RFC 5545 §3.1.
    let pos = 0
    let first = true
    while (pos < octets.length) {
      const chunkSize = first ? 75 : 74
      const chunk = octets.slice(pos, pos + chunkSize)
      const text = decoder.decode(chunk)
      folded.push(first ? text : ' ' + text)
      pos += chunkSize
      first = false
    }
  }
  return folded.join('\r\n')
}

export function eventToICAL(event: CalendarEvent): string {
  const comp = new ICAL.Component('vcalendar')
  comp.updatePropertyWithValue('version', '2.0')
  comp.updatePropertyWithValue('prodid', '-//Calino//EN')
  comp.updatePropertyWithValue('calscale', 'GREGORIAN')

  const vevent = calendarEventToIcalComponent(event)
  comp.addSubcomponent(vevent)

  return foldICalLines(comp.toString())
}

export function taskToICAL(task: CalendarEvent): string {
  const comp = new ICAL.Component('vcalendar')
  comp.updatePropertyWithValue('version', '2.0')
  comp.updatePropertyWithValue('prodid', '-//Calino//EN')
  comp.updatePropertyWithValue('calscale', 'GREGORIAN')

  const vtodo = calendarEventToIcalVtodo(task)
  comp.addSubcomponent(vtodo)

  return foldICalLines(comp.toString())
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

  return foldICalLines(comp.toString())
}