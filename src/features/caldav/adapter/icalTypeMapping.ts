import ICAL from 'ical.js'
import { v4 as uuidv4 } from 'uuid'
import type { CalendarEvent, CalendarAttachment, RecurrenceRule, Reminder, TaskPriority } from '@/types'
import { addDays } from 'date-fns'
import { DAY_NUM_TO_CODE } from '@/lib/recurrence'

export function parseAppleTravelDuration(vevent: ICAL.Component): number | undefined {
  const prop = vevent.getFirstProperty('x-apple-travel-duration')
  if (prop) {
    const value = prop.getFirstValue() as string
    return parseTravelDuration(value) ?? undefined
  }
  return undefined
}

export function addAppleTravelDuration(vevent: ICAL.Component, minutes: number): void {
  vevent.addPropertyWithValue('x-apple-travel-duration', formatMinutesToDuration(minutes))
}

function parseTravelDuration(duration: string): number | null {
  const match = duration.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/)
  if (!match) return null

  const weeks = parseInt(match[1] || '0', 10)
  const days = parseInt(match[2] || '0', 10)
  const hours = parseInt(match[3] || '0', 10)
  const minutes = parseInt(match[4] || '0', 10)
  const seconds = parseInt(match[5] || '0', 10)

  const totalMinutes = (weeks * 7 * 24 * 60) + (days * 24 * 60) + (hours * 60) + minutes + Math.ceil(seconds / 60)
  return totalMinutes > 0 ? totalMinutes : null
}

function formatMinutesToDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `PT${hours}H${mins}M`
  } else if (hours > 0) {
    return `PT${hours}H`
  } else {
    return `PT${mins}M`
  }
}

function parseRRule(rruleString: string): RecurrenceRule | undefined {
  const parts = rruleString.split(';')
  let frequency: RecurrenceRule['frequency'] = 'weekly'
  let interval = 1
  let endDate: string | undefined
  let count: number | undefined
  let byWeekday: number[] | undefined
  let bySetPos: number[] | undefined
  let byMonthDay: number[] | undefined
  let byMonth: number[] | undefined

  for (const part of parts) {
    const [key, value] = part.split('=')

    switch (key) {
      case 'FREQ':
        switch (value) {
          case 'SECONDLY':
            frequency = 'secondly'
            break
          case 'MINUTELY':
            frequency = 'minutely'
            break
          case 'HOURLY':
            frequency = 'hourly'
            break
          case 'DAILY':
            frequency = 'daily'
            break
          case 'WEEKLY':
            frequency = 'weekly'
            break
          case 'MONTHLY':
            frequency = 'monthly'
            break
          case 'YEARLY':
            frequency = 'yearly'
            break
        }
        break
      case 'INTERVAL':
        interval = parseInt(value, 10)
        break
      case 'UNTIL': {
        const parsed = parseICalDateTime(value)
        endDate = parsed.date
        break
      }
      case 'COUNT':
        count = parseInt(value, 10)
        break
      case 'BYDAY': {
        const bySetPosList: number[] = []
        byWeekday = value.split(',').map((day) => {
          const dayMap: Record<string, number> = {
            SU: 0,
            MO: 1,
            TU: 2,
            WE: 3,
            TH: 4,
            FR: 5,
            SA: 6,
          }
          const match = day.match(/^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/)
          if (match) {
            const posStr = match[1]
            if (posStr) {
              bySetPosList.push(parseInt(posStr, 10))
            } else {
              bySetPosList.push(0)
            }
            const dayCode = match[2]
            return dayMap[dayCode] ?? 1
          }
          return dayMap[day] ?? 1
        })
        if (bySetPosList.some((p) => p !== 0)) {
          bySetPos = bySetPosList
        }
        break
      }
      case 'BYMONTHDAY': {
        const days = value.split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
        if (days.length > 0) byMonthDay = days
        break
      }
      case 'BYMONTH': {
        const months = value.split(',').map((m) => parseInt(m.trim(), 10)).filter((n) => !isNaN(n))
        if (months.length > 0) byMonth = months
        break
      }
      case 'BYSETPOS': {
        const positions = value.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n))
        if (positions.length > 0) bySetPos = positions
        break
      }
    }
  }

  return {
    frequency,
    interval,
    endDate,
    count,
    byWeekday,
    bySetPos,
    byMonthDay,
    byMonth,
  }
}

