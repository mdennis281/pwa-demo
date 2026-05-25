import { randomBytes } from 'node:crypto';
import type {
  LobbyInfo,
  LobbyState,
  LobbyPlayer,
  Role,
} from '@pwa-demo/shared';

// Duplicated from packages/shared because that package is consumed as raw
// TS source; the compiled Node server can't import .ts at runtime. If you
// change either value, also change it in packages/shared/src/index.ts.
export const OFFICIAL_LOBBY_ID = 'tower-official';
export const OFFICIAL_HOST_ID = 'SYSTEM';

/** True if this lobby is the dedicated, always-on Official Server. */
export function isOfficial(lobby: { id: string } | undefined | null): boolean {
  return lobby?.id === OFFICIAL_LOBBY_ID;
}

export type ServerPlayer = {
  socketId: string;
  displayName: string;
  character: number;
  role: Role;
  isHost: boolean;
  maxHeight: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  state: 'idle' | 'run' | 'air';
  lastInputAt: number;
  /** When the player joined the lobby. Used to compute session length for
   *  persisted high scores on the Official Server. */
  joinedAt: number;
  /** True when the socket presented a valid LOADTEST_TOKEN. Bypasses the
   *  per-lobby maxPlayers cap and is excluded from leaderboard persistence. */
  isBot: boolean;
};

export type Lobby = {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  paused: boolean;
  createdAt: number;
  players: Map<string, ServerPlayer>;
};

const lobbies = new Map<string, Lobby>();
const playerLobby = new Map<string, string>(); // socketId -> lobbyId

const MAX_PLAYERS = 8;
const MAX_NAME = 40;
const MAX_LOBBY_NAME = 40;

function sanitize(name: string, max: number, fallback: string): string {
  const trimmed = (name ?? '').toString().trim().slice(0, max);
  return trimmed || fallback;
}

/** Create-or-return the always-on Official Server lobby. Idempotent; safe to
 *  call from boot and again from any join path. hostId is a sentinel so no
 *  real socket can ever pass the host-only admin guards. */
export function ensureOfficialLobby(): Lobby {
  const existing = lobbies.get(OFFICIAL_LOBBY_ID);
  if (existing) return existing;
  const lobby: Lobby = {
    id: OFFICIAL_LOBBY_ID,
    name: '★ Tower Climb — Official Server',
    hostId: OFFICIAL_HOST_ID,
    maxPlayers: MAX_PLAYERS,
    paused: false,
    createdAt: Date.now(),
    players: new Map(),
  };
  lobbies.set(OFFICIAL_LOBBY_ID, lobby);
  return lobby;
}

export function createLobby(opts: {
  socketId: string;
  name: string;
  displayName: string;
  character: number;
  role: Role;
  isBot?: boolean;
}): Lobby {
  const id = randomBytes(4).toString('hex');
  const hostName = sanitize(opts.displayName, MAX_NAME, 'Host');
  const lobby: Lobby = {
    id,
    name: sanitize(opts.name, MAX_LOBBY_NAME, `${hostName}'s lobby`),
    hostId: opts.socketId,
    maxPlayers: MAX_PLAYERS,
    paused: false,
    createdAt: Date.now(),
    players: new Map(),
  };
  lobby.players.set(opts.socketId, {
    socketId: opts.socketId,
    displayName: hostName,
    character: opts.character,
    role: opts.role,
    isHost: true,
    maxHeight: 0,
    x: 0,
    y: 2,
    z: 0,
    yaw: 0,
    state: 'idle',
    lastInputAt: Date.now(),
    joinedAt: Date.now(),
    isBot: !!opts.isBot,
  });
  lobbies.set(id, lobby);
  playerLobby.set(opts.socketId, id);
  return lobby;
}

export function joinLobby(opts: {
  socketId: string;
  lobbyId: string;
  displayName: string;
  character: number;
  isBot?: boolean;
}): { ok: true; lobby: Lobby } | { ok: false; error: string } {
  const lobby = lobbies.get(opts.lobbyId);
  if (!lobby) return { ok: false, error: 'lobby not found' };
  // Bots bypass the maxPlayers cap — they're the load-test fleet, gated by
  // LOADTEST_TOKEN at the handshake (see io.ts).
  if (!opts.isBot && lobby.players.size >= lobby.maxPlayers) {
    return { ok: false, error: 'lobby is full' };
  }
  if (lobby.players.has(opts.socketId)) return { ok: true, lobby };

  lobby.players.set(opts.socketId, {
    socketId: opts.socketId,
    displayName: sanitize(opts.displayName, MAX_NAME, 'Guest'),
    character: opts.character,
    role: 'player',
    isHost: false,
    maxHeight: 0,
    x: (Math.random() - 0.5) * 6,
    y: 2,
    z: (Math.random() - 0.5) * 6,
    yaw: 0,
    state: 'idle',
    lastInputAt: Date.now(),
    joinedAt: Date.now(),
    isBot: !!opts.isBot,
  });
  playerLobby.set(opts.socketId, opts.lobbyId);
  return { ok: true, lobby };
}

