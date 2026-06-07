# VJournal Code Review Report

## Progress

Fixed so far:
- [x] #1 — Double comma bug in CalendarGrid.tsx line 931
- [x] #2 — Duplicate `.addEntry` CSS in JournalDayModal.module.css
- [x] #3 — `confirmDeleteId` not reset on mode/entry changes (both JournalDayModal + JournalView)
- [x] #4 — `footerActions` CSS — confirmed not present, no fix needed
- [x] #5 — Deprecated `navigator.platform` → `navigator.userAgent` (both files)
- [x] #6 — Memoized `entries` filter in JournalDayModal with `useMemo`
- [x] #7 — Replaced `useSettingsStore.getState()` with prop-based `journalEnabled` in DroppableDay
- [x] #8 — Extracted `JournalComposeForm` component to eliminate compose form duplication in JournalView
- [x] #9 — Used refs for `events`/`calendars` in `handleSave` to reduce callback recreation
- [x] #10 — Used ref for `handleSave` in keyboard shortcut effects to fix stale closure risk
- [x] #11 — Added `.catch()` error handling on all CalDAV sync calls with user-facing toast
- [x] #12 — Added `console.warn` when VJOURNAL missing DTSTART falls back to today
- [x] #13 — Added `sequence` increment on journal entry update
- [x] #14 — Added `created`/`lastModified` fallbacks for pre-existing events in CalDAV parse
- [x] #15 — Journal entries now appear in search results with "Journal" type badge
- [x] #17 — Undo toast after delete (8s window, restores entry locally + CalDAV)
- [x] #19 — Keyboard navigation (↑/↓/j/k to navigate, Enter/o to edit) in day modal
- [x] #21 — "Export Journal as Markdown" command in command palette
- [x] #22 — Category selector (chip picker) in journal compose form
- [x] #23 — Empty state CTA ("Write something") when no entries for a day
- [x] #24 — Context menu "New journal entry" now force-resets modal state

All 749 tests pass. TypeScript compiles clean.

---

## Bugs

### 1. Double comma syntax error in CalendarGrid.tsx (line 931) ✅ FIXED
```tsx
              : []),,   // ← double comma
```

---

### 2. Duplicate CSS `.addEntry` definitions in JournalDayModal.module.css ✅ FIXED
Removed the first (dead) `.addEntry` block.

---

### 3. `confirmDeleteId` not reset on mode/entry changes ✅ FIXED
Added `setConfirmDeleteId(null)` in the reset-on-open effect (JournalDayModal) and a dedicated `useEffect` watching `[editingId, isComposing]` (JournalView).

---

### 4. `footerActions` CSS class defined but never used ✅ NOT PRESENT
Confirmed it doesn't exist. No fix needed.

---

### 5. `isMac` detection uses deprecated `navigator.platform` ✅ FIXED
Replaced with `navigator.userAgent` regex test.

---

## Performance Issues

### 6. Unmemoized `entries` filter in JournalDayModal ✅ FIXED
Wrapped in `useMemo`.

---

### 7. `useSettingsStore.getState()` in DroppableDay render ✅ FIXED
Added `journalEnabled` prop to `DroppableDay`, passed from parent via `useSettingsStore` hook.

---

## Code Quality / Best Practice Issues

### 8. Massive code duplication in JournalView.tsx ✅ FIXED
The compose form is copy-pasted twice — once for new entries (top of page) and once for editing (inline). This should be extracted into a shared `JournalComposeForm` component.

**Fix:** Extracted `JournalComposeForm` component and reuse it in both places.

---

### 9. `handleSave` / `handleSaveEntry` have too many dependencies ✅ FIXED
Both callbacks depend on `[mode, editingId, title, body, date, events, calendars, ...]`. The `events` dependency means the callback is recreated on every event change. Consider using refs for values that don't need to trigger re-creation.

**Fix:** Used refs for `events` and `calendars`. Removed them from dependency arrays.

---

