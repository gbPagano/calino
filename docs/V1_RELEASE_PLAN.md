# Calino v1.0 Release Plan

> Audit-driven fix plan for the first full public release. Execute top-to-bottom.
> Created from direct source verification of an ~80-issue audit (~50 real bugs, ~8 false positives, ~10 deferred).

## Context

Calino is a React 19 + TypeScript + Vite + Zustand calendar app with CalDAV sync, NLP event creation, and PWA support. We're preparing the first full public release. A code audit identified ~80 issues. After direct verification of each claim against the source, ~50 are real bugs, ~8 were false positives, and ~10 are out-of-scope for v1.0.

**Repo:** `C:\Users\Ivan\Documents\coding\Calino`
**Branch:** `main` (clean at `f7e3cf3`)
**Stack:** React 19, TypeScript, Vite, Zustand, ical.js, tsdav, Fuse.js, react-router-dom 7, Framer Motion

### Commands

```bash
pnpm install
pnpm dev          # dev server
pnpm build        # production build
pnpm lint         # ESLint
pnpm lint:fix
pnpm typecheck    # TypeScript
pnpm test         # Vitest watch
pnpm test:run     # Vitest single run
pnpm format       # Prettier
pnpm check        # typecheck + lint + test + build (full CI)
```

---

## What this plan does NOT cover (do not work on these)

Verified false positives from the original audit:

| Audit claim | Why it's wrong |
|---|---|
| Drag-to-resize duration missing | Already implemented at `src/features/calendar/components/EventCard.tsx:90-243` and `src/features/calendar/components/CalendarGrid.tsx:474-549` |
| SEQUENCE never incremented | Incremented via "Bug 29 fix" at `src/features/caldav/hooks/useCalDAV.ts:1004-1032` when event data actually changes |
| `partialize` clones every event | Early-return at `src/store/calendarStore.ts:691-692` skips clone when no attachments |
| `contactStore.migrate` drops persisted fields | `partialize` (line 204-208) only persists `contacts/addressBooks/pendingChanges`; `selectedContactId`/`searchQuery`/`filterAddressBookId` aren't persisted anyway |
| Sidebar mini month/year buttons missing aria-label | Present at `src/features/calendar/components/Sidebar.tsx:391, 434` |
| CalendarGrid "+N more" button unreadable | Has visible text content |
| All-day multi-day generates 0-height fragment | Generates a phantom full-day fragment on day-after-end (medium not high) |
| Send/receive invitations | Out of scope per README |
| Public sharing | Out of scope per README |
| Subtasks, i18n, email reminders | v1.1 per README |
| Saved searches | v1.1 |
| Hourly/minutely/secondly frequencies in UI | v1.1 |
| Background Sync API, periodic background sync | v1.1 |

## Already-shipped features (no work needed)

The audit flagged these as "missing" but they exist:

