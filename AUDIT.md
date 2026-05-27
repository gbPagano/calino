# Calino Full Codebase Audit — 115 Bugs

**Date:** 2026-05-27
**Method:** 5 parallel agents, each auditing a major area

## Summary

| Area | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total |
|------|:-----------:|:-------:|:---------:|:------:|:-----:|
| Zustand Stores | 4 | — | 8 | 9 | 21 |
| CalDAV Feature | 5 | 8 | 7 | 5 | 25 |
| UI Components | 10 | — | 12 | 7 | 29 |
| Lib Utilities | 3 | — | 5 | 7 | 15 |
| Hooks/NLP/Themes | 3 | — | 9 | 13 | 25 |
| **Total** | **25** | **8** | **41** | **41** | **115** |

---

## Phase 1 — Critical Data Loss & Security

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 1 | 🔴 | calendarStore.ts | 289 | Destructive `migrate` wipes all data on version bump |
| 2 | 🔴 | credentials.ts | 1-53 | Plaintext password storage in localStorage |
| 3 | 🔴 | calendarStore.ts | 73-74 | `updateEvent` mutates caller's `updates` object |
| 4 | 🔴 | eventPositioning.ts | 51-58 | Cross-midnight events: loop skipped, wrong position |
| 5 | 🔴 | types/index.ts vs storage.ts | — | Duplicate `SyncStatus` with incompatible values ('failed' vs 'conflict') |

## Phase 2 — Gesture & Interaction Bugs

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 6 | 🔴 | useGestures.ts | all | Stale closures: @use-gesture captures callbacks once, all swipe/pinch use initial state |
| 7 | 🔴 | useGestures.ts | 50-217 | Dual handler architecture: event double-firing, conflicts with @dnd-kit |
| 8 | 🔴 | EventFormFields.tsx | 89-99 | Start time 23:30 → end time "24:30" (invalid, crashes) |
| 9 | 🔴 | CommandPalette.tsx | 37-45 | onClose() before async executeSelected() completes |
| 10 | 🔴 | EventPreviewPopup.tsx | 324 | relatedTarget null → contains() crash |
| 11 | 🔴 | EventPreviewPopup.tsx | 385-395 | Modal dialogs inside popup portal have broken overlays |
| 12 | 🔴 | EventPreviewPopup.tsx | 192 | editEndTime not initialized, creates zero-length events |

## Phase 3 — CalDAV Robustness

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 13 | 🔴 | CalDAVClient.ts | all | No timeouts on any network request |
| 14 | 🔴 | CalDAVClient.ts | 60 | Date.now() for calendar IDs (collision risk) |
| 15 | 🔴 | useCalDAV.ts | 636-675 | Data loss on delete when server returns 404/410 |
| 16 | 🟠 | CalDAVClient.ts | 18-20 | Proxy URL double-encoding breaks create/update |
| 17 | 🟠 | useCalDAV.ts | 674 | deleteEvent always passes empty etag |
| 18 | 🟠 | useCalDAV.ts | 95-150 | No retry limit on pending changes |
| 19 | 🟠 | useCalDAV.ts | 443-448 | Sync can delete events server didn't return |
| 20 | 🟠 | useCalDAV.ts | — | No offline detection |
| 21 | 🟠 | discovery.ts | 18-30 | Unauthenticated discovery probes |
| 22 | 🟠 | useCalDAV.ts | 413-424 | "Ask" conflict resolution silently overwrites |
| 23 | 🟠 | useCalDAV.ts | 153-158 | Concurrent processPendingChanges (no mutex) |
| 24 | 🟠 | icalTypeMapping.ts | 117-147 | RRULE BYDAY parsing issues; BYMONTHDAY/BYMONTH never parsed |
| 25 | 🟡 | icalTypeMapping.ts | 157-192 | Floating time timezone flip in RRULE UNTIL |
| 26 | 🟡 | icalTypeMapping.ts | 263-273 | Absolute reminder trigger uses Date.now() instead of event start |
| 27 | 🟡 | icalTypeMapping.ts | 287-307 | All-day DTEND rollover broken for December/January |
| 28 | 🟡 | icalTypeMapping.ts | 225-238 | All-day DTEND read-side fragile string manipulation |
| 29 | 🟡 | useCalDAV.ts | 598 | Sequence increments unconditionally (false conflicts) |
| 30 | 🟡 | discovery.ts | 28 | All errors silently swallowed in discovery loop |
| 31 | 🟡 | useCalDAV.ts | 353-357 | Category names compared to UUIDs, silently dropped |
| 32 | 🟢 | CalDAVClient.ts | 77,108,137,168 | Redundant fetchCalendars in every CRUD op |
| 33 | 🟢 | syncEngine.ts | 130-131 | Event start used as conflict heuristic instead of DTSTAMP |
| 34 | 🟢 | caldav/index.ts | 5 | taskToICAL not exported from barrel |
| 35 | 🟢 | discovery.ts | 34-54 | getServerInfo creates client but never uses it (dead code) |
| 36 | 🟢 | credentials.ts + accountStorage.ts | multiple | JSON.parse failures silently return empty arrays |