function parseICalDateTime(value: string): { date: string; isAllDay: boolean } {
  const isAllDay = value.length === 8

  if (isAllDay) {
    const year = value.substring(0, 4)
    const month = value.substring(4, 6)
    const day = value.substring(6, 8)
    return { date: `${year}-${month}-${day}`, isAllDay: true }
  }

  const hasTime = value.includes('T')
  const hasZ = value.endsWith('Z')
  const dateTimeValue = hasZ ? value.slice(0, -1) : value

  if (hasTime && dateTimeValue.length >= 15) {
    const year = dateTimeValue.substring(0, 4)
    const month = dateTimeValue.substring(4, 6)
    const day = dateTimeValue.substring(6, 8)
    const hour = dateTimeValue.substring(9, 11)
    const minute = dateTimeValue.substring(11, 13)
    const second = dateTimeValue.substring(13, 15)

    if (hasZ) {
      return {
        date: `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
        isAllDay: false,
      }
    }

    // Bug 25 fix: floating times (no Z, no TZID) must be preserved as-is per iCal spec.
    // Do NOT convert through the browser's local timezone.
    return {
      date: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
      isAllDay: false,
    }
  }

  return { date: '', isAllDay: false }
}

function createIcalDateTime(isoString: string): ICAL.Time {
  return ICAL.Time.fromJSDate(new Date(isoString), true)
}

function icalTimeToISO(icalTime: ICAL.Time): string {
  if (!icalTime || !icalTime.year) {
    throw new Error('Invalid ICAL.Time')
  }

  if (icalTime.isDate) {
    return icalTime.toString()
  }

  // Bug 25 fix: floating times (timezone 'floating') should be preserved as-is.
  // The iCal spec says floating times represent wall-clock time with no timezone.
  const tz = icalTime.zone
  if (tz && tz.tzid === 'floating') {
    const year = String(icalTime.year).padStart(4, '0')
    const month = String(icalTime.month).padStart(2, '0')
    const day = String(icalTime.day).padStart(2, '0')
    const hour = String(icalTime.hour).padStart(2, '0')
    const minute = String(icalTime.minute).padStart(2, '0')
    const second = String(icalTime.second).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`
  }

  const jsDate = icalTime.toJSDate()
  if (!jsDate || isNaN(jsDate.getTime())) {
    throw new Error('Invalid JS Date')
  }
  return jsDate.toISOString()
}

function recurrenceToRRuleString(recurrence: RecurrenceRule): string {
  const freqMap: Record<string, string> = {
    secondly: 'SECONDLY',
    minutely: 'MINUTELY',
    hourly: 'HOURLY',
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  }

  const parts: string[] = [`FREQ=${freqMap[recurrence.frequency] || 'WEEKLY'}`]

  if (recurrence.interval && recurrence.interval !== 1) {
    parts.push(`INTERVAL=${recurrence.interval}`)
  }

  if (recurrence.byWeekday && recurrence.byWeekday.length > 0) {
    const bydayParts: string[] = []
    for (let i = 0; i < recurrence.byWeekday.length; i++) {
      const dayNum = recurrence.byWeekday[i]
      const dayCode = DAY_NUM_TO_CODE[dayNum]
      if (dayCode) {
        const pos = recurrence.bySetPos?.[i]
        if (pos !== undefined && pos !== 0) {
          bydayParts.push(`${pos}${dayCode}`)
        } else {
          bydayParts.push(dayCode)
        }
      }
    }
    if (bydayParts.length > 0) {
      parts.push(`BYDAY=${bydayParts.join(',')}`)
    }
  }

  if (recurrence.byMonthDay && recurrence.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${recurrence.byMonthDay.join(',')}`)
  }

  if (recurrence.byMonth && recurrence.byMonth.length > 0) {
    parts.push(`BYMONTH=${recurrence.byMonth.join(',')}`)
  }

  if (recurrence.bySetPos && recurrence.bySetPos.length > 0 && (!recurrence.byWeekday || recurrence.byWeekday.length === 0)) {
    parts.push(`BYSETPOS=${recurrence.bySetPos.join(',')}`)
  }

  if (recurrence.endDate) {
    const date = new Date(recurrence.endDate)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hour = String(date.getUTCHours()).padStart(2, '0')
    const minute = String(date.getUTCMinutes()).padStart(2, '0')
    const second = String(date.getUTCSeconds()).padStart(2, '0')
    parts.push(`UNTIL=${year}${month}${day}T${hour}${minute}${second}Z`)
  }

  if (recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`)
  }

  return parts.join(';')
}

export function icalEventToCalendarEvent(
  vevent: ICAL.Component,
  calendarId: string
): CalendarEvent {
  const event = new ICAL.Event(vevent)

  const dtstart = event.startDate
  const dtend = event.endDate

  const isAllDay = dtstart ? dtstart.isDate : false

  let start = ''
  let end = ''

  if (dtstart) {
    start = icalTimeToISO(dtstart)
  }

  if (dtend) {
    if (isAllDay) {
      const endDateStr = dtend.toString()
      const endDate = new Date(endDateStr + 'T00:00:00Z')
      endDate.setUTCDate(endDate.getUTCDate() - 1)
      const year = endDate.getUTCFullYear()
      const month = String(endDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(endDate.getUTCDate()).padStart(2, '0')
      end = `${year}-${month}-${day}`
    } else {
      end = icalTimeToISO(dtend)
    }
  }

  let recurrence: RecurrenceRule | undefined
  let rruleString: string | undefined

  const rruleProp = vevent.getFirstProperty('rrule')
  if (rruleProp) {
    rruleString = rruleProp.toICALString().substring(6)
    recurrence = parseRRule(rruleString)
  }

  const excludedDates: string[] = []
  const exdateProps = vevent.getAllProperties('exdate')
  for (const exdateProp of exdateProps) {
    const values = exdateProp.getValues()
    for (const val of values) {
      if (val instanceof ICAL.Time) {
        excludedDates.push(icalTimeToISO(val))
      }
    }
  }

  const reminders: Reminder[] = []
  const valarms = vevent.getAllSubcomponents('valarm')
  for (const valarm of valarms) {
    const triggerProp = valarm.getFirstProperty('trigger')
    if (triggerProp) {
      const triggerValue = triggerProp.getFirstValue()
      let minutes: number | null = null

      if (typeof triggerValue === 'string') {
        minutes = parseTriggerDuration(triggerValue)
      } else if (triggerValue instanceof ICAL.Duration) {
        // Duration triggers (e.g. -PT30M) are parsed by ical.js as ICAL.Duration
        const totalSeconds = triggerValue.toSeconds()
        minutes = Math.round(Math.abs(totalSeconds) / 60)
      } else if (triggerValue instanceof ICAL.Time) {
        // Bug 26 fix: calculate minutes from event DTSTART, not Date.now()
        const isoStr = icalTimeToISO(triggerValue)
        if (isoStr && dtstart) {
          const triggerDate = new Date(isoStr)
          const startDate = new Date(icalTimeToISO(dtstart))
          if (!isNaN(triggerDate.getTime()) && !isNaN(startDate.getTime())) {
            const diffMs = startDate.getTime() - triggerDate.getTime()
            minutes = Math.round(diffMs / 60000)
            if (minutes < 0) minutes = Math.abs(minutes)
          }
        }
      }

      if (minutes !== null && minutes > 0) {
        reminders.push({
          id: uuidv4(),
          minutesBefore: minutes,
          method: 'popup',
        })
      }
    }
  }

  const travelDuration = parseAppleTravelDuration(vevent)

  const transpProp = vevent.getFirstProperty('transp')
  let transparency: 'transparent' | 'opaque' = 'opaque'
  if (transpProp) {
    const transpValue = transpProp.getFirstValue() as string
    transparency = transpValue === 'TRANSPARENT' ? 'transparent' : 'opaque'
  }

  let recurrenceId: string | undefined
  const recIdProp = vevent.getFirstProperty('recurrence-id')
  if (recIdProp) {
    const recIdValue = recIdProp.getFirstValue()
    if (recIdValue instanceof ICAL.Time) {
      recurrenceId = icalTimeToISO(recIdValue)
    }
  }

  const categories: string[] = []
  const catProp = vevent.getFirstProperty('categories')
  if (catProp) {
    const catValue = catProp.getFirstValue()
    if (typeof catValue === 'string') {
      categories.push(...catValue.split(',').map((c) => c.trim()))
    }
  }

  const sequenceProp = vevent.getFirstProperty('sequence')
  const sequence = sequenceProp ? parseInt(sequenceProp.getFirstValue() as string, 10) : undefined

  // Parse attachments
  const attachments: CalendarAttachment[] = []
  const attachProps = vevent.getAllProperties('attach')
  for (const attachProp of attachProps) {
    const attachValue = attachProp.getFirstValue()

    // RFC 5545 §3.3.1: VALUE=BINARY with ENCODING=BASE64 → ical.js returns ICAL.Binary
    if (attachValue instanceof ICAL.Binary) {
      const base64Data = attachValue.decodeValue()
      const rawFmtType = attachProp.getParameter('fmttype')
      const contentType = (typeof rawFmtType === 'string' ? rawFmtType : undefined) || 'application/octet-stream'
      const filename = attachProp.getParameter('filename')
      attachments.push({
        href: `data:${contentType};base64,${base64Data}`,
        contentType,
        size: Math.round((base64Data.length * 3) / 4),
        filename: typeof filename === 'string' ? filename : 'attachment',
      })
    } else if (typeof attachValue === 'string') {
      // URI value type: could be a data: URI (legacy) or external URL
      if (attachValue.startsWith('data:')) {
        // Legacy data: URI format (backward compat)
        const match = attachValue.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          const filename = attachProp.getParameter('filename')
          attachments.push({
            href: attachValue,
            contentType: match[1],
            size: Math.round((match[2].length * 3) / 4),
            filename: typeof filename === 'string' ? filename : 'attachment',
          })
        }
      } else {
        // External URL attachment
        const fmttype = attachProp.getParameter('fmttype')
        const filename = attachProp.getParameter('filename')
        attachments.push({
          href: attachValue,
          contentType: typeof fmttype === 'string' ? fmttype : 'application/octet-stream',
          filename: typeof filename === 'string' ? filename : attachValue.split('/').pop() || 'attachment',
        })
      }
    }
  }

  return {
    id: event.uid || uuidv4(),
    calendarId,
    title: event.summary || 'Untitled',
    description: event.description,
    location: event.location,
    start,
    end,
    isAllDay,
    categories: categories.length > 0 ? categories : undefined,
    recurrence,
    reminders: reminders.length > 0 ? reminders : undefined,
    rruleString,
    travelDuration,
    transparency,
    sequence,
    excludedDates: excludedDates.length > 0 ? excludedDates : undefined,
    recurrenceId,
    attachments: attachments.length > 0 ? attachments : undefined,
  }
}

function parseTriggerDuration(trigger: string): number | null {
  if (trigger.startsWith('-PT')) {
    const duration = trigger.substring(3)
    let minutes = 0

    const hourMatch = duration.match(/(\d+)H/)
    const minMatch = duration.match(/(\d+)M/)
    const secMatch = duration.match(/(\d+)S/)

    if (hourMatch) {
      minutes += parseInt(hourMatch[1], 10) * 60
    }
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10)
    }
    if (secMatch) {
      minutes += Math.ceil(parseInt(secMatch[1], 10) / 60)
    }

    return minutes > 0 ? minutes : null
  }

  if (trigger.startsWith('PT')) {
    const duration = trigger.substring(2)
    let minutes = 0

    const hourMatch = duration.match(/(\d+)H/)
    const minMatch = duration.match(/(\d+)M/)
    const secMatch = duration.match(/(\d+)S/)

    if (hourMatch) {
      minutes += parseInt(hourMatch[1], 10) * 60
    }
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10)
    }
    if (secMatch) {
      minutes += Math.ceil(parseInt(secMatch[1], 10) / 60)
    }

    return minutes > 0 ? minutes : null
  }

  return null
}

