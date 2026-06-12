import { RRule } from 'rrule'
import type { CalendarEvent, RecurrenceRule } from '@/types'

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

function ruleObjectToRRuleString(rule: RecurrenceRule): string {
  const parts: string[] = []
  parts.push(`FREQ=${FREQ_MAP[rule.frequency] ?? 'WEEKLY'}`)
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`)
  }
  if (rule.endDate) {
    parts.push(`UNTIL=${rule.endDate.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`)
  } else if (rule.count) {
    parts.push(`COUNT=${rule.count}`)
  }
  if (rule.byWeekday && rule.byWeekday.length > 0) {
    const codes = rule.byWeekday
      .map((d) => DAY_NUM_TO_CODE[d])
      .filter(Boolean)
      .join(',')
    if (codes) parts.push(`BYDAY=${codes}`)
  }
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`)
  }
  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`)
  }
  if (rule.bySetPos && rule.bySetPos.length > 0) {
    parts.push(`BYSETPOS=${rule.bySetPos.join(',')}`)
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
    const rruleString = ruleObjectToRRuleString(rule)
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
