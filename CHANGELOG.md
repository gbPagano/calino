# Changelog

All notable changes to Calino will be documented in this file.

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
