# Architecture

A bird's-eye view of how YesWeb is wired together. For specifics on any subsystem follow the links into per-app READMEs.

## One container, same origin

```
                                  ┌───────────────────────────────────┐
                                  │  Cloud Run container              │
                                  │                                   │
       https://yesweb.app  ──────►│  Node 20 + Express                │
                                  │   ├─ /api/*                       │
                                  │   ├─ /socket.io                   │
                                  │   └─ static  apps/web/dist        │
                                  │                                   │
                                  │   ─ env from Secret Manager       │
                                  │   ─ Cloud SQL Auth Proxy socket   │
                                  │                                   │
                                  └──┬──────────────────────┬─────────┘
                                     │                      │
                          Cloud SQL Postgres        Push notification dispatch
                          (yesweb-db, drizzle)      (web-push library)
```

The frontend and backend are **co-deployed in a single container**. The web client's `io()` is called with no URL, so it connects same-origin. There is no proxy, no separate API host, no CORS dance — `Host: yesweb.app` covers the whole surface area. This matches the LAN-box deploy layout exactly, so the same code runs everywhere.

## Repo layout

```
.
├─ apps/
│  ├─ web/              React PWA — Vite, Tailwind, Workbox, react-three-fiber
│  │   src/
│  │   ├─ demos/        62 demos + framework (modal/page/multi-page registry)
│  │   ├─ game/         Tower Climb 3D client (r3f, hand-rolled physics)
│  │   ├─ routes/       App.tsx routes (Home, Category, ?demo=, /d/<id>)
│  │   ├─ components/   Layout, sidebar, install prompt
│  │   ├─ lib/          Shared utilities (capabilities, push, socket, install)
│  │   ├─ workers/      Web Worker source (compute.worker.ts)
│  │   ├─ main.tsx      Entry, Workbox registration
│  │   └─ sw.ts         Custom service worker (injectManifest mode)
│  ├─ server/           Node backend — Express + Socket.io + push + DB
│  │   src/
│  │   ├─ routes/       /api/* (vapid, push, tower, passkeys, bg-fetch demo)
│  │   ├─ game/         Tower Climb server — lobby state machine + 20Hz tick
│  │   ├─ db/           Drizzle schema + pool + tower scores helpers
│  │   ├─ io.ts         Socket.io handshake, auth, debug broadcast
│  │   ├─ index.ts      Express bootstrap + static SPA serve
│  │   ├─ env.ts        Zod-validated env config
│  │   └─ metrics.ts    Server telemetry singleton
│  └─ bots/             Load-test harness — headless Socket.io fleet
│      src/
│      └─ index.ts      CLI; orbital movement, 20Hz inputs, stats
├─ packages/
│  └─ shared/           TS types for the socket.io contract + game models
│      src/index.ts
├─ deploy/
│  └─ gcp/README.md     Cloud Run + Cloud SQL ops cookbook
├─ scripts/             one-shot generators (VAPID, PWA assets, screenshots)
├─ Dockerfile           Multi-stage; builds shared+web+server, slim runtime
├─ cloudbuild.yaml      Cloud Build pipeline (build → push → deploy)
├─ docker-compose.yml   Local Postgres for development
└─ .github/workflows/
   └─ deploy.yml        GitHub Actions → gcloud builds submit
```

## Request flow

### Static page load

```
browser ──► Cloudflare DNS (yesweb.app A → Google IPs)
         ──► Google edge (Cloud Run domain mapping, managed SSL)
         ──► Cloud Run pwa-demo us-central1
         ──► Express static middleware  →  apps/web/dist/index.html
```

If `Host: www.yesweb.app`, Express's canonical-host middleware 301-redirects to `https://yesweb.app/...` with path + query preserved.

### API call

```
browser ──► .../api/health           same origin, no CORS preflight
         ──► Express route handler
         ──► JSON response
```

### Realtime (Socket.io)

```
browser ──► io() with no URL → reuses window.location.origin
         ──► WebSocket upgrade on /socket.io
         ──► Express server (HTTP) hands off to socket.io
         ──► attachSocket() registers per-socket event handlers
```

Same-origin connection means no auth headers, no CORS dance, no SameSite cookie weirdness. The PWA client identity is whatever the socket session carries.

### Push notification

