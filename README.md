# YesWeb

**Live:** [yesweb.app](https://yesweb.app) · backup origin: [pwa-demo-ruukiox65q-uc.a.run.app](https://pwa-demo-ruukiox65q-uc.a.run.app)

A "show off everything the web can do today" PWA. ~60 live demos covering 60+ web platform capabilities — from Service Workers and WebAuthn passkeys through WebGPU and a full 3D multiplayer game — all served from a single Node container on Cloud Run.

## What's inside

| Subsystem | Path | Purpose |
|---|---|---|
| Frontend PWA | [`apps/web`](apps/web) | React 19 + Vite + Tailwind. Service worker, installable, demos shell. |
| Backend | [`apps/server`](apps/server) | Express + Socket.io + web-push + Drizzle/Postgres. Same-origin API + static SPA serve. |
| Load-test bots | [`apps/bots`](apps/bots) | Headless Socket.io clients that orbit the Tower Climb lobby. |
| Shared types | [`packages/shared`](packages/shared) | Socket.io event contracts + game domain models. |

Deeper architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Subsystem READMEs live in each `apps/*/README.md` + a couple of cross-cutting ones at [`apps/web/src/demos/README.md`](apps/web/src/demos/README.md) and [`apps/web/src/game/README.md`](apps/web/src/game/README.md).

## Quickstart

```bash
npm install
npm run gen:vapid                  # one-time: writes VAPID keys to .env
npm run gen:assets                 # generates PWA icons + splash from apps/web/public/logo.svg
npm run db:up                      # optional: start Postgres 16 in Docker
npm run dev                        # web on :5173, api on :3000 (proxied)
```

Open http://localhost:5173.

Exercise the multiplayer game from headless clients:

```bash
LOADTEST_TOKEN=$(grep LOADTEST_TOKEN .env | cut -d= -f2) \
  npm run bots -- --count=10 --host=http://localhost:3000
```

## Stack

- **Web** — Vite 7, React 19, React Router 7, Tailwind 4, `vite-plugin-pwa` (injectManifest), Workbox 7, react-three-fiber, three.js
- **Server** — Express 4, Socket.io 4, web-push, Drizzle ORM, `pg` against Postgres 16
- **Shared** — TypeScript types consumed as raw source by Vite, as compiled JS by Node
- **Infra** — Docker, GitHub Actions, Cloud Build, Cloud Run (us-central1), Cloud SQL, Cloudflare DNS

## Deploy targets

Two live deploys today:

1. **GCP Cloud Run** at `yesweb.app` — production. Auto-deploys on every push to `main` via GitHub Actions. Architecture, IAM, ops cookbook: [`deploy/gcp/README.md`](deploy/gcp/README.md).
2. **LAN box autodeploy** — a self-hosted polling deploy on a home server. Used for local-network testing of platform features (PWA install, push, NFC) that need a stable HTTPS origin on the LAN.

Both deploy the same single-container image (web + server + sockets all on the same origin).

## Brand

The project was originally called `pwa-demo` and rebranded to **YesWeb** in May 2026. Internal package names, the GCP project ID, and the Cloud Run service name still use the `pwa-demo` slug for backward compatibility. New work uses the YesWeb name in user-visible surfaces.

## Customising the logo

Drop your SVG at `apps/web/public/logo.svg` and rerun `npm run gen:assets`.

## Production build

```bash
npm run build
npm start            # serves SPA + API on :3000
```

## Contributing

- **Adding a demo:** see [`apps/web/src/demos/README.md`](apps/web/src/demos/README.md) — there's a registry pattern; don't break the recipe.
- **Socket events:** extend types in [`packages/shared/src/index.ts`](packages/shared/src/index.ts) and wire both sides.
- **Database schema:** edit [`apps/server/src/db/schema.ts`](apps/server/src/db/schema.ts), then `npm -w @pwa-demo/server run db:push`.
- **Auto-deploy:** anything outside `.planning/`, `*.md`, `.gitignore`, `LICENSE`, `docker-compose.yml`, `scripts/**` triggers a Cloud Run deploy on push to `main`.
