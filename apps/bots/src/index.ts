/**
 * Tower-climb headless bot harness.
 *
 * Spawns N socket.io clients that join a lobby and run a deterministic
 * orbit-plus-jump pattern at the configured tick rate. Used to load-test
 * the server's tick fanout — see apps/bots/README.md.
 *
 *   tsx src/index.ts --host http://localhost:3000 --count 50 --duration 5m
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  LobbyResult,
  ServerDebugStats,
  ServerToClientEvents,
} from '@pwa-demo/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../');
loadDotenv({ path: path.join(repoRoot, '.env') });

// ─── arg parsing ──────────────────────────────────────────────────────────

type Args = {
  host: string;
  lobby: string;
  token: string;
  count: number;
  rampMs: number;
  durationMs: number; // 0 = run until SIGINT
  tickHz: number;
  radius: number;
  jumpHeight: number;
  statsEverySec: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    host: 'http://localhost:3000',
    lobby: 'tower-official',
    token: process.env.LOADTEST_TOKEN ?? '',
    count: 10,
    rampMs: 5_000,
    durationMs: 0,
    tickHz: 20,
    radius: 5,
    jumpHeight: 2.5,
    statsEverySec: 5,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--host': out.host = next(); break;
      case '--lobby': out.lobby = next(); break;
      case '--token': out.token = next(); break;
      case '--count': out.count = parseInt(next(), 10); break;
      case '--ramp': out.rampMs = parseDuration(next()); break;
      case '--duration': out.durationMs = parseDuration(next()); break;
      case '--tick': out.tickHz = parseInt(next(), 10); break;
      case '--radius': out.radius = parseFloat(next()); break;
      case '--jump': out.jumpHeight = parseFloat(next()); break;
      case '--stats': out.statsEverySec = parseInt(next(), 10); break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`unknown arg: ${a}`);
        printHelp();
        process.exit(2);
    }
  }
  return out;
}

/** Parse "500ms" / "5s" / "5m" / bare number (treated as ms). */
function parseDuration(s: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(s);
  if (!m) throw new Error(`bad duration: ${s}`);
  const n = parseFloat(m[1]);
  const unit = m[2] ?? 'ms';
  return unit === 'ms' ? n : unit === 's' ? n * 1000 : n * 60_000;
}

function printHelp(): void {
  console.log(`tower-bot — headless load-test harness

USAGE
  tsx src/index.ts [flags]

FLAGS
  --host URL          server URL (default http://localhost:3000)
  --lobby ID          lobby id to join (default tower-official)
  --token T           LOADTEST_TOKEN (default from env)
  --count N           number of bots (default 10)
  --ramp DUR          stagger connects over this window (default 5s)
  --duration DUR      stop after this long, 0 = until SIGINT (default 0)
  --tick HZ           input emit rate per bot (default 20)
  --radius M          orbit radius (default 5)
  --jump M            jump height (default 2.5)
  --stats SEC         stats line every N seconds (default 5)
  -h, --help          print this help

DURATIONS may be "500ms", "5s", "5m", or a bare number (ms).

EXAMPLES
  # 50 bots into the Official server lobby, ramp over 5s, stop after 5m
  tsx src/index.ts --count 50 --ramp 5s --duration 5m

  # Bot fleet against a remote LAN box
  tsx src/index.ts --host http://pwa-demo.local --count 100 --token \$LOADTEST_TOKEN
`);
}

// ─── per-bot lifecycle ────────────────────────────────────────────────────

type Bot = {
  idx: number;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  bornAt: number;
  joined: boolean;
  inputTimer: NodeJS.Timeout | null;
  bornPhase: number;
  txEvents: number;
  rxEvents: number;
};

const TWO_PI = Math.PI * 2;
const ORBIT_OMEGA = 0.4;   // rad/s — ~15s per lap
const JUMP_OMEGA = 1.5;    // rad/s — ~4s per jump cycle

function spawnBot(idx: number, args: Args, sessionStats: SessionStats): Bot {
  const displayName = `[bot]${idx.toString().padStart(3, '0')}`;
  const bornPhase = (idx / Math.max(args.count, 1)) * TWO_PI;
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(args.host, {
    transports: ['websocket'],
    auth: { isBot: true, token: args.token, displayName },
    // We want transient drops to auto-recover during a 5m run.
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    timeout: 10_000,
  });

  const bot: Bot = {
    idx,
    socket,
    bornAt: Date.now(),
    joined: false,
    inputTimer: null,
    bornPhase,
    txEvents: 0,
    rxEvents: 0,
  };

  socket.on('connect', () => {
    socket.emit(
      'lobby:join',
      { lobbyId: args.lobby, displayName, character: idx % 8 },
      (res: LobbyResult) => {
        if (!res.ok) {
          console.error(`[bot ${idx}] join failed: ${res.error}`);
          socket.disconnect();
          sessionStats.joinErrors++;
          return;
        }
        bot.joined = true;
        sessionStats.joined++;
        startInputLoop(bot, args, sessionStats);
      },
    );
  });

  socket.on('connect_error', (err) => {
    sessionStats.connectErrors++;
    if (sessionStats.connectErrors <= 3) {
      console.error(`[bot ${idx}] connect error: ${err.message}`);
    } else if (sessionStats.connectErrors === 4) {
      console.error(`[bot ${idx}] connect error: ${err.message} (suppressing further)`);
    }
  });

  socket.on('disconnect', (reason) => {
    if (bot.joined) sessionStats.joined = Math.max(0, sessionStats.joined - 1);
    bot.joined = false;
    if (bot.inputTimer) {
      clearInterval(bot.inputTimer);
      bot.inputTimer = null;
    }
    if (!shuttingDown) sessionStats.unexpectedDisconnects++;
    if (!shuttingDown && sessionStats.unexpectedDisconnects <= 3) {
      console.error(`[bot ${idx}] disconnect: ${reason}`);
    }
  });

  // Count one rx per server-to-client event for the local stats line.
  socket.onAny(() => { bot.rxEvents++; sessionStats.rxEvents++; });

  // Subscribe one bot to debug stats — gives us live server load lines in
  // the harness's own stdout. Doing this on every bot would spam.
  if (idx === 0) {
    socket.on('connect', () => socket.emit('debug:subscribe'));
    socket.on('debug:server-stats', (s: ServerDebugStats) => {
      sessionStats.lastServerStats = s;
    });
  }

  return bot;
}