```
1. Browser  → POST /api/push/subscribe        { endpoint, keys }
              Server stores PushSubscription in memory.

2. (Later)
   Server   → web-push send to each subscription's endpoint
              VAPID-signed payload → push provider (FCM, Mozilla, etc.)

3. Push provider → user's browser → Service Worker push event
4. Service Worker → Notification.show()
```

The server holds subscriptions in memory; restart clears them. The trade-off is intentional: this is a demo, not a notification platform.

## Data layer

- **Cloud SQL Postgres** (managed; Cloud Run reaches it via Unix-socket Cloud SQL Auth Proxy injected by `--add-cloudsql-instances`).
- **Drizzle ORM** with `pg` driver. Two tables today: `connection_events` (audit trail of socket connects) and `tower_high_scores` (Tower Climb leaderboard).
- **Graceful degrade:** if `DATABASE_URL` is wrong or Postgres is unreachable, `getDb()` returns null. All DB writes/reads no-op safely. The server keeps running; only the DB-backed demos (passkeys, leaderboard) lose persistence.

In-memory state (push subscriptions, lobbies, players, passkey credentials) lives in the Node process and is lost on restart. That's fine for everything except the high score leaderboard, which is the one piece of persistence-worthy state.

## Auth model

Three identity tiers, distinguished by what gets presented at socket connection:

| Tier | How | What it grants |
|---|---|---|
| Anonymous | No auth | Browse, join open lobbies, vote etc. |
| Bot | `io({ auth: { isBot: true, token: LOADTEST_TOKEN } })` at handshake | Bypass lobby maxPlayers cap, excluded from leaderboard persistence. Reject if token wrong. |
| Admin | Post-connect `socket.emit('admin:elevate', token)` callback | Kick players, pause Official Server, edit lobby config. Admins are sticky on the same socket; reconnect re-elevates. |

REST endpoints don't have user auth (it's a public demo). WebAuthn / Passkeys demos use the in-memory passkey store at `/api/passkeys/*` — that's a real WebAuthn implementation but the credential store is in-memory and demo-scope only.

## Build & deploy

### Local

```
npm run dev    → vite on :5173 + tsx watch on :3000, no DB needed
npm run build  → builds shared → web → server in order
npm start      → runs the compiled Node server on :3000 serving dist
```

### Production (GCP)

Two deploy paths share `cloudbuild.yaml`:

1. **Manual:** `gcloud builds submit --config=cloudbuild.yaml ...` from your laptop.
2. **CI:** push to `main` → GH Actions auths via SA key → runs the same `gcloud builds submit`.

Cloud Build steps: docker build (multi-stage, with BuildKit cache-from from `latest`) → push two tags (`<short-sha>` + `latest`) → `gcloud run deploy` with `--add-cloudsql-instances` and `--set-secrets`. Deploy uses `--min-instances=1` to keep the websocket-heavy server warm.

### Image layout

The Dockerfile builds all three workspaces (shared, web, server) in one stage, then ships a slim Node 20 runtime containing only:

- `/app/node_modules` (root-hoisted npm workspaces → all deps land here)
- `/app/apps/server/dist` (compiled Node code)
- `/app/apps/web/dist` (static SPA bundle)
- `/app/packages/shared` (preserved for module resolution)

Runs as non-root user `runner` (UID 10001) on port 8080. No bot harness ships in the image — bots are a dev-time tool.

## Frontend architecture

Every demo is one of three types defined in [`apps/web/src/demos/_types.ts`](../apps/web/src/demos/_types.ts):

| Type | Routing | Used for |
|---|---|---|
| `modal` | `?demo=<id>` query param overlay | 53 demos — small, focused, single-screen |
| `page` | `/d/<id>` full route, wrapped in `<DemoPage>` | 8 demos — larger UIs (Web Push, Manifest playground, IndexedDB bench, Passkeys diag, Speech Echo, Islands, WCO, Web Worker) |
| `multi-page` | `/d/<id>/*` with internal sub-routing | 1 demo — Tower Climb (lobby → picker → game) |

A central registry in [`_registry.ts`](../apps/web/src/demos/_registry.ts) lazy-loads every demo. The sidebar, the per-category page, the routes in `App.tsx`, and the favorites system all derive from the registry. Adding a new demo is one file + one registry entry — full contract in [`apps/web/src/demos/README.md`](../apps/web/src/demos/README.md).

