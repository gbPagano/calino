# Plan: CalDAV Sync Fixes & Code Quality Improvements

**Last updated:** 2026-05-25
**Session commits:** `df07c0a` → `a6084a5` → `145eeef` → `99496e6` → `4903951`

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
| 2 | **Data Loss** | ✅ FIXED — `syncAccount` now only deletes local events whose start date falls within the queried date range (1970..+365d). Events outside this range are preserved. | `useCalDAV.ts` |
| 3 | **A11Y** | Calendar grid cells are `div`s with `onClick` — zero keyboard access. Also: AgendaView, TodoView, DayEventsPopup, EventCard dragContent | Multiple views |

### 🟠 High — Fix soon

| # | Category | Issue | File |
|---|----------|-------|------|
| 14 | Security | Settings export leaks server URLs + usernames in JSON download | `DataSettings.tsx` |
| 15 | PWA | Cache-first service worker never updates — users see stale app indefinitely | `sw.js:19-36` |
| 16 | PWA | Notifications use polling, not Push API — only works while tab open | `useNotifications.ts` |
| 18 | Bug | ✅ FIXED — Effect no longer depends on `initialState`. Reads fresh state via `getState()` when `selectedEventId`/`selectedDate` change, preventing form resets during background CalDAV sync. | `EventModal.tsx` |
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

## Phase 4: Implementation Plan (Next Session)

### Task P-1: Calendar Grid Keyboard Access (#3) 🅰️1️⃣1️⃣Y️⃣

**Goal:** Every interactive element in the calendar UI is keyboard-accessible via Enter/Space and has visible focus indicators.

**Step 1: Add `:focus-visible` CSS rules to all 5 CSS modules**
- [ ] `CalendarGrid.module.css` — add focus ring to `.day:focus-visible`, `.dayNumber:focus-visible`, `.moreEvents:focus-visible` matching hover background + 2px blue outline
- [ ] `AgendaView.module.css` — add focus ring to `.agendaEvent:focus-visible`, `.agendaTask:focus-visible`
- [ ] `TodoView.module.css` — add focus ring to `.taskRow:focus-visible`
- [ ] `DayEventsPopup.module.css` — add focus ring to `.eventItem:focus-visible`
- [ ] `EventCard.module.css` — add focus ring to `.card:focus-visible`, `.dragContent:focus-visible`, `.checkbox:focus-visible`

**Step 2: Fix easy components (no dnd-kit) — `role="button" tabIndex={0} onKeyDown`**
- [ ] `DayEventsPopup.tsx:64` — `.eventItem` div: add `role="button" tabIndex={0} onKeyDown` for Enter/Space
- [ ] `CalendarGrid.tsx:555` — day number `<span>`: convert to `<button>` with `onKeyDown` Enter → `onDayNumberClick(day)`
- [ ] `CalendarGrid.tsx:583` — "more events" div: convert to `<button>` with Enter/Space → `handleMoreEventsClick`
- [ ] `AgendaView.tsx:276` and `:250` — event/task divs: convert `onMouseDown` → `onClick`, add `role="button" tabIndex={0} onKeyDown`
- [ ] `TodoView.tsx:97` — task row div: add `role="button" tabIndex={0} onKeyDown` Enter/Space → `handleTaskClick`
- [ ] `EventCard.tsx:213` — checkbox div: convert to `<button>` with `aria-label="Toggle completion"`

**Step 3: Fix DroppableDay (has dnd-kit useDroppable)**
- [ ] `CalendarGrid.tsx:550` — add `role="button" tabIndex={0}` and `onKeyDown` handler for Enter/Space → `onDayClick(day)` alongside existing `onClick`. **Do NOT** convert to `<button>` element (dnd-kit pointer events would double-fire). Keep as `<div>` with ARIA role.

**Step 4: Fix EventCard dragContent (has dnd-kit useDraggable)**
- [ ] `EventCard.tsx:219` — dnd-kit's `attributes` already set `role="button"` and `tabIndex`. Add explicit `onKeyDown` handler: Enter/Space → `handleClick` (synthesized as MouseEvent)
- [ ] Verify dnd-kit's keyboard drag support (Space for drag, Arrow keys to move) still works after adding Enter handler

- [ ] Commit: `fix(a11y): add keyboard access to calendar grid, agenda, todo, popups, and event cards`

---

### Task P-2: Encrypt CalDAV Passwords at Rest (#1) 🔒

**Goal:** Passwords are never stored as plaintext in `localStorage`. Uses Web Crypto API AES-256-GCM with origin-derived key.