export function leaveLobby(socketId: string): {
  lobbyId: string;
  dissolved: boolean;
  /** The player record that left, if any. Caller uses this to persist
   *  final stats (e.g. official-server high scores). */
  player: ServerPlayer | null;
} | null {
  const lobbyId = playerLobby.get(socketId);
  if (!lobbyId) return null;
  const lobby = lobbies.get(lobbyId);
  playerLobby.delete(socketId);
  if (!lobby) return { lobbyId, dissolved: false, player: null };

  const player = lobby.players.get(socketId) ?? null;
  lobby.players.delete(socketId);

  if (lobby.players.size === 0) {
    // The Official Server never dissolves — it's the persistent rendezvous.
    if (isOfficial(lobby)) return { lobbyId, dissolved: false, player };
    lobbies.delete(lobbyId);
    return { lobbyId, dissolved: true, player };
  }

  if (lobby.hostId === socketId) {
    // Official Server has a sentinel host (OFFICIAL_HOST_ID), so this branch
    // never fires for it — the check above (`hostId === socketId`) is false
    // for any real socket. Defensive guard kept for clarity.
    if (!isOfficial(lobby)) {
      const newHost = [...lobby.players.values()][0];
      lobby.hostId = newHost.socketId;
      newHost.isHost = true;
    }
  }
  return { lobbyId, dissolved: false, player };
}

export function getLobby(lobbyId: string): Lobby | undefined {
  return lobbies.get(lobbyId);
}

export function getLobbyOf(socketId: string): Lobby | undefined {
  const lobbyId = playerLobby.get(socketId);
  return lobbyId ? lobbies.get(lobbyId) : undefined;
}

export function listLobbies(): LobbyInfo[] {
  return [...lobbies.values()]
    .map((l) => ({
      id: l.id,
      name: l.name,
      hostName: isOfficial(l)
        ? 'Dedicated Server'
        : l.players.get(l.hostId)?.displayName ?? 'unknown',
      playerCount: l.players.size,
      maxPlayers: l.maxPlayers,
      createdAt: l.createdAt,
    }))
    // Official server pinned at the top, then most-recently-created lobbies.
    .sort((a, b) => {
      if (a.id === OFFICIAL_LOBBY_ID) return -1;
      if (b.id === OFFICIAL_LOBBY_ID) return 1;
      return b.createdAt - a.createdAt;
    });
}

export function lobbyToState(lobby: Lobby): LobbyState {
  return {
    id: lobby.id,
    name: lobby.name,
    hostId: lobby.hostId,
    maxPlayers: lobby.maxPlayers,
    paused: lobby.paused,
    createdAt: lobby.createdAt,
    players: [...lobby.players.values()].map<LobbyPlayer>((p) => ({
      id: p.socketId,
      displayName: p.displayName,
      character: p.character,
      role: p.role,
      isHost: p.isHost,
      maxHeight: p.maxHeight,
    })),
  };
}

/** `isAdmin` short-circuits the host check so a token-elevated admin can act
 *  on lobbies they don't own — chiefly the Official Server, whose hostId is
 *  the SYSTEM sentinel and matches no real socket. */
export function kickPlayer(
  hostSocketId: string,
  targetSocketId: string,
  isAdmin = false,
): { ok: true; lobbyId: string } | { ok: false; error: string } {
  const lobby = getLobbyOf(hostSocketId);
  if (!lobby) return { ok: false, error: 'not in a lobby' };
  if (!isAdmin && lobby.hostId !== hostSocketId) return { ok: false, error: 'not the host' };
  if (!lobby.players.has(targetSocketId)) return { ok: false, error: 'player not found' };
  if (targetSocketId === hostSocketId) return { ok: false, error: 'cannot kick yourself' };
  lobby.players.delete(targetSocketId);
  playerLobby.delete(targetSocketId);
  return { ok: true, lobbyId: lobby.id };
}

export function setPaused(
  hostSocketId: string,
  paused: boolean,
  isAdmin = false,
): { ok: true; lobby: Lobby } | { ok: false; error: string } {
  const lobby = getLobbyOf(hostSocketId);
  if (!lobby) return { ok: false, error: 'not in a lobby' };
  if (!isAdmin && lobby.hostId !== hostSocketId) return { ok: false, error: 'not the host' };
  lobby.paused = paused;
  return { ok: true, lobby };
}

export function updateLobbyConfig(
  hostSocketId: string,
  opts: { maxPlayers?: number; name?: string },
  isAdmin = false,
): { ok: true; lobby: Lobby } | { ok: false; error: string } {
  const lobby = getLobbyOf(hostSocketId);
  if (!lobby) return { ok: false, error: 'not in a lobby' };
  if (!isAdmin && lobby.hostId !== hostSocketId) return { ok: false, error: 'not the host' };
  if (opts.name !== undefined) {
    lobby.name = sanitize(opts.name, MAX_LOBBY_NAME, lobby.name);
  }
  if (opts.maxPlayers !== undefined) {
    const cap = Math.max(1, Math.min(16, Math.floor(opts.maxPlayers)));
    lobby.maxPlayers = cap;
  }
  return { ok: true, lobby };
}

export function updateInput(
  socketId: string,
  input: { x: number; y: number; z: number; yaw: number; state: 'idle' | 'run' | 'air' },
): void {
  const lobby = getLobbyOf(socketId);
  if (!lobby) return;
  const player = lobby.players.get(socketId);
  if (!player || player.role !== 'player') return;
  player.x = clamp(input.x, -1000, 1000);
  player.y = clamp(input.y, -50, 1000);
  player.z = clamp(input.z, -1000, 1000);
  player.yaw = input.yaw;
  player.state = input.state;
  player.lastInputAt = Date.now();
  if (player.y > player.maxHeight) player.maxHeight = player.y;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function allLobbies(): Lobby[] {
  return [...lobbies.values()];
}
