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

export function getSocket() {
  if (socket) return socket;
  socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });

  socket.onAny((_event: string, ...args: unknown[]) => {
    socketMetrics.rxEvents++;
    try { socketMetrics.rxBytesEst += JSON.stringify(args).length; } catch { /* noop */ }
  });

  return socket;
}