**Step 1: Create encryption module**
- [ ] Create `src/features/caldav/client/crypto.ts`:
  - `getEncryptionKey()`: derive AES-256-GCM key from `window.location.origin` + hardcoded salt `"calino-caldav-creds-v1"` via PBKDF2 (600k iterations, SHA-256), cached in module scope
  - `encryptPassword(plaintext: string): Promise<string>`: encrypt with random 12-byte IV → return JSON `{iv, data}` as base64
  - `decryptPassword(encrypted: string): Promise<string>`: parse JSON → decrypt → return plaintext
- [ ] Write tests in new `src/features/caldav/client/__tests__/crypto.test.ts`:
  - encrypt-then-decrypt roundtrip
  - different ciphertext each time (IV randomization)
  - tampered ciphertext throws
  - same origin produces same key (deterministic derivation)

**Step 2: Modify credentials.ts**
- [ ] Split into private sync helpers (`getAllCredentialsSync` — returns encrypted form) and public async API
- [ ] `saveCredentials()` → encrypt password before `localStorage.setItem`
- [ ] `getCredentialById()` → decrypt password after `JSON.parse`, return plaintext in-memory
- [ ] `getAllCredentials()` → decrypt all passwords
- [ ] `deleteCredential()`, `updateCredential()` → no encryption change but become async for consistency
- [ ] All public functions become `Promise`-returning

**Step 3: Update all callers in useCalDAV.ts**
- [ ] Add `await` to 7 call sites: `saveCredentials` (line 194), `getCredentialById` (lines 96, 344, 507, 578, 646), `deleteCredential` (line 321)
- [ ] Callers are already in `async` functions — no signature changes needed

**Step 4: Update tests**
- [ ] `useCalDAV.test.ts`: mock `saveCredentials`/`getCredentialById` → `mockResolvedValue`/`mockRejectedValue` instead of sync `mockReturnValue`
- [ ] `CalDAVClient.test.ts`: no changes (bypasses credentials module, uses plaintext directly)

**Step 5: Update Privacy Policy**
- [ ] `PrivacyPolicy.tsx:79`: change claim from "encrypted only in your browser" to "encrypted at rest in your browser"

- [ ] Commit: `feat(security): encrypt CalDAV passwords at rest with Web Crypto AES-256-GCM`

---

### Task P-3: WeekView Memoization (#9) ⚡

**Goal:** `renderDayEvents` (135-line closure) doesn't re-run when unrelated state changes (scroll, context menu, drag-create). Extracts into `React.memo(WeekDayColumn)`.

**Step 1: Create WeekDayColumn component**
- [ ] Create `src/features/calendar/components/WeekDayColumn.tsx`:
  - Props: `{ day, events, fragments, calendars, hourHeight, openModal }`
  - Move lines 443–578 (`renderDayEvents` body) into component
  - Wrap with `React.memo(WeekDayColumn)` for shallow prop comparison
  - Import `EventCard`, `CalendarEvent` type, `parseISO`, `format`, etc.

**Step 2: Add dayColumnProps useMemo in WeekView**
- [ ] In `WeekView.tsx`, add `useMemo` that pre-computes props for all 7 days:
  ```ts
  const dayColumnProps = useMemo(() =>
    weekDays.map(day => {
      const dk = format(day, 'yyyy-MM-dd')
      return { day, events: eventsMap.get(dk)||[], fragments: timedFragmentsMap.get(dk)||[], calendars, hourHeight, openModal }
    }), [weekDays, eventsMap, timedFragmentsMap, calendars, hourHeight, openModal])
  ```

**Step 3: Replace callsites**
- [ ] Line 698 (`renderMobileContent`): replace `{renderDayEvents(day)}` → `<WeekDayColumn {...dayColumnProps[idx]} />`
- [ ] Line 799 (`renderDesktopContent`): same replacement
- [ ] Remove the `renderDayEvents` closure function definition (lines 443–578)

- [ ] Commit: `perf(weekview): extract renderDayEvents into React.memo(WeekDayColumn)`

---

### Task P-4: Debounce Search Index Rebuild (#23) ⚡

**Goal:** Fuse.js search index isn't rebuilt synchronously on every `events` array mutation. Uses 500ms debounce inline with existing pattern.

**Step 1: Add debounce to useSearch**
- [ ] In `src/features/search/hooks/useSearch.ts`, modify the index effect:
  ```ts
  // Before (line 31-33):
  useEffect(() => { updateSearchIndex(events) }, [events])
  
  // After:
  const indexTimerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    clearTimeout(indexTimerRef.current)
    indexTimerRef.current = setTimeout(() => updateSearchIndex(events), 500)
    return () => clearTimeout(indexTimerRef.current)
  }, [events])
  ```
