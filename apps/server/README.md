# `@pwa-demo/server` — YesWeb backend

Express + Socket.io + web-push + Drizzle/Postgres. Serves the built React PWA on the same origin so the browser's parameter-less `io()` Just Works.

## Source layout

```
src/
├─ index.ts              Express bootstrap; canonical-host redirect; SPA serve
├─ env.ts                Zod-validated env config
├─ io.ts                 Socket.io handshake auth + debug broadcast
├─ metrics.ts            Server telemetry singleton
├─ game/
│   ├─ index.ts          Tower Climb event handlers + 20Hz tick + leaderboard
│   └─ lobby.ts          In-memory lobby state machine
├─ db/
│   ├─ client.ts         Drizzle pool init (lazy, graceful degrade)
│   ├─ schema.ts         Tables: connection_events, tower_high_scores, server_config
│   ├─ towerScores.ts    High-score read/write helpers
│   └─ serverConfig.ts   Dedicated-server config (singleton row + in-memory cache)
└─ routes/
    ├─ vapid.ts          GET /api/vapid-public-key
    ├─ push.ts           Web Push subscribe / unsubscribe / send-now / send-delayed
    ├─ tower.ts          GET /api/tower/leaderboard
    ├─ bgfetch.ts        GET /api/bg-fetch-demo?mb=N (large download for BG Fetch demo)
    └─ passkeys.ts       WebAuthn registration + authentication
```

## HTTP routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness + uptime |
| GET | `/api/vapid-public-key` | Public key for web-push subscription |
| POST | `/api/push/subscribe` | Register a PushSubscription |
| POST | `/api/push/unsubscribe` | Remove a PushSubscription |
| POST | `/api/push/test` | Send a test notification to all/specified subs |
| POST | `/api/push/test/delayed` | Schedule a test notification N seconds out |
| GET | `/api/push/count` | Subscription count |
| GET | `/api/tower/leaderboard?limit=N` | Top-N Tower Climb scores, 5-sec cache |
| GET | `/api/bg-fetch-demo?mb=N` | Stream N MB of zeros for the Background Fetch demo |
| GET/POST/DELETE | `/api/passkeys/*` | WebAuthn registration, authentication, credential mgmt |
| GET | `/*` | SPA fallback — serves `apps/web/dist/index.html` |

After `/api/*`, any remaining GET goes to the React SPA's `index.html` so client-side routes (`/d/passkeys`, `/category/notifications`, etc.) work on direct load.

## Socket.io contract

The wire format is fully typed via `@pwa-demo/shared`. Each socket runs through two layers of event registration:

### Layer 1 — [`io.ts`](src/io.ts) (auth + meta)

**Handshake middleware:**
- If `socket.handshake.auth.isBot === true`, validate `token` matches `LOADTEST_TOKEN` (env). Reject if not.
- Stamp `socket.data.isBot` / `socket.data.isAdmin`.

**Client → server:**
- `status:join` / `status:leave` — subscribe/unsubscribe to the live-clients diagnostic room
- `debug:subscribe` / `debug:unsubscribe` — server stats stream (every 1 s)
- `ping:probe(sentAt)` — round-trip measurement
- `admin:elevate(token, ack)` — claim admin by presenting `ADMIN_TOKEN`; flips `socket.data.isAdmin=true` on match
- `admin:logout(ack)` — drop admin flag

**Server → client:**
- `clients:update([{id, userAgent, connectedAt, lastPingMs}, …])` — broadcast on connect/disconnect/ping
- `debug:server-stats({uptime, lobbyCount, playerCount, rxEvents, txEvents, loopLag:{p50,p99}, rssMB, …})` — 1 Hz to debug room
- `auth:status({isAdmin, isBot})` — on connect, on elevate, on logout
- `pong:reply(sentAt)` — echo ping timestamp

### Layer 2 — [`game/index.ts`](src/game/index.ts) (lobby + game)

**Client → server:**
- `lobby:browser:join` / `lobby:browser:leave` — subscribe to lobby list updates
- `lobby:create({name, displayName, character, role}, ack)` — open a new lobby
- `lobby:join({lobbyId, displayName, character}, ack)` — join an existing lobby
- `lobby:quick-join({displayName, character}, ack)` — drop into the least-full dedicated server; errors `no dedicated servers available` when they're disabled
- `lobby:leave()` — leave; persists max height to DB if you were on a dedicated server
- `game:input({x, y, z, yaw, state: 'idle'|'run'|'air'})` — 20 Hz position update (ignored while the lobby is paused)
- `admin:action({type: 'kick'|'pause'|'config', …}, ack)` — host or admin-only; acts on the **caller's current lobby** (config caps players 1–1000)
- `admin:get-config(ack)` — admin-only; read the global dedicated-server config
- `admin:set-config(patch, ack)` — admin-only; persist `{dedicatedEnabled?, dedicatedCount?, dedicatedPlayerCap?}` to `server_config` and reconcile the live fleet

**Server → client:**
- `lobby:list([{id, name, playerCount, maxPlayers, …}])` — broadcast on every lobby change (dedicated servers pinned at top)
- `lobby:state({lobby, you: {role, character}}|null)` — the lobby you're in
- `game:snapshot({lobbyId, t, players:[{id, x, y, z, yaw, state, ping, maxHeight, …}]})` — 20 Hz to each lobby room
- `tower:leaderboard([{displayName, character, maxHeight, sessionMs, achievedAt}])` — on browser:join + when a dedicated-server player leaves

