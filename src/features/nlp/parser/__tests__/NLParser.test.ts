import { describe, it, expect, beforeEach } from 'vitest'
import { NLParser } from '../NLParser'

describe('NLParser - Bug #89: recurrence should not destroy endDate/duration', () => {
  let parser: NLParser

  beforeEach(() => {
    // Use a fixed reference date so tests are deterministic
    parser = new NLParser({
      defaultDate: new Date('2026-05-27T10:00:00'),
      defaultDuration: 60,
    })
  })

  it('preserves endDate and duration for a recurring event with explicit time range', () => {
    const result = parser.parse('meeting daily from 2pm to 3pm')

    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('daily')
    expect(result.endDate).toBeDefined()
    expect(result.duration).toBeDefined()
    expect(result.duration).toBeGreaterThan(0)
  })

  it('preserves endDate and duration for "every week" with a duration', () => {
    const result = parser.parse('yoga every week for 90 minutes')

    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('weekly')
    expect(result.duration).toBe(90)
    expect(result.endDate).toBeDefined()
  })

  it('preserves duration when recurrence is detected from "weekdays" keyword', () => {
    // "weekday desk" previously matched \bweekdays?\b and destroyed endDate/duration
    const result = parser.parse('weekday desk meeting at 10am for 30 minutes')

    // "weekday" matches the recurrence pattern
    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('weekly')

    // Duration should be preserved (not cleared)
    expect(result.duration).toBe(30)
  })

  it('preserves endDate when a chrono-parsed time range exists alongside recurrence', () => {
    const result = parser.parse('standup daily at 9am to 9:30am')

    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('daily')
    expect(result.endDate).toBeDefined()
    // endDate should be after startDate
    expect(result.endDate!.getTime()).toBeGreaterThan(result.startDate.getTime())
  })

  it('sets recurrence and still returns valid startDate', () => {
    const result = parser.parse('lunch every day')

    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('daily')
    expect(result.startDate).toBeInstanceOf(Date)
    expect(result.startDate.getTime()).toBeGreaterThan(0)
  })

  it('non-recurring event has no recurrence but still has endDate/duration', () => {
    const result = parser.parse('meeting tomorrow at 2pm for 1 hour')

    expect(result.recurrence).toBeUndefined()
    expect(result.endDate).toBeDefined()
    expect(result.duration).toBe(60)
  })

  it('preserves byWeekday for "every weekday"', () => {
    const result = parser.parse('standup every weekday at 10am')

    expect(result.recurrence).toBeDefined()
    expect(result.recurrence?.frequency).toBe('weekly')
    expect(result.recurrence?.byWeekday).toEqual([1, 2, 3, 4, 5])
    expect(result.endDate).toBeDefined()
  })
})
