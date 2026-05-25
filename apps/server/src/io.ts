import { monitorEventLoopDelay } from 'node:perf_hooks';
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
import { env } from './env.js';

const clients = new Map<string, ClientInfo>();
const STATUS_ROOM = 'status';
const DEBUG_ROOM = 'debug';

// Continuously samples how long the event loop is delayed past its scheduled
// tick. p50 climbing toward the tick period (50ms at 20Hz) means the loop is
// saturated; p99 is the spike indicator. Reset each broadcast so values are
// per-second, not lifetime.
const loopLag = monitorEventLoopDelay({ resolution: 10 });
loopLag.enable();

function snapshot(): ClientInfo[] {
  return Array.from(clients.values()).sort((a, b) => a.connectedAt - b.connectedAt);
}

export function getPing(socketId: string): number | null {
  return clients.get(socketId)?.lastPingMs ?? null;
}

export function attachSocket(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  // Handshake gate for elevated connections — the headless load-test fleet
  // and the human server admin. Both carry an auth blob:
  //   io(url, { auth: { isBot: true,  token: LOADTEST_TOKEN } })
  //   io(url, { auth: { isAdmin: true, token: ADMIN_TOKEN    } })
  // Wrong/missing token + a privilege claim is a hard reject (never falls
  // through to a normal anonymous connection). A normal client passes no
  // auth blob and connects unchanged.
  io.use((socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as {
      isBot?: boolean;
      isAdmin?: boolean;
      token?: string;
    };
    if (auth.isBot) {
      if (!env.LOADTEST_TOKEN) {
        next(new Error('bot connections disabled (LOADTEST_TOKEN unset)'));
        return;
      }
      if (auth.token !== env.LOADTEST_TOKEN) {
        next(new Error('invalid bot token'));
        return;
      }
      socket.data.isBot = true;
    }
    if (auth.isAdmin) {
      if (!env.ADMIN_TOKEN) {
        next(new Error('admin elevation disabled (ADMIN_TOKEN unset)'));
        return;
      }
      if (auth.token !== env.ADMIN_TOKEN) {
        next(new Error('invalid admin token'));
        return;
      }
      socket.data.isAdmin = true;
    }
    next();
  });

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
      lastTickBytes: serverMetrics.lastTickBytes,
      // perf_hooks reports in ns — convert to ms for the UI.
      loopLagP50Ms: Number((loopLag.percentile(50) / 1e6).toFixed(2)),
      loopLagP99Ms: Number((loopLag.percentile(99) / 1e6).toFixed(2)),
      rssMb: Number((process.memoryUsage.rss() / 1024 / 1024).toFixed(1)),
    };
    loopLag.reset();
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

    // Tell the client what the handshake earned them so the UI can render
    // admin affordances without trusting localStorage alone.
    socket.emit('auth:status', {
      isAdmin: socket.data.isAdmin === true,
      isBot: socket.data.isBot === true,
    });

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
