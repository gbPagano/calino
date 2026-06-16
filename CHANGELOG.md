# Changelog

All notable changes to Calino will be documented in this file.

## [0.14.0] - 2026-06-14

### New Features
- **Attendees** — add, edit, and remove attendees on events with email validation and duplicate prevention. Each attendee shows a color-coded status badge (Accepted, Declined, Tentative, Pending, Delegated). The organizer is displayed as a read-only badge. The section is hidden by default to save space — click "+ Attendees" to expand it. Attendees sync bidirectionally through CalDAV.
- **Recurring tasks** — tasks now support recurrence (daily, weekly, monthly, yearly) with the same controls as events: custom intervals, weekday/month pickers, and end conditions.
- **Subtasks** — tasks can now have children. Click the "+" button on any task row to create a subtask. Subtasks render indented under their parent in the task list. Parent-child relationships sync through CalDAV via `RELATED-TO` with `RELTYPE=PARENT`.
- **Keyboard shortcuts help** — press `?` anywhere to see all available keyboard shortcuts.
- **Empty states** — Day, Agenda, and Journal views now show helpful empty states when there's nothing to display.
- **URL field** — events now have a "Link" field in the "More" section for storing a URL. It round-trips through CalDAV and is parsed from imported ICS files.

### Improvements
- **Task attachments** — tasks now support file attachments, matching the event editor's attachment section.
- **Inline task creation** — pressing Enter in the task composer now creates the task immediately instead of opening the full editor modal.
- **Form validation** — attempting to save an event with an end time before the start time now shows a toast instead of silently dropping the save.
- **Reduced motion support** — animations respect the system `prefers-reduced-motion` setting via CSS media queries and framer-motion configuration.
- **Smaller bundle** — the main JavaScript bundle is split into per-library chunks, reducing the initial load from ~1.6 MB to ~360 kB.

### Fixes
- **Drag-to-create accuracy** — dragging to create events in WeekView and DayView now correctly tracks the mouse position, accounting for scroll offset and hour height scaling. Previously the selection rectangle would drift away from the cursor.
- **Attachment removal UX** — removing an attachment now uses an inline confirmation pill instead of a browser `confirm()` dialog.
- **CalDAV import warnings** — fixed Vite build warnings caused by dynamic imports in the CalDAV sync hook.
- **Lint cleanup** — reduced lint warnings from 32 to 15 by fixing missing hook dependencies, wrapping unstable callbacks, and removing dead code.

### Internal
- CI now runs the full test suite on every push.
- Dependabot configured for npm, GitHub Actions, and Docker dependencies.
- 24 new tests (AttendeeSection, icalTypeMapping attendee round-trip, EmptyState, useReducedMotion, ShortcutsHelp).

## [0.13.1] - 2026-06-14

