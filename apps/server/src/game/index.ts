import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameSnapshot,
  PlayerSnapshot,
} from '@pwa-demo/shared';
import {
  allLobbies,
  createLobby,
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

const BROWSER_ROOM = 'lobby:browser';
const TICK_HZ = 20;

function lobbyRoom(id: string): string {
  return `lobby:${id}`;
}

function broadcastBrowser(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  io.to(BROWSER_ROOM).emit('lobby:list', listLobbies());
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

export function attachGame(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  getPing: (socketId: string) => number | null,
): void {
  if (!stopTick) {
    getPingFn = getPing;
    stopTick = startTickLoop(io);
  }

  socket.on('lobby:browser:join', () => {
    socket.join(BROWSER_ROOM);
    socket.emit('lobby:list', listLobbies());
  });

  socket.on('lobby:browser:leave', () => {
    socket.leave(BROWSER_ROOM);
  });

  socket.on('lobby:create', (opts, cb) => {
    // If already in a lobby, leave it first.
    const existing = getLobbyOf(socket.id);
    if (existing) {
      socket.leave(lobbyRoom(existing.id));
      const r = leaveLobby(socket.id);
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

  socket.on('lobby:join', (opts, cb) => {
    const existing = getLobbyOf(socket.id);
    if (existing && existing.id !== opts.lobbyId) {
      socket.leave(lobbyRoom(existing.id));
      const r = leaveLobby(socket.id);
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

  socket.on('lobby:leave', () => {
    const existing = getLobbyOf(socket.id);
    if (!existing) return;
    socket.leave(lobbyRoom(existing.id));
    const r = leaveLobby(socket.id);
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

  socket.on('disconnect', () => {
    const r = leaveLobby(socket.id);
    if (r) {
      if (!r.dissolved) broadcastLobbyState(io, r.lobbyId);
      broadcastBrowser(io);
    }
  });
}