`admin:get-config` / `admin:set-config` are registered in [`game/index.ts`](src/game/index.ts) (they need the lobby registry + reconcile), and both gate on `socket.data.isAdmin`.

Tower Climb specifics: [`apps/web/src/game/README.md`](../web/src/game/README.md) (the architectural quirks like "client-authoritative, server is a relay" apply on both sides).

## Database

Three tables, all [Drizzle-defined](src/db/schema.ts):

| Table | Purpose | Lifecycle |
|---|---|---|
| `connection_events` | Audit trail of socket connect/disconnects | Append-only |
| `tower_high_scores` | Tower Climb leaderboard | Insert on player leaves a dedicated server with `maxHeight > 0` |
| `server_config` | Dedicated-server fleet config (singleton `id=1`) | Upserted whenever an admin applies changes; read once on boot |

`server_config` is fronted by an **in-memory cache** in [`serverConfig.ts`](src/db/serverConfig.ts): reconcile and quick-join read the cache (never the DB), so the dedicated-server feature works fully even with no Postgres — it just won't survive a restart. Writes are clamped (`count` 1–50, `cap` 1–1000) and best-effort persisted.

**Graceful DB degrade** — [`db/client.ts`](src/db/client.ts) initializes the pool lazily; if it can't connect, `getDb()` returns null and every db-touching code path no-ops cleanly. The server stays up; only the leaderboard loses persistence.

**`drizzle-kit push`** is the sync mechanism. There are no checked-in migrations because the schema is small and idempotent. To apply schema changes in prod:

```sh
# proxy in one shell:
cloud-sql-proxy --address=127.0.0.1 --port=5433 \
  yesweb-497913:us-central1:yesweb-db

# in another:
DATABASE_URL="postgres://pwademo:$PW@127.0.0.1:5433/pwademo" \
  npm -w @pwa-demo/server run db:push
```

## In-memory state

Three things live in Node's heap and are lost on restart:

| State | Lives in | Loss on restart |
|---|---|---|
| Push subscriptions | `routes/push.ts` `Map<endpoint, PushSubscription>` | Yes — users would need to re-subscribe |
| Tower Climb lobbies & players | `game/lobby.ts` registry | Yes — players auto-leave on disconnect anyway. Dedicated servers are re-materialized on boot from `server_config` |
| Dedicated-server config | `db/serverConfig.ts` cache, backed by `server_config` | **No** — restored from Postgres on boot (defaults if no DB) |
| Passkey credentials | `routes/passkeys.ts` `Map<credentialId, ...>` | Yes — credential cleared, browser still has it (next register replaces) |
| Pending WebAuthn challenges | `routes/passkeys.ts` | Yes — auto-expire after 5 min anyway |

This is intentional. YesWeb is a demo; durability is only worth it for the leaderboard.

## Auth

The server distinguishes three identity tiers:

- **Anonymous** — no auth. Default. Can join open lobbies, see public state.
- **Bot** — `isBot: true` + matching `LOADTEST_TOKEN` at handshake. Bypasses lobby max-player caps; excluded from leaderboard persistence.
- **Admin** — post-connect `admin:elevate` with matching `ADMIN_TOKEN`. Can kick from / pause / reconfigure any lobby including the dedicated servers, **and** edit the global dedicated-server config (`admin:get-config` / `admin:set-config`). Admins are per-socket; reconnect requires re-elevation (the web client auto-replays its saved token).

## Env

[`env.ts`](src/env.ts) parses with Zod at boot. Required: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Optional with sensible defaults: `PORT`, `HOST`, `WEB_ORIGIN`, `DATABASE_URL`, `LOADTEST_TOKEN`, `ADMIN_TOKEN`.

Additional non-Zod env read directly: `CANONICAL_HOST` (drives the apex redirect middleware — set to `yesweb.app` in prod; unset locally so no redirect fires during dev).

## Run

```bash
npm -w @pwa-demo/server run dev      # tsx watch, no build
npm -w @pwa-demo/server run build    # tsc
npm -w @pwa-demo/server start        # node dist/index.js
```

In prod (Cloud Run), the runtime invokes `node apps/server/dist/index.js` directly (see [`Dockerfile`](../../Dockerfile)).

## Notable patterns

- **Canonical-host redirect** (`index.ts`) — env `CANONICAL_HOST` drives a middleware that 301s any non-canonical hostname (e.g. `www.yesweb.app`) to `https://<canonical>/<path>`. Exempts localhost, raw IPs, and `*.run.app` (so the Cloud Run backup URL stays usable).
- **CORS `origin: true`** — accepts any origin. Fine because the server doesn't ship cookies; all auth is socket-handshake-time or per-request token. LAN devices (phones over Wi-Fi to the dev box) need this to work.
- **`trust proxy: true`** — Cloud Run sits behind a Google edge proxy. Without this, `req.protocol` / `req.hostname` would report the internal `http://` and the proxy hostname instead of the original client request.
- **Push delayed-send is process-local `setTimeout`** — durable enough for a demo, lost on restart. Snapshots the subscription set at schedule time so unsubscribing after scheduling still delivers.
- **Push event listeners on the SW side broadcast** `push:received`, `push:shown`, `push:error` via `postMessage` to all clients so the diagnostic UI can show "the SW got it but the OS suppressed the popup" cases — those are common (Focus mode on macOS, DND on iOS) and confusing without explicit telemetry.
