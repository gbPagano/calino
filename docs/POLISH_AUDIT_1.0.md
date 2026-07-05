# Calino 1.0 Polish & Bug Audit — Actionable Roadmap

## Context

Calino is a mature (~36K LOC) React 19 + TS CalDAV calendar with month/week/day/agenda/year views,
tasks (VTODO), journal, CardDAV contacts, NLP quick-add, command palette, search, themes, and PWA
notifications. The sync layer is already heavily engineered (optimistic UI, pending-change tombstones,
in-flight-delete tracking, sequence-based conflict resolution). This audit targets the remaining
**1.0 blockers**: correctness bugs that erode trust, plus polish/feature gaps that separate a "good"
CalDAV client from a *premium* one (Apple Calendar / Cron / Fantastical tier).

Findings are ranked by **ROI (impact ÷ effort)** in three tiers. Every item was verified against the
actual code and includes concrete edit hints. **Product decision:** there is no automatic
background/scheduled sync — a manual **page refresh** is the intended way to re-sync, and any UI that
implies automatic refreshing must be removed (see 1.4).

Effort key: **S** = <½ day, **M** = ½–2 days, **L** = multi-day. Run `pnpm check` after each item.

---

## TIER 1 — Must-fix blockers (correctness & trust; do first)

### 1.1 — Task-reminder settings toggles are dead no-ops  ⭐ highest ROI
- **Where**: `src/features/settings/components/NotificationSettings.tsx:92,104`
- **Bug**: "Task due date reminders" and "Overdue task badge" render as
  `<input type="checkbox" defaultChecked …>` with **no `checked` binding and no `onChange`** — they look
  functional but change nothing and never persist. (The neighboring desktop/sound toggles at lines 53–74
  are correctly wired to `useSettingsStore` — copy their pattern.)
- **Impact**: Settings that silently lie — the cardinal sin for a trust product.
- **Steps**:
  1. Add `enableTaskReminders: boolean` and `enableOverdueBadge: boolean` to the state + defaults in
     `src/store/settingsStore.ts` (defaults `true`).
  2. In `NotificationSettings.tsx`, read them via `useSettingsStore` and replace `defaultChecked` with
     `checked={…}` + `onChange={() => updateSettings({ … })}`, mirroring lines 53–74.
  3. Honor `enableTaskReminders` where task reminders are scheduled (`src/lib/notifications.ts` /
     `src/hooks/useNotifications.ts`) and `enableOverdueBadge` where the overdue badge renders
     (`MiniTasksSection.tsx` / `TodoView.tsx`).
- **Effort: S**

### 1.2 — Recurrence exceptions & EXDATE collide on same-day / sub-daily series
- **Where**: `src/store/calendarStore.ts:488–495` (exception map keyed `${calendarId}-${date}`),
  `:586` (EXDATE matched date-only), `:590` (lookup date-only). The full occurrence datetime `occKey`
  already exists at `:583`.
- **Bug**: The exception/EXDATE key is the **date only**, not the full RECURRENCE-ID datetime. Fine for
  daily events (one occurrence/day), but for sub-daily recurrence (`FREQ=HOURLY/MINUTELY`, or two
  instances of a series on one day) editing/deleting *one* occurrence wrongly rewrites/removes **every**
  occurrence that day.
- **Impact**: Silent data corruption on sub-daily recurrences.
- **Steps**:
  1. Build the exception map key from the full RECURRENCE-ID datetime, not `event.recurrenceId.split('T')[0]`
     (`:491`). Normalize to the same ISO form as `occKey`.
  2. At `:590`, look up by `occKey` (the ISO occurrence string) instead of `occDateStr`.
  3. At `:586`, compare EXDATEs against the full occurrence datetime, not the date prefix — keeping a
     date-only fallback only for genuinely date-only EXDATEs (all-day events).
  4. Add a Vitest case to the recurrence-expansion suite (see Verification).
- **Effort: M**

### 1.3 — "This and following events" recurrence edit is unreachable
- **Where**: `src/features/calendar/components/RecurrenceDialog.tsx:53–59` (renders only two buttons);
  the type already supports `'all' | 'future' | 'this'` (`:7`) and `EventModal` already handles `'future'`.
