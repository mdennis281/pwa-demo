# pwa-demo

A "show off everything PWAs can do today" demo app. Host shell with navigable sub-modules. Frontend in Vite/React, backend in Node/Express, Postgres in Docker.

## Quickstart

```bash
npm install
npm run gen:vapid        # one-time: writes VAPID keys to .env
npm run gen:assets       # generates PWA icons + splash from apps/web/public/logo.svg
npm run db:up            # optional: start Postgres in Docker
npm run dev              # web on :5173, api on :3000
```

Open http://localhost:5173.

## Sub-modules (foundation)

- `/worker` — Web Worker vs main-thread side-by-side
- `/status` — live list of connected websocket clients
- `/push` — subscribe and send a Web Push test
- `/manifest` — PWA install state + manifest playground

## Stack

- Vite 7 + React 19 + TypeScript + React Router 7 + Tailwind 4
- `vite-plugin-pwa` (injectManifest mode) + Workbox 7
- Express 4 + socket.io 4 + `web-push`
- Drizzle ORM + `pg` against Postgres 16 (docker-compose)
- `@vite-pwa/assets-generator` for icons and iOS splash screens

## Customising the logo

Drop your SVG at `apps/web/public/logo.svg` and rerun `npm run gen:assets`.

## Production build

```bash
npm run build
npm start   # serves SPA + API on :3000
```
