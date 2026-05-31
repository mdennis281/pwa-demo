# Tower Climb

A 3D multiplayer platformer wired into YesWeb as the demo for `webgl`, `webgl2`, `websocket`, and `gamepad`. The climb is a **spiral of floating sky-islands** wrapping an open centre (a slender decorative peak) up to a beacon at the top. Each tier is its own little district with its own vibe and a signature trick: **Garden Rise** → **Windmill Heights** (ride a turning gondola-wheel up) → **The Waterworks** (a rising water-lift) → **The Night Market** (transfer between two converging cargo carts before they smash) → **Ice Reach** (a dash across cracking ice that falls away behind you) → **Summit**. Touch the beacon and **flight unlocks** for a victory lap.

The world is **hand-built** ([`worldgen.ts`](worldgen.ts)). The islands orbit an *open* middle so the chase camera always has sky behind you; every foothold is a solid island with a matching mesh. Look-and-feel is validated with headless screenshots ([`WorldPreview.tsx`](WorldPreview.tsx)) and reachability/head-clearance with a deterministic audit ([`worldgen.audit.ts`](worldgen.audit.ts)).

Live: https://yesweb.app → Graphics & compute → Tower Climb · or directly: `/d/tower-climb`.

Server-side counterpart: [`apps/server/src/game/`](../../../server/src/game/) — lobby state machine + 20 Hz snapshot tick. Wire format: [`packages/shared`](../../../../packages/shared).

## Design at a glance

- **Three.js + react-three-fiber.** One `<Canvas>` rooted in [`GameCanvas.tsx`](GameCanvas.tsx), DPR clamped to 1.5×, high-performance GPU preference, no stencil/alpha buffers, with a shader precompiler step before first frame to dodge first-paint jank.
- **Client-authoritative.** The server does not run physics. Each client runs its own AABB-sweep physics, broadcasts `game:input` at 20 Hz, and the server fans out `game:snapshot` to every player in the lobby (also at 20 Hz). Remote players are rendered with a 110 ms interpolation buffer.
- **Deterministic world.** Seed = 1337. The same plaza, spokes, cottages, staircase, crystal spires, and goal orb on every client. No world state is transmitted.
- **Always-on dedicated servers.** A fleet of always-on "Official" servers (`tower-official`, `tower-official-2`, …) never dissolves; `lobby:quick-join` drops a new session into the least-full one. How many run (default 1) and their player cap (default 25) live in the `server_config` DB table and are editable by a token-elevated admin from the server-browser admin menu — turn them all off and Quick Play goes offline. Their "host" is the sentinel `SYSTEM` socket id, so no real human can claim host authority; admin actions require token elevation.

## File inventory

```
game/
├─ GameCanvas.tsx       Canvas root, socket wiring, HUD/Admin/Debug overlays
├─ Player.tsx           Local player controller (physics, jumps, ladders, camera)
├─ RemotePlayer.tsx     Other players, sampled & interpolated from snapshots
├─ Character.tsx        Mesh builder for the 8 character variants
├─ characters.ts        Variant table (body/head/leg colors + accessory + quirk)
├─ World.tsx            Renders all world geometry (static + movers + decor)
├─ worldgen.ts          Hand-built world: solid terraced-mountain village, movers
├─ worldgen.audit.ts    Dev-only: re-verifies reachability/head-clearance/draw-calls
├─ WorldPreview.tsx     Dev-only: no-socket world view for headless screenshots
├─ physics.ts           AABB-sweep step + ray-vs-AABB camera occlusion
├─ HUD.tsx              Altitude, best height, leaderboard, control hints
├─ AdminMenu.tsx        In-game admin: pause/kick/reconfigure THIS server (Ctrl+A)
├─ CheatMenu.tsx        Client-side fly + infinite-jumps (Ctrl+C)
├─ NetworkPerf.tsx      Ping + snapshot rate + player list (draggable overlay)
├─ SettingsMenu.tsx     ⚙ launcher — shadows toggle + opens the perf overlays
├─ DraggablePanel.tsx   Shared draggable/closable chrome for all overlays
├─ SkyDome.tsx          Custom shader gradient skydome with sun
├─ Spectator.tsx        Free-fly camera for spectator role
├─ controls/
│  ├─ input.ts          Ref-based input store (no React re-renders)
│  ├─ useKeyboard.ts    WASD/arrows + space + shift
│  ├─ useMouseLook.ts   Pointer-lock yaw/pitch, wheel-zoom
│  └─ TouchControls.tsx Dual-joystick mobile layout
└─ lobby/
   ├─ LobbyList.tsx     Browser + create + quick-join entry; admin shield icon
   ├─ ServerAdminMenu.tsx  Server-page admin: token elevation + dedicated-server fleet
   └─ CharacterPicker.tsx
```

