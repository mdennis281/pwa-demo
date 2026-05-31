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

/** True for any dedicated/official-server lobby id. The first dedicated server
 *  keeps the bare `tower-official` id (so the load-test bots' `--lobby
 *  tower-official` default and old reconnecting clients keep working); the
 *  2nd+ are suffixed `-2`, `-3`, … Mirror of `isDedicatedLobbyId` in
 *  packages/shared. */
export function isDedicatedLobbyId(id: string): boolean {
  return id === OFFICIAL_LOBBY_ID || id.startsWith(`${OFFICIAL_LOBBY_ID}-`);
}

/** True if this lobby is one of the dedicated, always-on Official Servers. */
export function isOfficial(lobby: { id: string } | undefined | null): boolean {
  return !!lobby && isDedicatedLobbyId(lobby.id);
}

/** Stable id for the Nth dedicated server (1-based). #1 is the bare base id. */
function dedicatedLobbyId(n: number): string {
  return n <= 1 ? OFFICIAL_LOBBY_ID : `${OFFICIAL_LOBBY_ID}-${n}`;
}

/** Display name for the Nth dedicated server. Drops the number when there's
 *  only one, so the common case reads simply "Official Server". */
function dedicatedName(n: number, total: number): string {
  return total <= 1
    ? '★ Tower Climb — Official Server'
    : `★ Tower Climb — Official Server ${n}`;
}

