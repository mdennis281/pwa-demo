import { io, type Socket } from 'socket.io-client';
import type {
  AdminResult,
  ClientToServerEvents,
  ServerConfig,
  ServerConfigResult,
  ServerToClientEvents,
} from '@pwa-demo/shared';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export const socketMetrics = {
  rxEvents: 0,
  rxBytesEst: 0,
  txEvents: 0,
  txBytesEst: 0,
  startedAt: Date.now(),
};

const ADMIN_TOKEN_KEY = 'adminToken';
const CLIENT_ID_KEY = 'pwademo:clientId';

/** A stable identity for THIS tab that survives socket reconnects — unlike
 *  `socket.id`, which Socket.IO regenerates on every reconnect. We send it in
 *  the handshake auth; the server reconciles a reconnecting player by it (so a
 *  pre-reconnect "ghost" record is reaped instead of lingering as a second
 *  on-screen character), and the game uses it to recognize its own avatar.
 *  Backed by sessionStorage so a reload mid-blip still re-associates, and
 *  scoped per-tab so two tabs are correctly two players. */
let clientId: string | null = null;
function ensureClientId(): string {
  if (clientId) return clientId;
  try {
    const stored = sessionStorage.getItem(CLIENT_ID_KEY);
    if (stored) return (clientId = stored);
  } catch { /* sessionStorage unavailable (private mode etc.) */ }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  clientId = id;
  try { sessionStorage.setItem(CLIENT_ID_KEY, id); } catch { /* noop */ }
  return id;
}

/** Stable per-tab client identity (see {@link ensureClientId}). */
export function getClientId(): string {
  return ensureClientId();
}

function readAdminToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return !!readAdminToken();
}

/** Submit `token` to the server. Resolves with `{ok:true}` on accept (server
 *  flips this socket's isAdmin and re-emits auth:status), `{ok:false,error}`
 *  on reject. On success we persist to localStorage so subsequent loads can
 *  silently re-elevate via attemptStoredAdmin. */
export function elevateAdmin(token: string): Promise<AdminResult> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'socket not connected' });
      return;
    }
    socket.emit('admin:elevate', token, (res: AdminResult) => {
      if (res.ok) {
        try { localStorage.setItem(ADMIN_TOKEN_KEY, token); } catch { /* noop */ }
      }
      resolve(res);
    });
  });
}

/** Drop admin on this socket and clear the stored token. */
export function logoutAdmin(): Promise<AdminResult> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'socket not connected' });
      return;
    }
    socket.emit('admin:logout', (res: AdminResult) => {
      try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* noop */ }
      resolve(res);
    });
  });
}

/** Read the global dedicated-server config (admin only). Rejects via the
 *  `{ok:false}` result when the socket isn't connected or the caller isn't an
 *  elevated admin. */
export function getServerConfig(): Promise<ServerConfigResult> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'socket not connected' });
      return;
    }
    socket.emit('admin:get-config', (res) => resolve(res));
  });
}

/** Update the global dedicated-server config (admin only). The server clamps,
 *  persists, reconciles the live fleet, and acks the effective config. */
export function setServerConfig(patch: Partial<ServerConfig>): Promise<ServerConfigResult> {
  return new Promise((resolve) => {
    if (!socket) {
      resolve({ ok: false, error: 'socket not connected' });
      return;
    }
    socket.emit('admin:set-config', patch, (res) => resolve(res));
  });
}

/** On a fresh connection, replay any token we've stored so the user doesn't
 *  have to re-paste it on every reload. Fire-and-forget — failure clears the
 *  stale token without bothering the UI. */
function attemptStoredAdmin(): void {
  const token = readAdminToken();
  if (!token || !socket) return;
  socket.emit('admin:elevate', token, (res: AdminResult) => {
    if (!res.ok) {
      console.warn('[auth] stored admin token rejected:', res.error);
      try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* noop */ }
    }
  });
}

export function getSocket() {
  if (socket) return socket;
  socket = io({
    autoConnect: true,
    transports: ['websocket', 'polling'],
    // Stable identity that outlives reconnects (socket.id does not). Lets the
    // server re-associate us after a drop instead of leaving a duplicate ghost.
    auth: { clientId: ensureClientId() },
  });

  socket.onAny((_event: string, ...args: unknown[]) => {
    socketMetrics.rxEvents++;
    try { socketMetrics.rxBytesEst += JSON.stringify(args).length; } catch { /* noop */ }
  });
  // Count outbound traffic too (game:input at 20Hz, pings, etc.) — without this
  // the debug panel's client tx counters stay at zero.
  socket.onAnyOutgoing((_event: string, ...args: unknown[]) => {
    socketMetrics.txEvents++;
    try { socketMetrics.txBytesEst += JSON.stringify(args).length; } catch { /* noop */ }
  });

  // Re-elevate on every connection (initial + after any reconnect), since
  // the server holds isAdmin in per-socket data and a reconnect = fresh socket.
  socket.on('connect', attemptStoredAdmin);

  return socket;
}