function createAllDayDate(year: number, month: number, day: number): ICAL.Time {
  const time = new ICAL.Time({
    year,
    month,
    day,
    hour: 0,
    minute: 0,
    second: 0,
    isDate: true,
    timezone: 'UTC'
  }, ICAL.Timezone.utcTimezone)
  return time
}

export function calendarEventToIcalComponent(event: CalendarEvent): ICAL.Component {
  const vevent = new ICAL.Component('vevent')

  vevent.updatePropertyWithValue('uid', event.id)
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))
  vevent.updatePropertyWithValue('sequence', event.sequence ?? 0)

  if (event.isAllDay) {
    const startParts = event.start.split('T')[0].split('-')
    const startYear = parseInt(startParts[0], 10)
    const startMonth = parseInt(startParts[1], 10)
    const startDay = parseInt(startParts[2], 10)
    const startDate = createAllDayDate(startYear, startMonth, startDay)
    vevent.updatePropertyWithValue('dtstart', startDate)

    // Bug 27 fix: use date-fns addDays for proper date arithmetic.
    // The old manual rollover used new Date(y, m, 0) which gives the
    // last day of the previous month and fails at month/year boundaries.
    const endParts = event.end.split('T')[0].split('-')
    const endYear = parseInt(endParts[0], 10)
    const endMonth = parseInt(endParts[1], 10)
    const endDay = parseInt(endParts[2], 10)
    const endDateObj = addDays(new Date(endYear, endMonth - 1, endDay), 1)
    const endDate = createAllDayDate(
      endDateObj.getFullYear(),
      endDateObj.getMonth() + 1,
      endDateObj.getDate()
    )
    vevent.updatePropertyWithValue('dtend', endDate)
  } else {
    const startTime = createIcalDateTime(event.start)
    vevent.updatePropertyWithValue('dtstart', startTime)

    const endTime = createIcalDateTime(event.end)
    vevent.updatePropertyWithValue('dtend', endTime)
  }

  vevent.updatePropertyWithValue('summary', event.title)

  if (event.description) {
    vevent.updatePropertyWithValue('description', event.description)
  }

  if (event.location) {
    vevent.updatePropertyWithValue('location', event.location)
  }

  if (event.categories && event.categories.length > 0) {
    vevent.updatePropertyWithValue('categories', event.categories.join(','))
  }

  if (event.rruleString) {
    const rruleProp = ICAL.Property.fromString(`RRULE:${event.rruleString}`)
    vevent.addProperty(rruleProp)
  } else if (event.recurrence) {
    const rruleStr = recurrenceToRRuleString(event.recurrence)
    vevent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(rruleStr))
  }

  if (event.recurrenceId) {
    if (event.isAllDay) {
      const recIdParts = event.recurrenceId.split('T')[0].split('-')
      const recId = createAllDayDate(
        parseInt(recIdParts[0], 10),
        parseInt(recIdParts[1], 10),
        parseInt(recIdParts[2], 10)
      )
      vevent.updatePropertyWithValue('recurrence-id', recId)
    } else {
      const recId = createIcalDateTime(event.recurrenceId)
      vevent.updatePropertyWithValue('recurrence-id', recId)
    }
  }

  if (event.excludedDates && event.excludedDates.length > 0) {
    for (const exDate of event.excludedDates) {
      if (event.isAllDay) {
        const exParts = exDate.split('T')[0].split('-')
        const exIcalDate = createAllDayDate(
          parseInt(exParts[0], 10),
          parseInt(exParts[1], 10),
          parseInt(exParts[2], 10)
        )
        vevent.addPropertyWithValue('exdate', exIcalDate)
      } else {
        const exIcalTime = createIcalDateTime(exDate)
        vevent.addPropertyWithValue('exdate', exIcalTime)
      }
    }
  }

  vevent.updatePropertyWithValue('transp', event.transparency === 'transparent' ? 'TRANSPARENT' : 'OPAQUE')

  if (event.travelDuration) {
    addAppleTravelDuration(vevent, event.travelDuration)
  }

  if (event.reminders && event.reminders.length > 0) {
    for (const reminder of event.reminders) {
      const valarm = new ICAL.Component('valarm')
      valarm.updatePropertyWithValue('action', 'DISPLAY')
      valarm.updatePropertyWithValue('trigger', `-PT${reminder.minutesBefore}M`)
      vevent.addSubcomponent(valarm)
    }
  }

  // Serialize attachments
  if (event.attachments && event.attachments.length > 0) {
    for (const attachment of event.attachments) {
      if (attachment.href.startsWith('data:')) {
        // Inline binary: extract base64 from data URI, write per RFC 5545 §3.8.1.1
        const match = attachment.href.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          const attachProp = new ICAL.Property('attach')
          attachProp.setParameter('value', 'BINARY')
          attachProp.setParameter('encoding', 'BASE64')
          if (attachment.contentType) {
            attachProp.setParameter('fmttype', attachment.contentType)
          }
          if (attachment.filename) {
            attachProp.setParameter('filename', attachment.filename)
          }
          attachProp.setValue(new ICAL.Binary(match[2]))
          vevent.addProperty(attachProp)
        }
      } else {
        // External URL: write as URI (default value type)
        const attachProp = new ICAL.Property('attach')
        attachProp.setValue(attachment.href)
        if (attachment.contentType) {
          attachProp.setParameter('fmttype', attachment.contentType)
        }
        if (attachment.filename) {
          attachProp.setParameter('filename', attachment.filename)
        }
        vevent.addProperty(attachProp)
      }
    }
  }

  return vevent
}

