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

// BYDAY codes → readable names
const BYDAY_TO_NAME: Record<string, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
}

const WEEKDAY_CODES = new Set(['MO', 'TU', 'WE', 'TH', 'FR'])
const WEEKEND_CODES = new Set(['SA', 'SU'])

function joinWords(words: string[]): string {
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return words.slice(0, -1).join(', ') + ', and ' + words[words.length - 1]
}

function intervalPrefix(interval: number, singular: string, plural: string): string {
  if (interval === 1) return `Every ${singular}`
  if (interval === 2) return `Every other ${singular}`
  return `Every ${interval} ${plural}`
}

function describeFromParts(freq: string, interval: number, byday: string[]): string {
  switch (freq) {
    case 'DAILY':
      return intervalPrefix(interval, 'day', 'days')

    case 'WEEKLY': {
      if (byday.length === 0) {
        return intervalPrefix(interval, 'week', 'weeks')
      }
      const isWeekdays = byday.length === 5 && byday.every((d) => WEEKDAY_CODES.has(d))
      const isWeekends = byday.length === 2 && byday.every((d) => WEEKEND_CODES.has(d))
      if (isWeekdays) return interval === 1 ? 'Every weekday' : `Every ${interval} weeks on weekdays`
      if (isWeekends) return interval === 1 ? 'Every weekend' : `Every ${interval} weeks on weekends`
      const names = byday.map((d) => BYDAY_TO_NAME[d] ?? d)
      if (names.length === 1 && interval === 1) return `Every ${names[0]}`
      const prefix = intervalPrefix(interval, 'week', 'weeks')
      return `${prefix} on ${joinWords(names)}`
    }

    case 'MONTHLY':
      return intervalPrefix(interval, 'month', 'months')

    case 'YEARLY':
      return intervalPrefix(interval, 'year', 'years')

    default:
      return 'Recurring'
  }
}

function describeFromRruleString(rruleString: string): string {
  const parts: Record<string, string> = {}
  // strip any RRULE: prefix that CalDAV events may include
  const stripped = rruleString.replace(/^RRULE:/i, '')
  stripped.split(';').forEach((part) => {
    const eq = part.indexOf('=')
    if (eq !== -1) parts[part.slice(0, eq)] = part.slice(eq + 1)
  })

  const freq = parts['FREQ'] ?? ''
  const interval = parseInt(parts['INTERVAL'] ?? '1', 10)
  const byday = parts['BYDAY'] ? parts['BYDAY'].split(',').map((d) => d.trim()) : []

  return describeFromParts(freq, interval, byday)
}

function describeFromRecurrenceRule(rule: RecurrenceRule): string {
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  }
  const freq = freqMap[rule.frequency] ?? 'WEEKLY'
  const interval = rule.interval ?? 1
  const byday = rule.byWeekday?.map((d) => DAY_NUM_TO_CODE[d]).filter(Boolean) ?? []
  return describeFromParts(freq, interval, byday)
}

export function describeRecurrence(event: CalendarEvent): string {
  if (event.rruleString) return describeFromRruleString(event.rruleString)
  if (event.recurrence) return describeFromRecurrenceRule(event.recurrence)
  return 'Recurring'
}
