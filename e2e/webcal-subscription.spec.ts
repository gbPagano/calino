/**
 * Webcal (.ics URL) subscription flow.
 *
 * Subscribing fetches the URL once via fetchWebcalIcs (plain GET, no proxy
 * in this test), parses it with the same ICS parser CalDAV uses, and adds
 * a read-only calendar populated with the parsed events. Read-only means
 * the event card can't be dragged/resized and the event modal hides
 * save/delete for events in that calendar.
 */
import { test, expect } from '@playwright/test'
import { clearState } from './fixtures/localstorage'

const ICS_URL = 'https://example.com/test-calendar.ics'

// Use "today" so the event lands in the month view's default range without
// needing date-specific navigation (Calino's URL routes don't carry a date).
const today = new Date()
const y = today.getUTCFullYear()
const m = String(today.getUTCMonth() + 1).padStart(2, '0')
const d = String(today.getUTCDate()).padStart(2, '0')

const ICS_FIXTURE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//EN',
  'BEGIN:VEVENT',
  'UID:webcal-test-event-1@example.com',
  'DTSTAMP:20260101T000000Z',
  `DTSTART:${y}${m}${d}T090000Z`,
  `DTEND:${y}${m}${d}T100000Z`,
  'SUMMARY:Webcal Test Event',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

test.describe('Webcal calendar subscription', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page)
    await page.route(ICS_URL, async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/calendar', body: ICS_FIXTURE })
    })
  })

  test('subscribing adds a read-only calendar with the feed\'s events', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Add calendar' }).click()
    await page.getByText('Subscribe to Calendar (.ics)').click()

    await expect(page.getByRole('heading', { name: 'Subscribe to Calendar' })).toBeVisible()
    await page.getByLabel('Name (optional)').fill('Test Feed')
    await page.getByLabel('Calendar URL').fill(ICS_URL)
    await page.locator('[data-component="modal-save"]').click()

    // Modal closes once the subscription is added.
    await expect(page.getByRole('heading', { name: 'Subscribe to Calendar' })).not.toBeVisible()

    // Today's month view is already showing (default), and the fixture
    // event is dated today, so it's in the visible range without navigation.
    await page.goto('/month')

    const eventCard = page.locator('[data-component="event-card"]', { hasText: 'Webcal Test Event' })
    await expect(eventCard).toBeVisible()

    // Read-only: dragging is disabled via data-no-drag on the card.
    await expect(eventCard).toHaveAttribute('data-no-drag', '')

    // Click opens the hover preview; "Open event" opens the full edit modal.
    await eventCard.click()
    await page.getByRole('button', { name: 'Open event' }).click()
    await expect(page.locator('[data-component="readonly-calendar-notice"]')).toBeVisible()
    await expect(page.locator('[data-component="modal-save"]')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible()
  })
})