export function icalVtodoToCalendarEvent(vtodo: ICAL.Component, calendarId: string): CalendarEvent {
  const uidProp = vtodo.getFirstProperty('uid')
  const summaryProp = vtodo.getFirstProperty('summary')
  const descProp = vtodo.getFirstProperty('description')
  const dueProp = vtodo.getFirstProperty('due')
  const priorityProp = vtodo.getFirstProperty('priority')
  const percentProp = vtodo.getFirstProperty('percent-complete')
  const statusProp = vtodo.getFirstProperty('status')
  const seqProp = vtodo.getFirstProperty('sequence')
  const catProp = vtodo.getFirstProperty('categories')

  let dueDate: string | undefined
  let isAllDay = true

  if (dueProp) {
    try {
      const dueRawValue = dueProp.getFirstValue()
      if (dueRawValue instanceof ICAL.Time) {
        const isoStr = icalTimeToISO(dueRawValue)
        if (isoStr && !isoStr.endsWith('T::')) {
          dueDate = isoStr
          isAllDay = dueRawValue.isDate
        }
      }
    } catch {
      const dueStr = dueProp.toString().replace(/^DUE[^:]*:/i, '')
      if (dueStr && /^\d{8}$/.test(dueStr.trim())) {
        const year = dueStr.substring(0, 4)
        const month = dueStr.substring(4, 6)
        const day = dueStr.substring(6, 8)
        dueDate = `${year}-${month}-${day}T00:00:00.000Z`
        isAllDay = true
      }
    }
  }

  let priority: TaskPriority | undefined
  if (priorityProp) {
    const priorityValue = parseInt(priorityProp.getFirstValue() as string, 10)
    const priorityMap: Record<number, TaskPriority> = {
      1: 1,
      2: 2,
      3: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 3,
      9: 3,
    }
    priority = priorityMap[priorityValue] ?? 2
  }

  let percentComplete: number | undefined
  let completed = false
  if (percentProp) {
    percentComplete = parseInt(percentProp.getFirstValue() as string, 10)
    completed = percentComplete >= 100
  }

  if (statusProp) {
    const status = statusProp.getFirstValue() as string
    completed = status === 'COMPLETED'
  }

  const categories: string[] = []
  if (catProp) {
    const catValue = catProp.getFirstValue()
    if (typeof catValue === 'string') {
      categories.push(...catValue.split(',').map((c) => c.trim()))
    }
  }

  const sequence = seqProp ? parseInt(seqProp.getFirstValue() as string, 10) : undefined

  return {
    id: uidProp ? (uidProp.getFirstValue() as string) : uuidv4(),
    calendarId,
    title: summaryProp ? (summaryProp.getFirstValue() as string) : 'Untitled',
    description: descProp ? (descProp.getFirstValue() as string) : undefined,
    start: dueDate || new Date().toISOString(),
    end: dueDate || new Date().toISOString(),
    isAllDay,
    categories: categories.length > 0 ? categories : undefined,
    type: 'task',
    dueDate,
    completed,
    priority,
    percentComplete,
    sequence,
  }
}

