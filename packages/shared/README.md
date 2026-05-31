# `@pwa-demo/shared`

The wire-format contract between the web client and the Node server. Single source file: [`src/index.ts`](src/index.ts).

## What's here

Three groups of types:

1. **Socket.io event contracts** — `ClientToServerEvents` and `ServerToClientEvents`. The web client's `Socket<…>` is parameterized with these, and the server's `Server<…>` is parameterized with their mirror image. Adding an event is a type-level enforcement on both sides.

2. **Game domain models** — `LobbyState`, `LobbyInfo`, `LobbyPlayer`, `PlayerSnapshot`, `GameSnapshot`, `LocalInput`, `Role`, `LobbyCreate`, `LobbyJoin`, `LobbyResult`, `AdminAction`, `AdminResult`, `ServerConfig`, `ServerConfigResult`.

3. **Misc shared models** — `ClientInfo`, `AuthStatus`, `ServerDebugStats`, `TowerHighScore`.

Plus runtime **values** (constants + helpers). The web client imports these directly; the server **re-declares each locally** (it can only `import type` — see below):
- `OFFICIAL_LOBBY_ID = 'tower-official'` — base id of the dedicated-server family
- `OFFICIAL_HOST_ID = 'SYSTEM'` — sentinel host id; no real socket can match it, so no human can host a dedicated server
- `isDedicatedLobbyId(id)` — true for `tower-official` and `tower-official-N` (the whole dedicated/official family)
- `DEFAULT_SERVER_CONFIG` — `{ dedicatedEnabled: true, dedicatedCount: 1, dedicatedPlayerCap: 25 }`, the client's pre-load default

## Consumption model

Both processes import directly from `@pwa-demo/shared`, but they consume it *differently*:

- **Web (Vite)** imports the raw TypeScript source. The `exports` field in [`package.json`](package.json) maps `.` to `./src/index.ts`. Vite handles the compilation on the fly. Imports can be values or types.
- **Server (Node)** imports the same path. But Node can't execute `.ts` files at runtime — the workspace install creates a symlink, and `tsc` resolves the import to types at compile time, leaving a `from '@pwa-demo/shared'` literal in the compiled `.js` that points at the symlink. At runtime, Node looks up the symlink and tries to require the file.

**Why this matters:** on the server side, any **value** import (`import { OFFICIAL_LOBBY_ID } from '@pwa-demo/shared'`) compiles into a runtime require. That require looks at `apps/server/dist/index.js` → finds `@pwa-demo/shared/src/index.ts` via the symlink → tries to execute it → **crashes** because Node can't run `.ts`.

The fix is to use `import type` for everything on the server side:

```ts
import type { LobbyState, Role, OFFICIAL_LOBBY_ID } from '@pwa-demo/shared';
```

`import type` declarations get stripped by `tsc` and don't produce a runtime require. **On the server, never use value imports from `@pwa-demo/shared`.** Re-declare constants locally if you need their value.

This is captured as a memory note in the project so future-you doesn't forget.

## Event contracts (quick reference)

### Client → server

| Event | Payload | Callback |
|---|---|---|
| `status:join` | — | — |
| `status:leave` | — | — |
| `ping:probe` | `number` (sentAt) | — |
| `lobby:browser:join` | — | — |
| `lobby:browser:leave` | — | — |
| `lobby:create` | `LobbyCreate` | `LobbyResult` |
| `lobby:join` | `LobbyJoin` | `LobbyResult` |
| `lobby:quick-join` | `Pick<LobbyJoin, 'displayName' | 'character'>` | `LobbyResult` |
| `lobby:leave` | — | — |
| `game:input` | `LocalInput` | — |
| `admin:action` | `AdminAction` | `AdminResult` |
| `admin:elevate` | `string` (token) | `AdminResult` |
| `admin:logout` | — | `AdminResult` |
| `admin:get-config` | — | `ServerConfigResult` |
| `admin:set-config` | `Partial<ServerConfig>` | `ServerConfigResult` |

### Server → client

| Event | Payload |
|---|---|
| `clients:update` | `ClientInfo[]` |
| `pong:reply` | `number` |
| `lobby:list` | `LobbyInfo[]` |
| `lobby:state` | `LobbyState \| null` |
| `game:snapshot` | `GameSnapshot` |
| `debug:server-stats` | `ServerDebugStats` |
| `tower:leaderboard` | `TowerHighScore[]` |
| `auth:status` | `AuthStatus` |

The shapes of each payload type are in [`src/index.ts`](src/index.ts). Adding a new field there is a one-stop edit and both sides immediately type-check against the new contract.

## Build

```
npm -w @pwa-demo/shared run build
```

Produces `dist/` (declarations + compiled JS), needed by `tsc` on the server side to resolve types. Not consumed at runtime — the server's runtime resolves `@pwa-demo/shared` via the npm workspace symlink as described above.
