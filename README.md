# Calino

A browser-based CalDAV client — sync with your own server, no data is sent elsewhere.

Check out the hosted version at [Calino.io](https://calino.io).

Despite Calino being a web app, it acts as a desktop client, in the sense that it only sends data between your computer and the CalDAV servers; there is no central Calino server to store your information, as it is a static web app.

> **⚠️ Active Project:** Calino is under active development. Expect breaking changes, evolving UI, and frequent updates. Use at your own risk — but report bugs, we'd love the feedback!

### CalDAV Proxy

Due to the browser based nature of Calino, if your CalDAV server doesn't support CORS, you can use Calino's hosted proxy URL during setup: https://proxy.calino.io

With that said, I urge you to either selfhost Calino or at least use your own proxy, to minimize the amount of data being sent to servers that are not your own. Calino.proxy.io is solely for convenience. Don't rely on it. Instructions for setting up your own proxy is further down in the readme.

## Features

I have made it as close as possible, as to what I envision the perfect CalDAV non-enterprise calendar to be, for my own usage. I'm simply sharing it with the world. The design philosophy is to have sensible and automatic default settings, so that you can use it from any clients, without needing further customization.

### Views

- **Month, Week, Day, Agenda** — four views for every preference
- **Tasks** — dedicated view for VTODOs with filtering and sorting
- Click week numbers to jump straight to that week
- Click any date to see it in day view
- Drag events to move them, drag edges to resize

### Smart Input

- Type naturally: _"coffee with friends on wednesday, at 12-18"_ → creates a 4-hour event on that Wednesday
- Press `Cmd+K` (or `Ctrl+K`) for the command palette — navigate, create events, sync, search, settings
- Smart detection: start typing and NLP parses dates, times, and durations

### Tasks (VTODO)

- Full VTODO support with due dates, priorities, and completion status
- Shows as checkboxes in month view, inline in week/day view
- Filter by calendar, sort by date/priority
- Mark complete directly from notifications

### Time & Calendar

- Auto timezone detection with manual override
- 12h/24h toggle
- Multiple calendars with custom colors
- Compact recurring events (no giant blocks cluttering your week)
- Event transparency (TRANSP) — see busy/free status
- Apple Travel Time support (!!)

### Search

- Full-text search across all event fields
- Filter by calendar, date range, event type
- Fuzzy matching with Fuse.js

### Categories

- Organize events with color-coded categories
- Auto-apply categories based on keywords in event titles
- Filter events by category in sidebar
- Categories sync via iCalendar CATEGORIES property (RFC 5545)

### Desktop Integration

- **PWA** — install as a native app (*offline support requires self-hosting with proper CSP headers; GitHub Pages not supported*)
- **Desktop notifications** with customizable reminders
- Sync retry: failed CalDAV operations are automatically retried; manual retry button in sidebar

### Customization

- **Themes** — light, dark, or follow system
- **Event density** — comfortable or compact
- Configurable first day of week, date format, default duration
- Show/hide week numbers, completed tasks

### Mobile

- Swipe left/right to navigate between months/weeks/days
- Touch-friendly interface

The only non-standard iCalendar feature, is the support for Apples travel time, so it plays well with iPhones and MacOS calendars. I chose to include that feature, as all edits will otherwise still be compatible with other CalDAV clients - although they'll naturally not show the travel time, if it's not supported.

### Security

- CalDAV passwords are encrypted (AES-256-GCM) before storing in localStorage
- All data stays on your device — no central server, no telemetry
- Open source — audit the code yourself

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

## Selfhosting

Calino is just a static React app — host it anywhere that serves HTML/JS.

1. Build: `pnpm build`
2. Serve the `dist/` folder

**Config:**

- Click the gear icon or use `Cmd+K` → "Settings"
- Add your CalDAV server URL, username, password
- App stores credentials in localStorage

**Site URL (for SEO/social cards):**

```bash
cp .env.example .env.local
# Edit .env.local and set VITE_SITE_URL=https://your-domain.com
pnpm build
```

### Supported CalDAV Servers

- Baikal
- Nextcloud Calendar
- Radicale
- Any RFC 4791 compliant server

### CORS Headers

If adding headers to your server:

```
Access-Control-Allow-Origin: <your-calino-origin>
Access-Control-Allow-Headers: Authorization, Content-Type, Depth, If-Match, If-None-Match
Access-Control-Allow-Methods: GET, PUT, POST, DELETE, PROPFIND, PROPPATCH, REPORT, OPTIONS
```

### Caddy Example

```caddy
yourcaldav.server.com {
    @cors method OPTIONS

    handle @cors {
        header {
            Access-Control-Allow-Origin "*"
            Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PROPFIND, REPORT, OPTIONS"
            Access-Control-Allow-Headers "Authorization, Content-Type, Depth, Prefer, If-None-Match, If-Match"
        }
        respond "" 204
    }

    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PROPFIND, REPORT, OPTIONS"
        Access-Control-Allow-Headers "Authorization, Content-Type, Depth, Prefer, If-None-Match, If-Match"
        -Server
    }

    reverse_proxy 192.168.1.1:89 # replace with your own address
}
```

## Tech Stack

React 19 + TypeScript + Vite, Zustand v5, date-fns, chrono-node, @dnd-kit, framer-motion, Fuse.js, ical.js, Vitest

---

**Disclaimer:** This project is entirely vibe coded by [Minimax M2.7](https://minimax.io), but thoroughly tested. Issues may arise. Bug reports welcome.

## License

MIT
