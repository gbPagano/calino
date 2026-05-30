# Plan: Code Quality Improvements

## Phase 1: Toast System

- [ ] **T1** — Create `src/lib/toast.ts` with `showToast(message: string)` utility (wraps the CustomEvent dispatch)
- [ ] **T2** — Create `src/hooks/useToast.ts` hook that listens for toast events and manages state (for components that want to render a toast component instead of relying on App.tsx listener)
- [ ] **T3** — Replace all 28 `window.dispatchEvent(new CustomEvent('show-toast', ...))` calls with `showToast()` across EventCard, WeekView, DayView, AgendaView, EventPreviewPopup, EventModal, CalendarGrid

## Phase 2: CalDAV Error Handling

- [ ] **C1** — Create `src/lib/caldavHelpers.ts` with `safeCalDAVOperation` wrapper that handles try/catch + showToast + returns success boolean
- [ ] **C2** — Create `src/lib/caldavHelpers.ts` with `safeCalDAVUpdate` and `safeCalDAVDelete` convenience functions for the two most common patterns
- [ ] **C3** — Refactor EventCard (checkbox toggle, convert type, delete) to use shared helpers
- [ ] **C4** — Refactor WeekView `handleDragEnd` to use shared helpers
- [ ] **C5** — Refactor DayView drag handler to use shared helpers
- [ ] **C6** — Refactor EventPreviewPopup delete/toggle handlers to use shared helpers
- [ ] **C7** — Refactor AgendaView delete handler to use shared helpers

## Phase 3: EventModal Decomposition

- [ ] **E1** — Extract `getInitialFormState` + `buildEventFromForm` into `src/features/calendar/components/EventModal/formUtils.ts`
- [ ] **E2** — Extract validation logic (`validateForm`) into `src/features/calendar/components/EventModal/validateForm.ts`
- [ ] **E3** — Create `useEventForm` hook in `src/features/calendar/components/EventModal/useEventForm.ts` (manages form state, validation, save)
- [ ] **E4** — Simplify EventModal.tsx to ~300-400 lines (just render, delegates logic to hook + utils)

## Phase 4: CalendarGrid Cleanup

- [ ] **G1** — Extract month-view-specific logic (cell click, drag-to-create, event positioning) into `src/features/calendar/components/CalendarGrid/monthViewUtils.ts`
- [ ] **G2** — Extract context menu handler and keyboard navigation into separate concerns
- [ ] **G3** — Simplify CalendarGrid to ~500 lines

## Phase 5: Keyboard Click Helper

- [ ] **K1** — Create `src/lib/keyboardClick.ts` with `handleKeyboardClick(e, handler)` that types `React.KeyboardEvent` → `React.MouseEvent` bridge properly
- [ ] **K2** — Replace all `e as unknown as React.MouseEvent` usages in EventCard, AgendaView

## Phase 6: Verify

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:run` passes (no new failures)
- [ ] `pnpm lint` passes

---

## Out of Scope (Future)

- **CalendarStore `getEventsForDateRange`** — Extract recurrence expansion to pure utility. High effort, high risk of regressions. Worth doing but needs careful testing.
- **useCalDAV hook (893 lines)** — Could be split into sub-hooks, but tightly coupled to CalDAV state machine. Leave for a dedicated refactor.
- **EventPreviewPopup (797 lines)** — Large but self-contained. Low priority.
