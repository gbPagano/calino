# Calino

**A lightweight CalDAV calendar for the web.**

---

**Calino is a browser-based CalDAV client that connects directly to your calendar server.** Your CalDAV account is the only account. No accounts, no cloud sync, no bloated suite — just you and your data. It runs as a static page and stays entirely between your browser and your CalDAV server.

**Core philosophy:** 

If you've been looking for a clean, modern CalDAV calendar that doesn't come attached to five other features you don't need — this is it.

> **⚠️ Active project:** Calino is under active development. Breaking changes are possible. Please report bugs - they're more than welcome.

<img width="1469" height="843" alt="Screenshot 2026-06-06 at 00 05 11" src="https://github.com/user-attachments/assets/17767336-2bd0-4732-a385-a7e44a79e7be" />
<img width="1470" height="839" alt="Screenshot 2026-06-06 at 00 05 34" src="https://github.com/user-attachments/assets/f3368480-8598-4e3c-8e0d-00d1c987cff3" />

### CalDAV Proxy

Due to the browser based nature of Calino, if your CalDAV server doesn't support CORS, you can use Calino's hosted proxy URL during setup: https://proxy.calino.io

With that said, I urge you to either selfhost Calino or at least use your own proxy, to minimize the amount of data being sent to servers that are not your own. `proxy.calino.io` is solely for convenience — don't rely on it. To run your own proxy, see [`docs/CORS_PROXY.md`](./docs/CORS_PROXY.md).

---

## Features

I have made it as close as possible, as to what I envision the perfect CalDAV non-enterprise calendar to be, according to my own tastes. I'm simply sharing it with the world. The design philosophy is to have sensible and automatic default settings, that adjust according to your browser , so that you can use it from any clients, without needing further customization.


### Views
- **Month, Week, Day, Agenda**
- Click week numbers to jump straight to that week
- Click any date to see it in day view
- Drag events to move them, drag edges to resize
- Vertical split view for tall windows; month shares vertical space with day view and agenda

### Smart Input
- Type naturally: *"coffee with friends on wednesday, at 12-18"* → creates a 4-hour event on that Wednesday
- Press `Ctrl+K` for the command palette — navigate, create events, sync, search, settings from the same textbox
- Smart detection: start typing and NLP parses dates, times, and durations

### Tasks (VTODO) + Journals (VJOURNAL)
- Full VTODO support with due dates, priorities, and completion status
- Shows as checkboxes in month view, inline in week/day view
- **VJOURNAL support**, a rarity among CalDAV clients. Use it for daily logs, or deeper notes related to your events.

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

### Categories
- Organize events with color-coded categories
- Auto-apply categories based on keywords in event titles
- Filter events by category in sidebar
- Categories sync via iCalendar CATEGORIES property (RFC 5545)

### Desktop Integration
- **PWA** — install as a native app (*offline / service-worker support requires self-hosting; GitHub Pages strips the `Service-Worker-Allowed` header. See "Service Worker" below.*)
- **Desktop notifications** with customizable reminders
- Sync retry: failed CalDAV operations are automatically retried; manual retry button in sidebar

### Customization
- **Themes** — light, dark, or follow system
- Configurable first day of week, date format, default duration
- Show/hide week numbers, completed tasks
- Adjust calendar and category colors

### Mobile
- Swipe left/right to navigate between months/weeks/days
- Tasks and agenda work well on mobile

### Security
- **No backend = no attack surface.** Your CalDAV credentials never touch a Calino server — they stay in your browser's localStorage, encrypted with AES-256-GCM
- **No telemetry, no analytics.** Nothing leaves your browser except CalDAV traffic to your own server
- **Serverless by design.** There's nothing to breach on Calino's side — the app is just static HTML/JS
- **Docker hardening.** Runs as non-root, minimal base image, no shell access

### Limitations
- No enterprise features
- No invitation functionality (for now?)
- No sharing functionality (for now?)

---

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

## Docker

The fastest way to self-host. Pre-built multi-arch images (amd64 + arm64) are on GHCR:

```bash
docker run -d -p 8080:8080 ghcr.io/ivan-malinovski/calino:main
```

Or clone and customize:

