# Changelog

All notable changes to Calino will be documented in this file.

## [0.11.0] - 2026-06-10

### New Features
- **Settings sync via CalDAV** — sync your preferences (theme, time format, first day of week, etc.) across devices using your existing CalDAV server. Opt-in: enable in Settings → Sync. Creates a hidden "Calino Settings" calendar on your server to store preferences. Settings are pulled automatically during sync and pushed manually via the Save button. Tested with Baikal — please report issues with other servers.
- **Journal view switcher** — toggle between Month and All views in the journal page. "All" shows all entries grouped by month with pagination.

### Improvements
- **Sidebar animation** — overlay now fades in/out smoothly when opening the sidebar on mobile
- **Mobile sidebar brand** — Calino logo now appears at the top of the sidebar when opened from the burger menu
- **Docker tags** — CI now pushes `latest` tag alongside version and branch tags
- **Release script** — `scripts/release.sh` for running all CI checks locally before pushing

## [0.9.5] - 2026-06-06

### New Features
- **Resizable sidebar** — drag the edge to resize, auto-collapses when too small
- **Calendar management** — create, rename, and delete calendars directly from the app
- **Attachments** — upload, download, preview, and delete files on events (5MB warning, 25MB limit)
- **Multi-category filter** — select multiple categories in the sidebar to narrow your view

### Improvements
- **Command palette** now has a typewriter animation and supports partial matching (e.g. "jan" for January)
- **More quick toggles** in the command palette for sidebar, dark mode, time format, and sync
- **Category color toggle** — option to disable category colors
- **Animated header** — smooth transitions when resizing between desktop, tablet, and mobile

### Notable Fixes
- Attachment deletion now syncs correctly to the CalDAV server
- Fixed command palette input being cut off
