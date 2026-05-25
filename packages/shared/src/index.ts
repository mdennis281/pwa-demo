export type ClientInfo = {
  id: string;
  userAgent: string;
  connectedAt: number;
  lastPingMs: number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  actions?: { action: string; title: string }[];
};

// ────────────────────── game / lobby ──────────────────────

export type Role = 'player' | 'spectator';

export type LobbyInfo = {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
};

export type LobbyPlayer = {
  id: string;
  displayName: string;
  character: number;
  role: Role;
  isHost: boolean;
  maxHeight: number;
};

export type LobbyState = {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  createdAt: number;
  paused: boolean;
  players: LobbyPlayer[];
};

export type PlayerSnapshot = LobbyPlayer & {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** simple flag set by client when in moving/jumping state */
  state: 'idle' | 'run' | 'air';
  /** last measured round-trip ping in ms, null if not yet probed */
  ping: number | null;
};

export type GameSnapshot = {
  lobbyId: string;
  t: number;
  players: PlayerSnapshot[];
};

export type LocalInput = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  state: 'idle' | 'run' | 'air';
};

export type LobbyCreate = {
  name: string;
  displayName: string;
  character: number;
  role: Role;
};

export type LobbyJoin = {
  lobbyId: string;
  displayName: string;
  character: number;
};

export type LobbyResult =
  | { ok: true; lobby: LobbyState }
  | { ok: false; error: string };

export type AdminAction =
  | { type: 'kick'; targetId: string }
  | { type: 'pause'; paused: boolean }
  | { type: 'config'; maxPlayers?: number; name?: string };

export type AdminResult = { ok: true } | { ok: false; error: string };

export type ServerDebugStats = {
  uptimeMs: number;
  totalLobbies: number;
  totalPlayers: number;
  tickHz: number;
  rxEvents: number;
  txEvents: number;
  rxBytesEst: number;
  txBytesEst: number;
  /** Total bytes broadcast in the most recent tick across all lobbies. The
   *  first signal a 50-player load test stresses — watch this climb. */
  lastTickBytes: number;
  /** node:perf_hooks event-loop delay percentiles in ms. Climbs above ~5ms
   *  means the loop is getting starved by tick fanout. */
  loopLagP50Ms: number;
  loopLagP99Ms: number;
  rssMb: number;
};

/** The single hardcoded "Official Server" lobby. Always-on, never dissolves,
 *  no host (admin actions are refused). Clients join via lobby:quick-join. */
export const OFFICIAL_LOBBY_ID = 'tower-official';
export const OFFICIAL_HOST_ID = 'SYSTEM';

export type TowerHighScore = {
  displayName: string;
  character: number;
  maxHeight: number;
  achievedAt: number; // unix ms
};

/** Server tells the client what privileges (if any) the handshake earned.
 *  Emitted once on connect; client uses it to gate admin UI affordances.
 *  The server is the source of truth — a client claiming `isAdmin` without
 *  a valid ADMIN_TOKEN gets `isAdmin: false` here. */
export type AuthStatus = {
  isAdmin: boolean;
  isBot: boolean;
};

export interface ServerToClientEvents {
  'clients:update': (clients: ClientInfo[]) => void;
  'pong:reply': (sentAt: number) => void;
  'lobby:list': (lobbies: LobbyInfo[]) => void;
  'lobby:state': (state: LobbyState | null) => void;
  'game:snapshot': (snap: GameSnapshot) => void;
  'debug:server-stats': (stats: ServerDebugStats) => void;
  /** Pushed to lobby-browser room whenever the official-server leaderboard
   *  changes (player leaves, new high score posted). */
  'tower:leaderboard': (top: TowerHighScore[]) => void;
  /** Emitted once per connection after the handshake middleware runs. */
  'auth:status': (status: AuthStatus) => void;
}

export interface ClientToServerEvents {
  'status:join': () => void;
  'status:leave': () => void;
  'ping:probe': (sentAt: number) => void;
  'lobby:browser:join': () => void;
  'lobby:browser:leave': () => void;
  'lobby:create': (opts: LobbyCreate, cb: (r: LobbyResult) => void) => void;
  'lobby:join': (opts: LobbyJoin, cb: (r: LobbyResult) => void) => void;
  /** Drop into the always-on Official Server lobby in one click. Idempotent —
   *  if the caller is already in the official lobby, returns its current state. */
  'lobby:quick-join': (opts: Pick<LobbyJoin, 'displayName' | 'character'>, cb: (r: LobbyResult) => void) => void;
  'lobby:leave': () => void;
  'game:input': (input: LocalInput) => void;
  'admin:action': (action: AdminAction, cb: (r: AdminResult) => void) => void;
  /** Runtime privilege elevation — present a token, get isAdmin on success.
   *  Beats handshake auth because failure can be surfaced in the UI without
   *  a page reload. Server flips socket.data.isAdmin and re-emits auth:status. */
  'admin:elevate': (token: string, cb: (r: AdminResult) => void) => void;
  /** Drop admin privileges on this socket. No-op if not currently elevated. */
  'admin:logout': (cb: (r: AdminResult) => void) => void;
  'debug:subscribe': () => void;
  'debug:unsubscribe': () => void;
}

export type AnySocketEvent =
  | keyof ServerToClientEvents
  | keyof ClientToServerEvents;
