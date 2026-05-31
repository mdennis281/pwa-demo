import { io, type Socket } from 'socket.io-client';
import type {
  AdminResult,
  ClientToServerEvents,
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
