# Self-Hosting with Docker

Calino is a static React app. The Docker image bundles it with nginx for a production-ready setup.

## Quick Start

```bash
docker compose up -d
```

Calino is now running at http://localhost:8080.

## ⚠️ Build-Time vs Runtime Variables

All `VITE_*` and `CALINO_*` variables are **baked into the JavaScript at build time**. Changing them in `docker-compose.yml` `environment:` section does nothing — you must **rebuild the image**:

```bash
# ❌ This does NOT change the site URL:
environment:
  - VITE_SITE_URL=https://other-domain.com  # No effect!

# ✅ This does:
docker compose build --build-arg VITE_SITE_URL=https://other-domain.com
docker compose up -d
```

Or use a `.env` file in the project root:

```bash
# .env (in same directory as docker-compose.yml)
VITE_SITE_URL=https://calendar.example.com
CALINO_ENABLE_SW=true
```

Then rebuild:

```bash
docker compose build
docker compose up -d
```

## Environment Variables

| Variable | Description | Default | Requires Rebuild |
|----------|-------------|---------|:---:|
| `VITE_SITE_URL` | Public URL for SEO / Open Graph meta tags. No trailing slash. | `https://calino.io` | ✅ |
| `CALINO_GITHUB_REPO` | GitHub repo slug (shown in footer). | `ivan-malinovski/Calino` | ✅ |
| `CALINO_CONTACT_EMAIL` | Contact email (shown in footer). | `calendar@malinov.ski` | ✅ |
| `CALINO_ENABLE_SW` | Enable service worker for offline support. Requires `Service-Worker-Allowed: /` header from your reverse proxy. | `false` | ✅ |

## Architecture

```
┌──────────────────────────────────────┐
│  nginx:1.27-alpine (~23 MB compressed)│
│  ├── /usr/share/nginx/html           │  ← built React SPA (static files)
│  └── nginx.conf                      │  ← SPA fallback, gzip, security headers
│                                      │
│  Runs as non-root (nginx user)       │
│  Listen on port 8080                 │
│  Read-only filesystem                │
└──────────────────────────────────────┘
```

The container is **stateless** — all user data lives in the browser's `localStorage`. No volumes needed.

## Multi-Arch Builds

The image supports **amd64** (x86) and **arm64** (Apple Silicon, Raspberry Pi 4+, Oracle Cloud ARM).

### Pull from GHCR (no build needed)

Pre-built multi-arch images are published to GitHub Container Registry on every push to `main` and on version tags:

```bash
# Latest from main
docker pull ghcr.io/ivan-malinovski/calino:main

# Specific version
docker pull ghcr.io/ivan-malinovski/calino:0.6.0

# Run directly (tmpfs mounts required for non-root nginx)
docker run -d -p 8080:8080 \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,uid=101,gid=101 \
  --tmpfs /var/run:rw,noexec,nosuid,uid=101,gid=101 \
  --tmpfs /tmp:rw,noexec,nosuid,uid=101,gid=101 \
  ghcr.io/ivan-malinovski/calino:main
```

Docker automatically pulls the correct architecture for your machine.

### Build locally for current platform

```bash
docker compose build
docker compose up -d
```

On Apple Silicon this produces an arm64 image natively — no emulation.

### Build multi-arch locally

Requires `docker buildx` and QEMU:

```bash
# One-time setup: create a buildx builder with multi-platform support
docker buildx create --name calino-builder --driver docker-container --use
docker buildx inspect --bootstrap

# Build for both platforms (loads only native into local Docker)
docker buildx build --platform linux/amd64,linux/arm64 -t calino:latest .

# Build and push to a registry
docker buildx build --platform linux/amd64,linux/arm64 -t your-registry/calino:latest --push .
```

## Security Posture

The Docker setup follows least-privilege principles:

| Hardening | Status | Details |
|-----------|:------:|---------|
| Runs as non-root | ✅ | nginx master process runs as `nginx` user |
| Read-only filesystem | ✅ | `read_only: true` + `tmpfs` for temp dirs |
| All capabilities dropped | ✅ | `cap_drop: ALL` |
| Only required capabilities added | ✅ | `CHOWN`, `SETGID`, `SETUID` (nginx worker process user switching) |
| No new privileges | ✅ | `no-new-privileges` |
| Graceful shutdown | ✅ | `STOPSIGNAL SIGQUIT` |
| Process limit | ✅ | `pids_limit: 256` |
| Memory limit | ✅ | `mem_limit: 128m` (static site needs very little) |
| nginx version hidden | ✅ | `server_tokens off` |
| Security headers | ✅ | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Log rotation | ✅ | 3 × 10 MB max |

### Content Security Policy

Calino does **not** ship a `Content-Security-Policy` header because the app connects to **user-configured CalDAV servers** at arbitrary origins — a static CSP would break the app for most deployments. If your CalDAV server has a fixed origin, you can add a CSP header in your reverse proxy. A reasonable starting point:

```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://your-caldav.example.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
```

## Updating

Pull the latest changes and rebuild:

```bash
git pull
docker compose build
docker compose up -d
```

Or if using a pre-built image from a registry:

```bash
docker compose pull
docker compose up -d
```

Docker Compose only restarts containers whose image changed.

## Reverse Proxy

Put Calino behind a reverse proxy for TLS and custom domains. The container listens on port **8080**.

### Caddy

```caddy
calendar.example.com {
    reverse_proxy calino:8080
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name calendar.example.com;

    ssl_certificate /etc/letsencrypt/live/calendar.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/calendar.example.com/privkey.pem;

    location / {
        proxy_pass http://calino:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.calino.rule=Host(`calendar.example.com`)"
  - "traefik.http.routers.calino.entrypoints=websecure"
  - "traefik.http.routers.calino.tls.certresolver=letsencrypt"
  - "traefik.http.services.calino.loadbalancer.server.port=8080"
```

### With Auth (Authelia / Authentik)

Add authentication in front of Calino using your identity provider's proxy integration. Calino has no built-in auth — it relies on your reverse proxy layer.

## Offline Support / Service Worker

By default, the service worker is disabled. To enable offline mode:

1. Set `CALINO_ENABLE_SW=true` in your `.env`
2. Rebuild: `docker compose build`
3. Ensure your reverse proxy returns `Service-Worker-Allowed: /` header for `/sw.js`

Example Caddy config:

```caddy
handle /sw.js {
    header Service-Worker-Allowed "/"
    reverse_proxy calino:8080
}
```

## Troubleshooting

### Container won't start

Check logs:

```bash
docker compose logs calino
```

Common causes:
- Port 8080 already in use → change the left side of `ports` in compose
- nginx config syntax error → rebuild after editing `nginx.conf`

### Blank page on refresh

Ensure your reverse proxy rewrites all paths to `index.html`. The included nginx config handles this internally, but if you're proxying through another nginx instance, add SPA fallback there too.

### CalDAV CORS errors

Calino runs in the browser — your CalDAV server must allow CORS from your Calino origin. Even if CalDAV is on the same host, different port or subdomain = different origin = CORS required. See the main [README](../README.md#cors-headers) for Caddy examples, or use a CORS proxy.

### Read-only filesystem errors

The container runs with `read_only: true`. If a plugin or modification needs to write files, add a `tmpfs` mount in `docker-compose.yml`:

```yaml
tmpfs:
  - /some/writable/path
```
