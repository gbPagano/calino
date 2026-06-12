# Changelog

All notable changes to Calino will be documented in this file.

## [0.13.0] - 2026-06-12

### New Features
- **Advanced recurrence** - set a custom interval (every 2 weeks, every 3 months), choose when a series ends (on a date, after N occurrences), and pick monthly patterns (e.g. "second Tuesday of the month") or specific months for yearly events.
- **Recurrence checkbox** - "Recurring" is now a dedicated toggle. Enabling it reveals the recurrence controls.
- **Attachments in the "More" panel** - file attachments live inside the collapsible "More" section with a compact layout.
- **Rich toast notifications** - toasts now support action buttons (e.g. "Open" after creating an event, "Undo" after deleting). Powered by [sonner](https://sonner.emilkowal.ski/).
- **Markdown journals** - journal entries now support tables, strikethrough, task lists, and autolinks via GitHub Flavored Markdown.

### Improvements
- **Command palette** - rebuilt on [cmdk](https://cmdk.paco.me/) for faster fuzzy filtering, keyboard navigation with auto-scroll, smooth open/close animations, and proper screen reader support (`role="dialog"`).
- **Palette groups** - results are now grouped into Navigation, Actions, Settings, Calendars, and Events for easier scanning.

### Notable Fixes
- **Delete recurring event from preview popup** — the trash icon now works correctly for recurring events in the quick preview modal
- **Delete recurring event from modal** — the store's delete function was missing from EventModal, so deleting recurring events via the full editor did nothing
- **Monthly recurrence weekday values** — selecting a weekday in the monthly pattern picker now works correctly for non-Sunday first-day-of-week locales.
- **Recurring event edits** — changing recurrence settings (interval, end condition, weekday selection) now properly enables the Save button.
- **“Go to today” navigation** — typing “go to today” or “show next week” in the palette navigates instead of trying to create an event.
- **Dark mode fixes** — weekday buttons and recurrence labels now use theme-aware CSS variables instead of hardcoded light-mode colors.

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