- [ ] Add `useRef` import if not already imported

**Step 2: Verify edge cases**
- [ ] Initial page load: events set once → 500ms → single index build
- [ ] Bulk import/sync: timer resets on each events change, only final state is indexed
- [ ] Unmount: cleanup prevents stale index updates
- [ ] Empty events: still rebuilds (Fuse no-op, but timer correctly managed)

- [ ] Commit: `perf(search): debounce Fuse.js index rebuild by 500ms`

---

### Task P-5: Fix Service Worker Stale Cache (#15) 📱

**Goal:** Service worker uses network-first for navigation (HTML shell) so users always see the latest app version. Hashed assets remain cache-first.

**Step 1: Replace sw.js caching strategy**
- [ ] Edit `public/sw.js` — replace the fetch handler (lines 29–50) and install precache (lines 1–14):
  - Change `CACHE_NAME` to `'calino-v6'`
  - Remove `/` and `/index.html` from `STATIC_ASSETS` precache (they'll be network-first cached)
  - Add navigation check: `if (request.mode === 'navigate')` → network-first with cache fallback
  - Keep cache-first for everything else (hashed JS/CSS assets)
  - Keep existing `notificationclick` handler unchanged

**Step 2: (Optional) Add update detection in main.tsx**
- [ ] In `src/main.tsx`, add `updatefound` listener to `navigator.serviceWorker.register()`:
  - When new SW installs (state = 'installed' and controller exists), dispatch `show-toast` event: "New version available — refresh to update"

- [ ] Commit: `fix(pwa): network-first navigation to prevent stale app cache`

---

### Verification

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:run` — all 381+ tests pass
- [ ] `pnpm build` produces all chunks without errors
- [ ] `pnpm lint` — only pre-existing issues remain
- [ ] Manual: Tab through calendar grid with keyboard → day cells highlight and open on Enter
- [ ] Manual: Check localStorage → `calino_caldav_credentials` contains encrypted blobs, not plaintext
- [ ] Manual (PWA): `pnpm build && pnpm preview` → reload app → verify fresh content loads (no stale cache)

---

# Plan: pi-plan-viewer — Browser-Based PLAN.md Viewer

**Goal:** A Pi package that auto-opens a browser tab with a visual, interactive view of PLAN.md when Pi finishes writing a plan. Supports checkbox toggling, drag-to-reorder, and inline editing, synced back to PLAN.md.

**Approach:** A Pi extension that hooks `tool_execution_end` (for `write` on `PLAN.md`) and `agent_end` to auto-detect plan completion. It starts a local HTTP server (Node.js `http`, zero npm deps), opens the browser via `open`/`start`/`xdg-open`, and serves an SPA that parses the PLAN.md markdown structure into interactive task cards. A file watcher pushes live updates when Pi modifies the file.

**Critical Files (new package):**
- `~/pi-plan-viewer/package.json`: Pi package manifest with `pi.extensions` and `pi-package` keyword
- `~/pi-plan-viewer/extensions/index.ts`: Extension: `/plan-view` command, `tool_execution_end` hook, HTTP server lifecycle
- `~/pi-plan-viewer/web/index.html`: SPA shell (minimal, loads JS/CSS)
- `~/pi-plan-viewer/web/app.js`: Client: PLAN.md parser, task card renderer, drag-drop, inline edit, fetch API
- `~/pi-plan-viewer/web/styles.css`: Visual styling: cards, progress bars, status badges, dark/light support

## Architecture

```
┌─ Pi Agent ─────────────────────────────────────┐
│                                                 │
│  tool_execution_end                             │
│  (write → PLAN.md) ──► flag = true              │
│                                                 │
│  agent_end ──► if flag: start HTTP server       │
│                         │                       │
│                         ▼                       │
│               ┌─────────────────────┐           │
│               │  localhost:PORT     │           │
│               │                     │           │
│               │  GET  /api/plan ──► read  PLAN.md
│               │  PUT  /api/plan ──► write PLAN.md
│               │  SSE  /api/watch──► fs.watch    │
│               │  GET  / ─────────► web/ files   │
│               └──────┬──────────────┘           │
│                      │                          │
└──────────────────────┼──────────────────────────┘
                       │ HTTP
              ┌────────▼──────────┐
              │   Browser Tab     │
              │                   │
              │  Task Cards UI    │
              │  ☑ toggle         │
              │  ⇅ drag reorder   │
              │  ✎ inline edit    │
              │  📊 progress bar  │
              └───────────────────┘
```

## Tasks

### Task 1: Package scaffolding
- [ ] Create `~/pi-plan-viewer/package.json` with `name`, `keywords: ["pi-package"]`, `pi.extensions: ["./extensions"]`, and `peerDependencies` for `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`
- [ ] Create directory structure: `extensions/`, `web/`
- [ ] Commit: `feat(pi-plan-viewer): scaffold package`

### Task 2: Extension — command and server skeleton
- [ ] Create `~/pi-plan-viewer/extensions/index.ts`:
  - Import `ExtensionAPI` from `@earendil-works/pi-coding-agent` and `Type` from `typebox`
  - Register `/plan-view` command that calls `startServer()`
  - Implement `startServer()` using `node:http.createServer`:
    - Find a free port (bind to port 0, read assigned port from `server.address()`)
    - Route requests: `/api/plan` (GET/PUT), `/api/watch` (SSE), `/` → serve `web/index.html`, `web/app.js`, `web/styles.css`
    - Store server handle, port, and file watcher in module-level variables
  - Implement `stopServer()` to close server + file watcher
  - Register `session_shutdown` handler that calls `stopServer()`
  - Use `child_process.exec` to open browser (`open` on darwin, `start ""` on win32, `xdg-open` on linux)
- [ ] Commit: `feat(pi-plan-viewer): extension with /plan-view command and HTTP server`

### Task 3: Extension — auto-detect plan completion
- [ ] In `extensions/index.ts`, add module-level flag `planJustWritten = false`
- [ ] Hook `tool_execution_end` event: if `event.toolName === 'write'` and `event.input.path` ends with `PLAN.md`, set `planJustWritten = true`
- [ ] Hook `agent_end` event: if `planJustWritten`, call `startServer()`, reset `planJustWritten = false`
- [ ] Prevent duplicate server: check if server is already running before starting; if running, just re-open browser
- [ ] Commit: `feat(pi-plan-viewer): auto-detect plan completion and open browser`

### Task 4: Web UI — PLAN.md parser
- [ ] Create `~/pi-plan-viewer/web/app.js`:
  - Implement `parsePlan(markdown)` function that returns structured data:
    - `header`: plan name (from `# Plan: ...`), goal, approach (from `**Goal:**`/`**Approach:**` lines)
    - `criticalFiles`: array of `{path, description}` from bullet list under `**Critical Files:**`
    - `phases`: array of `{title, status, tasks: [{text, checked, commit}]}` parsed from `## Phase ...` headings and `- [ ]` / `- [x]` checkboxes
  - Implement `serializePlan(data)` function that reconstructs valid PLAN.md markdown from structured data, preserving exact formatting of header/critical files sections
  - Handle edge cases: plan without phases, tasks without commits, incomplete checkbox lines
- [ ] Commit: `feat(pi-plan-viewer): PLAN.md parser and serializer`

### Task 5: Web UI — task card renderer
- [ ] In `app.js`, implement `renderPlan(data, container)`:
  - Header bar: plan name, overall progress bar (`completed tasks / total tasks`), colored status pill
  - For each phase: collapsible card with phase title, status badge, task list
  - Each task: checkbox (styled div, visually hidden input), task text (strikethrough if checked), commit badge if present
  - Apply colors: green for complete, amber for partial/in-progress, red for pending critical, gray for pending
  - Responsive layout: single column on narrow, two-column grid on wide viewports
- [ ] Create `~/pi-plan-viewer/web/styles.css`:
  - CSS custom properties for theming (supports light/dark via `prefers-color-scheme`)
  - Card styles: border-radius, shadows, hover effects
  - Progress bar: animated fill, percentage label
  - Checkbox: custom styled, smooth transition on toggle
  - Drag states: `dragging` class with opacity + border highlight, drop zone indicator
  - Inline edit: textarea styling that matches task text
- [ ] Create `~/pi-plan-viewer/web/index.html`: minimal shell that links `styles.css`, loads `app.js`, has `<div id="app">` mount point
- [ ] Commit: `feat(pi-plan-viewer): task card renderer and styles`

### Task 6: Web UI — checkbox toggle (sync to PLAN.md)
- [ ] In `app.js`, add click handler on checkboxes:
  - Toggle `checked` state in parsed data
  - Add CSS strikethrough + color transition
  - Update progress bar immediately (optimistic)
  - Call `PUT /api/plan` with serialized markdown via `fetch()`
  - On error: revert checkbox, show inline error toast
- [ ] In `extensions/index.ts`, implement `PUT /api/plan` handler:
  - Read request body as string
  - Write to `PLAN.md` at `ctx.cwd` (resolve path relative to session cwd)
  - Return 200 on success, 500 on error
- [ ] Commit: `feat(pi-plan-viewer): checkbox toggle with sync to PLAN.md`

### Task 7: Web UI — drag-to-reorder tasks
- [ ] In `app.js`, implement HTML5 Drag and Drop:
  - Set `draggable="true"` on task elements
  - `dragstart`: store dragged task index + phase index in `dataTransfer`, add `dragging` class
  - `dragover`: prevent default, calculate drop position (before/after based on cursor Y relative to target midpoint), show drop indicator line
  - `drop`: reorder tasks in parsed data array, re-render, serialize and PUT to server
  - `dragend`: remove `dragging` class and drop indicators
- [ ] Handle edge: dropping task into different phase (move across phases)
- [ ] Commit: `feat(pi-plan-viewer): drag-to-reorder tasks`

### Task 8: Web UI — inline task editing
- [ ] In `app.js`, add double-click handler on task text:
  - Replace text with `<textarea>` pre-filled with current text
  - Auto-focus, select all, resize textarea to fit content
  - On Enter (no shift): save edit, serialize, PUT to server
  - On Escape: cancel edit, restore original text
  - On blur: save edit (same as Enter)
- [ ] Support editing task text, not just toggling checkbox
- [ ] Commit: `feat(pi-plan-viewer): inline task editing`

### Task 9: Extension — live reload via file watcher
- [ ] In `extensions/index.ts`, implement `GET /api/watch` as Server-Sent Events:
  - Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - Start `fs.watch(planPath)` on the PLAN.md file
  - On `change` event: debounce 200ms, read file, send `data: <content>` SSE event
  - On client disconnect (`req.on('close')`): close watcher, end response
  - Keepalive: send `: ping` comment every 15 seconds
- [ ] In `app.js`, connect to `/api/watch` EventSource on load:
  - On `message` event: re-parse PLAN.md, diff with current state, re-render only changed parts
  - On error: reconnect after 1 second backoff
- [ ] Handle edge: file deleted externally → show "PLAN.md not found" state
- [ ] Commit: `feat(pi-plan-viewer): live reload via SSE file watcher`

### Task 10: Extension — server lifecycle and edge cases
- [ ] Ensure server uses `127.0.0.1` (localhost) only, not `0.0.0.0`, for security
- [ ] Add `ctx.ui.notify()` calls: "Plan viewer opened → http://localhost:PORT" on start, "Plan viewer closed" on stop
- [ ] Handle `EPERM` / `EADDRINUSE` errors gracefully with toast notifications
- [ ] Stop server on `session_shutdown` (all reasons: quit, reload, new, resume, fork)
- [ ] Register a `/plan-view close` argument to stop server without quitting Pi
- [ ] If browser open fails (`ENOENT` on the open command), show URL in a toast so user can copy-paste
- [ ] Commit: `fix(pi-plan-viewer): server lifecycle and edge cases`

### Task 11: Manual testing
- [ ] Install the package locally: `pi install ~/pi-plan-viewer`
- [ ] Create a sample `PLAN.md` in a test directory, run `pi` there
- [ ] Test flow 1: Agent writes to PLAN.md → browser auto-opens → verify tasks rendered correctly
- [ ] Test flow 2: Click checkbox → verify PLAN.md updated on disk → verify re-render
- [ ] Test flow 3: Drag task to new position → verify order in PLAN.md → refresh browser → verify persisted
- [ ] Test flow 4: Double-click task → edit text → Enter → verify PLAN.md updated
- [ ] Test flow 5: `/plan-view` command opens browser when no auto-detect triggered
- [ ] Test flow 6: Close browser tab → `/plan-view` reopens to existing server
- [ ] Test flow 7: Session end / Pi quit → verify server stops (no lingering process)
- [ ] Commit: `test(pi-plan-viewer): manual verification checklist`

### Task 12: README and publish prep
- [ ] Create `~/pi-plan-viewer/README.md`:
  - Installation: `pi install <source>`
  - Usage: auto-opens on plan, or `/plan-view`
  - Screenshot (placeholder or real)
  - Requirements: Pi >= current version
- [ ] Add `"pi-package"` to `package.json` keywords
- [ ] Commit: `docs(pi-plan-viewer): README and metadata`
