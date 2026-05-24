# Plan: Fix Silent CalDAV Sync Failures

**Goal:** Every create, update, and delete operation reliably reaches the CalDAV server, and users are notified when sync fails.
**Approach:** Fix the race condition in `useCalDAV` by reading account/calendar from localStorage instead of React state. Add missing CalDAV calls in AgendaView and EventCard. Add user-facing error feedback. Implement pending-queue processing so failed operations are retried.

**Critical Files:**
- `src/features/caldav/hooks/useCalDAV.ts`: Core fix — bypass React state for account/calendar lookups, add `processPendingChanges`
- `src/features/calendar/components/AgendaView.tsx`: Missing CalDAV delete call
- `src/features/calendar/components/EventCard.tsx`: Fire-and-forget delete + missing recurrence sync
- `src/features/calendar/components/EventModal.tsx`: Empty catch blocks — add error feedback

---

## Tasks

### Task 1: Fix Race Condition — Read Accounts/Calendars from localStorage
- [ ] In `src/features/caldav/hooks/useCalDAV.ts`, inside `createEvent` (line ~249), `updateEventFn` (line ~305), and `deleteEventFn` (line ~358), replace the `calendars.find()` / `accounts.find()` lookups with calls to `storage.getAllAccounts()` and `storage.getAllCalendars()` (already imported). These read directly from localStorage, so they always return data regardless of whether the React `useEffect` has fired yet.
- [ ] Remove the now-unnecessary dependency on `accounts` and `calendars` state from the `useCallback` dependency arrays for these three functions.
- [ ] Commit: `fix(caldav): read accounts/calendars from localStorage to avoid race condition`

### Task 2: Add User-Facing Error Feedback
- [ ] In `src/features/calendar/components/EventModal.tsx`, in every `catch { }` block (lines ~471, ~490, ~548, ~598, ~625), dispatch a `show-toast` CustomEvent with a user-friendly message: `"Failed to sync event with CalDAV server. It will be retried."`. Use the existing pattern:
  ```ts
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: { message: 'Failed to sync event with CalDAV server. It will be retried.' }
  }))
  ```
- [ ] In `src/features/calendar/components/EventCard.tsx`, in the `handleCheckboxClick` catch block (line ~245), add the same toast. In the non-recurring delete path (line ~364-365), change `deleteCalDAVEvent(event.calendarId, event.id).catch(() => {})` to `await deleteCalDAVEvent(...)` inside a try/catch with the same toast.
- [ ] In `src/features/caldav/hooks/useCalDAV.ts`, in the `if (!calendar || !account)` guard blocks, add a `console.warn` with details about what's missing, and dispatch the same toast via a custom event (or throw an error that the caller can surface).
- [ ] Commit: `fix(caldav): show toast notification on CalDAV sync failures`

### Task 3: Add CalDAV Delete to AgendaView
- [ ] In `src/features/calendar/components/AgendaView.tsx`, import `useCalDAV` from `@/features/caldav/hooks/useCalDAV`.
- [ ] Destructure `deleteEvent: deleteCalDAVEvent` from `useCalDAV()`.
- [ ] In the Delete context menu item handler (line ~350), add a CalDAV sync call after the store delete. The delete handler should:
  1. Call `deleteEvent(eventContextMenu.event.id)` (already exists)
  2. Await `deleteCalDAVEvent(eventContextMenu.event.calendarId, eventContextMenu.event.id)` in a try/catch
  3. On failure, dispatch the `show-toast` custom event
- [ ] Make the `onClick` handler async to support the await.
- [ ] Commit: `fix(caldav): add CalDAV delete sync to AgendaView`

### Task 4: Add CalDAV Sync to EventCard Recurrence Delete
- [ ] In `src/features/calendar/components/EventCard.tsx`, in the `DeleteDialog`'s `onConfirm` handler (lines ~385-399), add CalDAV sync calls:
  - For `mode === 'this'`: after `updateEvent(originalEventId, ...)`, call `updateCalDAVEvent(calendarId, { ...masterEvent, excludedDates: [...] })` in a try/catch with error toast
  - For `originalEventId` branch: after `deleteEvent(originalEventId)`, call `deleteCalDAVEvent(event.calendarId, originalEventId)` in try/catch
  - For the fallback: after `deleteEvent(event.id)`, call `deleteCalDAVEvent(event.calendarId, event.id)` in try/catch
- [ ] Make the `onConfirm` handler async.
- [ ] Commit: `fix(caldav): add CalDAV sync to EventCard recurrence deletes`

### Task 5: Implement Pending-Queue Retry Processing
- [ ] In `src/features/caldav/hooks/useCalDAV.ts`, add a new function `processPendingChanges` that:
  1. Reads pending changes from `storage.getPendingChanges()`
  2. For each change, calls the appropriate CalDAV function (create/update/delete) using `storage.getAllAccounts()` and `storage.getAllCalendars()` for lookups
  3. On success: calls `storage.removePendingChange(change.id)` and decrements `syncState.pendingChanges`
  4. On failure: calls `storage.updatePendingChangeRetry(change.id)` (tracks retry count), does not re-throw
  5. Logs a summary of succeeded/failed counts to console (always, not just debug mode)
- [ ] Call `processPendingChanges()` from:
  - The existing `useEffect` in useCalDAV (after accounts/calendars are loaded, line ~92)
  - A new `useEffect` that runs on a 30-second interval (using `setInterval`, cleaned up on unmount)
  - After any successful `createEvent`, `updateEvent`, or `deleteEvent` call (right after `storage.updateAccountLastSync`)
  - After `syncAccount` and `syncAll` complete successfully
- [ ] Export `processPendingChanges` (or queue size) so the settings UI can show a "Retry pending changes" button, if desired. **Skip the UI button for now — keep scope minimal.**
- [ ] Commit: `feat(caldav): implement pending-queue retry processing`

### Task 6: Verify with Manual Testing
- [ ] Run `pnpm dev`
- [ ] Create an event and verify it appears on both local GUI and CalDAV server (check server web UI or logs)
- [ ] Delete the event from EventModal and verify it's removed from the CalDAV server
- [ ] Delete an event from AgendaView context menu and verify it syncs to server
- [ ] Delete a non-recurring event from EventCard context menu and verify it syncs
- [ ] If possible, test with CalDAV debug mode off to ensure no regressions in the silent-return fix
- [ ] Run `pnpm typecheck` to ensure no TypeScript errors
- [ ] Run `pnpm test` to ensure existing tests still pass
- [ ] Commit: `chore: manual verification notes`