## Server file inventory

```
apps/server/src/game/
├─ index.ts             Socket events, 20Hz tick loop, leaderboard broadcasts
└─ lobby.ts             In-memory Lobby + ServerPlayer state machine
```

## Lobby & game flow

```
LobbyList               (client lobby browser)
  ▼ pick / create / quick-join
LobbyState received     server sends lobby:state with you = { role, character }
  ▼
CharacterPicker         (visible only if no character chosen yet)
  ▼
GameCanvas              (Player, RemotePlayer × N, World, HUD, Sky, …)
                        ‒ game:input 20Hz outbound
                        ‒ game:snapshot 20Hz inbound
  ▲
  └ leave → server saves max height to tower_high_scores
            if non-bot and lobby == tower-official and maxHeight > 0
```

## Physics — quick spec

| Parameter | Value | Why |
|---|---|---|
| Ground speed | 7.0 m/s | Comfortable hop spacing |
| Air control | 55% | Lets you tweak mid-jump but you can't 180 |
| Jump velocity | 13 m/s | Apex ≈ 3.0 m (`v²/2g`) |
| Double-jump velocity | +10 m/s | Adds ≈ 1.8 m if hit at apex |
| Variable cut | 45% vy on release | Short hops on tap |
| Coyote time | 120 ms | Forgives mistimed edge jumps |
| Jump buffer | 110 ms | Catches early presses before landing |
| Gravity | 28 m/s² | Tuned against jump height for tight feel |
| Player AABB | 0.4 × 1.6 × 0.4 m | Centered y=0.8 |
| Skin tolerance | 1 mm | Prevents single-ULP false collisions |
| Falloff respawn | y < −20 m | Re-spawns at last checkpoint (world spawn if none reached) |

[`physics.ts`](physics.ts) implements the AABB sweep in two passes: horizontal slide (resolve X then Z independently, so corner cases don't pop), then vertical (find the highest land-platform top, clamp to it; or hit ceiling and zero vy). Ladders bypass the box collision check entirely (they're gravity-free volumes) — without that bypass, the destination platform's box would shove you sideways during the climb.

## World

**Hand-built** by [`worldgen.ts`](worldgen.ts) (seed 1337 drives only decorative scatter). Footholds are free-floating islands placed on a spiral of orbit radius `R0≈9.5` around the open centre. All y in metres:

| y | District | Vibe | Signature trick |
|---|---|---|---|
| 0 | **Garden Rise** (home + CP1) | green pastoral | the launch village + first leaps |
| ~11 | **Windmill Heights** (CP2) | golden, breezy | **ride a turning gondola-wheel** up |
| ~23 | **The Waterworks** (CP3) | watery, misty | a rising **water-lift** + waterfalls |
| ~34 | **The Night Market** (CP4) | warm, festive | **two converging carts** — transfer before the smash |
| ~45 | **Ice Reach** | cold, glittering | a dash across **cracking ice** that falls away |
| ~50 | **Summit** | triumphant | the beacon, atop the peak |

