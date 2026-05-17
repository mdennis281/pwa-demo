import type { Server, Socket } from 'socket.io';
import type {
  ClientInfo,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@pwa-demo/shared';
import { attachGame } from './game/index.js';

const clients = new Map<string, ClientInfo>();
const STATUS_ROOM = 'status';

function snapshot(): ClientInfo[] {
  return Array.from(clients.values()).sort((a, b) => a.connectedAt - b.connectedAt);
}

export function attachSocket(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const info: ClientInfo = {
      id: socket.id,
      userAgent: String(socket.handshake.headers['user-agent'] ?? 'unknown'),
      connectedAt: Date.now(),
      lastPingMs: null,
    };
    clients.set(socket.id, info);
    io.to(STATUS_ROOM).emit('clients:update', snapshot());

    socket.on('status:join', () => {
      socket.join(STATUS_ROOM);
      socket.emit('clients:update', snapshot());
    });

    socket.on('status:leave', () => {
      socket.leave(STATUS_ROOM);
    });

    socket.on('ping:probe', (sentAt: number) => {
      socket.emit('pong:reply', sentAt);
      const c = clients.get(socket.id);
      if (c) {
        c.lastPingMs = Date.now() - sentAt;
        io.to(STATUS_ROOM).emit('clients:update', snapshot());
      }
    });

    socket.on('disconnect', () => {
      clients.delete(socket.id);
      io.to(STATUS_ROOM).emit('clients:update', snapshot());
    });

    attachGame(io, socket);
  });
}
