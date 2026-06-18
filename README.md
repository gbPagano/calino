# Calino

**A lightweight CalDAV calendar for the web.**

---

**Calino is a browser-based CalDAV client that connects directly to your calendar server.** No other accounts required, it it runs as a static page and data stays entirely between your browser and your CalDAV server.

If you've been looking for a beautiful, modern browser-based CalDAV calendar that doesn't come part of a bloated suite, Calino have you covered.

> **⚠️ Active project:** Calino is under active development. Breaking changes are possible. Please report bugs - they're more than welcome!

<img width="1613" height="942" alt="image" src="https://github.com/user-attachments/assets/832356b1-0b20-4161-8083-06ff71934a16" />
(more screenshots at the bottom)

### CalDAV Proxy

Due to the browser based nature of Calino, if your CalDAV server doesn't support CORS, you can use Calino's hosted proxy URL during setup: https://proxy.calino.io

With that said, I urge you to either selfhost Calino or at least use your own proxy, to minimize the amount of data being sent to servers that are not your own. `proxy.calino.io` is solely for convenience, please don't rely on it. To run your own proxy, see [`docs/CORS_PROXY.md`](./docs/CORS_PROXY.md).

---

## Features

I have made it as close as possible, as to what I envision the perfect CalDAV non-enterprise calendar to be, according to my own tastes. I'm simply sharing it with the world. The design philosophy is to have sensible and automatic default settings, that adjust according to your browser and calendar, so that you can use it from any clients, without needing further customization.

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
- **Themes** — light, dark, or follow system. Custom themes can be added by dropping a `.css` file into `public/themes/` and rebuilding the app (themes are loaded at build time, not at runtime).
- Configurable first day of week, date format, default duration
- Show/hide week numbers, completed tasks
- Adjust calendar and category colors
- **Settings sync** (disabled by default) — sync your preferences (theme, first day of week, time format, etc.) across devices via CalDAV. Opt-in: only activates when you enable it in Settings → Sync. Uses a dedicated hidden calendar on your server. See [`docs/CALINOSETTINGSSYNC.md`](./docs/CALINOSETTINGSSYNC.md) for details.

### Mobile
- Swipe left/right to navigate between months/weeks/days
- Tasks and agenda work well on mobile
- Optimized mobile view

### Security
- **No backend = no attack surface.** Your CalDAV credentials never touch a Calino server — they stay in your browser's localStorage, encrypted with AES-256-GCM
- **No telemetry, no analytics.** Nothing leaves your browser except CalDAV traffic to your own server
- **Serverless by design.** There's nothing to breach on Calino's side — the app is just static HTML/JS
- **Docker hardening.** Runs as non-root, minimal base image, no shell access
- **Self-hosted account preloading.** Ship Calino with preconfigured CalDAV accounts protected by a master password. Generate the config via the browser-based `/setup` wizard — no Node.js required. See [`docs/SELF_HOSTED_CONFIG.md`](./docs/SELF_HOSTED_CONFIG.md)

### Limitations
- No enterprise features
- No invitation functionality (for now?)
- No sharing functionality (for now?)

---

## Self hosting Quick Start

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

Calino runs at http://localhost:8080 by default.
To customize settings (site URL, offline support), create a `.env` file — see [`docs/DOCKER.md`](./docs/DOCKER.md) for full details.

**Preconfigure CalDAV accounts:** Visit `/setup` in any running Calino instance to generate a config file with encrypted credentials. Place it in the project root and rebuild — users will be prompted for a master password instead of entering server details manually. See [`docs/SELF_HOSTED_CONFIG.md`](./docs/SELF_HOSTED_CONFIG.md) for details.

## No-Docker

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

### Online Deployment

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
            Access-Control-Allow-Origin "*" # or your selfhosted Calino instance URL
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

# Screenshots

## Mobile month and task view

<img width="357" height="774" alt="image" src="https://github.com/user-attachments/assets/609e3443-ac80-4116-94d5-fe13b97a0673" />
<img width="357" height="774" alt="image" src="https://github.com/user-attachments/assets/3e1d565a-a066-4452-a389-3cb847953b3e" />

## Desktop tasks and journal (the journal has markdown support!)

<img width="1224" height="925" alt="image" src="https://github.com/user-attachments/assets/cdd8cb01-8a5e-4a7b-b83f-dfdec8158512" />
<img width="1221" height="925" alt="image" src="https://github.com/user-attachments/assets/4037bd13-755c-4e2a-a4a3-57544afb60c9" />

## Quickly create events through Natural Language Processing in the Command Palette (no AI)

<img width="640" height="244" alt="image" src="https://github.com/user-attachments/assets/7e6623f7-5f12-4b44-a74b-8cce3fb1bf94" />


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