### Creative mechanics (engine bits)

- **Orbiting platforms** (`Mover.orbit`): a mover circles a pivot in the x-y plane — a turning gondola-wheel you ride up. `tickMover` in [`Player.tsx`](Player.tsx) and `MoverNode` in [`World.tsx`](World.tsx) compute the circular position; the existing carry logic ferries the rider.
- **Breakaway platforms** (`WorldData.breakaways`, the ice): solid until you stand on one, then it cracks (`BREAK_DELAY_MS`), falls away, and respawns (`BREAK_RESPAWN_MS`). Player sets a shared `triggeredAt`; the collision set drops broken ones; `BreakawayNode` animates the crack + fall. Client-local (like movers).
- **Converging carts**: two ordinary linear movers timed to meet in the middle on a cycle — ride one, transfer across the gap in the convergence window, ride the other to a solid island.

### Correctness by construction

The trail is hand-placed but laid down through a `Route` helper whose `arc()` advances an angle around the open centre at radius `R0`, drops a floating island, and **asserts** the jump is inside the physics envelope for its difficulty *band* — so overlaps and over-reaches are impossible. Movers/breakaways record their traversal as edges too, so the audit proves the whole climb (mechanics included) is beatable. Bands (well inside the real envelope, so jumps feel generous):

| Band | Max rise | Max edge gap | Jumps |
|---|---|---|---|
| walk | 0.6 m | 1.3 m | 1 |
| easy | 2.0 m | 3.0 m | 1 |
| medium | 2.5 m | 3.8 m | 1 |
| hard | 2.8 m | 4.3 m | 1 |
| double | 4.2 m | 5.2 m | 2 |

A separate deterministic harness, [`worldgen.audit.ts`](worldgen.audit.ts) (`tsx apps/web/src/game/worldgen.audit.ts`, excluded from the app build), **independently re-verifies** every jump edge against the envelope, confirms ≥1.6 m **head clearance** above every foothold (no head-bumps), checks checkpoint spacing + centrality, and reports the post-merge draw-call budget. Run it after editing the world.

### Dev visual preview

Look-and-feel is validated headlessly: [`WorldPreview.tsx`](WorldPreview.tsx) renders the world (same lights/sky, no socket/lobby) at a fixed camera from `/d/tower-climb?preview=<preset>` (presets: `overview`, `mill`, `summit`, `ground`, …; or `?preview=1&cx=&cy=&cz=&tx=&ty=&tz=`). A headless Chrome screenshot of that URL shows exactly what the geometry looks like without needing to play through the lobby.

### Checkpoints & flight

