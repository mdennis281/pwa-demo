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
};

export interface ServerToClientEvents {
  'clients:update': (clients: ClientInfo[]) => void;
  'pong:reply': (sentAt: number) => void;
  'lobby:list': (lobbies: LobbyInfo[]) => void;
  'lobby:state': (state: LobbyState | null) => void;
  'game:snapshot': (snap: GameSnapshot) => void;
  'debug:server-stats': (stats: ServerDebugStats) => void;
}

export interface ClientToServerEvents {
  'status:join': () => void;
  'status:leave': () => void;
  'ping:probe': (sentAt: number) => void;
  'lobby:browser:join': () => void;
  'lobby:browser:leave': () => void;
  'lobby:create': (opts: LobbyCreate, cb: (r: LobbyResult) => void) => void;
  'lobby:join': (opts: LobbyJoin, cb: (r: LobbyResult) => void) => void;
  'lobby:leave': () => void;
  'game:input': (input: LocalInput) => void;
  'admin:action': (action: AdminAction, cb: (r: AdminResult) => void) => void;
  'debug:subscribe': () => void;
  'debug:unsubscribe': () => void;
}

export type AnySocketEvent =
  | keyof ServerToClientEvents
  | keyof ClientToServerEvents;
