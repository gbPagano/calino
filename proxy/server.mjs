// Calino CORS proxy — self-hostable, zero dependencies (Node 18+).
//
// Calino talks to a CalDAV server from the browser. Many CalDAV servers don't
// send CORS headers, so the browser blocks the requests. This tiny proxy sits
// in front of your CalDAV server, forwards the request, and adds the CORS
// headers Calino needs — including WebDAV methods (MKCOL, MKCALENDAR, COPY,
// MOVE) required for calendar creation and settings sync.
//
// URL convention (must match what Calino sends):
//   http://your-proxy:8081/<url-encoded-origin>/<path>
//   e.g. http://your-proxy:8081/https%3A%2F%2Fdav.example.com/principals/user
//
// Config via env:
//   PORT              Port to listen on (default 8081)
//   ALLOWED_ORIGINS   Comma-separated Calino origins allowed to use this proxy.
//                     Leave empty (default) to allow any origin — fine for a
//                     private/self-hosted deployment.

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT) || 8081
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ALLOW_METHODS =
  'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, OPTIONS, MKCOL, MKCALENDAR, COPY, MOVE'
const ALLOW_HEADERS = 'Authorization, Content-Type, Depth, Prefer, If-None-Match, If-Match'

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    // Health check / root — lets container healthchecks pass.
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Calino CORS proxy OK')
      return
    }

    // Optional origin allowlist (open by default).
    if (ALLOWED_ORIGINS.length) {
      const origin = req.headers.origin || req.headers.referer || ''
      const allowed = !origin || ALLOWED_ORIGINS.some((a) => origin.startsWith(a))
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden')
        return
      }
    }

    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing target server in path')
      return
    }

    const targetBase = decodeURIComponent(pathParts[0])
    // Reconstruct path from the raw pathname to preserve trailing slashes.
    const rawPath = url.pathname.substring(url.pathname.indexOf('/', 1))
    const targetPath = (rawPath || '/') + url.search

    // Handle CORS preflight.
    if (req.method === 'OPTIONS') {
      res
        .writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': ALLOW_METHODS,
          'Access-Control-Allow-Headers': ALLOW_HEADERS,
        })
        .end()
      return
    }

    const targetUrl = targetBase.replace(/\/$/, '') + targetPath

    // Forward headers, minus ones the fetch layer must set itself.
    const headers = { ...req.headers }
    delete headers.host
    delete headers.connection
    delete headers['content-length']

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

    // Follow redirects so .well-known discovery works, then expose the final
    // URL via X-Target-URL — Calino reads it to locate the real endpoint.
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req : undefined,
      duplex: hasBody ? 'half' : undefined,
      redirect: 'follow',
    })

    const outHeaders = {}
    upstream.headers.forEach((value, key) => {
      outHeaders[key] = value
    })
    // fetch already decoded the body, so drop encoding/length headers that
    // would no longer match the bytes we send.
    delete outHeaders['content-encoding']
    delete outHeaders['content-length']
    delete outHeaders['transfer-encoding']

    outHeaders['access-control-allow-origin'] = '*'
    outHeaders['access-control-allow-methods'] = ALLOW_METHODS
    outHeaders['access-control-allow-headers'] = ALLOW_HEADERS
    outHeaders['access-control-expose-headers'] = 'Location, X-Target-URL'
    outHeaders['x-target-url'] = upstream.url

    const body = Buffer.from(await upstream.arrayBuffer())
    res.writeHead(upstream.status, outHeaders).end(body)
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Proxy error: ' + e.message)
  }
})

server.listen(PORT, () => {
  console.log(`Calino CORS proxy listening on :${PORT}`)
  if (ALLOWED_ORIGINS.length) {
    console.log(`Restricted to origins: ${ALLOWED_ORIGINS.join(', ')}`)
  } else {
    console.log('Open to any origin (set ALLOWED_ORIGINS to restrict).')
  }
})
