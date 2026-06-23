import { format, parseISO } from 'date-fns'

/**
 * Format an ISO-8601 timestamp as `'MMM d, yyyy h:mm a'`
 * (e.g. `Mar 15, 2026 3:00 PM`). Returns the raw string on parse error.
 *
 * Used by the broken-events and data-management settings views.
 */
export function formatBrokenEventDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}
