import { describe, it, expect } from 'vitest'
import {
  createBirthdayEvent,
  hasBirthdayEvent,
  createAnniversaryEvent,
  hasAnniversaryEvent,
} from '../birthdayReminders'

describe('createAnniversaryEvent', () => {
  it('creates an annual all-day event on the anniversary month/day', () => {
    const event = createAnniversaryEvent({
      contactId: 'c1',
      contactName: 'Alex',
      anniversary: '2010-06-15',
      calendarId: 'cal1',
    })

    expect(event.isAllDay).toBe(true)
    expect(event.recurrence).toEqual({ frequency: 'yearly', interval: 1 })
    expect(event.categories).toEqual(['anniversary'])
    expect(event.title).toContain('Alex')
    // DTSTART uses the current year but preserves month/day
    expect(event.start.slice(5, 10)).toBe('06-15')
  })

  it('uses a distinct link marker from birthday', () => {
    const event = createAnniversaryEvent({
      contactId: 'c1',
      contactName: 'Alex',
      anniversary: '2010-06-15',
      calendarId: 'cal1',
    })
    expect(event.url).toBe('calino:contact:c1:anniversary')
  })
})

describe('hasBirthdayEvent / hasAnniversaryEvent do not collide', () => {
  it('distinguishes birthday and anniversary events for the same contact', () => {
    const birthday = createBirthdayEvent({
      contactId: 'c1',
      contactName: 'Alex',
      birthday: '1990-01-02',
      calendarId: 'cal1',
    })
    const anniversary = createAnniversaryEvent({
      contactId: 'c1',
      contactName: 'Alex',
      anniversary: '2010-06-15',
      calendarId: 'cal1',
    })

    // Only birthday present
    expect(hasBirthdayEvent('c1', [birthday])).toBe(true)
    expect(hasAnniversaryEvent('c1', [birthday])).toBe(false)

    // Only anniversary present
    expect(hasAnniversaryEvent('c1', [anniversary])).toBe(true)
    expect(hasBirthdayEvent('c1', [anniversary])).toBe(false)

    // Both present
    const both = [birthday, anniversary]
    expect(hasBirthdayEvent('c1', both)).toBe(true)
    expect(hasAnniversaryEvent('c1', both)).toBe(true)
  })
})
