import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameSnapshot,
  PackedPlayer,
} from '@pwa-demo/shared';
import {
  allLobbies,
  createLobby,
  getLobbyOf,
  isDedicatedLobbyId,
  joinLobby,
  kickPlayer,
  leaveLobby,
  listLobbies,
  lobbyToState,
  pickQuickJoinLobby,
  reconcileDedicatedLobbies,
  setPaused,
  updateInput,
  updateLobbyConfig,
} from './lobby.js';
import { serverMetrics } from '../metrics.js';
import {
  ensureTowerScoresTable,
  recordTowerHighScore,
  topTowerHighScores,
} from '../db/towerScores.js';
import {
  ensureServerConfigTable,
  getServerConfig,
  loadServerConfig,
  saveServerConfig,
} from '../db/serverConfig.js';
import type { ReconcileResult } from './lobby.js';

const BROWSER_ROOM = 'lobby:browser';
const TICK_HZ = 20;
const LEADERBOARD_LIMIT = 10;

function lobbyRoom(id: string): string {
  return `lobby:${id}`;
}

function broadcastBrowser(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  io.to(BROWSER_ROOM).emit('lobby:list', listLobbies());
}

/** Push the current top-N leaderboard to every browser-room subscriber.
 *  Called on boot, on every player leave from the Official Server, and any
 *  time a Quick-Join writes a fresh score. Cheap (small JSON, low fanout). */
async function broadcastLeaderboard(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
): Promise<void> {
  const top = await topTowerHighScores(LEADERBOARD_LIMIT);
  io.to(BROWSER_ROOM).emit('tower:leaderboard', top);
}

function broadcastLobbyState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  lobbyId: string,
): void {
  const room = lobbyRoom(lobbyId);
  // Look up the lobby in the registry — it may have been dissolved.
  const lobby = allLobbies().find((l) => l.id === lobbyId);
  if (!lobby) {
    io.to(room).emit('lobby:state', null);
    return;
  }
  io.to(room).emit('lobby:state', lobbyToState(lobby));
}

/** Apply a dedicated-server reconcile to the live socket world: boot the
 *  players of any torn-down server back to the browser, persist their in-flight
 *  high scores (a teardown is everyone leaving at once — same rule as
 *  handleLeave), push fresh state to the servers whose cap/name changed, and
 *  refresh the lobby list everywhere. */
function applyReconcile(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  result: ReconcileResult,
): void {
  let persisted = false;
  for (const removed of result.removed) {
    for (const p of removed.players) {
      io.to(p.socketId).socketsLeave(lobbyRoom(removed.id));
      io.to(p.socketId).emit('lobby:state', null);
      // Mirror handleLeave: dedicated-server, non-bot, real climb → record it.
      if (!p.isBot && p.maxHeight > 0) {
        persisted = true;
        void recordTowerHighScore({
          displayName: p.displayName,
          character: p.character,
          maxHeight: p.maxHeight,
          sessionMs: Date.now() - p.joinedAt,
        });
      }
    }
  }
  for (const id of result.updated) broadcastLobbyState(io, id);
  broadcastBrowser(io);
  if (persisted) void broadcastLeaderboard(io);
}

function startTickLoop(io: Server<ClientToServerEvents, ServerToClientEvents>): () => void {
  const interval = setInterval(() => {
    const now = Date.now();
    let tickBytes = 0;
    for (const lobby of allLobbies()) {
      if (lobby.paused) continue; // skip snapshot when paused — clients freeze
      // Pack only the per-tick-dynamic state into a quantized tuple and let the
      // client merge the static fields (name/character/role/host) from the
      // roster it already has via lobby:state. Cuts the per-player payload ~4×
      // vs. the old full-object snapshot — the difference between a 50-player
      // room melting and not. Encoding is inlined (mirror of PackedPlayer in
      // @pwa-demo/shared) because the compiled server can't import that package
      // at runtime. Quantize: positions/maxHeight ×100 (cm), yaw ×100 (centirad).
      const players: PackedPlayer[] = [...lobby.players.values()].map((p) => [
        p.socketId,
        Math.round(p.x * 100),
        Math.round(p.y * 100),
        Math.round(p.z * 100),
        Math.round(p.yaw * 100),
        p.state === 'run' ? 1 : p.state === 'air' ? 2 : 0,
        Math.round(p.maxHeight * 100),
        getPingFn(p.socketId) ?? -1,
      ]);
      const snap: GameSnapshot = { lobbyId: lobby.id, t: now, players };
      const snapStr = JSON.stringify(snap);
      // volatile: if a client's send buffer is backed up, DROP this snapshot for
      // them instead of queuing it. A stale position is worthless, and reliable
      // queuing is exactly what produced 27s ping at 50 players — the outbound
      // buffer grew without bound and every pong/ack/input-ack queued behind it.
      // Dropping keeps latency honest and the server responsive under load.
      io.volatile.to(lobbyRoom(lobby.id)).emit('game:snapshot', snap);
      serverMetrics.txEvents++;
      serverMetrics.txBytesEst += snapStr.length;
      // Per-recipient fanout cost is what hurts at 50 players — one emit
      // becomes N socket writes. Multiply payload by room size for a
      // realistic "bytes-on-the-wire this tick" estimate.
      tickBytes += snapStr.length * lobby.players.size;
    }
    serverMetrics.lastTickBytes = tickBytes;
  }, Math.floor(1000 / TICK_HZ));
  return () => clearInterval(interval);
}

