import { io, type Socket } from 'socket.io-client';
import type {
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

/** Store (or clear) the admin token in localStorage and re-handshake. A full
 *  reload is the cleanest way to re-establish the socket with new auth without
 *  tearing down every component-level listener. */
export function setAdminToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token && token.trim()) localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.location.reload();
}

export function hasAdminToken(): boolean {
  return !!readAdminToken();
}

export function getSocket() {
  if (socket) return socket;
  const adminToken = readAdminToken();
  socket = io({
    autoConnect: true,
    transports: ['websocket', 'polling'],
    // Only send the admin auth blob when we have a token. Anonymous clients
    // pass nothing and connect normally.
    auth: adminToken ? { isAdmin: true, token: adminToken } : {},
  });

  socket.onAny((_event: string, ...args: unknown[]) => {
    socketMetrics.rxEvents++;
    try { socketMetrics.rxBytesEst += JSON.stringify(args).length; } catch { /* noop */ }
  });

  // If the server rejects our admin token at the handshake (wrong value or
  // ADMIN_TOKEN unset), clear it locally and let socket.io retry anonymously —
  // otherwise the same bad token would loop forever and the user couldn't
  // even play the game.
  socket.on('connect_error', (err) => {
    if (adminToken && /admin/i.test(err.message)) {
      console.warn('[auth] admin token rejected, clearing:', err.message);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      if (socket) socket.auth = {};
    }
  });

  return socket;
}