export function calendarEventToIcalVtodo(task: CalendarEvent): ICAL.Component {
  const vtodo = new ICAL.Component('vtodo')

  vtodo.updatePropertyWithValue('uid', task.id)
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))
  vtodo.updatePropertyWithValue('sequence', task.sequence ?? 0)
  vtodo.updatePropertyWithValue('summary', task.title)

  if (task.dueDate) {
    if (task.isAllDay) {
      const dueParts = task.dueDate.split('T')[0].split('-')
      const dueDate = createAllDayDate(
        parseInt(dueParts[0], 10),
        parseInt(dueParts[1], 10),
        parseInt(dueParts[2], 10)
      )
      vtodo.updatePropertyWithValue('due', dueDate)
    } else {
      const dueTime = ICAL.Time.fromJSDate(new Date(task.dueDate))
      vtodo.updatePropertyWithValue('due', dueTime)
    }
  }

  if (task.description) {
    vtodo.updatePropertyWithValue('description', task.description)
  }

  if (task.categories && task.categories.length > 0) {
    vtodo.updatePropertyWithValue('categories', task.categories.join(','))
  }

  if (task.priority) {
    const priorityValue = task.priority === 1 ? 1 : task.priority === 2 ? 5 : 9
    vtodo.updatePropertyWithValue('priority', priorityValue)
  }

  if (task.percentComplete !== undefined) {
    vtodo.updatePropertyWithValue('percent-complete', task.percentComplete)
  }

  if (task.completed) {
    vtodo.updatePropertyWithValue('status', 'COMPLETED')
    vtodo.updatePropertyWithValue('completed', ICAL.Time.now())
  } else {
    vtodo.updatePropertyWithValue('status', 'NEEDS-ACTION')
  }

  return vtodo
}