export type ServerPlayer = {
  socketId: string;
  /** Stable per-tab id from the client handshake — survives reconnects, unlike
   *  socketId. Used to reconcile a reconnecting player with their prior record.
   *  Falls back to socketId for clients that don't supply one (bots). */
  clientId: string;
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
/** Hard ceiling on any lobby's player cap. Admins can set "as many as the heart
 *  desires" up to this — high enough to never feel limiting, bounded so a typo
 *  can't melt the O(n²) snapshot fan-out. */
const MAX_PLAYER_CAP = 1000;

function sanitize(name: string, max: number, fallback: string): string {
  const trimmed = (name ?? '').toString().trim().slice(0, max);
  return trimmed || fallback;
}

function clampCap(n: number): number {
  if (!Number.isFinite(n)) return MAX_PLAYERS;
  return Math.max(1, Math.min(MAX_PLAYER_CAP, Math.floor(n)));
}

export type ReconcileResult = {
  /** ids of dedicated lobbies newly materialized this call. */
  created: string[];
  /** ids whose name/cap were updated in place. */
  updated: string[];
  /** dedicated lobbies torn down (count reduced or disabled), with the full
   *  player records that were in them — the caller evicts those sockets from
   *  the room, sends them back to the browser, and (a torn-down dedicated
   *  server is everyone leaving it at once) persists their session high
   *  scores, exactly as a normal leave would. */
  removed: { id: string; players: ServerPlayer[] }[];
};

/** Make the live set of dedicated ("Official") servers match `config`.
 *  Idempotent — safe to call on boot and again on every admin config change.
 *  Creates missing servers, re-caps/renames existing ones, and removes any
 *  beyond the desired count (or all of them when disabled). Each server's host
 *  is the SYSTEM sentinel so no real socket can pass the host-only admin guards.
 *  Players inside a removed server are reported back so the caller can notify
 *  them; their `playerLobby` mapping is cleared here. */
export function reconcileDedicatedLobbies(config: {
  dedicatedEnabled: boolean;
  dedicatedCount: number;
  dedicatedPlayerCap: number;
}): ReconcileResult {
  const desiredCount = config.dedicatedEnabled ? Math.max(0, Math.floor(config.dedicatedCount)) : 0;
  const cap = clampCap(config.dedicatedPlayerCap);
  const result: ReconcileResult = { created: [], updated: [], removed: [] };

  const desiredIds = new Set<string>();
  for (let n = 1; n <= desiredCount; n++) desiredIds.add(dedicatedLobbyId(n));

  // Create or update each desired server.
  for (let n = 1; n <= desiredCount; n++) {
    const id = dedicatedLobbyId(n);
    const name = dedicatedName(n, desiredCount);
    const existing = lobbies.get(id);
    if (existing) {
      existing.maxPlayers = cap;
      existing.name = name;
      result.updated.push(id);
    } else {
      lobbies.set(id, {
        id,
        name,
        hostId: OFFICIAL_HOST_ID,
        maxPlayers: cap,
        paused: false,
        createdAt: Date.now(),
        players: new Map(),
      });
      result.created.push(id);
    }
  }

  // Tear down any dedicated lobby no longer desired.
  for (const lobby of [...lobbies.values()]) {
    if (!isOfficial(lobby) || desiredIds.has(lobby.id)) continue;
    const players = [...lobby.players.values()];
    for (const p of players) playerLobby.delete(p.socketId);
    lobbies.delete(lobby.id);
    result.removed.push({ id: lobby.id, players });
  }
  return result;
}

/** Pick the dedicated server a Quick Play should drop into: the one with the
 *  most free slots. Returns null when no dedicated servers are running (admin
 *  disabled them), in which case Quick Play is surfaced as offline. */
export function pickQuickJoinLobby(): Lobby | null {
  const dedicated = [...lobbies.values()]
    .filter(isOfficial)
    .sort((a, b) => a.id.localeCompare(b.id));
  let best: Lobby | null = null;
  let bestFree = -Infinity;
  for (const l of dedicated) {
    const free = l.maxPlayers - l.players.size;
    if (free > bestFree) {
      bestFree = free;
      best = l;
    }
  }
  return best;
}

export function createLobby(opts: {
  socketId: string;
  clientId: string;
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
    clientId: opts.clientId,
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
  clientId: string;
  lobbyId: string;
  displayName: string;
  character: number;
  isBot?: boolean;
}): { ok: true; lobby: Lobby } | { ok: false; error: string } {
  const lobby = lobbies.get(opts.lobbyId);
  if (!lobby) return { ok: false, error: 'lobby not found' };

  // Reconnect reconciliation: Socket.IO hands a reconnecting client a brand-new
  // socket id, so re-joining would otherwise leave the player's PRIOR record
  // (keyed by the now-dead socket id) sitting in the lobby as a frozen "ghost"
  // — a second copy of themselves — until that socket times out (~45s). Evict
  // any record sharing this client's stable id, and remember whether it was the
  // host so the fresh record below can inherit it.
  let inheritHost = false;
  let inheritMaxHeight = 0;
  for (const [sid, p] of [...lobby.players]) {
    if (sid !== opts.socketId && p.clientId === opts.clientId) {
      if (lobby.hostId === sid) inheritHost = true;
      // Carry the climbed height across the reconnect so the player's best
      // (and the leaderboard write on their eventual leave) isn't reset to 0.
      if (p.maxHeight > inheritMaxHeight) inheritMaxHeight = p.maxHeight;
      lobby.players.delete(sid);
      playerLobby.delete(sid);
    }
  }

  // Bots bypass the maxPlayers cap — they're the load-test fleet, gated by
  // LOADTEST_TOKEN at the handshake (see io.ts).
  if (!opts.isBot && !lobby.players.has(opts.socketId) && lobby.players.size >= lobby.maxPlayers) {
    return { ok: false, error: 'lobby is full' };
  }
  if (lobby.players.has(opts.socketId)) return { ok: true, lobby };

  lobby.players.set(opts.socketId, {
    socketId: opts.socketId,
    clientId: opts.clientId,
    displayName: sanitize(opts.displayName, MAX_NAME, 'Guest'),
    character: opts.character,
    role: 'player',
    isHost: inheritHost,
    maxHeight: inheritMaxHeight,
    x: (Math.random() - 0.5) * 6,
    y: 2,
    z: (Math.random() - 0.5) * 6,
    yaw: 0,
    state: 'idle',
    lastInputAt: Date.now(),
    joinedAt: Date.now(),
    isBot: !!opts.isBot,
  });
  // Re-point the host to the reconnected socket (never for the Official Server,
  // whose host is the SYSTEM sentinel and matches no real socket).
  if (inheritHost && !isOfficial(lobby)) lobby.hostId = opts.socketId;
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
    // Dedicated servers pinned at the top (in id order), then most-recently-
    // created player lobbies.
    .sort((a, b) => {
      const aOff = isDedicatedLobbyId(a.id);
      const bOff = isDedicatedLobbyId(b.id);
      if (aOff && bOff) return a.id.localeCompare(b.id);
      if (aOff) return -1;
      if (bOff) return 1;
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
      clientId: p.clientId,
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
    lobby.maxPlayers = clampCap(opts.maxPlayers);
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
