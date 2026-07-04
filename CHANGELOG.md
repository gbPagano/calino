# Changelog

All notable changes to Calino will be documented in this file.

## [Unreleased]

### New Features
- **Bouldering events get an icon** — events mentioning "bouldering" now show the mountain icon, alongside hiking, climbing, and camping.
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