// ── VJOURNAL ──────────────────────────────────────────────────────────────

export function icalVjournalToCalendarEvent(
  vjournal: ICAL.Component,
  calendarId: string
): CalendarEvent {
  const uidProp = vjournal.getFirstProperty('uid')
  const summaryProp = vjournal.getFirstProperty('summary')
  const descProp = vjournal.getFirstProperty('description')
  const dtstartProp = vjournal.getFirstProperty('dtstart')
  const createdProp = vjournal.getFirstProperty('created')
  const lastModProp = vjournal.getFirstProperty('last-modified')
  const seqProp = vjournal.getFirstProperty('sequence')
  const catProp = vjournal.getFirstProperty('categories')

  // DTSTART — date only for journal entries
  let startDate = new Date().toISOString().split('T')[0]
  if (!dtstartProp) {
    console.warn('VJOURNAL missing DTSTART, defaulting to today:', uidProp?.getFirstValue())
  }
  if (dtstartProp) {
    const raw = dtstartProp.getFirstValue()
    if (raw instanceof ICAL.Time) {
      const isoStr = icalTimeToISO(raw)
      if (isoStr) {
        // Journal entries are date-only — strip any time component
        startDate = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr
      }
    }
  }

  const categories: string[] = []
  if (catProp) {
    const catValue = catProp.getFirstValue()
    if (typeof catValue === 'string') {
      categories.push(...catValue.split(',').map((c) => c.trim()))
    }
  }

  let created: string | undefined
  if (createdProp) {
    try {
      const val = createdProp.getFirstValue()
      if (val instanceof ICAL.Time) created = icalTimeToISO(val)
    } catch { /* skip */ }
  }
  // Fallback: use start date for events without CREATED property
  if (!created) {
    created = new Date(startDate).toISOString()
  }

  let lastModified: string | undefined
  if (lastModProp) {
    try {
      const val = lastModProp.getFirstValue()
      if (val instanceof ICAL.Time) lastModified = icalTimeToISO(val)
    } catch { /* skip */ }
  }
  // Fallback: use created date for events without LAST-MODIFIED property
  if (!lastModified) {
    lastModified = created
  }

  const sequence = seqProp ? parseInt(seqProp.getFirstValue() as string, 10) : undefined

  // URL
  const urlProp = vjournal.getFirstProperty('url')
  const url = urlProp ? (urlProp.getFirstValue() as string) : undefined

  // RELATED-TO (can occur multiple times)
  const relatedToProps = vjournal.getAllProperties('related-to')
  const relatedTo = relatedToProps
    .map(p => p.getFirstValue() as string)
    .filter(v => typeof v === 'string' && v.length > 0)

  // ATTACH (port from VEVENT logic)
  const attachments: CalendarAttachment[] = []
  const attachProps = vjournal.getAllProperties('attach')
  for (const attachProp of attachProps) {
    try {
      const attachValue = attachProp.getFirstValue()
      if (attachValue instanceof ICAL.Binary) {
        const base64Data = attachValue.decodeValue()
        const rawFmtType = attachProp.getParameter('fmttype')
        const contentType = (typeof rawFmtType === 'string' ? rawFmtType : undefined) || 'application/octet-stream'
        const filename = attachProp.getParameter('filename')
        attachments.push({
          href: `data:${contentType};base64,${base64Data}`,
          size: Math.round((base64Data.length * 3) / 4),
          filename: typeof filename === 'string' ? filename : 'attachment',
          contentType,
        })
      } else if (typeof attachValue === 'string') {
        if (attachValue.startsWith('data:')) {
          const match = attachValue.match(/^data:([^;]+);base64,(.+)$/)
          if (match) {
            const filename = attachProp.getParameter('filename')
            attachments.push({
              href: attachValue,
              contentType: match[1],
              size: Math.round((match[2].length * 3) / 4),
              filename: typeof filename === 'string' ? filename : 'attachment',
            })
          }
        } else {
          const fmttype = attachProp.getParameter('fmttype')
          const filename = attachProp.getParameter('filename')
          attachments.push({
            href: attachValue,
            contentType: typeof fmttype === 'string' ? fmttype : 'application/octet-stream',
            filename: typeof filename === 'string' ? filename : attachValue.split('/').pop() || 'attachment',
          })
        }
      }
    } catch { /* skip malformed attachment */ }
  }

  return {
    id: uidProp ? (uidProp.getFirstValue() as string) : uuidv4(),
    calendarId,
    title: summaryProp ? (summaryProp.getFirstValue() as string) : '',
    description: descProp ? (descProp.getFirstValue() as string) : '',
    start: startDate,
    end: startDate,
    isAllDay: true,
    type: 'journal',
    categories: categories.length > 0 ? categories : undefined,
    created,
    lastModified,
    sequence,
    url,
    relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  }
}

