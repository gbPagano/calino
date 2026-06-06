# Performance Audit — Full Calino Codebase

Sorted from **least to most likely** to break anything when fixed.

---

## Tier 1 — Safe (pure additions, zero behavior change)

### 1. Move static arrays to module-level constants
**File:** `src/features/commandPalette/hooks/useCommandPalette.ts` lines ~110-180

`pureDateKeywords`, `dayNames`, `monthNames` are recreated inside `parseInput` on every call. They're static data.

**Fix:** Move to module-level `const` arrays. No behavior change — just fewer allocations.

---

### 2. Cache `btoa()` credentials on constructor
**File:** `src/features/caldav/client/CalDAVClient.ts`

`btoa(\`${this.credentials.username}:${this.credentials.password}\`)` is called in every method that makes HTTP requests. Same string encoded every time.

**Fix:** Store `this.authHeader = 'Basic ' + btoa(...)` in the constructor. No behavior change.

---

### 3. Pre-parse dates in `positionEvents()`
**File:** `src/lib/eventPositioning.ts` lines ~40-60

`parseISO(p.event.start).getTime()` is called inside `some()` and `filter()` callbacks — the same date parsed 4× per event pair. For 100 events, that's 2000 parse calls.

**Fix:** Pre-map events to `{ event, startMs, endMs }[]` once at the top. No behavior change — same algorithm, fewer allocations.

---

### 4. Early-return default state when `EventModal` is closed
**File:** `src/features/calendar/components/EventModal.tsx` lines ~37-210

`getInitialFormState` runs on every render (via useMemo) even when `isModalOpen` is false. It recomputes when any event/calendar changes.

**Fix:** Add `if (!isModalOpen) return emptyState` at the top of the useMemo. No behavior change — modal is closed anyway.

---

### 5. Pause notifications polling when tab is hidden
**File:** `src/hooks/useNotifications.ts`

The interval runs regardless of document visibility. Wastes CPU in background tabs.

**Fix:** Add `document.addEventListener('visibilitychange', ...)` to pause/resume. No behavior change — notifications aren't needed when hidden.

---

### 6. Move EventCard inline SVGs to module-level components
**File:** `src/features/calendar/components/EventCard.tsx` lines ~280-310

`DeleteIcon`, `DuplicateIcon`, `EditIcon`, `TravelIcon`, `SyncWarningIcon` are defined inside the component body. They're recreated every render.

**Fix:** Move to module-level `const DeleteIcon = () => ...` or separate files. No behavior change — same SVGs, fewer allocations.

---

### 7. Consolidate `useGestures` ref-syncing useEffects
**File:** `src/hooks/useGestures.ts` lines ~40-80

12 separate `useEffect` hooks just to sync callback refs. Each creates a subscription.

**Fix:** Use a single `useEffect` that sets all refs. No behavior change — same sync timing.

---

### 8. Cache `storage.getAllCalendars()` / `storage.getAllAccounts()` in CalDAV hooks
**File:** `src/features/caldav/hooks/useCalDAV.ts` lines ~920-970

`updateCalDAVCalendar` and `deleteCalDAVCalendar` call these twice each. Each reads from localStorage + JSON.parse.

**Fix:** Call once, store in local `const`. No behavior change — same data, fewer reads.

---

### 9. Cache `findCalendarHome()` result on client instance
**File:** `src/features/caldav/client/CalDAVClient.ts` lines ~350-380

Every `createCalendar` re-discovers the calendar home via 4 PROPFINDs + fetchCalendars.

**Fix:** Store result as `this.calendarHomeUrl` on first call, reuse thereafter. No behavior change — same URL, fewer network requests.

---

### 10. Reorder `findCalendarHome` to try cached data first
**File:** `src/features/caldav/client/CalDAVClient.ts` lines ~350-380

Currently tries 4 principal URL paths (potentially 60s of timeouts) before falling back to `findCalendarHomeFromCalendars()`.

**Fix:** Try `findCalendarHomeFromCalendars()` first, then principal discovery. No behavior change — same result, faster path.

---

### 11. Move `parseNaturalLanguage` call out of NLP double-parse
**File:** `src/features/commandPalette/hooks/useCommandPalette.ts`

`parseNaturalLanguage(query)` is called once to detect type, then again in `preview` useMemo.

**Fix:** Compute the NLP result once, pass it through. No behavior change — same parsing, half the work.

---

## Tier 2 — Low Risk (minor logic changes, easily verifiable)

### 12. Memoize `selectedCategoryNames` in CalendarGrid
**File:** `src/features/calendar/components/CalendarGrid.tsx` lines ~56-60

Creates a new array every render, which defeats `useMemo` for `eventsMap` and `tasksMap`.

**Fix:** Wrap in `useMemo(() => ..., [selectedCategoryIds, categories])`. The only risk is getting the dependency array wrong.

---

