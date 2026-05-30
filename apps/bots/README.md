# `@pwa-demo/bots` — Tower Climb load-test harness

Headless Socket.io clients that connect to the server as bots, join a lobby, and run a deterministic orbital movement loop. Used for load-testing, smoke-testing, and (optionally) populating the Official Tower Climb server with activity.

Single file: [`src/index.ts`](src/index.ts). One npm bin: `tower-bot`.

## Run

```bash
# from repo root
LOADTEST_TOKEN=$(grep LOADTEST_TOKEN .env | cut -d= -f2) \
  npm run bots -- --count=20 --host=http://localhost:3000

# or with all defaults (10 bots, localhost, official lobby)
npm run bots
```

## CLI flags

| Flag | Default | Meaning |
|---|---|---|
| `--host URL` | `http://localhost:3000` | Server endpoint |
| `--count N` | `10` | Number of bots to spawn |
| `--ramp DUR` | `5s` | Stagger window for connects (e.g. `30s`, `2m`) |
| `--lobby ID` | `tower-official` | Lobby to join. Falls back to quick-join if create/join fails. |
| `--token T` | env `LOADTEST_TOKEN` | Loadtest token. The server rejects connections without it (`"invalid bot token"`). |
| `--duration DUR` | `0` (run until Ctrl-C) | Auto-stop after this much wall time |
| `--tick HZ` | `20` | Input emit rate per bot |
| `--radius M` | `5` | Orbital path radius around origin |
| `--jump M` | `2.5` | Vertical amplitude of the sine jump cycle |
| `--stats SEC` | `5` | Stats line cadence |

## What each bot does

1. Connect with `io({ auth: { isBot: true, token: LOADTEST_TOKEN } })`. Handshake-time auth — server middleware rejects early if the token's wrong.
2. Emit `lobby:quick-join` (or `lobby:join` with `--lobby`) using a synthetic display name like `Bot-0001` and a character index `i % 8` (rotates through the 8 character variants).
3. Start a `setInterval` at `1000 / tickHz` ms. Each tick:
   - Compute orbital position: `x = radius·cos(ω·t)`, `z = radius·sin(ω·t)` with `ω = 0.4 rad/s` (~15 s lap).
   - Superimpose a vertical jump cycle: `y = max(0, A·sin(1.5·t))`.
   - Yaw points tangent to the orbit (direction of travel).
   - Emit `game:input({ x, y, z, yaw, state: y < 0.3 ? 'run' : 'air' })`.
4. Stagger: bot `i` waits `i × (rampMs / count)` ms before connecting, so a count of 100 over `--ramp=30s` spreads connections at one per 300 ms.

## Stats

Every `--stats` seconds (default 5 s), the harness prints a one-liner:

```
[t+123s] joined=45/50 tx=900/s rx=1800/s err: connect=0 join=0 drop=0 | server: players=200 loop_p50=3.2ms loop_p99=12.5ms tick_bytes=150KB rss=480MB
```

Local part tracks: bots successfully joined, outbound/inbound event rate, error counters (connect failures, join refusals, unexpected disconnects).

Server part is pulled by subscribing bot index 0 (only) to `debug:server-stats` — saves the spam from N bots all subscribing. Server-side stats include event-loop lag percentiles, total players, tick payload size, RSS memory.

## Use cases

- **Saturation testing.** Spin up 100 bots over a 30 s ramp window. Watch `loop_p99` for tick-loop lag; the server's 20 Hz snapshot fan-out scales as `N²` because every player gets every other player in every tick.
- **Smoke test.** 5–10 bots for a minute. Confirms lobby pipeline, snapshot broadcast, leaderboard persistence, and disconnect cleanup all work end-to-end without humans involved.
- **Populating the Official Server.** Run persistent bots so new visitors see life when they land. The bots' high scores are *not* recorded (server filters `isBot` from leaderboard inserts), so they don't pollute the rankings.
- **Latency profiling.** Watch `tick_bytes` climb linearly with player count, and `loop_p99` spike when serialization eats too much CPU per tick.

## Notes

- Not bundled into the prod Docker image. The Dockerfile keeps `apps/bots/package.json` for npm workspace integrity but `.dockerignore` strips `apps/bots/src` and `dist`.
- `--lobby tower-official` only works if quick-join is enabled (it always is). For arbitrary lobby IDs, the harness uses `lobby:join`, which fails cleanly if the lobby doesn't exist.
- Bots bypass the lobby `maxPlayers` cap (server's `isBot` flag is honored in `joinLobby`). That's how 100 bots can pile into the 8-cap Official Server.
- The orbit is deterministic per bot (driven by `Date.now()` and bot index), so all clients see the same swarm pattern, useful for visual debugging.
