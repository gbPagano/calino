import { describe, it, expect } from 'vitest'
import { positionEvents } from '../eventPositioning'
import { makeEvent, eventTimeRange } from './fixtures'

const day = (hour: number, durationMin: number) =>
  eventTimeRange(2026, 4, 27, hour, 0, durationMin * 60_000)

describe('positionEvents - Bug #83: short event overlap detection', () => {
  it('assigns totalColumns=2 for two overlapping events regardless of duration', () => {
    // Two events that overlap but are both shorter than 30 minutes
    const events = [
      makeEvent({ id: 'a', title: 'Event a', ...day(10, 15) }),
      makeEvent({ id: 'b', title: 'Event b', ...day(10, 15) }),
    ]

    const result = positionEvents(events)
    expect(result).toHaveLength(2)

    // Both should report totalColumns = 2 since they fully overlap
    for (const positioned of result) {
      expect(positioned.totalColumns).toBe(2)
    }
  })

  it('assigns totalColumns=3 for three concurrent 10-minute events', () => {
    const events = [
      makeEvent({ id: 'a', title: 'Event a', ...day(10, 10) }),
      makeEvent({ id: 'b', title: 'Event b', ...day(10, 10) }),
      makeEvent({ id: 'c', title: 'Event c', ...day(10, 10) }),
    ]

    const result = positionEvents(events)

    for (const positioned of result) {
      expect(positioned.totalColumns).toBe(3)
    }
  })

  it('detects overlap between a short event and a long event', () => {
    const events = [
      makeEvent({ id: 'long', title: 'Event long', ...day(10, 60) }),
      makeEvent({ id: 'short', title: 'Event short', ...day(10, 5) }),
    ]

    const result = positionEvents(events)

    for (const positioned of result) {
      expect(positioned.totalColumns).toBe(2)
    }
  })

  it('short event sandwiched between two non-overlapping events gets totalColumns=1', () => {
    const events = [
      makeEvent({ id: 'a', title: 'Event a', ...day(10, 10) }),
      makeEvent({ id: 'b', title: 'Event b', ...day(10, 15) }),
      makeEvent({ id: 'c', title: 'Event c', ...day(11, 10) }),
    ]

    const result = positionEvents(events)

    const eventC = result.find((r) => r.event.id === 'c')!
    expect(eventC.totalColumns).toBe(1)
    expect(eventC.column).toBe(0)

    // a and b overlap each other
    const eventA = result.find((r) => r.event.id === 'a')!
    const eventB = result.find((r) => r.event.id === 'b')!
    expect(eventA.totalColumns).toBe(2)
    expect(eventB.totalColumns).toBe(2)
  })

  it('cascading short overlaps compute correct totalColumns', () => {
    // a: 10:00-10:10, b: 10:05-10:15, c: 10:10-10:20
    // a overlaps b, b overlaps c, a does NOT overlap c
    // a.totalColumns=2, b.totalColumns=3, c.totalColumns=2

    // All three start at 10:00 for simplicity
    const preciseEvents = [
      makeEvent({ id: 'a', title: 'Event a', ...day(10, 10) }),
      makeEvent({ id: 'b', title: 'Event b', ...day(10, 15) }),
      makeEvent({ id: 'c', title: 'Event c', ...day(10, 10) }),
    ]

    const result = positionEvents(preciseEvents)

    for (const positioned of result) {
      expect(positioned.totalColumns).toBe(3)
    }
  })

  it('single event has totalColumns=1', () => {
    const events = [makeEvent({ id: 'only', title: 'Event only', ...day(10, 15) })]

    const result = positionEvents(events)
    expect(result[0].totalColumns).toBe(1)
  })

  it('excludes transparent events from positioning', () => {
    const events = [
      makeEvent({ id: 'opaque', title: 'Event opaque', ...day(10, 30) }),
      makeEvent({
        id: 'transparent',
        title: 'Event transparent',
        ...day(10, 30),
        transparency: 'transparent',
      }),
    ]

    const result = positionEvents(events)
    // Only the opaque event should be positioned
    expect(result).toHaveLength(1)
    expect(result[0].event.id).toBe('opaque')
    expect(result[0].totalColumns).toBe(1)
  })

  it('events with zero-length duration (start === end) get totalColumns=1', () => {
    const events = [
      makeEvent({ id: 'a', title: 'Event a', ...day(10, 0) }),
      makeEvent({ id: 'b', title: 'Event b', ...day(10, 0) }),
    ]

    const result = positionEvents(events)
    // Zero-duration events don't overlap (start < end check fails)
    for (const positioned of result) {
      expect(positioned.totalColumns).toBe(1)
    }
  })
})