### 13. Wrap `DroppableDay` in `React.memo`
**File:** `src/features/calendar/components/CalendarGrid.tsx` lines ~600-680

All 42 day cells re-render on any parent state change.

**Fix:** `const DroppableDay = React.memo(function DroppableDay(...) {...})`. Risk: stale props if a prop is a new object/function reference each render. Need to verify all props are stable.

---

### 14. Wrap `EventCard` in `React.memo`
**File:** `src/features/calendar/components/EventCard.tsx`

Complex component rendered for every event. Re-renders whenever parent re-renders.

**Fix:** `const EventCard = React.memo(function EventCard(...) {...})`. Risk: same stale prop issue as #13. EventCard has many props — need to verify each one is stable.

---

### 15. Use `useCallback` on EventCard handlers
**File:** `src/features/calendar/components/EventCard.tsx`

`handleClick`, `handleCheckboxClick`, `handleResizeStart` etc. recreated every render.

**Fix:** Wrap in `useCallback`. Risk: dependency arrays — missing a dependency causes stale closures. Low risk since these handlers are simple.

---

### 16. Wrap `useCommandPalette.results` in `useMemo`
**File:** `src/features/commandPalette/hooks/useCommandPalette.ts` lines ~210-310

`results` is an IIFE that runs every render. Calls `filterCommands`, `searchEvents`, `searchCalendars`, `parseInput`.

**Fix:** Wrap in `useMemo([query, commands, events, calendars, parseInput, filterCommands, searchEvents, searchCalendars])`. Risk: dependency array correctness.

---

### 17. Use `matchMedia` for `useIsMobile()`
**File:** `src/hooks/useIsMobile.ts`

`resize` listener fires every pixel. `matchMedia` only fires when breakpoint is crossed.