- **Bug**: `onConfirm('future')` can never be triggered, so editing a series from a point forward (the
  most common recurrence edit) is impossible.
- **Steps**:
  1. Add a third `<button … onClick={() => onConfirm('future')}>This and following events</button>`
     between the existing "All events" and "This event only" buttons.
  2. Trace the `'future'` branch in `EventModal.tsx` (search `RecurrenceEditMode`/`'future'`) and confirm
     it splits the series correctly (rewrites the original series' `UNTIL`/`COUNT` and creates a new series
     from the edit date). Harden if needed.
- **Effort: S** (button) / **M** if the `'future'` handler needs work.

### 1.4 — Remove all "automatic refresh / scheduled sync" UI  (product decision)
- **Where**:
  - `src/features/settings/components/CalDAVSettings.tsx:81–121` — the entire **"Sync Settings"** group:
    the disabled **Sync Frequency** row (`:83–102`) and disabled **Sync on Launch** row (`:103–120`,
    including the "Always refresh when you open the app" copy at `:106`). Both are `rowDisabled` /
    `title="Not available yet"` placeholders.
  - `src/store/settingsStore.ts:114–115` — `syncEnabled` / `syncIntervalMinutes` and the
    `SYNC_INTERVAL_OPTIONS` const in `CalDAVSettings.tsx`.
  - `src/features/caldav/hooks/useCalDAV.ts:287–316` — mount auto-sync is gated on `syncEnabled` (which
    defaults to `false`), so refresh currently does **not** re-sync.
- **Goal**: No UI that implies automatic/scheduled refreshing; a **page refresh** is the sync trigger.
- **Steps**:
  1. Delete the "Sync Settings" group (`:81–121`) and the now-unused `SYNC_INTERVAL_OPTIONS`,
     `syncIntervalMinutes`, `syncEnabled` references in `CalDAVSettings.tsx`.
  2. Make mount-sync always run: in `useCalDAV.ts:290–316` remove the `syncEnabled` gate so a page load
     always re-syncs connected accounts (keep the `hasAutoSynced` one-shot guard and failure toast).
  3. Remove `syncEnabled` / `syncIntervalMinutes` from `settingsStore.ts` (and any persisted-state
     migration/partialize references) once no longer read.
  4. Grep for leftover copy mentioning automatic/background sync or "refresh when you open the app" and
     delete it.
- **Effort: S**

---

## TIER 2 — High-ROI polish (large perceived-quality lift, modest effort)

### 2.1 — No current-time "now" indicator + doesn't scroll to now  ⭐
- **Where**: `src/features/calendar/components/DayView.tsx`, `WeekView.tsx` (confirmed: no now-line
  anywhere; both scroll to the *first event*, not the current time). Day/Week share the hour-grid body
  (`bodyRef`) and `effectiveScale`/`hourHeight` sizing.
- **Gap**: Every premium calendar draws a live "now" line with a time label and opens today scrolled to
  it. Its absence makes Day/Week feel unfinished.
- **Steps**:
  1. Add a small `CurrentTimeIndicator` component: absolutely-positioned line at
     `top = (minutesSinceMidnight / 1440) * bodyHeight` (respect the same scale factor the events use),
     with a time label on the left gutter. Re-render on a 60s `setInterval` (clear on unmount).
  2. Render it only on the column whose date is today (DayView always if `isToday`; WeekView on the
     matching day column).
  3. On mount, if the view is showing today, scroll `bodyRef` to `now` (offset minus ~2h of padding)
     instead of the first-event scroll.
- **Effort: M**

### 2.2 — Motion inconsistency & reduced-motion not honored
- **Where**: durations are scattered across CSS modules (verified: `0.12s`×76, `0.14s`×58, `0.15s`×54,
  `0.2s`×32, `0.25s`×15…); modal-close timings disagree — `EventModal.tsx:41–47` hardcodes 180ms,
  `useAnimatedClose.ts` 160ms, `Modal.module.css` 200ms; `prefers-reduced-motion` is referenced **only**
  in `useReducedMotion.ts` (whose lone consumer is `useAnimatedClose`) — Framer view transitions,
  EventModal, sidebar, and nearly all CSS ignore it.
