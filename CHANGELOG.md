# Changelog

All notable changes to Calino will be documented in this file.

## [1.0.0] - 2026-07-07

First stable release. A four-round audit-driven effort: security hardening, iCalendar compliance for strict CalDAV servers, a full accessibility pass, and major performance improvements.

### New Features

- **3-state theme picker** — the quick-settings theme toggle now cycles through Auto, Light, and Dark. You can return to "follow system" without digging into the settings page.
- **Keyboard shortcuts help modal** — press `?` anywhere to open a reference of every keyboard shortcut. Press Escape to close.
- **Deep-link support** — links with `?date=2026-07-07&event=<id>` now parse correctly, so shared links open the right day and event.
- **Empty states** — Agenda, Tasks, and the sidebar calendar list now show a helpful message and action button when empty, instead of blank space.

### Improvements
- **Missed reminders catch up on next visit** — if your browser tab was asleep (laptop sleep, backgrounded tab, etc.) and missed a reminder, the next time the app is active it will fire for any reminder in the last 12 hours that was never shown.
- **Less theme-switch flash** — the theme color meta tag is now updated synchronously via `useLayoutEffect`, reducing the brief flash that used to occur on theme changes.
- **Faster calendar views** — event positioning now uses an O(n log n) sweep-line algorithm instead of O(n³), making month and week views render noticeably faster on busy calendars.
- **Smoother window resizing** — the resize hook is now frame-rate throttled, so dragging the browser window no longer causes stuttering.
- **Faster search index updates** — search index rebuilds now run during browser idle time, so syncing a large calendar won't freeze the UI.
- **Faster agenda rendering** — event grouping in the Agenda view is now O(N) instead of O(N²).
- **More reliable CalDAV sync with strict servers** — RRULE, EXDATE, RECURRENCE-ID, and VALARM now use the correct value forms (VALUE=DATE for all-day events, matching TZID for timezone-aware events). Strict servers like Radicale, iCloud, and Google Calendar will accept these changes without complaint.
- **VTODO round-trip fidelity** — task status (Needs Action, In Process, Completed, Cancelled), percent-complete, and original COMPLETED timestamp now survive a sync round-trip. Other CalDAV clients will show the same status and progress you set in Calino.
- **Better VALARM support** — reminders with day/week durations (e.g. "2 days before") and positive triggers are now preserved on sync. Previously these were silently dropped.
- **Settings sync uses proper iCalendar formatting** — the settings event is now serialized with line folding and correct escaping, matching what strict servers expect.
- **Improved accessibility** — many icon-only buttons now have `aria-label` attributes. The onboarding modal traps focus and responds to Escape. The ErrorBoundary dialog is now themed instead of using hardcoded colors. iOS PWA gets proper safe-area insets.
- **End-before-start validation** — the event modal now prevents saving events where the end time is before the start time, with a clear toast message.

### Bug Fixes

- **Security: dependency vulnerabilities patched** — updated `react-router-dom` (RCE fix) and `vite` (filesystem access bypass fix) to address high-severity CVEs.
- **Security: hardened CORS proxy** — the bundled CORS proxy no longer forwards Authorization headers to arbitrary targets, no longer echoes `Access-Control-Allow-Origin: *` when allowed origins are configured, and no longer leaks fetch error details.
- **Security: service worker path-traversal validation** — the service worker now validates that event IDs are valid UUIDs before using them in navigation URLs.
- **Settings no longer lost on store migration** — a bug caused all user preferences to be wiped during store migration. Settings, calendar positions, and view state are now preserved.
- **CalDAV sync no longer drops edits** — created and updated events now capture the server's URL and ETag response, preventing silent edit loss on the next sync.
- **ICS export is now lossless** — exporting events to `.ics` now preserves recurrence rules, exceptions, reminders, and all-day date forms, instead of stripping them.
- **Todo composer text preserved** — typing a task title in the inline composer and pressing Enter now carries that text into the event modal, instead of discarding it.
- **Duplicate settings event prevention** — each Calino instance now generates a unique identifier for its settings event, preventing collisions when multiple browser profiles sync to the same CalDAV server.
- **Docker body size limit raised** — the Caddy request body limit was increased from 1 KB to 1 MB, fixing CalDAV sync failures on servers with large payloads.
- **Notification permission UX** — when browser notification permission is denied, Calino now shows a toast explaining why the setting was disabled, instead of silently flipping it off.
- **Command palette "Go to Today" stays current** — the date is now computed when the action runs, not when the palette was first opened, so it works correctly across midnight.
- **Calendar storage cleanup** — `safeLocalStorage.clear()` now removes both `calino-` and `calino_` prefixed keys, fixing stale CalDAV records after account removal.

