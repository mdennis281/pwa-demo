import type { Server, Socket } from 'socket.io';
import type {
  ClientInfo,
  ClientToServerEvents,
  ServerToClientEvents,
  ServerDebugStats,
} from '@pwa-demo/shared';
import { attachGame } from './game/index.js';
import { allLobbies } from './game/lobby.js';
import { serverMetrics } from './metrics.js';

const clients = new Map<string, ClientInfo>();
const STATUS_ROOM = 'status';
const DEBUG_ROOM = 'debug';

function snapshot(): ClientInfo[] {
  return Array.from(clients.values()).sort((a, b) => a.connectedAt - b.connectedAt);
}

export function getPing(socketId: string): number | null {
  return clients.get(socketId)?.lastPingMs ?? null;
}

export function attachSocket(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  // Periodic debug stats broadcast
  setInterval(() => {
    const lobbies = allLobbies();
    const stats: ServerDebugStats = {
      uptimeMs: Date.now() - serverMetrics.startedAt,
      totalLobbies: lobbies.length,
      totalPlayers: lobbies.reduce((n, l) => n + l.players.size, 0),
      tickHz: 20,
      rxEvents: serverMetrics.rxEvents,
      txEvents: serverMetrics.txEvents,
      rxBytesEst: serverMetrics.rxBytesEst,
      txBytesEst: serverMetrics.txBytesEst,
    };
    io.to(DEBUG_ROOM).emit('debug:server-stats', stats);
  }, 1000);

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const info: ClientInfo = {
      id: socket.id,
      userAgent: String(socket.handshake.headers['user-agent'] ?? 'unknown'),
      connectedAt: Date.now(),
      lastPingMs: null,
    };
    clients.set(socket.id, info);
    io.to(STATUS_ROOM).emit('clients:update', snapshot());

    // Track incoming event metrics
    socket.use(([_event, ...args], next) => {
      serverMetrics.rxEvents++;
      try { serverMetrics.rxBytesEst += JSON.stringify(args).length; } catch { /* noop */ }
      next();
    });

    socket.on('status:join', () => {
      socket.join(STATUS_ROOM);
      socket.emit('clients:update', snapshot());
    });

    socket.on('status:leave', () => {
      socket.leave(STATUS_ROOM);
    });

    socket.on('debug:subscribe', () => {
      socket.join(DEBUG_ROOM);
    });

    socket.on('debug:unsubscribe', () => {
      socket.leave(DEBUG_ROOM);
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

    attachGame(io, socket, getPing);
  });
}
