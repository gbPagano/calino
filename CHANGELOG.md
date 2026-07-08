# Changelog

All notable changes to Calino will be documented in this file.

## [0.20.1] - 2026-07-08

A small patch of theming and dark-mode fixes.

### Fixed

- **Mobile day selection now respects your theme** — the selected day in the sidebar mini-calendar used the default (brown) accent instead of your active theme's color on non-default themes. It now derives its highlight from the current theme, so custom themes look right too. ([#20](https://github.com/Ivan-Malinovski/calino/issues/20))
- **No more tap-highlight flash on mobile** — tapping buttons and links no longer shows the browser's default gray/blue overlay. The highlight color is now a themeable token if you want it back. ([#21](https://github.com/Ivan-Malinovski/calino/issues/21))
- **Dark-mode color leaks** — fixed several spots that fell back to light-mode colors in dark mode: the Add Calendar connection-hint box, Year-view hover states, and the contacts tag-filter chip.

## [0.20.0] - 2026-07-08

A large audit-driven release: security hardening, iCalendar compliance for strict CalDAV servers, a full accessibility pass, major performance work, a new 3-day view, and a round of animation and connection-reliability polish.

---

### 👤 User-facing

Things you'll actually notice using Calino.

**New**

- **3-day view** — a new zoom level between Day and Week, with a resizable agenda sidebar that now persists across every view.
- **3-state theme picker** — the quick-settings theme toggle cycles Auto → Light → Dark, so you can return to "follow system" without opening the settings page. It now sits at the top of the quick-settings dropdown with clearer mode icons.
- **Keyboard shortcuts help modal** — press `?` anywhere to see every shortcut; Escape closes it.
- **Deep-link support** — links like `?date=2026-07-08&event=<id>` open the right day and event.
- **Empty states** — Agenda, Tasks, and the sidebar calendar list show a helpful message and action button instead of blank space.

**Improved**

- **More reliable connections** — Fastmail and other providers that used to 404 during setup now connect: Calino auto-expands provider URLs, tries the `caldav.` subdomain, and follows cross-domain redirects.
- **Missed reminders catch up** — if your tab was asleep and missed a reminder, the next active visit fires anything from the last 12 hours that was never shown.
- **Smoother, faster calendar** — event layout uses an O(n log n) sweep-line (was O(n³)), window resizing is frame-rate throttled, search index rebuilds run during idle time, and Agenda grouping is O(N). Busy calendars render noticeably faster.
- **Polished animations** — refined enter/exit transitions for events and the view-switcher menus, faster fade-outs, and full reduced-motion support. The event you're actively dragging no longer animates out from under you.
- **Saving feedback** — the event modal shows a spinner and "Saving…" label while a save is in flight, and rapid clicks can no longer create duplicate events.
- **Recurring events are safer to touch** — drag-and-drop and resize are disabled for recurring events, preventing accidental one-off edits to a series.
- **Better sync with strict servers** — RRULE, EXDATE, RECURRENCE-ID, and VALARM now use correct value forms (VALUE=DATE for all-day, matching TZID for timezone-aware events), so Radicale, iCloud, and Google Calendar accept edits cleanly. Task status/percent-complete round-trip faithfully, and day/week-duration reminders are preserved.
- **Lossless ICS export** — exporting `.ics` keeps recurrence rules, exceptions, reminders, and all-day date forms.
- **Accessibility pass** — icon-only buttons get `aria-label`s, the onboarding modal traps focus and honors Escape, the error dialog is themed, and iOS PWA gets safe-area insets.
- **Smaller papercuts** — end-before-start validation in the event modal, a toast when notification permission is denied, "Go to Today" that stays correct across midnight, todo-composer text carried into the modal, and rounder `/tasks` & `/journal` selectors.

**Security fixes you benefit from**

- Patched high-severity CVEs in `react-router-dom` and `vite`.
- The bundled CORS proxy no longer forwards Authorization headers to arbitrary hosts, no longer echoes a wildcard origin when allowed origins are set, and no longer leaks fetch errors.
- The service worker validates event IDs before using them in navigation URLs.
- Settings are no longer wiped during an app data migration.

---

### 🤓 Technical

For the curious — the interesting bits under the hood.

- **Rendering** — `eventPositioning` rewritten as a sweep-line with a tight `totalColumns` scan; range/version counters drive the memoization deps so recomputes only happen on real changes.
- **Animations** — `AnimatePresence` uses `initial={false}`; a shared `eventAnimations` helper centralizes the reduced-motion pattern and skips exit animation for the actively-dragged element. Conditional wrappers removed to keep keys stable across renders.
- **CalDAV discovery** — `discovery.ts` gained provider-URL expansion, `caldav.` subdomain fallback, and cross-domain redirect handling, with ~200 lines of new tests.
- **iCalendar adapter** — correct VALUE=DATE / TZID emission, VTODO STATUS + percent-complete + COMPLETED preservation, VALARM day/week durations, multibyte-safe line folding, and settings-event serialization with proper folding/escaping. Round-trip tests cover TZID, RRULE WKST/BYSETPOS, and VTODO.
- **ETag handling** — create/update now capture the server URL and ETag (including etag-on-create recovery) so the next sync doesn't drop edits.
- **State** — Zustand migrations merge persisted state over defaults rather than discarding unknown keys; `partialize()` keys and calendar positions survive version bumps. `safeLocalStorage.clear()` sweeps both `calino-` and `calino_` prefixes.
- **Proxy** — `https://`-only scheme validation, restricted header allowlist, an SSRF denylist, generic error responses.
- **Types/routing** — `'3day'` added to `VIEW_ROUTES` and the settings store; per-BYDAY field renamed `bySetPos → byDayOrdinals`.
- **Infra** — service worker cache bumped to `calino-v7`; Docker Caddy request-body limit raised 1 KB → 1 MB; dev server defaults to `localhost`; e2e (Playwright) infra + specs for drag-disabled recurring events, animation, and month delete; `pnpm lint` at 0 errors; `tsc -b` project-reference type errors fixed.

### Known Limitations

- **All-day reminders fire N minutes before midnight the day before** — this matches the iCalendar spec (reminders are relative to DTSTART). The 12-hour catch-up pass (see above) covers the common case where the tab was inactive, but reminders older than 12 hours won't fire.
- **App-level encryption is obfuscation, not security** — credentials in localStorage are encrypted with a key bundled in the app. Anyone with the JavaScript bundle can derive the same key and decrypt stored CalDAV credentials. For stronger protection, use the master-password setup wizard (`/setup`), which derives the encryption key from a user-supplied password that never leaves the device.

### Deferred (roadmap)

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