Capabilities (a separate concept — there are ~70 entries in [`apps/web/src/lib/capabilities.ts`](../apps/web/src/lib/capabilities.ts)) describe browser APIs and their detection logic. A demo declares which capability ids it exercises. The M:N mapping lets one demo cover multiple capabilities (Push covers `push` + `notifications`; Floating Islands covers `motion` + `orientation`; Tower Climb covers `webgl` + `webgl2` + `websocket` + `gamepad`) and lets one capability be touched by multiple demos (WebAuthn has a 30-line modal demo *and* a full `/d/passkeys` diagnostic page).

## Backend architecture

Two execution domains share the same Node process:

1. **REST + static serve** — Express routes under `/api/*` and a static middleware for the SPA bundle. Routes: `vapid-public-key`, `push/*`, `tower/leaderboard`, `bg-fetch-demo`, `passkeys/*`.
2. **Realtime** — Socket.io wraps the same HTTP server. Two layers of socket event handlers:
   - `io.ts` — handshake auth (bot/admin), debug broadcast, ping probes, status room
   - `game/index.ts` — Tower Climb lobby management, 20 Hz snapshot tick, leaderboard broadcast

Each tier is documented in [`apps/server/README.md`](../apps/server/README.md).

## Tower Climb (3D multiplayer)

A non-trivial subsystem worth calling out separately. **Client-authoritative**: server is purely a relay + scorekeeper, no physics replication. The whole tower is deterministic and seed-based (seed=1337), so all clients see the same world without any state being transmitted.

- **Client** (`apps/web/src/game/`) — react-three-fiber Canvas, hand-rolled AABB sweep physics, 20 Hz input emit, 110 ms interpolation buffer for remote players, shader precompiler to dodge first-frame jank.
- **Server** (`apps/server/src/game/`) — in-memory lobby registry, 20 Hz snapshot broadcast per room, persistent Official Server with sentinel host, high score writes on disconnect.

Full geometry inventory, physics tuning, controls, and architectural quirks: [`apps/web/src/game/README.md`](../apps/web/src/game/README.md).

## Load-test bots

`apps/bots` is a CLI that spawns N headless Socket.io clients into a lobby with deterministic orbital movement at 20 Hz. Useful for:

- saturating the server tick loop to find performance limits
- smoke-testing the lobby/game pipeline end-to-end
- populating the Official Server with activity so first-time visitors don't land on an empty world

Auth: requires `LOADTEST_TOKEN` (matches server env). Without it, the handshake middleware rejects with `"invalid bot token"`. Run details: [`apps/bots/README.md`](../apps/bots/README.md).

## Service worker / PWA semantics

The web app ships a custom Workbox service worker (`apps/web/src/sw.ts`) using **injectManifest mode** — Vite injects the precache manifest, but the SW code is hand-written. This is necessary because the demos exercise SW APIs directly (push, background sync, background fetch) and need handlers that don't fit Workbox's generated patterns.

- **Precache:** SPA shell and assets (130+ entries, ~3.5 MB).
- **Push event handler:** dispatches Notification.show with VAPID-signed payloads; broadcasts `push:received` / `push:shown` / `push:error` to clients via postMessage for diagnostic UI.
- **Background Sync handler:** drains a `pbs-queue` IndexedDB store on `sync` event, writes a `pbs-sync` checkpoint.
- **Background Fetch handler:** intercepts download progress events for the Background Fetch demo.

The manifest at `apps/web/public/manifest.webmanifest` declares `display: standalone` and `display_override: ["window-controls-overlay", "standalone"]` so installed PWAs can opt into WCO on desktop.

## Cross-cutting conventions

- **Memory note:** `packages/shared` is consumed as **raw TS source** by Vite; the Node side must use `import type` only when pulling from `@pwa-demo/shared`, otherwise the compiled JS errors trying to require `.ts` extensions.
- **Same-origin assumption:** the frontend's parameter-less `io()` is structural. Splitting web/server across hostnames requires either an HTTPS LB / Cloudflare-Worker-as-Host-rewriter, or a build-time `VITE_SERVER_URL`. The current deploy keeps everything co-located to dodge this.
- **`*.run.app` is exempt from canonical-host redirect** in [`apps/server/src/index.ts`](../apps/server/src/index.ts), so the Cloud Run-provided backup URL stays accessible for debug.
- **The autodeploy `paths-ignore`** prevents docs-only commits from burning CI minutes.
