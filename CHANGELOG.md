# Changelog

All notable changes to Calino will be documented in this file.

## [Unreleased]

### New Features
- **Resizable sidebar** — drag the edge to resize, auto-collapses when too small
- **Calendar management** — create, rename, and delete calendars directly from the app
- **Attachments** — upload, download, preview, and delete files on events (5MB warning, 25MB limit)
- **Multi-category filter** — select multiple categories in the sidebar to narrow your view

### Improvements
- **Command palette** now has a typewriter animation and supports partial matching (e.g. "jan" for January)
- **Quick toggles** in the command palette for sidebar, dark mode, time format, and sync
- **Category color toggle** — option to disable category colors
- **Sidebar state** persists across page reloads
- **Animated header** — smooth transitions when resizing between desktop, tablet, and mobile
- **Year fades out** on very narrow screens to make more room for navigation

### Notable Fixes
- Attachment deletion now syncs correctly to the CalDAV server
- Fixed delete race condition that could lose events
- Fixed command palette input being cut off
- Mobile header layout — view switcher no longer disappears on small screens

## [0.9.0] - 2026-06-06

_Breaking version bump — see previous entries for details._