- **Checkpoints** (`out.checkpoints`) sit on the terraces. Crossing one (grounded, within its radius) arms it as your respawn anchor. A fall respawns you there the moment you drop ~6 m below it (not just on falling off the world — critical, since with a solid ground plate you'd otherwise just thud onto the village floor). Anchors never downgrade; `maxHeight` stays sticky so the leaderboard is unaffected.
- **Flight** unlocks the instant you touch the summit beacon (`onReachSummit` in [`Player.tsx`](Player.tsx)). Press **F** (or the on-screen `✈ Fly` button on touch) to take off / land; `UP`/`DOWN` pads handle ascent/descent on mobile. Reward-flight is hard-capped at `summitY + 6` with a soft horizontal leash so you tour the world but can't escape it; the dev cheat-fly remains uncapped.

### Movers

A few platforms oscillate from the wall clock (time-synced via `Date.now()`, no network state): a `lift`, a `ramp`, and a `wall` timing hazard are available styles. `pos(t) = A + (B−A)·easeInOutSine(t/period + phase)`. `style` is cosmetic; physics is always AABB. The player is carried while standing on a `platform`-kind mover (Y snapped to the mover top each frame; re-mount tolerance ~0.14 m so a frame of float rounding doesn't drop the rider).

### Ladders

Gravity-free volumes that extend ~1.2 m above their destination platform's top. While inside a ladder volume, the local player:

- Sees `gravity` suppressed (vy not added)
- Reads `input.forward * CLIMB_SPEED` for vertical motion (4 m/s up, or down)
- Skips horizontal AABB collisions entirely
- Has `jumps = 0` (can hop off sideways)
- Triggers a 220 ms post-jump release grace so you don't re-grab immediately

The overshoot is what makes ladders feel right: you exit *above* the destination platform and fall onto it, rather than crashing into its side.

## Character system

[`characters.ts`](characters.ts) defines 8 variants — Sparky, Bricky, Petal, Pip, Goldie, Glitchy, Mochi, Sprout. Each is a hand-modeled capsule/box/sphere body, head, legs, and an accessory (top-hat, cap, antenna, horns, etc.) with a "quirk" idle animation (antenna pulse, tip-hat, twirl, head-shake, roll-side, glitch-step, nod, …).

Mesh construction is fully procedural in [`Character.tsx`](Character.tsx) — no skeletal rigging, no GLTF imports. Animations are driven by state:

| Player state | Visual |
|---|---|
| `idle` | Standing still, quirk timer ticks |
| `run` | Body sway, slight forward lean |
| `air` | Pitched forward, legs trailing |

## Controls

| Input | Source | Action |
|---|---|---|
| W/A/S/D or arrows | [`useKeyboard.ts`](controls/useKeyboard.ts) | Forward/strafe |
| Space | [`useKeyboard.ts`](controls/useKeyboard.ts) | Jump (queued in buffer if airborne) |
| Shift | [`useKeyboard.ts`](controls/useKeyboard.ts) | Descend while flying |
| F | [`GameCanvas.tsx`](GameCanvas.tsx) | Toggle flight (after the summit beacon is reached) |
| Mouse motion (after click) | [`useMouseLook.ts`](controls/useMouseLook.ts) | Yaw + pitch; requests pointer lock |
| Scroll wheel | [`useMouseLook.ts`](controls/useMouseLook.ts) | Camera distance, 2.5–14 m |
| Touch left half | [`TouchControls.tsx`](controls/TouchControls.tsx) | Movement joystick (radius 60 px) |
| Touch right half | [`TouchControls.tsx`](controls/TouchControls.tsx) | Look delta |
| Touch jump button | [`TouchControls.tsx`](controls/TouchControls.tsx) | Jump |

All inputs land in a single ref-based [`input.ts`](controls/input.ts) store. Refs (not React state) because every frame reads the inputs; re-rendering 60 fps would be wasteful.

A per-event mouse delta cap of ±120 px filters out Chromium's occasional absurd movementX/Y values right after pointer lock — without that, the camera snaps wildly on the first frame.

Gamepad: not wired yet, despite being in the demo's declared capabilities. Adding it is a hook in `controls/` mirroring `useKeyboard.ts`'s shape.

## Client ↔ server sync

**Client → server**, 20 Hz, via `game:input`:

```ts
{ x, y, z, yaw, state: 'idle' | 'run' | 'air' }
```

Server clamps to ±1000 on each axis, tracks `maxHeight = max(maxHeight, y)`, updates `lastInputAt`.

**Server → client**, 20 Hz to each lobby room, via `game:snapshot`:

```ts
{
  lobbyId: string,
  t: number,                              // server wall-clock when snap was built
  players: [
    { id, displayName, character, role, isHost,
      maxHeight, x, y, z, yaw, state, ping }
  ]
}
```

The client's `RemotePlayer` keeps the last ~500 ms of snapshots in a ring, then renders at `performance.now() − interpDelay`, lerping between the two nearest samples. `interpDelay = 110 ms` is tuned to be:

- short enough that remote motion looks responsive
- long enough that occasional dropped snapshots don't cause jitter

Yaw uses shortest-arc interpolation (wraps mod 2π so a player turning from +179° to −179° doesn't spin all the way around).

Ping is round-tripped via the `ping:probe` event (every 3 s); the server stamps it into the snapshot, and the HUD reads it from there.

## Always-on dedicated servers

A **fleet** of persistent "Official" lobbies, sized by the admin-editable
[`server_config`](../../../server/src/db/serverConfig.ts) (singleton DB row):

| Setting | Default | Range | Meaning |
|---|---|---|---|
| `dedicatedEnabled` | `true` | on/off | Master switch — off ⇒ no dedicated servers, Quick Play offline |
| `dedicatedCount` | `1` | 1–50 | How many dedicated servers run |
| `dedicatedPlayerCap` | `25` | 1–1000 | Player cap applied to every dedicated server |

Properties:

- **Ids:** the first server keeps the bare id `tower-official` (back-compat with the load-test bots' `--lobby tower-official` default and old reconnecting clients); the 2nd+ are `tower-official-2`, `tower-official-3`, … `isDedicatedLobbyId()` (in [`packages/shared`](../../../../packages/shared/src/index.ts), mirrored in [`lobby.ts`](../../../server/src/game/lobby.ts)) recognizes the whole family.
- **Reconciled** from config on boot and on every admin change via `reconcileDedicatedLobbies()` — spawns missing servers, re-caps/renames existing ones, tears down extras (booting their players back to the browser **and persisting their session high scores**, same as a normal leave).
- **Host** is the sentinel id `SYSTEM` — no real socket can have that id, so no human can host one.
- **High scores** are persisted to `tower_high_scores` on disconnect (non-bots) for **any** dedicated server, not just the first.
- Regular lobbies (created via `lobby:create`) auto-dissolve when empty.

Clients join via `lobby:quick-join`, which the server routes to the **least-full** dedicated server (or returns `no dedicated servers available` when they're disabled — the lobby browser then shows Quick Play as *Offline*). Reconnecting clients re-join their **exact** server by id (`lobby:join`), so a dropped player returns to the same one. Players can also `lobby:create` / `lobby:join` arbitrary lobbies for private play.

## Cheats

Ctrl+C toggles a client-side cheat menu (developer convenience):

- `fly` — bypass physics entirely, free-flight at 14 m/s
- `infiniteJumps` — unlimited air jumps

Neither is enforced server-side. Since the server is just a relay, a hacker could already teleport with a custom client. The cheat menu just makes that legal-feeling for dev use. A small "cheat mode" badge surfaces on the HUD when either is on.

## Admin tools

There are **two** distinct admin surfaces, both unlocked by the same
`ADMIN_TOKEN` (or, for a private lobby, by being its host):

### 1. Server-browser admin — the fleet

A subtle **shield icon** in the lobby-browser header opens
[`ServerAdminMenu.tsx`](lobby/ServerAdminMenu.tsx). This is where token
elevation happens (the old in-debug-panel elevate prompt was removed): paste the
token once and it's saved to `localStorage`, so you stay elevated across
sessions and reloads (`admin:elevate` is replayed on every (re)connect). Once
elevated it exposes the global **dedicated-server** controls — on/off, count
(1–50), and player cap (1–1000) — which `admin:set-config` persists to
`server_config` and reconciles live. The icon tints amber while elevated.

### 2. In-game admin — this server only

Ctrl+A (or the ★ Admin button) opens [`AdminMenu.tsx`](AdminMenu.tsx) for the
host or a token-elevated admin. It only ever acts on the **server you're
currently connected to**:

- **Pause** the lobby — server stops broadcasting snapshots. Every client freezes its physics **and loses mouse capture, with no way to re-acquire it until resume** (see below).
- **Kick** a player — server removes them from the lobby room; their client gets `lobby:state: null`
- **Reconfigure** — name, player cap (1–1000)

The "host" of a regular lobby is the first to join; on disconnect the next player gets promoted. A dedicated server's sentinel host means admins always require explicit elevation there. (Dedicated-server caps set here are runtime overrides; the next reconcile from `server_config` resets them.)

### Pause semantics

Pause is enforced on **both** ends so it can't be no-clipped:

- **Server:** the tick loop `continue`s past paused lobbies (no `game:snapshot`), and `game:input` is ignored while paused.
- **Client:** `Player`/`Spectator` early-return from their frame loop (no physics, no camera, no send), and `useMouseLook` is told `allowLock = !paused` — it drops pointer lock the instant the game pauses and **refuses to re-acquire it** on click until resume. The "click to capture mouse" hint is replaced by the "Game paused" overlay. This closes the old bug where a paused player could still walk around because only the network send was gated.

## Performance choices

- **Merged static geometry.** The world is ~700+ individual boxes/cones/cylinders/spheres but only ~130 distinct material signatures. [`World.tsx`](World.tsx)'s `MergedStatic` bakes each static mesh's transform into its geometry and merges all meshes sharing a material (`BufferGeometryUtils.mergeGeometries`) into **one draw call per material** — cutting the static scene to ~130 draw calls (+ a handful of animated nodes: movers, flags, smoke, waterfall, wheel, beacon, windmills, ladder). Merged geometries are disposed on unmount so GPU buffers don't leak across leave/rejoin.
- **Shader precompiler.** Before the first frame renders, [`GameCanvas.tsx`](GameCanvas.tsx)'s `ShaderPrecompiler` walks the scene graph, builds the materials' shader programs synchronously, and calls `gl.compileAsync()` where supported (`KHR_parallel_shader_compile`). Without it, Firefox spent 50–100 ms per program on first encounter and the first 100 ms of gameplay was full of "pop-in" as materials were lazily compiled. The user lands on a properly lit scene immediately.
- **DPR clamped to 1.5×.** Retina displays default to 2.0× or 3.0× DPR, and at native fragments-per-pixel the fragment shader is the bottleneck. 1.5× looks crisp on retina while halving fragment work.
- **No stencil, no alpha framebuffer.** The skydome covers the whole background; we don't need transparency on the framebuffer.
- **DirectionalLight shadow map 2048².** Big enough that cottages cast clean edges; small enough to fit in tile memory. Bias `-0.0002` to kill acne.
- **Fog from 220 m to 800 m.** Distant decor (cloud platforms, crystal spires) fades softly into atmosphere instead of popping out.
- **Snapshot fan-out is `O(n²)`.** Each tick, the server builds one snapshot per lobby and broadcasts it to every player. Each player snapshot includes every other player. At 200 players in a lobby, that's 200 × 200 ≈ 40 KB per tick × 20 ticks/s = 800 KB/s outbound from the server. The bot harness's `loop_p99` graph spikes when that crosses the serialization threshold around 100 players.

## Architectural quirks worth knowing

1. **Client-authoritative.** No rollback, no server simulation, no anti-cheat. Worth restating because it shapes every other decision.
2. **Time-synced movers.** No state for them on the wire; all clients compute identical motion from `Date.now()`.
3. **Ladder-skip collisions.** While climbing, all box collisions are bypassed. Only works because vertical-only motion has no side effects.
4. **Visual yaw lags camera yaw.** The character's facing direction tracks behind the camera with a 6 rad/s max angular speed clamp. Fast mouse flicks rotate the camera instantly but the character body catches up over ~150 ms. Prevents flicker on quick view-switching.
5. **Spectator role.** Joins with `role: 'spectator'`, sends no inputs, free-flies via [`Spectator.tsx`](Spectator.tsx). Counts toward `playerCount` for capacity but doesn't affect the leaderboard.
6. **Maxes are sticky.** The server tracks `maxHeight` cumulatively; you can fall to y=0 and the leaderboard still shows your peak. The DB row is written once on disconnect, not on every personal best.
