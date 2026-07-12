import { buildProxyUrl } from '@/features/caldav/client/CalDAVClient'

const NETWORK_TIMEOUT_MS = 15_000

/**
 * webcal:// and webcals:// are aliases for https:// (some feed publishers
 * still hand out webcal links, but the scheme just tells the OS "open in
 * your calendar app" — the transport is plain HTTP(S)).
 */
export function normalizeWebcalUrl(url: string): string {
  const trimmed = url.trim()
  if (/^webcals:\/\//i.test(trimmed)) {
    return trimmed.replace(/^webcals:\/\//i, 'https://')
  }
  if (/^webcal:\/\//i.test(trimmed)) {
    return trimmed.replace(/^webcal:\/\//i, 'https://')
  }
  return trimmed
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch and return the raw iCalendar text for a webcal subscription. Throws
 * a user-facing error message on any failure — callers surface it directly.
 */
export async function fetchWebcalIcs(url: string, proxyUrl?: string | null): Promise<string> {
  const normalized = normalizeWebcalUrl(url)

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('Enter a valid calendar URL (https:// or webcal://).')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http(s):// and webcal:// URLs are supported.')
  }

  const fetchUrl = proxyUrl ? buildProxyUrl(proxyUrl, normalized) : normalized

  let response: Response
  try {
    response = await fetchWithTimeout(fetchUrl)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Could not reach the calendar URL: ${msg}`, { cause: error })
  }

  if (!response.ok) {
    throw new Error(`Calendar URL returned status ${response.status}`)
  }

  const text = await response.text()
  if (!text.trim()) {
    throw new Error('Calendar URL returned an empty response.')
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error('That URL did not return a valid iCalendar (.ics) file.')
  }

  return text
}
