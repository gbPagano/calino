import { describe, it, expect, vi } from 'vitest'

// R5.2 — the function uses `format(date, "yyyy-MM-dd'T'23:59:59'Z'")` from
// date-fns, which formats in the system's *local* timezone. To make these
// tests deterministic across timezones (the test environment may be UTC,
// UTC+2, etc.), we override `format` to return the date's UTC ISO string.
// All other date-fns exports are preserved via `importActual`.
vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns')
  return {
    ...actual,
    format: (date: Date): string => date.toISOString(),
  }
})

import { buildMasterTruncation } from '../recurrenceSplit'
import { makeEvent, makeRule } from './fixtures'
import type { CalendarEvent } from '@/types'

describe('buildMasterTruncation (R5.2: do not pollute excludedDates)', () => {
  it('returns excludedDates: [] when the master has no excludedDates', () => {
    const master = makeEvent({ recurrence: makeRule({ frequency: 'weekly' }) })
    const result = buildMasterTruncation(master, '2026-04-15')
    expect(result.excludedDates).toEqual([])
  })

  it('does NOT include occurrenceDateStr in excludedDates (R5.2 fix)', () => {
    const master = makeEvent({ recurrence: makeRule({ frequency: 'weekly' }) })
    const result = buildMasterTruncation(master, '2026-04-15')
    expect(result.excludedDates).not.toContain('2026-04-15')
  })

  it('preserves the master\'s existing excludedDates without appending the split date', () => {
    const master = makeEvent({
      recurrence: makeRule({ frequency: 'weekly' }),
      excludedDates: ['2026-03-01', '2026-03-08'],
    })
    const result = buildMasterTruncation(master, '2026-04-15')
    // Exact array — no push of '2026-04-15', no reordering, no dedup magic.
    expect(result.excludedDates).toEqual(['2026-03-01', '2026-03-08'])
  })

  it('sets recurrence.endDate to the day before occurrenceDateStr (truncation does the work)', () => {
    const master = makeEvent({ recurrence: makeRule({ frequency: 'weekly' }) })
    const result = buildMasterTruncation(master, '2026-04-15')
    // With format() mocked to return date.toISOString(), the dayBefore
    // Date object is 2026-04-14T00:00:00.000Z, so endDate must be that.
    // This proves the master will not generate on the split date — which
    // is precisely why the EXDATE push (R5.2) was redundant.
    expect(result.recurrence?.endDate).toBe('2026-04-14T00:00:00.000Z')
  })

  it('does not mutate the master event (pure function)', () => {
    const recurrence = makeRule({ frequency: 'weekly' })
    const excludedDates = ['2026-03-01', '2026-03-08']
    const master: CalendarEvent = makeEvent({
      recurrence,
      excludedDates,
    })
    const beforeJson = JSON.stringify(master)

    buildMasterTruncation(master, '2026-04-15')

    // Deep-equal: no field on the master was added, removed, or changed.
    expect(JSON.stringify(master)).toBe(beforeJson)
    // Identity: the recurrence and excludedDates array references are
    // preserved (no in-place mutation or replacement on the input).
    expect(master.recurrence).toBe(recurrence)
    expect(master.excludedDates).toBe(excludedDates)
  })
})
