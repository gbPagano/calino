export function extractOriginalEventId(eventId: string): string | null {
  const isoDateMatch = eventId.match(/(.+)-(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/)
  if (isoDateMatch) {
    return isoDateMatch[1]
  }
  return null
}

/**
 * Resolves an event by id, falling back to its recurrence-master id when the id
 * refers to a generated recurring instance (see {@link extractOriginalEventId}).
 * Centralizes the `find(id) ?? find(originalId)` pattern used across the app.
 *
 * Pass a precomputed `Map` (from {@link buildEventIndex}) to avoid O(n) scans in
 * hot paths; otherwise an array is scanned directly.
 */
export function findEventById<T extends { id: string }>(
  events: readonly T[] | ReadonlyMap<string, T>,
  id: string | null | undefined
): T | undefined {
  if (!id) return undefined
  const originalId = extractOriginalEventId(id)
  if (events instanceof Map) {
    return events.get(id) ?? (originalId !== null ? events.get(originalId) : undefined)
  }
  const arr = events as readonly T[]
  return (
    arr.find((e) => e.id === id) ??
    (originalId !== null ? arr.find((e) => e.id === originalId) : undefined)
  )
}

/** Builds an id → event Map for O(1) lookups via {@link findEventById}. */
export function buildEventIndex<T extends { id: string }>(events: readonly T[]): Map<string, T> {
  const index = new Map<string, T>()
  for (const event of events) index.set(event.id, event)
  return index
}

export function hasDueTime(event: { dueDate?: string | null; isAllDay?: boolean }): boolean {
  if (!event.dueDate) return false
  if (event.isAllDay) return false
  if (!event.dueDate.includes('T')) return false
  const timePart = event.dueDate.split('T')[1]
  if (!timePart) return false
  const normalizedTime = timePart.split('.')[0]
  return normalizedTime !== '00:00:00' && normalizedTime !== '00:00'
}

export function formatTravelDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins > 0) {
      return `${hours}h ${mins}m`
    }
    return `${hours}h`
  }
  return `${minutes} min`
}