### Improvements
- **Closing animations for modals** — both the event preview popup and the full event editor now have smooth fade-out animations when dismissed.
- **NLP time range parsing** — typing "hang out at 16 to 17" or "meeting from 3pm to 5pm" now correctly creates a 1-hour event at the right times, instead of ignoring the end time.
- **NLP title cleanup** — duration phrases like "for 2 hours" are now stripped from event titles ("meeting at 3pm for 2 hours" → "Meeting", not "Meeting for 2 hours").
- **NLP location accuracy** — time ranges like "16 to 17" are no longer mistakenly extracted as a location.
- **Event preview backdrop** — clicking outside the preview popup now properly closes it without activating elements behind it (matching the full editor's behavior).

### Fixes
- **Compact mobile day cells** — tapping the day number in month view now opens the small popup instead of navigating to the full day view.
- **Mobile tasks button** — the "Add task" button now shows just "Add" on small screens to avoid text overflow.
- **View dropdown on touch** — the view switcher dropdown no longer requires a double-tap on touch devices.
- **Null guard in preview popup** — fixed a crash when the preview popup tried to extract an event ID from a null value.

### Internal
- 26 new tests covering NLP edge cases (time ranges, location extraction, full parser pipeline).

## [0.13.0] - 2026-06-12

### New Features
- **Advanced recurrence** - set a custom interval (every 2 weeks, every 3 months), choose when a series ends (on a date, after N occurrences), and pick monthly patterns (e.g. "second Tuesday of the month") or specific months for yearly events.
- **Recurrence checkbox** - "Recurring" is now a dedicated toggle. Enabling it reveals the recurrence controls.
- **Attachments in the "More" panel** - file attachments live inside the collapsible "More" section with a compact layout.
- **Rich toast notifications** - toasts now support action buttons (e.g. "Open" after creating an event, "Undo" after deleting). Powered by [sonner](https://sonner.emilkowal.ski/).
- **Markdown journals** - journal entries now support tables, strikethrough, task lists, and autolinks via GitHub Flavored Markdown.
- **Compact mobile view (≤500px)** - month view now shows events and tasks as color dots instead of text cards. Tap a day to see a split view with the mini-calendar on top and an agenda/task list below.
- **Tasks in DayView header** - tasks now appear alongside all-day events at the top of the day view, giving a complete picture of the day at a glance.
- **Back arrow in DayView** - a back arrow appears in the compact mobile DayView header for quick navigation back to the month grid.
- **FAB menu for compact mobile** - the floating action button now offers quick access to create events, tasks, open the command palette, settings, and toggle the sidebar — all without needing the hamburger menu.
- **Touch-friendly split resize** - the drag handle between the mini-calendar and agenda in split view now responds to touch, letting you adjust the ratio on phones.
- **Journal entries in sample data** - the sample ICS file now includes journal entries to demonstrate the journal feature on first load.

### Improvements
- **Command palette** - rebuilt on [cmdk](https://cmdk.paco.me/) for faster fuzzy filtering, keyboard navigation with auto-scroll, smooth open/close animations, and proper screen reader support (`role="dialog"`).
- **Palette groups** - results are now grouped into Navigation, Actions, Settings, Calendars, and Events for easier scanning.
- **Compact mobile month view polish** - week number column hidden, multi-day fragments shown as pill dots, word overflow handled, and the grid fills the full width without horizontal scrolling down to 375px.
- **Settings page mobile layout** - settings rows stack vertically on small screens, theme cards wrap naturally, and the back button sits above the navigation tabs.
- **Scrollbar styling** - scrollbars are hidden by default across the app and appear on hover, giving a cleaner look while remaining accessible.
- **Dark mode consistency** - DayEventsPopup and ContextMenu now use theme-aware CSS variables instead of hardcoded light-mode colors.
- **Multi-day event text alignment** - fragment cards (first/middle/last) now have consistent left padding so titles align with regular single-day events.
- **Auto-enable journal** - if the sample data contains journal entries, the journal feature is now enabled automatically during onboarding.

### Internal
- Replaced hand-rolled implementations with maintained libraries: `rrule` for recurrence expansion, `semver` for version comparison, `Zod` for config validation, `Dexie` for IndexedDB access, `uuid` for UUID validation.
- Unified RRule string generation across CalDAV sync, event storage, and recurrence descriptions.
- Removed unused `localforage` dependency.

## [0.12.0] - 2026-06-10

### New Features
- **Self-hosted account preloading** - ship Calino with preconfigured CalDAV accounts protected by a master password. Users enter the password once to unlock all accounts. Config is baked into the JS bundle at build time - no separate file served to clients. See `docs/SELF_HOSTED_CONFIG.md`.
- **Setup wizard (`/setup`)** - browser-based config generator with connection testing, password encryption, and one-click download. No Node.js required - works on any Calino instance, including the hosted one.
- **Lock button** - appears in the settings dropdown when preconfigured accounts are active. Clears the master password from storage; prompt reappears on next page load.
- **`CALINO_SELF_HOSTED` env var** - set to `true` (default in Docker) to hide "Try with sample data" and "I'll do it later" from the onboarding flow.
- **Auto-create GitHub Release** on version bump via `scripts/release.sh`.

### Security
- **Full config encryption** - server URLs, usernames, and passwords are all encrypted with AES-256-GCM using the master password. Only the account name (display label) is readable in the config.
- **Master password encrypted at rest** - stored in localStorage as encrypted `{ iv, data }` JSON, same as CalDAV credentials. Plaintext never touches persistent storage.
- **PBKDF2 iterations bumped to 600,000** - each key derivation takes ~2 seconds, making brute-force inherently expensive.
- **Brute-force protection** - 5 failed attempts trigger a 1-minute cooldown. Tracked in localStorage (shared across tabs).
- **Blur behind master password prompt** - prevents reading calendar data through the overlay.

### Improvements
- **"Offline calendar" removed after auto-connect** - when preconfigured CalDAV accounts connect, the default offline calendar is cleaned up if it has no events.
- **CLI script updated** - `encrypt-password.mjs` now accepts `--url`, `--username`, and `--password` flags, encrypting all three fields for a complete config entry.
- **Docs updated** - SELF_HOSTED_CONFIG.md, AGENTS.md, and README.md reflect the new setup wizard, security model, and self-hosting workflow.

### Notable Fixes
- Auto-connect runs sequentially to avoid localStorage race conditions in credential storage
- Module-level guard prevents auto-connect from running across multiple hook instances
- Base64url encoding handled correctly in crypto decoder
- Docker paths corrected from nginx to Caddy (`/srv` instead of `/usr/share/nginx/html`)
- `CALINO_SELF_HOSTED` build arg properly declared in Dockerfile

## [0.11.0] - 2026-06-10

### New Features
- **Settings sync via CalDAV** - sync your preferences (theme, time format, first day of week, etc.) across devices using your existing CalDAV server. Opt-in: enable in Settings → Sync. Creates a hidden "Calino Settings" calendar on your server to store preferences. Settings are pulled automatically during sync and pushed manually via the Save button. Tested with Baikal - please report issues with other servers.
- **Journal view switcher** - toggle between Month and All views in the journal page. "All" shows all entries grouped by month with pagination.

### Improvements
- **Sidebar animation** - overlay now fades in/out smoothly when opening the sidebar on mobile
- **Mobile sidebar brand** - Calino logo now appears at the top of the sidebar when opened from the burger menu
- **Docker tags** - CI now pushes `latest` tag alongside version and branch tags
- **Release script** - `scripts/release.sh` for running all CI checks locally before pushing

## [0.9.5] - 2026-06-06

### New Features
- **Resizable sidebar** - drag the edge to resize, auto-collapses when too small
- **Calendar management** - create, rename, and delete calendars directly from the app
- **Attachments** - upload, download, preview, and delete files on events (5MB warning, 25MB limit)
- **Multi-category filter** - select multiple categories in the sidebar to narrow your view

### Improvements
- **Command palette** now has a typewriter animation and supports partial matching (e.g. "jan" for January)
- **More quick toggles** in the command palette for sidebar, dark mode, time format, and sync
- **Category color toggle** - option to disable category colors
- **Animated header** - smooth transitions when resizing between desktop, tablet, and mobile

### Notable Fixes
- Attachment deletion now syncs correctly to the CalDAV server
- Fixed command palette input being cut off
