import { format } from 'date-fns'
import { buildRRuleString } from '@/lib/recurrence'
import type { CalendarEvent, RecurrenceRule } from '@/types'

export interface MasterTruncation {
  excludedDates: string[]
  recurrence: RecurrenceRule | undefined
  rruleString: string | undefined
}

/**
 * Computes the patch to apply to a recurrence master when splitting a series at
 * a given occurrence ("This and following events"). The master keeps every
 * occurrence *before* the split by ending its recurrence the day before, and
 * excludes the split date itself (a new series takes over from there).
 *
 * Pure — it neither mutates the store nor calls CalDAV. Callers apply the
 * returned patch (via `updateEvent`) and separately create the new series.
 *
 * @param master           the recurrence master event
 * @param occurrenceDateStr the split occurrence date, `yyyy-MM-dd`
 */
export function buildMasterTruncation(
  master: CalendarEvent,
  occurrenceDateStr: string
): MasterTruncation {
  // End the master the day before the split point, in UTC. The 'Z' literal
  // keeps it in UTC and avoids an off-by-one from local-time interpretation.
  const splitDate = new Date(`${occurrenceDateStr}T00:00:00Z`)
  const dayBefore = new Date(splitDate)
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
  const masterEndDate = format(dayBefore, "yyyy-MM-dd'T'23:59:59'Z'")

  const excluded = master.excludedDates || []
  const excludedDates = excluded.includes(occurrenceDateStr)
    ? excluded
    : [...excluded, occurrenceDateStr]

  const recurrence: RecurrenceRule | undefined = master.recurrence
    ? { ...master.recurrence, endDate: masterEndDate, count: undefined, isAllDay: master.isAllDay }
    : undefined

  const rruleString = recurrence ? buildRRuleString(recurrence) : undefined

  return { excludedDates, recurrence, rruleString }
}
