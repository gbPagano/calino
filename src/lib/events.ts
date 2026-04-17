export function extractOriginalEventId(eventId: string): string | null {
  const isoDateMatch = eventId.match(/(.+)-(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/)
  if (isoDateMatch) {
    return isoDateMatch[1]
  }
  return null
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