### Internal

- Zustand store migrations now merge persisted state over defaults instead of discarding unrecognized fields.
- iCalendar adapter round-trip tests added for VEVENT with TZID, RRULE with WKST/BYSETPOS, and VTODO STATUS preservation.
- Service worker cache version bumped to `calino-v7` to invalidate old cached service workers on deploy.
- CORS proxy source hardened: scheme validation (`https://` only), restricted header allowlist, generic error responses.

### Known Limitations

- **All-day reminders fire N minutes before midnight the day before** — this matches the iCalendar spec (reminders are relative to DTSTART). The 12-hour catch-up pass (see above) covers the common case where the tab was inactive, but reminders older than 12 hours won't fire.
- **App-level encryption is obfuscation, not security** — credentials in localStorage are encrypted with a key bundled in the app. Anyone with the JavaScript bundle can derive the same key and decrypt stored CalDAV credentials. For stronger protection, use the master-password setup wizard (`/setup`), which derives the encryption key from a user-supplied password that never leaves the device.

### Deferred to v1.1

- Recurrence preview before saving changes
- External ICS feed subscription
- Periodic remote pull / background sync
- Install-prompt UX (beforeinstallprompt)
- Conflict-resolution UI for "ask" sync mode
- Saved searches
- Hourly, minutely, and secondly recurrence frequencies
- Subtasks
- Email reminders
- Internationalization (i18n)
- Invitations and RSVP
- share_target PWA
- Periodic background sync

## [0.18.0] - 2026-07-05

### New Features
- **Undo and redo** — made a change you didn't mean to? Undo and redo now work across event edits, moves, deletes, and calendar changes, so you can step back and forward through your recent actions.
- **Live "now" line** — day and week views now show a red line marking the current time, with a time label that updates as the day goes on.
- **Type dates right into the title** — when creating an event, natural phrases like "lunch tomorrow at 1" or "dentist next friday" are recognized inline and fill in the date and time for you.
- **Smarter defaults** — Calino learns from your habits: recurring event names now pre-select the calendar and duration you usually give them.
- **Jump to a week from the year view** — ISO week numbers in the year view are now clickable and take you straight to that week.
- **Two-finger swipe between views** — swipe horizontally with two fingers on a touchscreen to move between calendar views.
- **More control over reminders** — task reminders now have real on/off toggles, and events can carry multiple reminders.

### Improvements
- **App keeps running if one part hiccups** — each major area now has its own safety net, so a problem in one view no longer takes down the whole app; you'll see a gentle notice if a background sync fails.
- **Better keyboard and screen-reader navigation** — arrow keys move across the month grid, a single Tab enters it, modals keep focus inside them, and Esc dismisses event previews.
- **Faster rendering** — month, week, and day views redraw more efficiently, especially on busy months.
- **Simpler sync settings** — removed the auto-sync toggle from settings in favor of consistent background syncing.

## [0.17.1] - 2026-07-04

### New Features
- **More events get automatic icons** — added icon matching for bouldering (mountain), meditation and mindfulness (gym), and cleaning/chores (laundry).
- **Self-hostable CORS proxy** — if your CalDAV server can't send CORS headers, you can now run Calino's own lightweight proxy instead of relying on Cloudflare or editing your reverse proxy. If you already run Calino with Docker, enable it alongside the app with a single command (`docker compose --profile proxy up -d`) and point the Proxy URL in settings at it. It can also run standalone or as a Cloudflare Worker.

### Bug Fixes
- **Settings sync behind a CORS proxy** — the documented proxy configuration was missing the WebDAV methods (`MKCOL`, `COPY`, `MOVE`) that settings sync needs, and didn't follow `.well-known` redirects, so discovery and settings sync could fail. The bundled/hosted proxy and the docs now include everything required.

## [0.17.0] - 2026-07-01

### New Features
- **Automatic event icons** — events now show a small icon matched to their title: a coffee cup for "Coffee with Sam", a mountain for "Morning hike", a dumbbell for "Gym", and so on across dozens of everyday categories (meetings, calls, travel, meals, appointments, shopping, and more). Icons appear on full-size event cards and in the event preview. Turn them on or off under Settings → Appearance → "Event icons".
- **Anniversary reminders for contacts** — anniversaries stored on your contacts now appear as recurring reminders on your calendar, so you won't miss them.
- **Tap the header to jump back to month view** — clicking the date title in the header now takes you back to month view from anywhere else in the app. When you're already in month view, it still jumps to today.