- **Impact**: The same gesture (closing a modal) animates at three speeds; motion-sensitive users get no
  relief (WCAG 2.3.3).
- **Steps**:
  1. Define tokens in `src/index.css`: `--dur-fast:150ms; --dur-base:200ms; --dur-slow:300ms` plus a
     shared easing var. Replace hardcoded durations in the CSS modules (start with the highest-traffic:
     Modal, EventModal, EventCard, Sidebar).
  2. Unify modal close to one duration — have `EventModal.tsx` use `useAnimatedClose` (or the same
     constant) so its 180ms matches `Modal`.
  3. Add a global escape hatch in `index.css`:
     `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:.01ms!important; transition-duration:.01ms!important } }`
     and gate Framer `AnimatePresence`/transitions on `useReducedMotion()` (App-level `ViewLoader`,
     EventModal, popups).
- **Effort: M**

---

## TIER 3 — Premium features & deeper polish (do selectively / post-blocker)

- **Multiple reminders + snooze** — `EventDefaultsSettings` / `notifications.ts` support a single reminder
  and no snooze action. Add a reminders array on the event + a "remind me in 5 min" notification action.
  **M–L**
- **NLP attendee parsing + contact autocomplete** — `features/nlp/parser/` extracts title/duration/
  location/recurrence but not "with John and Sarah"; add an `extractAttendees` pass wired to CardDAV
  contacts. **M**
- **Search filters** — `features/search/` returns a flat list; add type (event/task) + calendar +
  date-range filters in `SearchBar`/`SearchResults`. **M**
- **localStorage scaling** — `calendarStore.ts:685` persists **all events** into localStorage via zustand
  `partialize` (synchronous JSON on every change). Risks quota/jank at 1000+ events. Dexie is already a
  dependency — migrate the events slice to IndexedDB. **M–L**
- **Spacing/radius token pass** — ad-hoc gaps and border-radii across CSS modules; fold into a modular
  scale for visual coherence. **M**

---

## Discarded false positives (do NOT chase)
- ❌ "No drag-to-reschedule" — it exists: `WeekView.tsx:460 handleDragEnd` + dnd-kit, EventCard
  `enableResize`.
- ❌ "EventPreviewPopup / DayEventsPopup lack edge detection" — EventPreviewPopup clamps at `:361–365`.
- ❌ "Stale `conflictResolution` closure in auto-sync" — the effect is a one-shot (`hasAutoSynced`), no
  stale-loop risk.
- ⚠️ "All-day duration `Math.round`→0" (`calendarStore.ts:558`) — only fires for non-midnight all-day
  ends, which the model normalizes away; leave as-is.

---

## Suggested execution order
1. **Tier 1** (1.1 → 1.4): trust/correctness + the automatic-refresh removal, all S/M — ship as a
   reliability patch.
2. **Tier 2** (2.1 → 2.2): the visible "feels premium" jump — the now-indicator (2.1) and motion tokens
   (2.2) are the two highest-visibility wins.
3. **Tier 3**: pick 2–3 differentiators (multiple reminders, search filters) for the 1.0 headline.

## Verification
- `pnpm check` (typecheck + lint + `vitest --run` + build) green after each change.
- **1.1**: toggle each task-reminder setting, reload, confirm it persists and gates an actual reminder.
- **1.2**: create an `FREQ=HOURLY` event, edit/delete a single occurrence, confirm only that instance
  changes (add a Vitest case in the recurrence-expansion suite).
- **1.3**: edit a weekly series with "This and following", confirm the series splits at that date.
- **1.4**: Settings → CalDAV shows no sync-frequency/sync-on-launch rows; refreshing the page re-pulls
  events from connected accounts.
- **2.1**: open Day view on today mid-afternoon — now-line renders at the right offset and the view is
  scrolled to it; wait a minute, confirm it advances.
- **2.2**: enable OS "reduce motion", confirm modal/view transitions are near-instant.
- Manual pass via `pnpm dev` for the polish items.