let stopTick: (() => void) | null = null;
let getPingFn: (socketId: string) => number | null = () => null;
let bootstrapped = false;

/** Run leaveLobby + (if the departing player was on the Official Server with
 *  a real climb height) persist their session high score and republish the
 *  leaderboard. Returns the leaveLobby result so callers can broadcast room
 *  state changes as before. */
async function handleLeave(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socketId: string,
): Promise<ReturnType<typeof leaveLobby>> {
  const r = leaveLobby(socketId);
  if (!r) return null;
  // Bots run circles forever and would otherwise top the leaderboard with
  // junk maxHeight values — skip the write entirely. Scores persist for any
  // dedicated server, not just the first one.
  if (
    isDedicatedLobbyId(r.lobbyId) &&
    r.player &&
    !r.player.isBot &&
    r.player.maxHeight > 0
  ) {
    await recordTowerHighScore({
      displayName: r.player.displayName,
      character: r.player.character,
      maxHeight: r.player.maxHeight,
      sessionMs: Date.now() - r.player.joinedAt,
    });
    // Fire-and-forget the rebroadcast — we don't want to block disconnect.
    void broadcastLeaderboard(io);
  }
  return r;
}

export function attachGame(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  getPing: (socketId: string) => number | null,
): void {
  if (!stopTick) {
    getPingFn = getPing;
    stopTick = startTickLoop(io);
  }
  if (!bootstrapped) {
    bootstrapped = true;
    // 1. Make sure the persistent DB tables exist. Non-fatal if no DB.
    // 2. Load the saved dedicated-server config and materialize that many
    //    Official Servers so they're already in listLobbies() the moment the
    //    first client subscribes.
    // 3. Prime the leaderboard cache so the first browser:join receives it.
    void (async () => {
      await ensureTowerScoresTable();
      await ensureServerConfigTable();
      const config = await loadServerConfig();
      applyReconcile(io, reconcileDedicatedLobbies(config));
      await broadcastLeaderboard(io);
      console.log(
        `[tower] dedicated servers live: ${config.dedicatedEnabled ? config.dedicatedCount : 0}` +
          ` (cap ${config.dedicatedPlayerCap})`,
      );
    })();
  }

  socket.on('lobby:browser:join', () => {
    socket.join(BROWSER_ROOM);
    socket.emit('lobby:list', listLobbies());
    // Push the current top-N high scores on subscribe so the lobby browser
    // can render the persistent leaderboard immediately (no extra round-trip).
    void topTowerHighScores(LEADERBOARD_LIMIT).then((top) => {
      socket.emit('tower:leaderboard', top);
    });
  });

  socket.on('lobby:browser:leave', () => {
    socket.leave(BROWSER_ROOM);
  });

  socket.on('lobby:create', async (opts, cb) => {
    // If already in a lobby, leave it first.
    const existing = getLobbyOf(socket.id);
    if (existing) {
      socket.leave(lobbyRoom(existing.id));
      const r = await handleLeave(io, socket.id);
      if (r) broadcastLobbyState(io, r.lobbyId);
    }
    const result = createLobby({
      socketId: socket.id,
      clientId: socket.data.clientId ?? socket.id,
      name: opts.name,
      displayName: opts.displayName,
      character: opts.character,
      role: opts.role,
      isBot: socket.data.isBot === true,
    });
    // A profane display/lobby name is rejected here (input validation) — the
    // client surfaces res.error and keeps the user on the lobby browser.
    if (!result.ok) {
      cb({ ok: false, error: result.error });
      return;
    }
    const lobby = result.lobby;
    socket.join(lobbyRoom(lobby.id));
    cb({ ok: true, lobby: lobbyToState(lobby) });
    broadcastLobbyState(io, lobby.id);
    broadcastBrowser(io);
  });

  socket.on('lobby:join', async (opts, cb) => {
    const existing = getLobbyOf(socket.id);
    if (existing && existing.id !== opts.lobbyId) {
      socket.leave(lobbyRoom(existing.id));
      const r = await handleLeave(io, socket.id);
      if (r) broadcastLobbyState(io, r.lobbyId);
    }
    const result = joinLobby({
      socketId: socket.id,
      clientId: socket.data.clientId ?? socket.id,
      lobbyId: opts.lobbyId,
      displayName: opts.displayName,
      character: opts.character,
      isBot: socket.data.isBot === true,
    });
    if (!result.ok) {
      cb({ ok: false, error: result.error });
      return;
    }
    socket.join(lobbyRoom(result.lobby.id));
    cb({ ok: true, lobby: lobbyToState(result.lobby) });
    broadcastLobbyState(io, result.lobby.id);
    broadcastBrowser(io);
  });

  socket.on('lobby:quick-join', async (opts, cb) => {
    // Drop into the least-full dedicated server. If none are running (admin
    // disabled them), Quick Play is offline.
    const target = pickQuickJoinLobby();
    if (!target) {
      cb({ ok: false, error: 'no dedicated servers available' });
      return;
    }
    // Idempotent — if already on the chosen server, just hand back its state.
    const existing = getLobbyOf(socket.id);
    if (existing && existing.id !== target.id) {
      socket.leave(lobbyRoom(existing.id));
      const r = await handleLeave(io, socket.id);
      if (r) broadcastLobbyState(io, r.lobbyId);
    }
    const result = joinLobby({
      socketId: socket.id,
      clientId: socket.data.clientId ?? socket.id,
      lobbyId: target.id,
      displayName: opts.displayName,
      character: opts.character,
      isBot: socket.data.isBot === true,
    });
    if (!result.ok) {
      cb({ ok: false, error: result.error });
      return;
    }
    socket.join(lobbyRoom(result.lobby.id));
    cb({ ok: true, lobby: lobbyToState(result.lobby) });
    broadcastLobbyState(io, result.lobby.id);
    broadcastBrowser(io);
  });

  socket.on('lobby:leave', async () => {
    const existing = getLobbyOf(socket.id);
    if (!existing) return;
    socket.leave(lobbyRoom(existing.id));
    const r = await handleLeave(io, socket.id);
    socket.emit('lobby:state', null);
    if (r) {
      if (!r.dissolved) broadcastLobbyState(io, r.lobbyId);
      broadcastBrowser(io);
    }
  });

  socket.on('game:input', (input) => {
    const lobby = getLobbyOf(socket.id);
    if (lobby?.paused) return; // ignore inputs while paused
    updateInput(socket.id, input);
  });

  socket.on('admin:action', (action, cb) => {
    const isAdmin = socket.data.isAdmin === true;
    if (action.type === 'kick') {
      const result = kickPlayer(socket.id, action.targetId, isAdmin);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      // Force the kicked socket out of the lobby room and notify them
      io.to(action.targetId).socketsLeave(lobbyRoom(result.lobbyId));
      io.to(action.targetId).emit('lobby:state', null);
      broadcastLobbyState(io, result.lobbyId);
      broadcastBrowser(io);
      cb({ ok: true });
    } else if (action.type === 'pause') {
      const result = setPaused(socket.id, action.paused, isAdmin);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      broadcastLobbyState(io, result.lobby.id);
      cb({ ok: true });
    } else if (action.type === 'config') {
      const result = updateLobbyConfig(socket.id, action, isAdmin);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      broadcastLobbyState(io, result.lobby.id);
      broadcastBrowser(io);
      cb({ ok: true });
    } else {
      cb({ ok: false, error: 'unknown action' });
    }
  });

  // Global dedicated-server config — admin only, distinct from the per-lobby
  // admin:action above. Read populates the server-browser admin menu; set
  // persists + reconciles the live fleet.
  socket.on('admin:get-config', (cb) => {
    if (socket.data.isAdmin !== true) {
      cb({ ok: false, error: 'not authorized' });
      return;
    }
    cb({ ok: true, config: getServerConfig() });
  });

  socket.on('admin:set-config', async (patch, cb) => {
    if (socket.data.isAdmin !== true) {
      cb({ ok: false, error: 'not authorized' });
      return;
    }
    const config = await saveServerConfig(patch ?? {});
    applyReconcile(io, reconcileDedicatedLobbies(config));
    cb({ ok: true, config });
  });

  socket.on('disconnect', async () => {
    const r = await handleLeave(io, socket.id);
    if (r) {
      if (!r.dissolved) broadcastLobbyState(io, r.lobbyId);
      broadcastBrowser(io);
    }
  });
}
