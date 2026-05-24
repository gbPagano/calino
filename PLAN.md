# Plan: CalDAV Sync Fixes & Code Quality Improvements

**Last updated:** 2026-05-24
**Session commits:** `df07c0a` → `a6084a5` → `145eeef` → `99496e6`

---

## Phase 1: Silent CalDAV Sync Failures ✅ COMPLETE

**Goal:** Every create, update, and delete operation reliably reaches the CalDAV server, and users are notified when sync fails.

### Completed

- [x] **Task 1: Race condition fix** — `createEvent`, `updateEventFn`, `deleteEventFn` now read accounts/calendars from `localStorage` via `storage.getAllAccounts()` / `storage.getAllCalendars()` instead of React state. Removed stale `accounts`/`calendars` from `useCallback` deps. Guards now fire `console.warn` + `show-toast` instead of silent return.
- [x] **Task 2: Error feedback** — All 5 `catch {}` blocks in EventModal, all 3 in EventCard, and the AgendaView/EventPreviewPopup delete handlers now dispatch `show-toast` custom events.
- [x] **Task 3: AgendaView delete** — Added `deleteCalDAVEvent` call after store delete with error toast.
- [x] **Task 4: EventCard recurrence delete** — `DeleteDialog.onConfirm` now calls `updateCalDAVEvent` (mode='this') or `deleteCalDAVEvent` (other modes).
- [x] **Task 5: Pending-queue retry** — `processPendingChanges()` drains the queue on mount + every 30s + after every successful sync.
- [x] **Task 6: Manual testing** — TypeScript passes, 381/381 tests pass.
- [x] **Bonus: EventPreviewPopup delete** — Found and fixed same missing-CalDAV-call bug in preview popup (`handleDelete`/`performDelete`).

---

## Phase 2: Code Review Improvements ✅ PARTIAL

A broad review across React patterns, TypeScript, accessibility, security, and PWA revealed 33 issues. The following were fixed:

### Completed

| # | Area | Fix |
|---|------|-----|
| 4 | A11Y | EventModal: added Escape key handler + `role="dialog"` `aria-modal="true"` |
| 5 | A11Y | CommandPalette CSS: `outline: none` on `:focus` → `:focus-visible` with visible ring |
| 6 | A11Y | Toast: added `role="status"` `aria-live="polite"` |
| 7 | Perf | 9 components refactored to individual Zustand selectors instead of full store subscriptions |
| 8 | Perf | EventCard: removed subscription to entire `events` array, uses `getState()` in handler |
| 11 | Bug | EventModal: non-null assertion `selectedEventId!` → guard with `if (!selectedEventId) return` |
| 12 | Bug | MiniTasksSection: non-null assertion `tooltipPosition!` → guard with `&& tooltipPosition` |
| 13 | Security | Added Content-Security-Policy meta tag to `index.html` |
| 17 | Data | Both Zustand stores: added `version: 1` + `migrate` to persist configs |
| 30 | Dep | Removed `dexie` dead code (73KB) + deleted `dbSyncMiddleware.ts` |
| 32 | TS | Added explicit return type to `useCommandPalette` (fixed sig in follow-up commit) |

### Skipped (from the selected list)

| # | What | Why |
|---|------|-----|
| 9 | WeekView `renderDayEvents` memoization | ~150-line function needs extraction into `React.memo(WeekDayColumn)` component — non-trivial refactor |
| 10 | DST transition bug | `getTimezoneOffset()` on Date objects returns offset at that date's timestamp (not current), so the review's claim was partially wrong. But the recurrence code uses system timezone, not the user's configured timezone — needs a broader rework with `date-fns-tz` |

---

## Phase 3: Remaining Issues from Full Audit

### 🔴 Critical — Fix immediately

| # | Category | Issue | File |
|---|----------|-------|------|
| 1 | **Security** | CalDAV passwords stored in **plaintext** localStorage | `credentials.ts` |
| 2 | **Data Loss** | `syncAccount` deletes local events not found on server (outside query range, partial response) — **can wipe user data** | `useCalDAV.ts:376-381` |
| 3 | **A11Y** | Calendar grid cells are `div`s with `onClick` — zero keyboard access. Also: AgendaView, TodoView, DayEventsPopup, EventCard dragContent | Multiple views |

### 🟠 High — Fix soon

| # | Category | Issue | File |
|---|----------|-------|------|
| 14 | Security | Settings export leaks server URLs + usernames in JSON download | `DataSettings.tsx` |
| 15 | PWA | Cache-first service worker never updates — users see stale app indefinitely | `sw.js:19-36` |
| 16 | PWA | Notifications use polling, not Push API — only works while tab open | `useNotifications.ts` |
| 18 | Bug | `EventModal` useEffect resets form when `events`/`calendars` change (e.g. during CalDAV sync) — **user data loss risk** | `EventModal.tsx:226-267` |
| 19 | A11Y | Missing `aria-label` on 10+ icon-only buttons (nav chevrons, settings, sync, color dot) | Multiple components |
| 20 | A11Y | No focus restoration after any dialog/modal closes — focus lost | All dialogs |
| 21 | A11Y | Month calendar grid uses CSS grid `div`s instead of `<table>` semantics | `CalendarGrid.tsx` |
| 22 | Error | 30+ empty `catch {}` blocks in drag-to-reschedule, task completion, etc. | Multiple views |
| 23 | Perf | `useSearch` rebuilds index synchronously on every `events` change | `useSearch.ts` |
| 24 | Perf | WeekView `useLayoutEffect` resets scroll position on zoom | `WeekView.tsx` |

### 🟡 Medium — Worth doing

| # | Category | Issue |
|---|----------|-------|
| 25 | A11Y | Many touch targets below 44×44px (color dot 10px, checkbox 16px, resize handle 8px) |
| 26 | A11Y | Event identification is **color-only** — no text label for calendar/category |
| 27 | A11Y | ~30 SVG icons missing `aria-hidden="true"` |
| 28 | Data | No localStorage quota exceeded handling |
| 29 | Data | `crypto.randomUUID()` and `uuid.v4()` mixed — standardize on one |
| 31 | TS | 20+ unsafe `as` casts on `formData.get()`, `JSON.parse()`, gesture events |
| 33 | TS | `any[]` in iCalendar adapter should be `unknown[]` |

---

## Recommendations

### Next session priority order

1. **#2 (Data Loss)** — `syncAccount` deletion logic is dangerous. Only delete events within the queried date range, and ensure the full response was received before applying deletions. **This can wipe user data.**

2. **#18 (Bug)** — EventModal form reset during CalDAV sync. Remove `initialState` from the useEffect deps; the reset should only fire when the user explicitly opens a different event.

3. **#3 (A11Y)** — Calendar grid keyboard access. Convert `DroppableDay` to use `<button>` elements with `onKeyDown` for Enter/Space. This is the single biggest a11y blocker.

4. **#1 (Security)** — Encrypt passwords in localStorage using Web Crypto API's `SubtleCrypto`. At minimum, add a warning that passwords are stored in plaintext.

5. **#9 + #23 (Perf)** — Extract `renderDayEvents` into `React.memo` component + debounce search index rebuild. These are the biggest remaining performance wins after the Zustand selector fixes.

6. **#15 (PWA)** — Fix cache-first SW to use network-first for HTML shell with cache fallback for offline support.

### Testing

- All 381 existing tests pass
- `pnpm typecheck` passes clean
- `pnpm build` produces all chunks without errors
- `pnpm lint` has only pre-existing issues (none in files we changed)