- Multiple CalDAV accounts (`src/features/caldav/sync/accountStorage.ts`)
- Calendar color per calendar
- Manual sync button (`src/features/calendar/components/Sidebar.tsx:519-560`)
- ICS import (`.ics` and `.json`) (`src/features/settings/components/DataSettings.tsx:73-112`)
- VTODO serialized as VTODO not VEVENT (`src/features/caldav/adapter/iCalendarAdapter.ts:119-129`)
- UID stability (v4 UUIDs, only duplicated via `duplicateEvent`)
- DTSTAMP written UTC on every save (`src/features/caldav/adapter/icalTypeMapping.ts:482`)
- All-day DTSTART/DTEND uses `VALUE=DATE` form
- TEXT escaping for SUMMARY/DESCRIPTION/LOCATION (delegated to ical.js)
- Well-known CalDAV discovery (`src/features/caldav/client/discovery.ts`)
- ETag-based optimistic concurrency (via tsdav's `updateCalendarObject`/`deleteCalendarObject`)

---

## Round 1 — P0 blockers (security + data loss)

Must ship before any release. ~13 file edits in dependency order.

### R1.1 — Update vulnerable dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

**Action:**
```bash
pnpm update react-router-dom    # to ^7.15.0 (fixes RCE via turbo-stream + 3 other HIGH CVEs)
pnpm update vite                # to ^7.3.5 (fixes 3 HIGH CVEs including fs.deny bypass)
```

**Verify:** `pnpm audit` should report zero HIGH/CRITICAL for `react-router` and `vite`.

**CVEs being fixed (confirmed by `pnpm audit`):**
- react-router: GHSA-49rj-9fvp-4h2h (RCE), GHSA-8646-j5j9-6r62 (XSS), GHSA-8x6r-g9mw-2r78 (DoS), GHSA-rxv8-25v2-qmq8 (DoS)
- vite: GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583, GHSA-fx2h-pf6j-xcff

### R1.2 — Fix `migrate()` to preserve persisted state (settings store)

**File:** `src/store/settingsStore.ts:151`

**Current (BAD):**
```ts
migrate: () => DEFAULT_SETTINGS as SettingsStore,
```

**Replace with:**
```ts
migrate: (persistedState: unknown) => ({
  ...DEFAULT_SETTINGS,
  ...(persistedState as Partial<UserSettings>),
}),
```

**Verify:** Add a unit test that calls `migrate` with a partial persisted state (e.g. `{ themeMode: 'dark', timezone: 'America/New_York' }`) and asserts those fields survive.

### R1.3 — Fix `migrate()` to preserve persisted state (calendar store)

**File:** `src/store/calendarStore.ts:679-687`

**Current (BAD):**
```ts
migrate: (persistedState: unknown) => {
  const state = persistedState as Record<string, unknown> | undefined
  return {
    events: state?.events ?? [],
    calendars: state?.calendars ?? [],
    categories: state?.categories ?? [],
    autoCategoryRules: state?.autoCategoryRules ?? [],
  }
},
```

**Issue:** Missing `brokenEvents`, `currentDate`, `currentView` (all in `partialize` at lines 701, 705, 706).

**Replace with:** Merge persisted state over defaults, including all keys from `partialize`:
```ts
migrate: (persistedState: unknown) => {
  const state = (persistedState ?? {}) as Partial<CalendarStore>
  return {
    events: state.events ?? [],
    calendars: state.calendars ?? [],
    categories: state.categories ?? [],
    autoCategoryRules: state.autoCategoryRules ?? [],
    brokenEvents: state.brokenEvents ?? [],
    currentDate: state.currentDate ?? format(new Date(), 'yyyy-MM-dd'),
    currentView: state.currentView ?? 'month',
    selectedCategoryIds: state.selectedCategoryIds ?? [],
  }
},
```

**Verify:** Existing test at `src/store/__tests__/calendarStore.test.ts:453+` ("Bug 1") should now pass meaningfully.

### R1.4 — Capture `{url, etag}` from CalDAV responses

**Files:** `src/features/caldav/hooks/useCalDAV.ts:937, 1039, 1123, 1221, 1224`

**Current:** All four sites call `await engine.pushEvent(...)` / `await engine.updateEvent(...)` / `await engine.deleteEvent(...)` and discard the return.

**SyncEngine signatures (verify with `src/features/caldav/sync/syncEngine.ts:128, 149, 170`):**
- `pushEvent(event): Promise<{ url: string; etag: string }>`
- `updateEvent(event, etag): Promise<{ url: string; etag: string }>`
- `deleteEvent(eventUrl, etag): Promise<void>`

**Fix pattern (apply to all 4 sites):**

```ts
// createEvent (line 937)
const { url, etag } = await engine.pushEvent(eventWithSequence)
storeUpdateEvent(event.id, { etag, syncStatus: 'synced' })

// updateEventFn (line 1039) and retryAllFailedSyncs (line 1221, 1224)
const { url, etag } = await engine.updateEvent(eventWithSequence, event.etag ?? '')
storeUpdateEvent(event.id, { etag, syncStatus: 'synced' })
```

For deletes (line 1123), the return is `void` — capture failure in a try/catch and update `syncStatus: 'synced'` on success.

**Verify:** Test by manually editing a synced event; the next sync should use the updated etag. Easiest test: add a unit test that mocks `engine.updateEvent` and asserts `storeUpdateEvent` is called with the new etag.

### R1.5 — Extend `openModal` to accept initial title (TodoView composer)

**Files:** `src/store/calendarStore.ts` (wherever `openModal` is defined), `src/features/calendar/components/TodoView.tsx:270-277`

**Step 1:** Find the `openModal` signature in `calendarStore.ts`. It looks like:
```ts
openModal: (date?: string, endDate?: string, eventId?: string, mode?: ModalMode) => void
```

**Step 2:** Add `initialTitle?: string` parameter.

**Step 3:** Update `TodoView.tsx:270-277` to pass the composer text:
```ts
const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
  if (e.key === 'Enter' && composerRef.current?.value.trim()) {
    openModal(format(new Date(), 'yyyy-MM-dd'), undefined, undefined, 'task', composerRef.current.value.trim())
    composerRef.current.value = ''
    setComposing(false)
  } else if (e.key === 'Escape') {
    setComposing(false)
  }
}
```

**Step 4:** Update `EventModal` to seed the `title` state from `initialTitle` if provided.

**Verify:** Type a task in the inline composer, press Enter, modal should open with that text pre-filled in the Title field.

### R1.6 — Lossless ICS export

**File:** `src/features/settings/components/DataSettings.tsx:46-57`

**Current (BAD):** Hand-built string with only UID/DTSTART/DTEND/SUMMARY/DESC/LOCATION — drops RRULE, EXDATE, reminders, all-day VALUE=DATE form, escapes nothing, folds no lines.

**Replace with:** Use the existing `eventToICAL` helper from `src/features/caldav/adapter/iCalendarAdapter.ts`. Read that helper and the existing tests at `src/features/caldav/adapter/__tests__/iCalendarAdapter.test.ts` to find the right call site.

`eventToICAL` returns a full VCALENDAR wrapper per event — strip that or use the lower-level `calendarEventToIcalComponent` from `src/features/caldav/adapter/icalTypeMapping.ts:478`.

**Verify:** Export a recurring event with RRULE + EXDATE. Re-import. Round-trip should preserve everything.

### R1.7 — Service worker: validate eventId in notificationclick

**File:** `public/sw.js:74`

**Current (BAD):** `const url = \`/?date=${eventData.eventDate.split('T')[0]}&event=${eventData.eventId}\``

**Issue:** If `eventId` contains `..` or other path-traversal chars and there's a push mechanism (or any path that lets a malicious actor trigger a notification on the same origin), `client.navigate` follows it.

**Replace with:**
```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const eventData = event.notification.data
  if (!eventData || !eventData.eventId) return

  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(eventData.eventId)) {
    console.warn('[sw] ignoring notification with invalid eventId:', eventData.eventId)
    return
  }

  // Validate date
  const eventDate = eventData.eventDate
  if (typeof eventDate !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
    return
  }

  const url = `/?date=${eventDate.split('T')[0]}&event=${eventData.eventId}`
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
```

Bump `CACHE_NAME` from `'calino-v6'` to `'calino-v7'` to invalidate the old SW on next deploy.

### R1.8 — Docker: raise CalDAV body size limit

**File:** `Dockerfile:32`

**Current:** `request_body { max_size 1kb }`

**Replace with:** `request_body { max_size 1mb }` (note: use lowercase `mb`, not `MB` — Caddy uses IEC units).

### R1.9 — Derive unique SETTINGS_EVENT_UID per instance

**File:** `src/features/caldav/client/CalDAVClient.ts:592`

**Current (BAD):**
```ts
private static readonly SETTINGS_EVENT_UID = '00000000-calino-0000-calino-000000000000'
```

**Issue:** Two Calino instances syncing to the same CalDAV calendar (shared server) collide.

**Fix options (pick one):**
1. Hash `(account.serverUrl + account.username)` to produce a deterministic per-account UID.
2. Generate a random UUID per Calino instance on first launch and persist it to localStorage; reuse thereafter.

**Recommended option 2** — one-time random UUID stored in `localStorage` under `calino.instanceId`. Read it on every CalDAVClient construction.

**Verify:** Two browser profiles with the same CalDAV account no longer overwrite each other's settings events.

### R1.10 — Tighten self-hosted CORS proxy

**File:** `proxy/server.mjs`

**Issues:**
- Forwards all `Authorization` headers to arbitrary path-decoded target (SSRF + credential relay)
- Returns `Access-Control-Allow-Origin: *` for OPTIONS
- 502 errors leak fetch exception message

**Fixes (read current file fully first):**

1. **Don't forward Authorization** — replace lines 77-80 (the spread + deletions) with:
```js
const FORWARDED_HEADERS = new Set(['content-type', 'depth', 'prefer', 'if-none-match', 'if-match', 'accept', 'accept-language'])
const headers = {}
for (const [k, v] of Object.entries(req.headers)) {
  if (FORWARDED_HEADERS.has(k.toLowerCase())) {
    headers[k] = v
  }
}
```

2. **Stricter OPTIONS** — only return `*` when `ALLOWED_ORIGINS` is empty; otherwise echo the verified origin.

3. **Don't leak fetch errors** — line 113: `'Proxy error: ' + e.message` → just `'Bad Gateway'`.

4. **Add target validation** — at minimum require `targetBase` to start with `https://` (line 57). Reject other schemes.

5. **Document `ALLOWED_ORIGINS` requirement** in the file header comment.

**Verify:** With `ALLOWED_ORIGINS` empty, OPTIONS still works. With it set, OPTIONS only echoes allowed origins. Trying to use the proxy to fetch `https://attacker.com` either fails (no Auth forwarded) or surfaces a clear error.

### R1.11 — Document app-level encryption as obfuscation

**File:** `src/lib/crypto.ts:1-7` (top comment)

**Current:** The comment is neutral.

**Replace with:** Add an explicit warning paragraph:
```
// SECURITY NOTE: App-level encryption uses a fixed key (`APP_SECRET`/`APP_SALT`)
// hardcoded in this bundle. It is OBfuscation, not ENcryption — anyone with the
// JS bundle and access to localStorage can derive the same AES key and decrypt
// stored CalDAV credentials. It only protects against casual inspection.
//
// Master-password encryption (used for self-hosted config) is stronger: the key
// is derived from a user-supplied password and never leaves the device.
```

**Also:** `src/store/configStore.ts:62` stores master password encrypted with the same weak app-level key. Document the same caveat. Long-term fix: don't persist master password; require user to unlock each session. (Defer to v1.1 unless trivial — the immediate fix is just documentation.)

### R1.12 — Remove or guard dev server `host: '0.0.0.0'`

**File:** `vite.config.ts:32`

**Current:** `host: '0.0.0.0'` in dev server (binds to all interfaces — exposes dev server to LAN, particularly bad given the Vite CVEs being fixed in R1.1).

**Fix:** Default to `localhost`, expose via env var:
```ts
server: {
  host: process.env.VITE_DEV_HOST ?? 'localhost',
  allowedHosts: ['jankyboi', 'localhost'],
  hmr: {
    host: process.env.VITE_DEV_HOST ?? 'localhost',
    port: 8080,
  },
},
```

### R1.13 — End-of-round verification

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

All must pass before proceeding to Round 2.

---

## Round 2 — iCalendar compliance

~6 files. Affects every non-UTC user + every user syncing with strict CalDAV servers (Radicale, iCloud, Google).

### R2.1 — RRULE UNTIL: emit VALUE=DATE for all-day events

**File:** `src/lib/recurrence.ts:92-96`

**Current (BAD):**
```ts
if (rule.endDate) {
  parts.push(`UNTIL=${toICalUTC(new Date(rule.endDate))}`)
}
```

**Issue:** Always UTC DATE-TIME; for all-day events RFC 5545 §3.3.10 requires VALUE=DATE (`YYYYMMDD`).

**Fix:** Branch on the event's all-day flag — but `RecurrenceRule` doesn't carry it. Two options:
1. Add `isAllDay?: boolean` to `RecurrenceRule` (requires updating the parse and the modal).
2. Have the caller pass the UNTIL format.

Option 1 is cleaner. Add the field, propagate from `EventFormFields`/`parseRRule`, and update `buildRRuleString`:
```ts
if (rule.endDate) {
  if (rule.isAllDay) {
    // VALUE=DATE form (YYYYMMDD), local date interpretation
    const d = new Date(rule.endDate)
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    parts.push(`UNTIL=${yyyymmdd}`)
  } else {
    parts.push(`UNTIL=${toICalUTC(new Date(rule.endDate))}`)
  }
}
```

**Verify:** Create an all-day recurring event with UNTIL. Inspect the exported ICS — UNTIL should be `20251231`, not `20251231T000000Z`.

### R2.2 — Preserve TZID on VEVENT round-trip

**File:** `src/features/caldav/adapter/icalTypeMapping.ts:198-228`

**Current (BAD):** `icalTimeToISO` calls `icalTime.toJSDate().toISOString()` — returns UTC string, dropping the original TZID. On serialize, `createIcalDateTime` constructs `ICAL.Time.fromJSDate(..., true)` — UTC `Z` form.

**Fix:** Preserve the original TZID by storing it on the `CalendarEvent` type and re-emitting it:

1. **Type change** — `src/types/index.ts` `CalendarEvent`:
   ```ts
   timezone?: string  // IANA TZID, e.g. 'Europe/Paris'; only set if originally parsed from TZID form
   ```

2. **Parse** — `icalTimeToISO`: when the input `icalTime` has a named zone (not UTC, not floating), store the TZID separately and emit the wall-clock ISO string with offset:
   ```ts
   if (tz && tz.tzid && tz.tzid !== 'UTC' && tz.tzid !== 'floating') {
     return { iso: `${wallclock}${offset}`, tzid: tz.tzid }
   }
   ```
   You'll need to refactor the return type to `{ iso: string, tzid?: string }` and update all callers.

3. **Serialize** — `createIcalDateTime`: if `event.timezone` is set, use `ICAL.Time.fromDateTimeString(iso, tzid)` or equivalent; otherwise UTC.

**Verify:** Parse a VEVENT with `DTSTART;TZID=America/New_York:20250706T150000`. Re-serialize. Round-trip should preserve the TZID. Edit the event and re-save — DST transitions shouldn't shift the local time.

### R2.3 — EXDATE / RECURRENCE-ID: value-form must match DTSTART

**File:** `src/features/caldav/adapter/icalTypeMapping.ts:546-567`

**Current (BAD):** Both serialize via `createIcalDateTime(...)` (always UTC).

**Fix:** If DTSTART is all-day, EXDATE/RECURRENCE-ID should use `createAllDayDate(...)`. If DTSTART has a TZID, EXDATE/RECURRENCE-ID should be in the same TZID form.

Same approach as R2.2 — branch on the master event's `isAllDay` and `timezone`.

**Verify:** Parse a VEVENT with `EXDATE;TZID=America/New_York:20250713T150000` (matching DTSTART's TZID). Re-serialize. The EXDATE value-form should match DTSTART.

### R2.4 — Add missing RRULE parts to parseRRule

**File:** `src/features/caldav/adapter/icalTypeMapping.ts:47-156`

**Missing cases in switch:** `WKST`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, `BYWEEKNO`, `BYYEARDAY`. `BYSETPOS` is partially handled but conflated with BYDAY ordinals.

**Fix:**
1. Add `wkst`, `byHour`, `byMinute`, `bySecond`, `byWeekNo`, `byYearDay` to `RecurrenceRule` type (`src/types/index.ts:20-29`).
2. Add corresponding `case` arms in `parseRRule`.
3. Update `buildRRuleString` (`src/lib/recurrence.ts:54-99`) to emit them.
4. **Fix BYDAY/BYSETPOS conflation** — current code at `:98-126` puts per-day BYDAY ordinals into `bySetPos`. These should be separate fields. Refactor `RecurrenceRule` to carry per-BYDAY ordinals separately, and only emit a true `BYSETPOS` when present.

**Verify:** Parse `FREQ=MONTHLY;BYDAY=2MO,-1FR;BYSETPOS=-1`. Re-serialize. The output should preserve the distinction.

### R2.5 — VTODO STATUS, percent-complete, COMPLETED timestamp

**File:** `src/features/caldav/adapter/icalTypeMapping.ts:673-683, 753-758`

**Current:**
- Parse: only `STATUS:COMPLETED` → `completed = true`; `STATUS:IN-PROCESS` and `STATUS:CANCELLED` collapse to `false`.
- Serialize: only `'COMPLETED'` or `'NEEDS-ACTION'` written. `percentComplete` field exists but is never parsed/serialized. `COMPLETED` always written as `ICAL.Time.now()`.

**Fix:**
1. Store raw `taskStatus: 'NEEDS-ACTION' | 'IN-PROCESS' | 'COMPLETED' | 'CANCELLED'` on `CalendarEvent`.
2. Store `percentComplete: number | undefined` (already in type).
3. Store `completedAt: string | undefined` (ISO timestamp) — only set when transitioning from incomplete to completed.
4. On parse: read all four; map to UI state. `CANCELLED` → render as completed (per product decision) but flag for deletion on next sync.
5. On serialize: emit correct STATUS, PERCENT-COMPLETE, and original COMPLETED timestamp.

**Verify:** Create a task in another client with `STATUS:IN-PROCESS;PERCENT-COMPLETE:50`. Sync to Calino. Re-sync. The other client should still see IN-PROCESS / 50%.

### R2.6 — VALARM: preserve ACTION, handle more trigger forms

**Files:** `src/features/caldav/adapter/icalTypeMapping.ts:283-318, 418-462`

**Fix:**
1. **Parse ACTION** — read `valarm.getFirstProperty('action')`. If present, store on `Reminder.method`. Currently `Reminder.method` is hardcoded to `'popup'`. Add `'email' | 'audio'` to the type and persist.
2. **Extend `parseTriggerDuration`** (line 418) — handle:
   - `+PTxxx` (positive sign = post-event reminder)
   - `P1DTxxx` (day component)
   - `P7D` / `P1W` (days/weeks without time)
   - `+PT15M` (with explicit +)
   - Add support for the `D` and `W` designators:
     ```ts
     const dayMatch = duration.match(/(\d+)D/)
     const weekMatch = duration.match(/(\d+)W/)
     if (dayMatch) minutes += parseInt(dayMatch[1], 10) * 24 * 60
     if (weekMatch) minutes += parseInt(weekMatch[1], 10) * 7 * 24 * 60
     ```

3. **Preserve unknown VALARMs** — when an alarm can't be parsed, store it opaque on the event so round-trip doesn't drop it.

**Verify:** Set a 2-day-before email reminder in another client. Sync to Calino. Re-sync. The other client should still see the email reminder.

### R2.7 — Settings VEVENT: line folding + escape

**File:** `src/features/caldav/client/CalDAVClient.ts:851-867`

**Current:** Hand-built string, no folding, no escape.

**Fix:** Route through ical.js. Build the settings event as a `CalendarEvent` with the base64 payload as an attachment, then serialize via `eventToICAL(event)`. Strip the VCALENDAR wrapper.

**Verify:** Export the settings event, inspect — all lines should be ≤75 octets with CRLF, ATTACH value should be base64 with proper folding.

### R2.8 — End-of-round verification

```bash
pnpm typecheck && pnpm lint && pnpm test:run
```

Write a round-trip integration test for each cluster:
- VEVENT with TZID → parse → serialize → bytewise diff (or at least content equality)
- RRULE with WKST/BYSETPOS → parse → serialize → original
- VTODO with IN-PROCESS → parse → serialize → STATUS preserved

Test files already exist at `src/features/caldav/adapter/__tests__/iCalendarAdapter.test.ts`.

---

## Round 3 — UX bugs and accessibility

### R3.1 — ErrorBoundary theming

**File:** `src/components/common/ErrorBoundary.tsx:34-55`

**Current:** Inline styles with hardcoded `#202124` text and `#4285f4` button.

**Replace with CSS-module classes** that use theme tokens:
```tsx
<div className={styles.errorFallback}>
  <h2 className={styles.title}>Something went wrong</h2>
  <p className={styles.message}>{this.state.error?.message ?? 'An unexpected error occurred'}</p>
  <button className={styles.retry} onClick={() => this.setState({ hasError: false, error: null })}>
    Try again
  </button>
</div>
```

Add a CSS module (`ErrorBoundary.module.css`) using `var(--color-text)`, `var(--color-bg)`, `var(--color-accent)`, etc.

**Verify:** Force an error in dark mode. The fallback dialog should be readable.

### R3.2 — viewport-fit=cover for iOS PWA

**File:** `index.html:6`

**Current:** `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`

**Replace with:** Add `viewport-fit=cover` so `--safe-area-*` CSS vars take effect on iOS:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

**Verify:** Install the PWA on iOS. The FAB should not overlap the home indicator.

### R3.3 — Mount ShortcutsHelp + register `?` shortcut

**Files:** `src/App.tsx`, `src/features/calendar/components/ShortcutsHelp.tsx` (already exists, never mounted)

**Action:**
1. In `App.tsx`, import `ShortcutsHelp`. Add state `isShortcutsHelpOpen`. Mount inside the app shell.
2. Register the `?` shortcut in the existing keydown handler at `App.tsx:279-312`:
   ```ts
   if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
     e.preventDefault()
     setIsShortcutsHelpOpen(true)
     return
   }
   ```

**Verify:** Press `?` anywhere. The help modal should open. Press Escape to close.

### R3.4 — End-before-start validation in EventModal

**File:** `src/features/calendar/components/EventModal.tsx:540-569`

**Current:** Only validates `title.trim()`. User can save a negative-duration event.

**Fix:** Add validation right after title check:
```ts
if (!isAllDay) {
  const startMs = new Date(`${startDate}T${startTime}:00`).getTime()
  const endMs = new Date(`${endDate}T${endTime}:00`).getTime()
  if (endMs <= startMs) {
    showToast('End time must be after start time')
    return
  }
} else {
  if (endDate < startDate) {
    showToast('End date must be on or after start date')
    return
  }
}
```

Also disable the Save button visually when invalid.

**Verify:** Open the modal, set end < start, click Save. Toast should appear, no save.

### R3.5 — Quick-settings dark-mode 3-state

**File:** `src/features/calendar/components/CalendarHeader.tsx:450-459`

**Current:** Toggle only flips between `'light'` and `'dark'`. User can't return to `'auto'`.

**Fix:** Replace the toggle with a 3-state segmented control:
```tsx
<div className={styles.themeModeGroup} role="radiogroup" aria-label="Theme mode">
  {(['auto', 'light', 'dark'] as const).map((mode) => (
    <button
      key={mode}
      role="radio"
      aria-checked={themeMode === mode}
      className={`${styles.themeModeBtn} ${themeMode === mode ? styles.themeModeActive : ''}`}
      onClick={() => updateSettings({ themeMode: mode })}
    >
      {mode === 'auto' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark'}
    </button>
  ))}
</div>
```

**Verify:** Auto / Light / Dark should all be reachable from the dropdown.

### R3.6 — a11y: aria-labels for icon-only buttons

**File:** `src/features/calendar/components/Sidebar.tsx`

Fixes:
- Line 473-479 (`+` button): add `aria-label="Add CalDAV account"`
- Line 494-499 (color dot): add `aria-label={`Change ${calendar.name} color`}`
- Line 519-560 (sync button): add `aria-label={`Sync ${calendar.name}`}`

Also fix:
- `src/features/calendar/components/MiniTasksSection.tsx:134-146` (checkbox): `aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}` and `aria-pressed={task.completed}`
- `MiniTasksSection.tsx:147` (task body): convert `<div onClick>` to `<button>` for keyboard access
- `src/features/calendar/components/EventModal.tsx:970-988` (pencil): `aria-label="Focus title input"`
- `src/features/calendar/components/CalendarGrid.tsx:962-975` (journalIndicator): `aria-label="View journal entries"`
- `src/features/calendar/components/CalendarGrid.tsx:952-960` (dayNumber): `aria-label={`Open ${format(day, 'MMMM d')} in day view`}`

**Verify:** Tab through the page with a screen reader. Every interactive element should announce a name.

### R3.7 — a11y: ARIA menu semantics on dropdowns

**File:** `src/features/calendar/components/CalendarHeader.tsx:391-418` (view dropdown), `:420-494` (quick settings)

**Fix:**
- Trigger button: `aria-haspopup="menu"`, `aria-expanded={isOpen}`, `aria-controls={menuId}`
- Dropdown container: `role="menu"`, `id={menuId}`
- Each menu item: `role="menuitem"`

**Verify:** Screen reader should announce "menu, collapsed" / "menu, expanded" on the trigger.

### R3.8 — OnboardingModal: focus trap, Escape, aria-labelledby

**File:** `src/features/onboarding/OnboardingModal.tsx:148-191`

**Fixes:**
1. Wrap content with a ref. Use `useFocusTrap(contentRef, isOpen)` (already exists at `src/hooks/useFocusTrap.ts`).
2. Add Escape handler in a useEffect:
   ```ts
   useEffect(() => {
     if (!isOpen) return
     const handleKey = (e: KeyboardEvent) => {
       if (e.key === 'Escape') handleDismiss()
     }
     document.addEventListener('keydown', handleKey)
     return () => document.removeEventListener('keydown', handleKey)
   }, [isOpen, handleDismiss])
   ```
3. Add `id="onboarding-title"` to the `<h2>`. Add `aria-labelledby="onboarding-title"` to the dialog `<div>`.

**Verify:** Open onboarding. Tab should be trapped. Escape should close. Screen reader should announce the dialog title.

### R3.9 — Notification permission denied UX

**File:** `src/hooks/useNotifications.ts:145-169`

**Current:** When permission is denied, silently flips the setting off. No user feedback.

**Fix:** Add a toast when forcing the setting off:
```ts
if (permission === 'denied') {
  updateSettings({ enableDesktopNotifications: false })
  toast.error('Notifications are blocked. Update site permissions to enable reminders.', {
    duration: 8000,
  })
}
```

Also surface the denied state inline in Settings (where the toggle lives) so the cause is discoverable later.

**Verify:** Deny notifications in browser settings. Toggle the setting on in Calino. Should see a toast explaining why it turned itself off.

### R3.10 — EventPreviewPopup: remove duplicate Escape handler

**File:** `src/features/calendar/components/EventPreviewPopup.tsx:356-366, 463-469`

**Current:** Two `useEffect`s both attach `document.addEventListener('keydown', ...)`.

**Fix:** Delete the second effect at `:457-469` (it's a duplicate of `:355-369` minus the `editingField` check). Or merge them into one effect.

**Verify:** Inspect the rendered events listener count in dev tools — should be 1.

### R3.11 — Empty states

**Files:**
- `src/features/calendar/components/AgendaView.tsx:180-193` — when `dayGroups.every(g => !g.hasEvents)`, render `<EmptyState>` with "Nothing scheduled this month" + "Jump to today" action.
- `src/features/calendar/components/TodoView.tsx:443-448` — add a "Create task" button to the empty state.
- `src/features/calendar/components/Sidebar.tsx:469-564` — when calendars list is empty, render `<EmptyState>` with "No calendars yet — Add a CalDAV account" + button.

EmptyState component is at `src/components/common/EmptyState.tsx`.

**Verify:** Each view should look intentional (not broken) when empty.

### R3.12 — Command palette: fresh `today` per action

**File:** `src/features/commandPalette/commands/index.ts:60`

**Current:** `const today = new Date()` captured once at registry build. Stale across midnight.

**Fix:** Compute `today` inside each `action`:
```ts
{
  id: 'nav-today',
  label: 'Go to Today',
  description: () => format(new Date(), 'EEEE, d MMMM yyyy'),
  ...
  action: () => {
    deps.setCurrentDate(format(new Date(), 'yyyy-MM-dd'))
    return 'Navigated to today'
  },
},
```

Check what `Command` interface allows — may need to make `description` a function. Update types accordingly.

**Verify:** Open the app, leave it overnight past midnight, open command palette — "Go to Today" should still navigate to today.

### R3.13 — OnboardingModal demo button: add spinner

**File:** `src/features/onboarding/OnboardingModal.tsx:178-182`

**Fix:** Add a spinner SVG inside the button when `isLoadingDemo`. Visually disable the button (already disabled prop).

**Verify:** Click "Try with sample data" — should see spinner.

### R3.14 — safeLocalStorage.clear() filter separator mismatch

**File:** `src/lib/storage.ts:3`

**Current:** `const APP_KEY_PREFIX = 'calino-'` (hyphen).
**Actual CalDAV keys:** `'calino_caldav_accounts'`, etc. (underscore).

**Fix:** Either normalize keys to one separator, or filter by both:
```ts
const APP_KEY_PREFIXES = ['calino-', 'calino_']
// in clear():
if (APP_KEY_PREFIXES.some((p) => key.startsWith(p))) keysToRemove.push(key)
```

**Verify:** Call `safeLocalStorage.clear()` in dev tools. All CalDAV records (calino_* and calino-*) should be removed.

### R3.15 — End-of-round verification

```bash
pnpm typecheck && pnpm lint && pnpm test:run && pnpm build
```

Manual smoke tests:
- Open in Chrome DevTools with screen reader simulation
- Tab through all main views
- Trigger an error in dev mode (e.g. throw in a component) — verify ErrorBoundary dialog is readable in dark mode
- Toggle dark mode 3 times — all 3 modes reachable from quick settings

---

## Round 4 — Performance

### R4.1 — rangeExpansionCache: version-counter invalidation

**File:** `src/store/calendarStore.ts:24, 426-510`

**Current:** Cache invalidates on `cached.events === state.events` — fails after every mutation since `set` replaces the array.

**Fix:** Add a version counter:
```ts
let rangeExpansionVersion = 0
// in any mutation action: rangeExpansionVersion++

// in getEventsForDateRange:
if (cached && cached.version === rangeExpansionVersion && cached.calendars === state.calendars && ...) {
  return cached.result
}
// otherwise: cached.version = rangeExpansionVersion
```

Wire `rangeExpansionVersion++` into `addEvent`, `updateEvent`, `deleteEvent`, `duplicateEvent`, `fixBrokenEvent`, `importEvents`, etc.

**Verify:** Profile in DevTools Performance. After 100 events loaded, drag an event — should see no recurrence expansion re-runs.

### R4.2 — eventPositioning: sweep-line algorithm

**File:** `src/lib/eventPositioning.ts:21-76`

**Current:** O(n²) for column assignment + O(n²) for totalColumns per event = **O(n³) worst case**.

**Fix:** Single O(n log n) sweep using a priority queue of active intervals (sorted by end time):
```ts
export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  const parsed = events
    .filter((e) => e.transparency !== 'transparent')
    .map((e) => ({ event: e, startMs: parseISO(e.start).getTime(), endMs: parseISO(e.end).getTime(), column: 0 }))
    .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs)

  // For each event, count how many events are active at its start time
  // and assign the smallest available column >= max-occupied-1.
  // ... sweep-line logic ...
}
```

A simpler fix that still beats current O(n³):
- For each event, only iterate `positioned` events that overlap (track active set by end time, prune out-of-window events).

**Verify:** Create 30 overlapping events on one day. Time `positionEvents` should drop from ~10ms to <1ms.

### R4.3 — WeekView useMemo deps

**File:** `src/features/calendar/components/WeekView.tsx:247-294`

**Current:** deps include raw `events` array. Any mutation invalidates.

**Fix:** Depend on a version counter or only on the result of `getEventsForDateRange`. Since `getEventsForDateRange` already returns the scoped events, use it as the primary input:
```ts
const weekEvents = useMemo(() => getEventsForDateRange(...), [date, firstDayOfWeek])
const { allDayEventsMap, eventsMap, timedFragmentsMap } = useMemo(() => {
  // ... same logic, iterate weekEvents ...
}, [weekEvents, ...])
```

Same pattern applies to `CalendarGrid.tsx:386-443` (`eventsMap`) and `WeekView.tsx:296` (`tasksMap`).

**Verify:** Load a calendar with 1000 events across many weeks. Toggle a calendar's visibility — only the affected views should recompute.

### R4.4 — useWindow: throttle resize

**File:** `src/hooks/useWindow.ts:13-17`

**Fix:** rAF-throttle:
```ts
useEffect(() => {
  let rafId = 0
  const handleResize = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      setValue(window[dimension])
      rafId = 0
    })
  }
  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('resize', handleResize)
    if (rafId) cancelAnimationFrame(rafId)
  }
}, [dimension])
```

**Verify:** Drag-resize the window. setState should fire at most once per frame.

### R4.5 — searchIndex: offload to idleCallback or web worker

**File:** `src/features/search/lib/searchIndex.ts:333-348`

**Current:** `fuseInstance.setCollection(events)` runs synchronously on every events change.

**Fix:** Wrap in `requestIdleCallback` with a timeout:
```ts
export function updateSearchIndex(events, options) {
  indexedEvents = events
  if (fuseInstance && !options) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => fuseInstance.setCollection(events), { timeout: 1000 })
    } else {
      setTimeout(() => fuseInstance.setCollection(events), 0)
    }
  } else {
    initializeSearchIndex(events, options)
  }
}
```

**Verify:** Sync 500 events. The sync UI should not stutter.

### R4.6 — AgendaView spread-copy per event

**File:** `src/features/calendar/components/AgendaView.tsx:92-108`

**Fix:** Use `push` instead of spread:
```ts
events.forEach((event) => {
  // ...
  let arr = eventMap.get(eventDate)
  if (!arr) { arr = []; eventMap.set(eventDate, arr) }
  arr.push({ event, date: parseISO(event.start) })
  // ...
})
```

**Verify:** Load a calendar with 500 events in a month. Agenda view should render noticeably faster.

### R4.7 — End-of-round verification

```bash
pnpm test:run
```

Manual benchmark: load 1000 events in a calendar, time the cold-start of each view.

---

## Round 5 — Polish & acknowledged-deferred

These are nice-to-haves. Either ship or document in CHANGELOG.

### R5.1 — All-day reminder fires day-before-midnight

**File:** `src/hooks/useNotifications.ts:49-50`

**Decision:** Behavior is intentional per spec ("N minutes before DTSTART"). But the 1-minute check window means a reminder at 23:45 is missed if the machine is asleep.

**Fix:** Add a catch-up pass: when the page loads or the tab becomes visible, also fire reminders whose trigger time was within the last 12 hours but never recorded as shown. Use the `shownReminders` Map at `:16` to avoid duplicates.

### R5.2 — recurrenceSplit EXDATE pollution

**File:** `src/lib/recurrenceSplit.ts:34-37`

**Fix:** Don't add `occurrenceDateStr` to `excludedDates` since the master is already truncated past it:
```ts
const excludedDates = master.excludedDates || []
// (removed the unconditional push)
```

**Verify:** Test "Edit this and following events" path — the master should have an empty EXDATE list (since the split point is past UNTIL).

### R5.3 — Empty-state copy + setup wizard

**Decision:** Don't add a multi-step wizard. The current 3-button modal is acceptable. Document that onboarding improvement is deferred to v1.1.

### R5.4 — Theme FOUC

**File:** `src/components/ThemeProvider.tsx:40, 62`

**Fixes:**
1. Line 40: memoize `combinedCSS` and only write `textContent` when it actually changed.
2. Line 62: replace `requestAnimationFrame(updateThemeColor)` with synchronous update inside the effect (or `useLayoutEffect`).

### R5.5 — Touch action: none blocking scroll

**Files:** `src/features/calendar/components/CalendarGrid.tsx:617, 747`, `WeekView.tsx:735`, `DayView.tsx:517`

**Fix:** Move `touchAction: 'none'` from `.gridPanel` (wrapper) to `.grid` (inner). Wrapper should allow vertical page scroll.

### R5.6 — Acknowledged-deferred features (document in CHANGELOG)

Add to CHANGELOG under v1.0:
- **Deferred to v1.1:** Recurrence preview, external ICS feed subscription, periodic remote pull, install-prompt UX, conflict-resolution UI for 'ask' mode, saved searches, hourly/minutely/secondly frequencies, subtasks, email reminders, i18n, invitations/RSVP, share_target PWA, periodic background sync.
- **Known limitations:** All-day reminders fire N minutes before midnight the day before (per spec); timezone preservation for non-UTC events requires app reload after import; app-level encryption is obfuscation not security (see SECURITY.md).

---

## End-of-release verification checklist

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

Manual:
- [ ] iCloud/Nextcloud/Radicale: create recurring event, edit one occurrence, edit title, drag to reschedule, delete. Sync. No 412s, no silent drops.
- [ ] Non-UTC user: TZID preserved on round-trip.
- [ ] Offline: open app while offline, view cached events, edit, queue sync. Reconnect — sync completes.
- [ ] Dark mode: all themes, all views, all modals. No hardcoded colors.
- [ ] Mobile (iOS Safari + Android Chrome): viewport safe areas work, FAB doesn't overlap home indicator.
- [ ] Screen reader (VoiceOver / NVDA): tab through main views, every interactive element has a name.
- [ ] PWA install: install prompt appears, app launches in standalone mode.
- [ ] Notifications: enabled, scheduling works, denied state shows clear message.
- [ ] Drag-and-drop: resize and move events in week/day views.
- [ ] Recurrence: "this / this-and-future / all" dialog appears for recurring edits.

Run `pnpm audit` — should report zero HIGH/CRITICAL.

---

## Pitfalls for the implementer

1. **Don't skip `pnpm test:run` after each round.** Existing tests catch regressions in CalendarStore, CalDAVClient, iCalendarAdapter, syncEngine. The whole test suite runs in ~30s.

2. **Watch for the `version` field in `persist` config.** When you change shape of a store, bump `version` (e.g. `version: 1` → `version: 2`) — that's what triggers `migrate`. Don't bump unless the shape actually changed.

3. **When changing iCal serialization, write a round-trip test first.** The existing tests at `src/features/caldav/adapter/__tests__/iCalendarAdapter.test.ts` are your template. A test should: parse a known ICS string → assert internal shape → serialize → assert the output equals (or is equivalent to) the input.

4. **Don't touch `src/features/caldav/client/CalDAVClient.ts` lightly.** It's a long file with a lot of `CalDAVClient.ts` lines — read the whole thing before editing. The class is constructed once per account, and many hooks hold a reference.

5. **The `vite.config.ts:32` change (R1.12) might affect contributors** who run on a LAN. Document the `VITE_DEV_HOST` env var in README.

6. **The proxy change (R1.10) is backward-incompatible** if anyone is using the proxy for non-CalDAV requests. Document the change in `docs/CORS_PROXY.md`.

7. **iCal UTC vs floating vs TZID is subtle.** Don't change one site without checking the related sites. The cluster I1/I2/I3 should be done together (R2.1, R2.2, R2.3).

8. **The `migrate` fixes (R1.2, R1.3) need a test.** Add a test that writes a fake `calino-settings` to localStorage with a non-default version, then constructs the store, and asserts the persisted fields survive.

9. **The SHORTCUTS shortcut `?` requires Shift+/ on most keyboards.** Handle both: `if (e.key === '?' || (e.key === '/' && e.shiftKey))`.

10. **When changing zustand store shape**, check `partialize` to make sure the new field is included if it should be persisted. The settings store only persists a subset; the calendar store persists `events/calendars/categories/autoCategoryRules/brokenEvents/currentDate/currentView`.

---

## File-by-file change list (total ~25 files)

| File | Rounds |
|---|---|
| `package.json` + lockfile | R1.1 |
| `src/store/settingsStore.ts` | R1.2 |
| `src/store/calendarStore.ts` | R1.3, R4.1 |
| `src/features/caldav/hooks/useCalDAV.ts` | R1.4 |
| `src/store/calendarStore.ts` (openModal) | R1.5 |
| `src/features/calendar/components/TodoView.tsx` | R1.5 |
| `src/features/settings/components/DataSettings.tsx` | R1.6 |
| `public/sw.js` | R1.7 |
| `Dockerfile` | R1.8 |
| `src/features/caldav/client/CalDAVClient.ts` | R1.4 (etag), R1.9 (settings UID), R2.7 (settings VEVENT) |
| `proxy/server.mjs` | R1.10 |
| `src/lib/crypto.ts` | R1.11 |
| `vite.config.ts` | R1.12 |
| `src/lib/recurrence.ts` | R2.1, R2.4 |
| `src/types/index.ts` | R2.1 (isAllDay), R2.2 (timezone), R2.4 (RRULE parts) |
| `src/features/caldav/adapter/icalTypeMapping.ts` | R2.2, R2.3, R2.4, R2.5, R2.6 |
| `src/components/common/ErrorBoundary.tsx` | R3.1 |
| `index.html` | R3.2 |
| `src/App.tsx` | R3.3 |
| `src/features/calendar/components/EventModal.tsx` | R3.4, R3.6 |
| `src/features/calendar/components/CalendarHeader.tsx` | R3.5, R3.7 |
| `src/features/calendar/components/Sidebar.tsx` | R3.6, R3.11 |
| `src/features/calendar/components/MiniTasksSection.tsx` | R3.6 |
| `src/features/calendar/components/CalendarGrid.tsx` | R3.6, R5.5 |
| `src/features/calendar/components/AgendaView.tsx` | R3.11, R4.6 |
| `src/features/calendar/components/EventPreviewPopup.tsx` | R3.10 |
| `src/features/calendar/components/WeekView.tsx` | R4.3, R5.5 |
| `src/features/calendar/components/DayView.tsx` | R5.5 |
| `src/features/onboarding/OnboardingModal.tsx` | R3.8, R3.13 |
| `src/hooks/useNotifications.ts` | R3.9, R5.1 |
| `src/hooks/useWindow.ts` | R4.4 |
| `src/features/search/lib/searchIndex.ts` | R4.5 |
| `src/lib/eventPositioning.ts` | R4.2 |
| `src/lib/storage.ts` | R3.14 |
| `src/lib/recurrenceSplit.ts` | R5.2 |
| `src/features/commandPalette/commands/index.ts` | R3.12 |
| `src/components/ThemeProvider.tsx` | R5.4 |

**Estimated total:** ~25 file edits, organized into 5 rounds. Each round ends with `pnpm check` (typecheck + lint + test + build) passing.

---

## Summary of confirmed bugs (~50 items)

### P0 Security
- Hardcoded `APP_SECRET`/`APP_SALT` in bundle (`crypto.ts:11-12`)
- Open SSRF + credential relay in CORS proxy (`proxy/server.mjs`)
- react-router-dom HIGH CVEs incl. RCE
- vite HIGH CVEs incl. fs.deny bypass
- SW notificationclick path traversal (`sw.js:74`)
- Docker 1KB body limit breaks CalDAV sync
- Fixed `SETTINGS_EVENT_UID` collides across instances

### P0 Data loss
- `settingsStore.migrate()` drops all preferences
- `calendarStore.migrate()` drops brokenEvents/currentDate/currentView
- CalDAV createEvent/updateEvent discards `{url, etag}` → silent edit loss
- TodoView inline composer drops typed title
- Lossy ICS export (no RRULE/EXDATE/reminders/all-day)

### P1 iCalendar compliance
- RRULE UNTIL always UTC, never VALUE=DATE for all-day
- TZID dropped on round-trip
- EXDATE/RECURRENCE-ID always UTC
- VEVENT STATUS never read/written
- CLASS never read/written
- ORGANIZER/ATTENDEE declared types never parsed
- VEVENT CREATED/LAST-MODIFIED never read/written
- RDATE never parsed/serialized
- parseRRule drops WKST/BYHOUR/BYMINUTE/BYSECOND/BYWEEKNO/BYYEARDAY
- parseTriggerDuration drops D/W/+ components
- VTODO COMPLETED overwritten with `now` on every save
- VTODO STATUS IN-PROCESS/CANCELLED lost
- BYDAY regex `\d` single-digit only
- Settings VEVENT no line folding or escape

### P1 Bugs
- recurrenceSplit adds EXDATE for date master already truncated past
- All-day reminder fires midnight day-before
- safeLocalStorage.clear() filter separator mismatch (`calino-` vs `calino_*`)
- App.tsx doesn't parse `?date=&event=` deep-link params
- ShortcutsHelp never mounted; `?` shortcut not registered
- ErrorBoundary hardcoded dark-mode-broken colors
- index.html missing `viewport-fit=cover`
- EventModal no end-before-start validation
- Basic auth header precomputed at CalDAVClient construction

### P2 UX/A11y
- Sidebar icon-only buttons missing `aria-label`
- MiniTasksSection checkbox no aria-label/pressed; `<div onClick>` task body
- OnboardingModal missing focus trap, Escape, aria-labelledby
- Notification permission denied silently disables
- Quick-settings dark-mode 2-state (no auto)
- EventPreviewPopup has two Escape keydown effects
- Phantom full-day fragment on day-after-end (multi-day all-day)
- Command palette captures stale `today` at registry-build
- OnboardingModal demo button has no spinner
- View dropdown/quick-settings lack `aria-haspopup`/`aria-expanded`/`role=menu`
- EventModal title-edit pencil no `aria-label`
- CalendarGrid journalIndicator no `aria-label`
- CalendarGrid dayNumber button reads "15" without context
- EventPreviewPopup no `useFocusTrap`
- SearchResults no arrow-key navigation
- WeekView/DayView no document-level arrow-key date navigation
- touchAction: 'none' blocks scroll on mobile (3 views)

### P2 Empty states
- AgendaView empty month shows just "X days free" label
- TodoView empty state has no CTA
- Sidebar empty Calendars list only shows `+` icon

### P2 Performance
- rangeExpansionCache ref-equality invalidation on every mutation
- eventPositioning O(n³) worst case
- useWindow unthrottled resize
- AgendaView O(N·M) spread-copy allocations
- searchIndex synchronous Fuse `setCollection` blocks main thread
- WeekView useMemo deps include raw `events` array
- CalendarGrid eventsMap recomputes on any calendar visibility toggle

### P3 Lower priority
- Priority 4-8 collapses to 9 on serialize
- CATEGORIES joined without escape
- VTIMEZONE not registered for VTODO/VJOURNAL parse
- Theme FOUC on theme-color update
- Positive trigger sign dropped
- Potential ReDoS in NLP location extraction