function startInputLoop(bot: Bot, args: Args, sessionStats: SessionStats): void {
  const periodMs = Math.max(1, Math.floor(1000 / args.tickHz));
  bot.inputTimer = setInterval(() => {
    if (!bot.joined) return;
    const t = (Date.now() - bot.bornAt) / 1000;
    const a = ORBIT_OMEGA * t + bot.bornPhase;
    const x = args.radius * Math.cos(a);
    const z = args.radius * Math.sin(a);
    const y = Math.abs(Math.sin(JUMP_OMEGA * t + bot.bornPhase)) * args.jumpHeight;
    // tangent to the circle, facing the direction of travel
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    const state: 'idle' | 'run' | 'air' = y > 0.3 ? 'air' : 'run';
    bot.socket.emit('game:input', { x, y, z, yaw, state });
    bot.txEvents++;
    sessionStats.txEvents++;
  }, periodMs);
}

// ─── session ──────────────────────────────────────────────────────────────

type SessionStats = {
  joined: number;
  joinErrors: number;
  connectErrors: number;
  unexpectedDisconnects: number;
  txEvents: number;
  rxEvents: number;
  lastServerStats: ServerDebugStats | null;
};

let shuttingDown = false;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.token) {
    console.error('error: LOADTEST_TOKEN is empty — pass --token or set in env/.env');
    process.exit(1);
  }
  if (args.count <= 0) {
    console.error('error: --count must be >= 1');
    process.exit(1);
  }

  console.log(
    `[harness] spawning ${args.count} bot(s) → ${args.host} lobby=${args.lobby} ` +
      `ramp=${args.rampMs}ms tick=${args.tickHz}Hz ` +
      `${args.durationMs ? `duration=${args.durationMs}ms` : 'duration=∞'}`,
  );

  const stats: SessionStats = {
    joined: 0,
    joinErrors: 0,
    connectErrors: 0,
    unexpectedDisconnects: 0,
    txEvents: 0,
    rxEvents: 0,
    lastServerStats: null,
  };
  const bots: Bot[] = [];
  const stagger = args.count > 1 ? args.rampMs / args.count : 0;

  for (let i = 0; i < args.count; i++) {
    const delay = i * stagger;
    setTimeout(() => {
      if (shuttingDown) return;
      bots.push(spawnBot(i, args, stats));
    }, delay);
  }

  // Periodic stats line — also acts as a heartbeat that the harness is alive.
  let lastTx = 0;
  let lastRx = 0;
  let lastAt = Date.now();
  const statsTimer = setInterval(() => {
    const now = Date.now();
    const dt = (now - lastAt) / 1000;
    const txRate = (stats.txEvents - lastTx) / dt;
    const rxRate = (stats.rxEvents - lastRx) / dt;
    lastTx = stats.txEvents;
    lastRx = stats.rxEvents;
    lastAt = now;
    const srv = stats.lastServerStats;
    const srvLine = srv
      ? ` | server: players=${srv.totalPlayers} loop_p50=${srv.loopLagP50Ms}ms ` +
        `loop_p99=${srv.loopLagP99Ms}ms tick_bytes=${fmtBytes(srv.lastTickBytes)} rss=${srv.rssMb}MB`
      : '';
    console.log(
      `[t+${Math.floor((now - startedAt) / 1000)}s] joined=${stats.joined}/${args.count} ` +
        `tx=${txRate.toFixed(0)}/s rx=${rxRate.toFixed(0)}/s ` +
        `err: connect=${stats.connectErrors} join=${stats.joinErrors} drop=${stats.unexpectedDisconnects}` +
        srvLine,
    );
  }, args.statsEverySec * 1000);

  const startedAt = Date.now();
  let durationTimer: NodeJS.Timeout | null = null;
  if (args.durationMs > 0) {
    durationTimer = setTimeout(() => {
      console.log('[harness] duration reached, shutting down');
      void shutdown(bots, statsTimer, durationTimer);
    }, args.durationMs);
  }

  const onSignal = (sig: string) => {
    console.log(`[harness] caught ${sig}, shutting down`);
    void shutdown(bots, statsTimer, durationTimer);
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));
}

async function shutdown(
  bots: Bot[],
  statsTimer: NodeJS.Timeout,
  durationTimer: NodeJS.Timeout | null,
): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(statsTimer);
  if (durationTimer) clearTimeout(durationTimer);
  for (const b of bots) {
    if (b.inputTimer) clearInterval(b.inputTimer);
    // Tell the server explicitly before tearing down the socket — gives a
    // clean leaveLobby path instead of a dangling disconnect timeout.
    try {
      b.socket.emit('lobby:leave');
    } catch { /* noop */ }
    b.socket.disconnect();
  }
  // Brief grace period so leave events flush.
  await new Promise((r) => setTimeout(r, 250));
  process.exit(0);
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)}MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)}KB`;
  return `${b}B`;
}

void main();
