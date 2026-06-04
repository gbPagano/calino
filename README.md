# Calino

A browser-based CalDAV client — sync with your own server, no data is sent elsewhere.

Check out the hosted version at [Calino.io](https://calino.io).

Despite Calino being a web app, it acts as a desktop client, in the sense that it only sends data between your computer and the CalDAV servers; there is no central Calino server to store your information, as it is a static web app.

> **⚠️ Active Project:** Calino is under active development. Expect breaking changes, evolving UI, and frequent updates. Use at your own risk — but report bugs, we'd love the feedback!

### CalDAV Proxy

Due to the browser based nature of Calino, if your CalDAV server doesn't support CORS, you can use Calino's hosted proxy URL during setup: https://proxy.calino.io

With that said, I urge you to either selfhost Calino or at least use your own proxy, to minimize the amount of data being sent to servers that are not your own. `proxy.calino.io` is solely for convenience — don't rely on it. To run your own proxy, see [`docs/CORS_PROXY.md`](./docs/CORS_PROXY.md).

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

- **PWA** — install as a native app (*offline / service-worker support requires self-hosting; GitHub Pages strips the `Service-Worker-Allowed` header, so offline mode does not work there. See "Service Worker" below.*)
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

## Docker

The fastest way to self-host:

```bash
docker compose up -d
```

Calino runs at http://localhost:8080. To customize settings (site URL, offline support), create a `.env` file — see [`docs/DOCKER.md`](./docs/DOCKER.md) for full details.

## Selfhosting

Calino is just a static React app — host it anywhere that serves HTML/JS.

1. Build: `pnpm build`
2. Serve the `dist/` folder (make sure SPA fallback is configured — see the platform notes below)

All user data, including CalDAV credentials, lives in the browser's `localStorage`. There is no backend, no telemetry, and no central Calino server to store your information.

**Config (in-app):**

- Click the gear icon or use `Cmd+K` → "Settings"
- Add your CalDAV server URL, username, password
- App stores credentials in `localStorage` (encrypted with AES-256-GCM)

**Site URL (for SEO / Open Graph cards):**

```bash
cp .env.example .env.local
# Edit .env.local and set VITE_SITE_URL=https://your-domain.com
pnpm build
```

`VITE_SITE_URL` is baked into `index.html` at build time and used for the canonical link, Open Graph / Twitter cards, and the JSON-LD structured-data block. If unset, the meta tags will contain the literal placeholder `%VITE_SITE_URL%` and social shares will look broken.

### Deployment

Calino is a Vite SPA. Any static host works as long as it rewrites all unknown paths to `/index.html` (so client-side routes like `/week` and `/day` resolve on refresh). A few common choices:

**Netlify** — already configured. The `public/_redirects` file in this repo maps every route to `/index.html`. Just connect the repo and use:

- Build command: `pnpm build`
- Publish directory: `dist`

**Cloudflare Pages:**

- Build command: `pnpm build`
- Build output: `dist`
- Add a `_redirects` file (or a Pages Function) that rewrites `/*` to `/index.html`

**GitHub Pages** — deploy via GitHub Actions:

1. Fork the repo
2. Edit `.github/workflows/deploy.yml` — change `VITE_SITE_URL` to `https://<your-user>.github.io/<your-repo>`
3. Settings → Pages → Source: **GitHub Actions**
4. Push to `main` (or Actions → Deploy to GitHub Pages → Run workflow)

Caveat: service-worker offline support does **not** work on GitHub Pages (their response headers strip the `Service-Worker-Allowed` header). See "Service Worker" below.

**Any static host (Nginx, Apache, Caddy, S3+CloudFront, etc.):** configure SPA fallback so unknown paths return `index.html`. Example for Nginx:

```nginx
location / {
    try_files $uri /index.html;
}
```

### Service Worker / Offline Mode

The service worker is **disabled by default**. To enable offline support:

1. Build with `CALINO_ENABLE_SW=true` (or add it to `.env.local`)
2. Make sure your host returns `Service-Worker-Allowed: /` so the SW can claim the whole origin

For Docker, set `CALINO_ENABLE_SW=true` in your `.env` file and rebuild — see [`docs/DOCKER.md`](./docs/DOCKER.md).

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
            # Replace "*" with your Calino origin in production, e.g.
            # Access-Control-Allow-Origin "https://calendar.example.com"
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

**Tip:** the `*` in `Access-Control-Allow-Origin` works for development and trusted clients. For production, replace it with your Calino origin (e.g. `https://calendar.example.com`) to avoid letting arbitrary sites read your calendar.

### Self-Hosting a CORS Proxy

If you can't add CORS headers to your CalDAV server, you can run a tiny proxy yourself. See [`docs/CORS_PROXY.md`](./docs/CORS_PROXY.md) for a one-file Cloudflare Worker you can deploy in a few minutes, plus the privacy trade-offs of using any proxy.

## Tech Stack

React 19 + TypeScript + Vite, Zustand v5, date-fns, chrono-node, @dnd-kit, framer-motion, Fuse.js, ical.js, Vitest

---

**Disclaimer:** This project is entirely vibe coded by [Minimax M2.7](https://minimax.io), but thoroughly tested. Issues may arise. Bug reports welcome.

## License

MIT
