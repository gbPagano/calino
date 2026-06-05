# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:22-alpine3.21 AS build

RUN corepack enable && corepack prepare pnpm@10 --activate

# Build-time env vars (overridable via --build-arg)
ARG VITE_SITE_URL=https://calino.io
ARG CALINO_ENABLE_SW=false
ARG CALINO_GITHUB_REPO=ivan-malinovski/Calino
ARG CALINO_CONTACT_EMAIL=calendar@malinov.ski
ENV VITE_SITE_URL=$VITE_SITE_URL \
    CALINO_ENABLE_SW=$CALINO_ENABLE_SW \
    CALINO_GITHUB_REPO=$CALINO_GITHUB_REPO \
    CALINO_CONTACT_EMAIL=$CALINO_CONTACT_EMAIL

WORKDIR /app

# Install deps first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM caddy:2-alpine

# Copy Caddy config
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built assets from build stage
COPY --from=build /app/dist /srv

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
