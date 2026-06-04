# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:22-alpine3.21 AS build

RUN corepack enable && corepack prepare pnpm@10 --activate

# Build-time env vars (overridable via --build-arg)
ARG VITE_SITE_URL=https://calino.io
ARG CALINO_ENABLE_SW=false
ENV VITE_SITE_URL=$VITE_SITE_URL \
    CALINO_ENABLE_SW=$CALINO_ENABLE_SW

WORKDIR /app

# Install deps first (layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default content
RUN rm -rf /usr/share/nginx/html/*

# Copy our nginx config + security headers include
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/conf.d/nginx-security-headers.conf

# Copy built assets from build stage (owned by nginx user)
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080

STOPSIGNAL SIGQUIT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