**Fix:** Replace with `window.matchMedia(\`(max-width: ${MOBILE_BREAKPOINT}px)\`)`. Risk: `matchMedia` API availability (IE11+ only, but we already don't support IE).

---

### 18. Use `matchMedia` for `useIsTallWindow()` / `useIsWideWindow()`
**File:** `src/hooks/useWindowHeight.ts`

Same issue as #17.

**Fix:** Same approach. Same risk level.

---

### 19. Cache NLP result for `useCommandPalette` preview
**File:** `src/features/commandPalette/hooks/useCommandPalette.ts`

`preview` useMemo calls `parseNaturalLanguage(query)` independently of the `results` computation.

**Fix:** Compute NLP once in `results`, store in state/ref for `preview` to consume. Risk: if preview depends on a different query than results (race condition during typing).

---

### 20. Pre-build `applyAutoCategories` keyword map
**File:** `src/store/calendarStore.ts` lines ~530-550

`applyAutoCategories` iterates all rules × keywords × categories on every event save.

**Fix:** Build `Map<lowercaseKeyword, categoryId>` once. Rebuild when rules change. Risk: keyword-to-category mapping must stay in sync with rule changes.

---

### 21. Store dragged event in ref instead of searching twice
**File:** `src/features/calendar/components/CalendarGrid.tsx` lines ~220-280

`events.find()` called in both `handleDragStart` and `handleDragEnd`.

**Fix:** Store the found event in a ref during `handleDragStart`. Risk: ref could become stale if event is deleted between drag start and end.

---

### 22. Add cleanup for resize drag listeners
**File:** `src/features/calendar/components/CalendarGrid.tsx` lines ~300-330

`handleGridResizeStart` and `handleResizeStart` add `mousemove`/`mouseup` to `document` without cleanup on unmount.

**Fix:** Track the listeners and remove them in a useEffect cleanup. Risk: if cleanup timing is wrong, resize could break.

---

### 23. Remove redundant `setCalendars(storage.getAllCalendars())` calls
**File:** `src/features/caldav/hooks/useCalDAV.ts` lines ~910-920

After `storeAddCalendar`/`storeUpdateCalendar`/`storeDeleteCalendar`, `setCalendars` is also called, causing a second re-render.

**Fix:** Remove the `setCalendars` line. Risk: if the zustand store and localStorage get out of sync, the Sidebar could show stale data. Verify that `storeAddCalendar` updates the store synchronously.

---

### 24. Use more granular selectors for Sidebar
**File:** `src/features/calendar/components/Sidebar.tsx`

Subscribes to `events` — any event change re-renders the entire Sidebar.

**Fix:** Remove `events` selector, use `calendars` only. Risk: Sidebar might need event data for category counts or other features. Verify no downstream usage.

---

## Tier 3 — Medium Risk (architecture changes, migration needed)

### 25. Move `applyAutoCategories` keyword map to a derived selector
**File:** `src/store/calendarStore.ts` lines ~530-550

Related to #20 but at the store level — the map should be derived from `autoCategoryRules` + `categories`.

**Fix:** Create a Zustand derived selector or a `useMemo` in the consuming component. Risk: selector timing — must rebuild when rules/categories change, not on every render.

---

### 26. Cache recurrence expansion in `getEventsForDateRange`
**File:** `src/store/calendarStore.ts` lines ~290-450

Every call re-parses all rrule strings and calls `rule.between()`. 50 recurring events = 50 rrule parses per render.

**Fix:** Cache expanded occurrences keyed by `rruleString + startDate + endDate`. Invalidate when events change. Risk: cache invalidation is hard. Stale cached data = wrong events shown. Edge cases with excluded dates, recurrence IDs, and exceptions.

---

### 27. Cache parsed start/end dates in `getEventsForDateRange`
**File:** `src/store/calendarStore.ts` lines ~290-350

`parseISO()`, `startOfDay()`, `endOfDay()` created fresh every call.

**Fix:** Memoize based on the input strings. Risk: if the same date string is passed but with different timezone semantics (UTC vs local), caching could return wrong results.

---

### 28. Memoize `useGestures` return value
**File:** `src/hooks/useGestures.ts`

The `bind` object is recreated every render. This means every component using `useGestures` re-renders its children unnecessarily.

**Fix:** Wrap `bind` in `useMemo`. Risk: the `bind` object contains event handlers that reference refs. If the ref values change but `bind` is memoized, stale behavior could occur. Need to verify the ref-based approach handles this correctly.

---

### 29. Extract CalendarGrid into separate components
**File:** `src/features/calendar/components/CalendarGrid.tsx`

The entire grid is rendered twice — once for `isTallWindow` layout, once for normal.

**Fix:** Extract a `MonthGrid` component and render conditionally. Risk: JSX structure changes, state sharing between layouts, event handler wiring.

---

### 30. Wrap `WeekView.DroppableCell` in `React.memo`
**File:** `src/features/calendar/components/WeekView.tsx`

Similar to CalendarGrid's DroppableDay — every cell re-renders on any event change.

**Fix:** Same as #13. Risk: same stale prop concerns. WeekView cells have hourHeight, onClick, onMouseDown as props — need to verify stability.

---

### 31. Virtualize AgendaView
**File:** `src/features/calendar/components/AgendaView.tsx`

Renders all events at once. No windowing for large lists.

**Fix:** Add `react-window` or `react-virtual`. Risk: new dependency, layout changes, scroll position management, interaction with existing features (context menus, drag).

---

### 32. Pre-compute `positionEvents` column assignments
**File:** `src/lib/eventPositioning.ts` lines ~40-60

O(n²) overlap calculation. For 100 events, ~10,000 iterations.

**Fix:** Use sweep-line algorithm or interval tree. Risk: algorithm correctness — wrong column assignments = visual misalignment.

---

### 33. Optimize `applyAutoCategories` with pre-built map
**File:** `src/store/calendarStore.ts` lines ~530-550

Related to #20/#25 but with the full optimization path.

**Fix:** Build `Map<lowercaseKeyword, categoryId[]>` at rules change time, then O(1) lookups per event title. Risk: keyword matching semantics change (case sensitivity, partial vs exact match).

---

## Tier 4 — High Risk (storage migration, breaking changes)

### 34. Move attachments from localStorage to IndexedDB
**Files:** `src/types/index.ts`, `src/store/calendarStore.ts`, `src/features/caldav/adapter/icalTypeMapping.ts`

Base64 attachments in zustand persist → localStorage can blow the 5-10MB quota.

**Fix:** Move attachment storage to IndexedDB. Keep event references in localStorage. Risk: **migration of existing data**, two storage backends, async reads for attachments, breaking changes to CalendarAttachment interface.

---

### 35. Extract EventModal into smaller components
**File:** `src/features/calendar/components/EventModal.tsx`

The modal has become large with attachment handling, form fields, recurrence dialog, delete dialog, and CalDAV sync logic all in one component.

**Fix:** Extract `AttachmentSection`, `FormFooter`, `CalDAVSyncStatus`. Risk: state management across components, props drilling, modal close behavior.

---

## Summary

| Tier | Count | Description |
|------|-------|-------------|
| Tier 1 — Safe | 11 | Pure additions, zero behavior change |
| Tier 2 — Low Risk | 13 | Minor logic changes, easily verifiable |
| Tier 3 — Medium Risk | 9 | Architecture changes, need testing |
| Tier 4 — High Risk | 2 | Storage migration, breaking changes |

## Recommended Execution Order

**Phase 1 (do first, no review needed):**
- Tier 1: #1–#11 — All safe, can be batched into one commit

**Phase 2 (quick wins with low risk):**
- Tier 2: #12–#24 — One at a time, verify each with test suite

**Phase 3 (bigger changes, need testing):**
- Tier 3: #25–#33 — One at a time, manual testing required

**Phase 4 (only when needed):**
- Tier 4: #34–#35 — Plan separately, full regression test
