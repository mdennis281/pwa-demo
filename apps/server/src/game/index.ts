import type { Server, Socket } from 'socket.io';
import {
  OFFICIAL_LOBBY_ID,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type GameSnapshot,
  type PlayerSnapshot,
} from '@pwa-demo/shared';
import {
  allLobbies,
  createLobby,
  ensureOfficialLobby,
  getLobbyOf,
  joinLobby,
  kickPlayer,
  leaveLobby,
  listLobbies,
  lobbyToState,
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

function startTickLoop(io: Server<ClientToServerEvents, ServerToClientEvents>): () => void {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const lobby of allLobbies()) {
      if (lobby.paused) continue; // skip snapshot when paused — clients freeze
      const players: PlayerSnapshot[] = [...lobby.players.values()].map((p) => ({
        id: p.socketId,
        displayName: p.displayName,
        character: p.character,
        role: p.role,
        isHost: p.isHost,
        maxHeight: p.maxHeight,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        state: p.state,
        ping: getPingFn(p.socketId),
      }));
      const snap: GameSnapshot = { lobbyId: lobby.id, t: now, players };
      const snapStr = JSON.stringify(snap);
      io.to(lobbyRoom(lobby.id)).emit('game:snapshot', snap);
      serverMetrics.txEvents++;
      serverMetrics.txBytesEst += snapStr.length;
    }
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
  if (r.lobbyId === OFFICIAL_LOBBY_ID && r.player && r.player.maxHeight > 0) {
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
    // 1. Make sure the persistent DB table exists. Non-fatal if no DB.
    // 2. Materialize the Official Server lobby so it's already in
    //    listLobbies() the moment the first client subscribes.
    // 3. Prime the leaderboard cache so the first browser:join receives it.
    void (async () => {
      await ensureTowerScoresTable();
      ensureOfficialLobby();
      await broadcastLeaderboard(io);
      console.log('[tower] Official Server lobby is live (' + OFFICIAL_LOBBY_ID + ')');
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
    const lobby = createLobby({
      socketId: socket.id,
      name: opts.name,
      displayName: opts.displayName,
      character: opts.character,
      role: opts.role,
    });
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
      lobbyId: opts.lobbyId,
      displayName: opts.displayName,
      character: opts.character,
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
    // Drop straight into the Official Server. Idempotent — if the caller is
    // already on it, we just hand back the current state without churn.
    const existing = getLobbyOf(socket.id);
    if (existing && existing.id !== OFFICIAL_LOBBY_ID) {
      socket.leave(lobbyRoom(existing.id));
      const r = await handleLeave(io, socket.id);
      if (r) broadcastLobbyState(io, r.lobbyId);
    }
    ensureOfficialLobby();
    const result = joinLobby({
      socketId: socket.id,
      lobbyId: OFFICIAL_LOBBY_ID,
      displayName: opts.displayName,
      character: opts.character,
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
    if (action.type === 'kick') {
      const result = kickPlayer(socket.id, action.targetId);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      // Force the kicked socket out of the lobby room and notify them
      io.to(action.targetId).socketsLeave(lobbyRoom(result.lobbyId));
      io.to(action.targetId).emit('lobby:state', null);
      broadcastLobbyState(io, result.lobbyId);
      broadcastBrowser(io);
      cb({ ok: true });
    } else if (action.type === 'pause') {
      const result = setPaused(socket.id, action.paused);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      broadcastLobbyState(io, result.lobby.id);
      cb({ ok: true });
    } else if (action.type === 'config') {
      const result = updateLobbyConfig(socket.id, action);
      if (!result.ok) { cb({ ok: false, error: result.error }); return; }
      broadcastLobbyState(io, result.lobby.id);
      broadcastBrowser(io);
      cb({ ok: true });
    } else {
      cb({ ok: false, error: 'unknown action' });
    }
  });

  socket.on('disconnect', async () => {
    const r = await handleLeave(io, socket.id);
    if (r) {
      if (!r.dissolved) broadcastLobbyState(io, r.lobbyId);
      broadcastBrowser(io);
    }
  });
}