```bash
git clone https://github.com/Ivan-Malinovski/calino.git
cd calino
docker compose up -d
```

Calino runs at http://localhost:8080. To customize settings (site URL, offline support), create a `.env` file — see [`docs/DOCKER.md`](./docs/DOCKER.md) for full details.

## Self-Hosting

Calino is a static React app — host it anywhere that serves HTML/JS.

1. Build: `pnpm build`
2. Serve the `dist/` folder (make sure SPA fallback is configured — see below)

All user data, including CalDAV credentials, lives in the browser's `localStorage`. There is no backend, no telemetry, and no central Calino server.

**Config (in-app):** Click the gear icon or use `Cmd+K` → "Settings" → add your CalDAV server URL, username, and password.

**Site URL (for SEO / Open Graph cards):**

```bash
cp .env.example .env.local
# Edit .env.local and set VITE_SITE_URL=https://your-domain.com
pnpm build
```

`VITE_SITE_URL` is baked into `index.html` at build time and used for the canonical link, Open Graph / Twitter cards, and the JSON-LD structured-data block.

### Deployment

Calino is a Vite SPA. Any static host works as long as it rewrites all unknown paths to `/index.html` (so client-side routes like `/week` and `/day` resolve on refresh).

**GitHub Pages** — deploy via GitHub Actions:
1. Fork the repo
2. Edit `.github/workflows/deploy.yml` — change `VITE_SITE_URL` to `https://<your-user>.github.io/<your-repo>`
3. Settings → Pages → Source: **GitHub Actions**
4. Push to `main`

**Caddy** (example):
```caddy
yourcaldav.server.com {
    @cors method OPTIONS

    handle @cors {
        header {
            Access-Control-Allow-Origin "https://calino.io" # or your selfhosted Calino instance URL
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

    reverse_proxy 192.168.1.1:89 # your caldav server IP and port
}
```

> **Tip:** Replace `*` with your Calino origin in production (e.g. `https://calendar.example.com`) to avoid letting arbitrary sites read your calendar.

**Service Worker / Offline Mode:** The service worker is disabled by default. To enable offline support, build with `CALINO_ENABLE_SW=true` and make sure your host returns `Service-Worker-Allowed: /`. See [`docs/DOCKER.md`](./docs/DOCKER.md) for Docker setup.

### Supported CalDAV Servers
- Baikal
- Nextcloud Calendar
- Radicale
- Any RFC 4791 compliant server

### CORS Headers

If adding headers to your CalDAV server:

```
Access-Control-Allow-Origin: <your-calino-origin>
Access-Control-Allow-Headers: Authorization, Content-Type, Depth, If-Match, If-None-Match
Access-Control-Allow-Methods: GET, PUT, POST, DELETE, PROPFIND, PROPPATCH, REPORT, OPTIONS
```

### Self-Hosting a CORS Proxy

If you can't add CORS headers to your CalDAV server, you can run a tiny proxy yourself. See [`docs/CORS_PROXY.md`](./docs/CORS_PROXY.md) for a one-file Cloudflare Worker you can deploy in a few minutes.

## Tech Stack

React 19 + TypeScript + Vite, Zustand v5, date-fns, chrono-node, @dnd-kit, framer-motion, Fuse.js, ical.js, Vitest

---

**Disclaimer:** This project is entirely vibe coded by [Minimax M2.7](https://minimax.io) and [Xiaomi MiMo v2.5 (Pro)](https://mimo.xiaomi.com/), but thoroughly tested with real calendars. Issues may still arise. Bug reports are very welcome.

## License

MIT

[Docker Pulls]: https://img.shields.io/docker/pulls/ivan-malinovski/calino?style=flat-square
[Docker Pulls-link]: https://github.com/Ivan-Malinovski/calino/pkgs/container/calino
[Build Status]: https://img.shields.io/github/actions/workflow/status/Ivan-Malinovski/calino/docker.yml?style=flat-square
[Build Status-link]: https://github.com/Ivan-Malinovski/calino/actions
[Last Commit]: https://img.shields.io/github/last-commit/Ivan-Malinovski/calino/main?style=flat-square
[Last Commit-link]: https://github.com/Ivan-Malinovski/calino/commits/main