### Bug Fixes
- **No more false sync errors when offline** — Calino no longer shows sync-failure notifications while you're offline; it waits until you're back online.
- **Multi-day event dragging lands correctly** — dragging a multi-day event in month view now drops it on the right dates instead of being offset.
- **Cleaner agenda locations** — event locations in the agenda no longer show up as a blue underlined web link; they now read as normal themed text (and are still tappable to open in Google Maps).
- **View switcher no longer starts misaligned** — the highlighted pill in the Month/Year/Week view switcher occasionally appeared shifted to the left on load; it now lines up correctly and re-aligns after fonts load or the window resizes.
- **Custom theme switching** — switching between custom themes now updates correctly.

### Improvements
- **Smoother calendar views** — more consistent open/close animations, multi-day events highlight across all their days on hover, and indented event fragments line up correctly in month and week views.

## [0.16.3] - 2026-06-30

### New Features
- **Event locations open in Google Maps** — an event's location is now a tappable link that opens the address directly in Google Maps.

### Bug Fixes
- **Calendar renaming now sticks** — renaming a synced (CalDAV) calendar could silently snap back to the old name if the server rejected the change. Your rename is now kept locally and the server is updated in the background; if the server refuses, you get a notice instead of losing the new name.
- **Deleted events no longer reappear** — an event you deleted could linger locally after the deletion was retried and succeeded on the server. It's now properly removed.
- **Month view shows all visible events** — events landing on the trailing/leading days of adjacent months (the greyed-out days that fill out the month grid) were missing and now show up again.
- **Search stays current after sync** — search results no longer show stale matches after a background sync; the index refreshes so results reflect your latest events.

### Improvements
- **Faster calendar views** — month, week, and day views render noticeably faster, especially on months with many recurring events.
- **Faster sync** — syncing accounts with large numbers of events is quicker.
- **Smoother event previews** — hovering to preview an event no longer re-renders the entire event list.
- **Cleaner location links** — location links no longer carry a permanent underline.

## [0.15.2] - 2026-06-20

### Bug Fixes
- **CalDAV URL discovery** — server URL input is now respected. Uses RFC 6764 `.well-known/caldav` discovery instead of hardcoded `/dav.php`. (#11)
- **Broken events** — events with start > end are now stored instead of silently dropped. New "Data Issues" tab in Settings shows and lets you fix/delete them.
- **Spanning day pills** — multi-day events in month view connect properly into one visual pill again.
- **Bauhaus theme** — fixed component overrides not matching (missing descendant combinator in selectors), event card left border, view switcher indicator height/position.
- **Brutalist theme** — fixed Today/AddTask border-radius, modal Save button styling, dark mode white borders toned down.

### Improvements
- **Theme system** — extracted `--view-switcher-indicator-height`, `--modal-card-border`, `--modal-save-shadow` variables to reduce theme override duplication.
- **View switcher indicator** — shared `data-component` between CalendarHeader and TodoView so one theme rule covers both.
- **Removed flaky `barrelExports` test** — redundant with TypeScript compilation.

## [0.15.0] - 2026-06-19

### New Features
- **Theme system** — choose independent light and dark themes in Settings → Theme. Switch between Light, Dark, and System modes. System mode automatically follows your OS preference.
- **9 new themes** — Slate (dark), Mist (light/dark), Mist Green (light/dark), Xiaohongshu (light/dark), Bauhaus (light/dark), Brutalist (light/dark)
- **Theme preview cards** — visual color swatches in settings show each theme's palette at a glance
- **Custom theme template** — create your own theme by dropping a `.css` file into `public/themes/`. A comprehensive template with all CSS variables and data-component selectors is included. See [docs/THEMING.md](./docs/THEMING.md) for the full guide.

### Improvements
- **Event preview popup** — frosted glass backdrop, accent-colored hover states, cleaner shadow
- **Event modal** — refined double-bezel shadow, removed accent color band for a calmer look
- **Multi-day events** — improved fragment rendering in week and day views with consistent styling
- **Settings UI** — new theme selector grid with live preview cards, cleaner toggle switches

### Internal
- Comprehensive CSS variable token system (97 variables) for full theme control
- `data-component` attributes on all major UI elements for theme targeting
- `data-theme-id` attribute on `<html>` for scoped component overrides
- Theme template with documented CSS variables, data attributes, and examples
