# syntax=docker/dockerfile:1.7

# ────────────────────────────────────────────────────────────────────────
# pwa-demo container — Cloud Run target.
# Single image serves the React PWA static bundle AND the Express/Socket.io
# API on the same origin (matches the LAN-box layout so the web client's
# parameter-less io() works unchanged).
# ────────────────────────────────────────────────────────────────────────

# Stage 1: install + build all workspaces.
FROM node:20-bookworm-slim AS build
WORKDIR /repo
ENV NODE_ENV=development
ENV NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_PROGRESS=false

# Manifest layer first so dep installs cache across code-only changes.
COPY package.json package-lock.json* ./
COPY apps/server/package.json   apps/server/package.json
COPY apps/web/package.json      apps/web/package.json
COPY apps/bots/package.json     apps/bots/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspaces --include-workspace-root

# Sources + tsconfigs.
COPY tsconfig.base.json ./
COPY packages/shared    packages/shared
COPY apps/server        apps/server
COPY apps/web           apps/web

# `shared` is consumed as raw TS by Vite (web) but as compiled .js by Node
# (server), so it must build first. See repo memory note.
RUN npm -w @pwa-demo/shared run build
RUN npm -w @pwa-demo/web    run build
RUN npm -w @pwa-demo/server run build

# Strip dev deps from the workspace tree so the runtime stage stays slim.
RUN npm prune --omit=dev --workspaces --include-workspace-root

# Stage 2: minimal runtime.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run injects PORT, but having a sensible default lets the image run
# anywhere (local docker run, GCE, etc.) without surprises.
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy only what `node apps/server/dist/index.js` actually needs at runtime.
# npm workspaces hoist deps to the repo-root node_modules; the symlinks for
# @pwa-demo/shared etc. live there too. No per-workspace node_modules to
# copy — Node module resolution walks up and finds them at /app/node_modules.
COPY --from=build /repo/package.json              ./package.json
COPY --from=build /repo/node_modules              ./node_modules
COPY --from=build /repo/apps/server/package.json  ./apps/server/package.json
COPY --from=build /repo/apps/server/dist          ./apps/server/dist
COPY --from=build /repo/apps/web/dist             ./apps/web/dist
COPY --from=build /repo/packages/shared           ./packages/shared

# Run as a non-root user so a container escape doesn't get free root.
RUN useradd -u 10001 -m runner && chown -R runner:runner /app
USER runner

EXPOSE 8080
CMD ["node", "apps/server/dist/index.js"]
