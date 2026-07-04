# Calino self-hosted CORS proxy

A tiny, zero-dependency proxy that adds the CORS + WebDAV headers Calino needs
to talk to a CalDAV server from the browser. Use this if your CalDAV server
can't send CORS headers and you'd rather not use Cloudflare or edit your
reverse proxy.

## Run

**Docker Compose:**

```bash
docker compose up -d --build
```

**Plain Node (18+):**

```bash
node server.mjs
```

Listens on port `8081` by default. Then in Calino settings set:

- **Server URL** — your CalDAV server, e.g. `https://cal.example.com`
- **Proxy URL** — where this proxy is reachable, e.g. `http://localhost:8081`

Serve it over HTTPS (behind your own reverse proxy) in production so browsers
don't block it as mixed content.

## Config

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8081` | Port to listen on |
| `ALLOWED_ORIGINS` | *(empty)* | Comma-separated Calino origins allowed to use the proxy. Empty = open to any origin. |

## Notes

- Credentials (the `Authorization` header) and request/response bodies are
  passed straight through and never logged.
- Follows redirects and exposes `X-Target-URL` so `.well-known` CalDAV
  discovery works through the proxy.
- Advertises `MKCOL, MKCALENDAR, COPY, MOVE` so calendar creation and Calino
  settings sync work.

See [`../docs/CORS_PROXY.md`](../docs/CORS_PROXY.md) for all proxy options
(hosted, Cloudflare Worker, self-hosted).
