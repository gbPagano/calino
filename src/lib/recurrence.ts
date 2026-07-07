import { RRule } from 'rrule'
import type { CalendarEvent, RecurrenceRule } from '@/types'
import { toICalUTC } from './datetime'

// byWeekday numbers stored in RecurrenceRule → BYDAY codes
export const DAY_NUM_TO_CODE: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
}

export const FREQ_MAP: Record<string, string> = {
  secondly: 'SECONDLY',
  minutely: 'MINUTELY',
  hourly: 'HOURLY',
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
}

function capitaliseFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * RRule.toText() doesn't support secondly. Provide a fallback that uses the
 * same wording style (every N seconds / every second).
 */
function describeSecondly(interval: number): string {
  if (interval === 1) return 'Every second'
  if (interval === 2) return 'Every other second'
  return `Every ${interval} seconds`
}

/**
 * Build an RFC 5545 RRULE string from a RecurrenceRule object.
 *
 * Handles: FREQ, INTERVAL, BYDAY (with positional prefix, e.g. 2TU for
 * second Tuesday), BYMONTHDAY, BYMONTH, BYWEEKNO, BYYEARDAY, BYHOUR,
 * BYMINUTE, BYSECOND, WKST, BYSETPOS (only when byWeekday is empty),
 * UNTIL (with Z suffix), and COUNT. UNTIL takes precedence over
 * COUNT per RFC 5545.
 *
 * R2.1 — For all-day events (rule.isAllDay === true), UNTIL is emitted
 * as VALUE=DATE (YYYYMMDD) per RFC 5545 §3.3.10. The caller must set
 * isAllDay on the recurrence object before calling this function.
 *
 * R2.4 — Per-BYDAY ordinals (e.g. 2MO, -1FR) come from rule.byDayOrdinals,
 * NOT rule.bySetPos. rule.bySetPos is reserved for the standalone
 * BYSETPOS rule part (e.g. "last weekday" = BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1).
 *
 * Used by:
 *  - recurrence.ts (human-readable descriptions via rrule.toText())
 *  - calendarStore.ts (event expansion)
 *  - icalTypeMapping.ts (CalDAV serialization)
 */
export function buildRRuleString(rule: RecurrenceRule): string {
  const parts: string[] = []
  parts.push(`FREQ=${FREQ_MAP[rule.frequency] ?? 'WEEKLY'}`)

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`)
  }

  if (rule.byWeekday && rule.byWeekday.length > 0) {
    const bydayParts: string[] = []
    for (let i = 0; i < rule.byWeekday.length; i++) {
      const dayCode = DAY_NUM_TO_CODE[rule.byWeekday[i]]
      if (dayCode) {
        // R2.4 — Read per-BYDAY ordinals from byDayOrdinals, not bySetPos.
        const pos = rule.byDayOrdinals?.[i]
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

  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`)
  }

  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`)
  }

  // R2.4 — Standalone BYSETPOS: only emit when no BYDAY is present, OR
  // when byDayOrdinals is empty (i.e. this BYSETPOS is genuinely a
  // standalone rule part, not a per-BYDAY ordinal misread).
  if (rule.bySetPos && rule.bySetPos.length > 0 && (!rule.byWeekday || rule.byWeekday.length === 0)) {
    parts.push(`BYSETPOS=${rule.bySetPos.join(',')}`)
  }

  // R2.4 — New RRULE parts per RFC 5545 §3.3.10.
  if (rule.byWeekNo && rule.byWeekNo.length > 0) {
    parts.push(`BYWEEKNO=${rule.byWeekNo.join(',')}`)
  }
  if (rule.byYearDay && rule.byYearDay.length > 0) {
    parts.push(`BYYEARDAY=${rule.byYearDay.join(',')}`)
  }
  if (rule.byHour && rule.byHour.length > 0) {
    parts.push(`BYHOUR=${rule.byHour.join(',')}`)
  }
  if (rule.byMinute && rule.byMinute.length > 0) {
    parts.push(`BYMINUTE=${rule.byMinute.join(',')}`)
  }
  if (rule.bySecond && rule.bySecond.length > 0) {
    parts.push(`BYSECOND=${rule.bySecond.join(',')}`)
  }
  if (rule.wkst) {
    parts.push(`WKST=${rule.wkst}`)
  }

  if (rule.endDate) {
    if (rule.isAllDay) {
      // R2.1 — VALUE=DATE form for all-day events per RFC 5545 §3.3.10.
      // endDate is stored as a date-only string ('YYYY-MM-DD') on the event;
      // emit it as YYYYMMDD without a time component or Z suffix.
      const d = new Date(rule.endDate)
      const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      parts.push(`UNTIL=${yyyymmdd}`)
    } else {
      parts.push(`UNTIL=${toICalUTC(new Date(rule.endDate))}`)
    }
  } else if (rule.count) {
    parts.push(`COUNT=${rule.count}`)
  }

  return parts.join(';')
}

function describeFromRruleString(rruleString: string): string {
  if (/^FREQ=SECONDLY/i.test(rruleString) || /;FREQ=SECONDLY/i.test(rruleString)) {
    const intervalMatch = rruleString.match(/INTERVAL=(\d+)/i)
    const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1
    return describeSecondly(interval)
  }
  try {
    const rrule = RRule.fromString(`RRULE:${rruleString.replace(/^RRULE:/i, '')}`)
    return capitaliseFirst(rrule.toText())
  } catch {
    return 'Recurring'
  }
}

function describeFromRecurrenceRule(rule: RecurrenceRule): string {
  if (rule.frequency === 'secondly') {
    return describeSecondly(rule.interval ?? 1)
  }
  try {
    const rruleString = buildRRuleString(rule)
    const rrule = RRule.fromString(`RRULE:${rruleString}`)
    return capitaliseFirst(rrule.toText())
  } catch {
    return 'Recurring'
  }
}

export function describeRecurrence(event: CalendarEvent): string {
  if (event.rruleString) return describeFromRruleString(event.rruleString)
  if (event.recurrence) return describeFromRecurrenceRule(event.recurrence)
  return 'Recurring'
}