export function calendarEventToIcalVjournal(entry: CalendarEvent): ICAL.Component {
  const vjournal = new ICAL.Component('vjournal')

  vjournal.updatePropertyWithValue('uid', entry.id)
  vjournal.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))
  vjournal.updatePropertyWithValue('sequence', entry.sequence ?? 0)

  // DTSTART — date only for journal entries
  const dateParts = entry.start.split('-')
  const dtstartDate = createAllDayDate(
    parseInt(dateParts[0], 10),
    parseInt(dateParts[1], 10),
    parseInt(dateParts[2], 10)
  )
  vjournal.updatePropertyWithValue('dtstart', dtstartDate)

  if (entry.title) {
    vjournal.updatePropertyWithValue('summary', entry.title)
  }

  if (entry.description) {
    vjournal.updatePropertyWithValue('description', entry.description)
  }

  if (entry.categories && entry.categories.length > 0) {
    vjournal.updatePropertyWithValue('categories', entry.categories.join(','))
  }

  if (entry.created) {
    try {
      vjournal.updatePropertyWithValue('created', ICAL.Time.fromJSDate(new Date(entry.created)))
    } catch { /* skip */ }
  }

  if (entry.lastModified) {
    try {
      vjournal.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(entry.lastModified)))
    } catch { /* skip */ }
  }

  if (entry.url) {
    vjournal.updatePropertyWithValue('url', entry.url)
  }

  if (entry.relatedTo && entry.relatedTo.length > 0) {
    for (const ref of entry.relatedTo) {
      vjournal.addPropertyWithValue('related-to', ref)
    }
  }

  // Serialize attachments (port from VEVENT logic)
  if (entry.attachments && entry.attachments.length > 0) {
    for (const attachment of entry.attachments) {
      if (attachment.href.startsWith('data:')) {
        const match = attachment.href.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          const attachProp = new ICAL.Property('attach')
          attachProp.setParameter('value', 'BINARY')
          attachProp.setParameter('encoding', 'BASE64')
          if (attachment.contentType) {
            attachProp.setParameter('fmttype', attachment.contentType)
          }
          if (attachment.filename) {
            attachProp.setParameter('filename', attachment.filename)
          }
          attachProp.setValue(new ICAL.Binary(match[2]))
          vjournal.addProperty(attachProp)
        }
      } else {
        const attachProp = new ICAL.Property('attach')
        attachProp.setValue(attachment.href)
        if (attachment.contentType) {
          attachProp.setParameter('fmttype', attachment.contentType)
        }
        if (attachment.filename) {
          attachProp.setParameter('filename', attachment.filename)
        }
        vjournal.addProperty(attachProp)
      }
    }
  }

  return vjournal
}