### 10. Keyboard shortcut `useEffect` depends on `handleSave` but doesn't include it ✅ FIXED
This means the keyboard shortcut captures a stale closure of `handleSave`. It works by accident because `handleSave`'s deps overlap with the effect's deps, but it's fragile.

**Fix:** Used a ref for `handleSave` in both components.

---

### 11. No error handling on CalDAV sync ✅ FIXED
When `createCalDAVEvent`, `updateCalDAVEvent`, or `deleteCalDAVEvent` fails, there's no error handling or user feedback. The local state updates optimistically but sync failures are silently swallowed.

**Fix:** Added `.catch()` on all CalDAV calls with toast notifications.

---

### 12. `icalVjournalToCalendarEvent` silently defaults missing DTSTART to today ✅ FIXED
If a VJOURNAL from the server has no DTSTART, it silently uses today's date. This could cause data to appear on the wrong day without any warning.

**Fix:** Added `console.warn` when falling back.

---

### 13. No `sequence` bump on update ✅ FIXED
When updating a journal entry, `sequence` is not incremented. RFC 5545 requires sequence bumps on significant changes for conflict resolution.

**Fix:** Added `sequence: (existing.sequence ?? 0) + 1` to update logic in both components.

---

### 14. `created` / `lastModified` not set on pre-existing events ✅ FIXED
The `created` and `lastModified` fields were added to `CalendarEvent` but are only set on new journal entries. Existing events/tasks have `undefined` for these fields, which could cause issues if code assumes they exist.

**Fix:** Added fallbacks in `icalVjournalToCalendarEvent`: `created` defaults to `start` date, `lastModified` defaults to `created`.

---

## Missing Features

### 15. No search integration ✅ FIXED
Journal entries are not indexed by the search/command palette. The `new-journal-entry` command exists, but searching for journal content doesn't work.

**Fix:** Search index already indexes all events. Added "Journal" type badge in search results display.

---

### 16. No agenda view integration ⏭️ SKIPPED
User chose to skip this feature.

---

### 17. No undo after delete ✅ FIXED
Delete is immediate and permanent. No toast/undo mechanism.

**Fix:** Enhanced Toast component to support undo callback. On delete, shows toast with "Undo" button (8s window) that restores entry locally and to CalDAV.

---

### 18. No entry ordering within a day ⏭️ SKIPPED
User chose to skip this feature.

---

### 19. No keyboard navigation between entries ✅ FIXED
In the day modal, there's no way to arrow-key between entries or tab through them efficiently.

**Fix:** Added ↑/↓/j/k navigation, Enter/o to edit. Focused entry gets visual highlight.

---

### 20. No mobile gestures ⏭️ SKIPPED
User chose to skip this feature.

---

### 21. No export/import ✅ FIXED
No way to export journal entries as markdown/PDF or import from other journal apps.

**Fix:** Added "Export Journal as Markdown" command in command palette. Generates .md file with entries grouped by date.

---

### 22. No categories/tags UI ✅ FIXED
The iCal `CATEGORIES` field is parsed and serialized, but there's no UI to assign categories to journal entries.

**Fix:** Added category chip picker to both JournalView and JournalDayModal compose forms.

---

### 23. No empty state CTA in day modal ✅ FIXED
When there are no entries for a day, the modal shows nothing — no "No entries yet, write one?" prompt.

**Fix:** Added empty state with "No entries for this day" message and "Write something" button.

---

### 24. CalendarGrid context menu doesn't close modal on journal creation ✅ FIXED
When "New journal entry" is clicked from the context menu, the context menu closes but the JournalDayModal opens. If the user was already viewing that modal, this could cause a state conflict.

**Fix:** Force-close modal first, then reopen on next tick via requestAnimationFrame.

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Bugs | 5 | 4 fixed, 1 confirmed not present |
| Performance | 2 | 2 fixed |
| Code Quality | 7 | 7 fixed |
| Missing Features | 10 | 7 fixed, 3 skipped |

**Complete.**