## Phase 4 — Recurrence & Timezone

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 37 | 🔴 | calendarStore.ts | 143-145 | Category filter hides recurrence exceptions |
| 38 | 🔴 | calendarStore.ts | 207-220 | Redundant exceptionId pattern-match causes duplicates |
| 39 | 🟡 | calendarStore.ts | 130-132 | Timezone-ambiguous date boundaries |
| 40 | 🟡 | calendarStore.ts | 165 | Excluded dates check uses UTC split, fails for non-UTC timezones |

## Phase 5 — Zustand Stores (remaining)

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 41 | 🟡 | calendarStore.ts | 88-97 | duplicateEvent copies recurrence-instance metadata |
| 42 | 🟡 | calendarStore.ts | 136-150 | Exception map built for ALL events, not just visible range |
| 43 | 🟡 | calendarStore.ts | 160-162 | updateCategory has no name-collision check |
| 44 | 🟡 | calendarStore.ts | 121-240 | getEventsForDateRange re-runs on every state change (no memoization) |
| 45 | 🟡 | calendarStore.ts | 295-300 | Navigation state (currentDate, currentView) not persisted |
| 46 | 🟡 | settingsStore.ts | 73-77 | Unnecessary state spread in updateSettings |
| 47 | 🟢 | calendarStore.ts | 106-112 | deleteCalendar doesn't clean up orphaned categories/rules |
| 48 | 🟢 | calendarStore.ts | 210-214 | toggleCategoryFilter name misleading (it sets, doesn't toggle) |
| 49 | 🟢 | calendarStore.ts | 310-323 | applyAutoCategories breaks after first keyword match per rule |
| 50 | 🟢 | calendarStore.ts | 13-25 | Possibly dead selector exports |
| 51 | 🟢 | calendarStore.ts | 46-51,68-82 | No start < end validation on add/update |
| 52 | 🟢 | storage.ts | 30-33 | removeItem silently swallows all errors |
| 53 | 🟢 | storage.ts | 34-39 | clear() wipes ALL localStorage, not just app keys |
| 54 | 🟢 | settingsStore.ts | 114 | TIMEZONE_OPTIONS evaluated eagerly at import time |
| 55 | 🟢 | calendarStore.ts | 118-124 | No validation in setDefaultCalendar |

## Phase 6 — UI Components (remaining)

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 56 | 🔴 | useGestures.ts | 143-152 | Long press timer not cleaned up on unmount |
| 57 | 🔴 | useScrollInput.ts | 23-56 | Programmatic DOM mutation bypasses React controlled inputs |
| 58 | 🔴 | EventModal.tsx | 305 | Missing selectedEndDate in useEffect deps |
| 59 | 🔴 | EventModal.tsx | 475-476 | All-day vs timed timezone inconsistency |
| 60 | 🟡 | EventFormFields.tsx | 161 | Weekday toggles for daily instead of weekly |
| 61 | 🟡 | EventCard.tsx | 85-110 | Resize listeners accumulate |
| 62 | 🟡 | Modal.tsx | 35 | Non-unique id="modal-title" (accessibility) |
| 63 | 🟡 | DayView.tsx | 60-76 | handleSwipe uses stale currentDate (related to #6) |
| 64 | 🟡 | CalendarGrid.tsx | 94-101 | changeMonth uses lagging currentDateRef |
| 65 | 🟡 | DayEventsPopup.tsx | 1-10 | Missing accessible role/label |
| 66 | 🟡 | WeekView.tsx | 129-149 | Scroll sync infinite loop risk with RAF |
| 67 | 🟡 | TodoView.tsx | 29-32 | Priority 0 mapped as "High" (should be undefined) |
| 68 | 🟡 | useGestures.ts | 145-148 | useDrag and usePinch both receive 2-finger touch events |
| 69 | 🟡 | SettingsPage.tsx | 73 | URL query params ignored on mount |
| 70 | 🟡 | CalendarHeader.tsx | 78-100 | handleSwipe captures stale currentView/date |
| 71 | 🟢 | Modal.tsx + others | multiple | Missing focus trap in modals/popups |
| 72 | 🟢 | CommandPalette.tsx | 109-116 | Ctrl+K handler calls onClose when palette closed |
| 73 | 🟢 | TodoView.tsx | 125-150 | Missing role="listitem" on task items |
| 74 | 🟢 | Sidebar.tsx | 189-194 | Dropdown click-outside effect re-creates on every state change |
| 75 | 🟢 | AgendaView.tsx | 43 | embedded prop unused (void embedded) |
| 76 | 🟢 | EventModal.tsx | 466-470 | Duplicate alert() before toast |
| 77 | 🟢 | Multiple | multiple | Missing displayName on forwardRef components |

## Phase 7 — Lib Utilities (remaining)

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 78 | 🔴 | hours.ts | 1-6 | DST transition: 23 or 25 hour slots instead of 24 |
| 79 | 🟡 | storage.ts | 33-35 | safeLocalStorage.length not in try/catch |
| 80 | 🟡 | storage.ts | 1-8 | handleQuotaError re-throws SecurityError |
| 81 | 🟡 | useNotifications.ts | 13,37-41 | shownReminders never clears for edited events |
| 82 | 🟡 | useNotifications.ts | 7 | 5-minute polling = ±5min reminder inaccuracy |
| 83 | 🟡 | eventPositioning.ts | 51-58 | 30-min sampling misses short overlapping events |
| 84 | 🟢 | uuid.ts | 1-4 | Regex accepts any hex UUID without version/variant validation |
| 85 | 🟢 | recurrence.ts | 79 | Sub-daily frequencies silently map to "Recurring" |
| 86 | 🟢 | Multiple | — | Mixed UTC/local date storage with no normalization |
| 87 | 🟢 | eventPositioning.ts | 24-41 | No secondary sort key; browser-dependent ordering |
| 88 | 🟢 | WeekView.tsx | ~119 | Timed tasks require both start AND dueDate to appear |

## Phase 8 — Hooks/NLP/Themes (remaining)

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 89 | 🔴 | NLParser.ts | 99-103 | Recurrence overwrites endDate/duration unconditionally |
| 90 | 🔴 | useNotifications.ts | 23-26 | shownReminders cleared on re-enable, causing duplicate notifications |
| 91 | 🔴 | useGestures.ts | 50-217 | Dual handler causes event double-firing (same as #7) |
| 92 | 🟡 | NLParser.ts | 90-91 | Ordinal preprocessing corrupts existing month names |
| 93 | 🟡 | extractDuration.ts | 6-15 | Recurrence patterns match inside other words |
| 94 | 🟡 | extractLocation.ts | 50 | Broken backslash escape in RegExp constructor |
| 95 | 🟡 | NLParser.ts | 89 | Title uses preprocessed input, parsedText mismatch |
| 96 | 🟡 | useGestures.ts | 213-214 | setTimeout calls setState after unmount |
| 97 | 🟡 | useWindowHeight.ts | 6,28 | Missing SSR guard for window access |
| 98 | 🟡 | useSearch.ts | 26-32 | Timer cleanup race on unmount |
| 99 | 🟡 | searchIndex.ts | 103-104 | Unsafe cast of Fuse.js internal docs |
| 100 | 🟡 | searchIndex.ts | 86-100 | Recurring events not expanded in date filtering |
| 101 | 🟡 | ThemeProvider.tsx | 37-43 | Empty CSS applied before themes load |
| 102 | 🟢 | extractLocation.ts | 89-96 | "at the" location capture includes trailing date words |
| 103 | 🟢 | NLParser.ts | 110-112 | Dead method parseToEvent() |
| 104 | 🟢 | useNotifications.ts | 73-84 | No feedback when permission denied while enabled |
| 105 | 🟢 | useIsMobile.ts | 10-14 | Redundant initial checkMobile() call |
| 106 | 🟢 | SearchResults.tsx | 27-44 | No bounds check on highlight indices |
| 107 | 🟢 | ThemeProvider.tsx | 59 | Unnecessary re-render on media query change |
| 108 | 🟢 | config.ts + useIsMobile.ts | — | MOBILE_BREAKPOINT duplicated |
| 109 | 🟢 | lib/notifications.ts | 1 | Unused format import in production path |
| 110 | 🟢 | config.ts + storage.ts | — | TOAST_DURATION_MS defined but unused; event name is magic string |
| 111 | 🟢 | storage.ts | 34-35 | key() wraps only function call, not property access |
| 112 | 🟢 | Multiple | — | Mixed UTC/local date storage (overlap with #86) |
| 113 | 🟢 | eventPositioning.ts | 20-21 | Transparent events passed to positionEvents but filtered internally |
| 114 | 🟢 | types/index.ts + extractDuration.ts | — | Frequency types align but are fragile |
| 115 | 🟢 | EventPreviewPopup.tsx | 385-395 | Portal nesting issues (overlaps with #11) |

---

## Completed Fixes (2026-05-27)

Search module (C1-C13): 10 bugs fixed in `fix/search-index-bugs` branch
- Limit applied after sort
- Composite relevance+recency scoring
- Partial date ranges
- Filter-only search with empty query
- Key remapping unconditional
- Date parse error handling
- updateSearchIndex options param
- Date caching (no redundant parseISO)
- Redundant key field removed from SearchMatch
