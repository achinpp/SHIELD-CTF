# syntax=docker/dockerfile:1

# Multi-stage build for the S.H.I.E.L.D. CTF platform.
#
# The runtime image carries only Next's standalone output — no npm, no
# TypeScript, no Tailwind, no source. Build it with:
#
#   docker compose up --build
#
# Node 22 is the current LTS; `next` requires >= 20.9.
ARG NODE_VERSION=22-alpine
FROM node:${NODE_VERSION} AS base


# ── deps ────────────────────────────────────────────────────────────────────
# Isolated so a source-only change reuses the cached install layer.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` installs devDependencies too — the build needs the toolchain, and
# none of it survives into the runner stage.
RUN npm ci


# ── builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `public/` now carries challenge artifacts, but keep the mkdir: it costs
# nothing and the runner's COPY still fails on a tree without the directory.
RUN mkdir -p public && npm run build


# ── runner ──────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The node image already ships an unprivileged `node` user (uid 1000).
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# busybox wget — the alpine image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/ || exit 1

# server.js is emitted by `output: "standalone"`; it replaces `next start`.
CMD ["node", "server.js"]
