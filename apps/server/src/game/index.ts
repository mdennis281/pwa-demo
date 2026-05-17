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
  leaveLobby,
  listLobbies,
  lobbyToState,
  updateInput,
} from './lobby.js';

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
      }));
      const snap: GameSnapshot = { lobbyId: lobby.id, t: now, players };
      io.to(lobbyRoom(lobby.id)).emit('game:snapshot', snap);
    }
  }, Math.floor(1000 / TICK_HZ));
  return () => clearInterval(interval);
}

let stopTick: (() => void) | null = null;

export function attachGame(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
): void {
  if (!stopTick) stopTick = startTickLoop(io);

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
    updateInput(socket.id, input);
  });

  socket.on('disconnect', () => {
    const r = leaveLobby(socket.id);
    if (r) {
      if (!r.dissolved) broadcastLobbyState(io, r.lobbyId);
      broadcastBrowser(io);
    }
  });
}
