# Calino

A browser-based CalDAV client — sync with your own server, no cloud required.

Check out the hosted version at [Calino.io](https://calino.io).

> **⚠️ New Project Alert:** Calino is a new project and under very active development. Expect breaking changes, evolving UI, and frequent updates. Use at your own risk — but report bugs, we'd love the feedback!

### CalDAV Proxy

If your CalDAV server doesn't support CORS, you can use Calino's hosted proxy URL during setup: https://proxy.calino.io

With that said, I urge you to either selfhost Calino or at least use your own proxy, to minimize the amount of data being sent to servers that are not your own. Calino.proxy.io is solely for convenience. Don't rely on it.

## Features

I have made it as close as possible, as to what I envision the perfect CalDAV non-enterprise calendar to be.

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
- Apple Travel Time support

### Search

- Full-text search across all event fields
- Filter by calendar, date range, event type
- Fuzzy matching with Fuse.js

### Desktop Integration

- **PWA** — install as a native app (works offline)
- **Desktop notifications** with customizable reminders
- Native event handling for dates and times

### Customization

- **Themes** — light, dark, or follow system
- **Event density** — comfortable or compact
- Configurable first day of week, date format, default duration
- Show/hide week numbers, completed tasks

### Mobile

- Swipe left/right to navigate between months/weeks/days
- Touch-friendly interface

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

React 18 + TypeScript + Vite, Zustand, Dexie.js, date-fns, chrono-node, @dnd-kit, framer-motion, Fuse.js, tsdav, Vitest

---

**Disclaimer:** This project is entirely vibe coded by [MiniMax-M2.5](https://minimax.io), but thoroughly tested. Issues may arise. Bug reports welcome.

## License

MIT
