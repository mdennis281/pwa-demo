import { useEffect, useRef, useState } from 'react';
import type { PlayerSnapshot, ServerDebugStats } from '@pwa-demo/shared';
import { elevateAdmin, getSocket, logoutAdmin, socketMetrics } from '../lib/socket';

type ClientMetrics = {
  rxEvents: number;
  rxBytesEst: number;
  txEvents: number;
  txBytesEst: number;
  snapshotCount: number;
  snapshotRate: number; // per second, rolling
  myPing: number | null;
};

export default function DebugPanel({
  open,
  onClose,
  players,
  selfId,
  myPing,
  snapshotCount,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  players: PlayerSnapshot[];
  selfId: string;
  myPing: number | null;
  snapshotCount: number;
  isAdmin: boolean;
}) {
  const [serverStats, setServerStats] = useState<ServerDebugStats | null>(null);
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics>({
    rxEvents: 0,
    rxBytesEst: 0,
    txEvents: 0,
    txBytesEst: 0,
    snapshotCount: 0,
    snapshotRate: 0,
    myPing: null,
  });

  const prevSnapRef = useRef({ count: snapshotCount, at: Date.now() });
  const snapshotRateRef = useRef(0);

  // Subscribe to debug stats when open
  useEffect(() => {
    const s = getSocket();
    s.emit('debug:subscribe');
    const onStats = (stats: ServerDebugStats) => setServerStats(stats);
    s.on('debug:server-stats', onStats);
    return () => {
      s.emit('debug:unsubscribe');
      s.off('debug:server-stats', onStats);
    };
  }, []);

  // Rolling snapshot rate + refresh client metrics every 500ms
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - prevSnapRef.current.at) / 1000;
      const delta = snapshotCount - prevSnapRef.current.count;
      snapshotRateRef.current = elapsed > 0 ? delta / elapsed : 0;
      prevSnapRef.current = { count: snapshotCount, at: now };

      setClientMetrics({
        rxEvents: socketMetrics.rxEvents,
        rxBytesEst: socketMetrics.rxBytesEst,
        txEvents: socketMetrics.txEvents,
        txBytesEst: socketMetrics.txBytesEst,
        snapshotCount,
        snapshotRate: snapshotRateRef.current,
        myPing,
      });
    }, 500);
    return () => clearInterval(id);
  }, [snapshotCount, myPing]);

  if (!open) return null;

  return (
    /* max-h + overflow-y-auto so the panel can never run off-screen as
       lobbies fill up or new stat rows get added. left-4 / top-32 places
       it just below the altitude card. */
    <div className="absolute top-32 left-4 z-40 bg-slate-950/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl w-72 p-4 space-y-4 text-xs font-mono pointer-events-auto max-h-[calc(100vh-9rem)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-[10px] uppercase tracking-wider">debug</span>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 leading-none">×</button>
      </div>

      <AdminElevationSection isAdmin={isAdmin} />

      {/* client metrics */}
      <section className="space-y-1">
        <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">client</p>
        <Row label="ping" value={myPing !== null ? `${myPing}ms` : '—'} highlight={pingColor(myPing)} />
        <Row label="rx events" value={fmtN(clientMetrics.rxEvents)} />
        <Row label="rx bytes (est)" value={fmtBytes(clientMetrics.rxBytesEst)} />
        <Row label="tx events" value={fmtN(clientMetrics.txEvents)} />
        <Row label="tx bytes (est)" value={fmtBytes(clientMetrics.txBytesEst)} />
        <Row label="snapshots recv" value={String(clientMetrics.snapshotCount)} />
        <Row label="snapshot rate" value={`${clientMetrics.snapshotRate.toFixed(1)}/s`} />
      </section>

      {/* server metrics */}
      {serverStats && (
        <section className="space-y-1">
          <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">server</p>
          <Row label="uptime" value={fmtUptime(serverStats.uptimeMs)} />
          <Row label="lobbies" value={String(serverStats.totalLobbies)} />
          <Row label="players" value={String(serverStats.totalPlayers)} />
          <Row label="tick hz" value={String(serverStats.tickHz)} />
          <Row label="rx events" value={fmtN(serverStats.rxEvents)} />
          <Row label="rx bytes (est)" value={fmtBytes(serverStats.rxBytesEst)} />
          <Row label="tx events" value={fmtN(serverStats.txEvents)} />
          <Row label="tx bytes (est)" value={fmtBytes(serverStats.txBytesEst)} />
          <Row label="last tick bytes" value={fmtBytes(serverStats.lastTickBytes)} highlight={tickBytesColor(serverStats.lastTickBytes)} />
          <Row label="loop lag p50" value={`${serverStats.loopLagP50Ms.toFixed(1)}ms`} highlight={lagColor(serverStats.loopLagP50Ms)} />
          <Row label="loop lag p99" value={`${serverStats.loopLagP99Ms.toFixed(1)}ms`} highlight={lagColor(serverStats.loopLagP99Ms)} />
          <Row label="rss" value={`${serverStats.rssMb.toFixed(0)} MB`} />
        </section>
      )}

      {/* player list */}
      {players.length > 0 && (
        <section className="space-y-1">
          <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">players in lobby</p>
          {players.map((p) => (
            <div key={p.id} className="flex justify-between items-center">
              <span className={p.id === selfId ? 'text-brand-400 truncate max-w-[120px]' : 'text-slate-300 truncate max-w-[120px]'}>
                {p.isHost ? '★ ' : ''}{p.displayName}
              </span>
              <span className={`shrink-0 ${pingColor(p.ping)}`}>
                {p.ping !== null ? `${p.ping}ms` : '—'}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ─── admin elevation ──────────────────────────────────────────────────────

type ElevateState = 'idle' | 'submitting' | 'ok' | 'err';

function AdminElevationSection({ isAdmin }: { isAdmin: boolean }) {
  const [token, setToken] = useState('');
  const [state, setState] = useState<ElevateState>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  // When isAdmin flips externally (auth:status from another tab, or after
  // successful elevate), clear the input + transient state.
  useEffect(() => {
    if (isAdmin) {
      setToken('');
      if (state === 'submitting') setState('ok');
    }
  }, [isAdmin, state]);

  async function handleElevate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setState('submitting');
    setMsg(null);
    const res = await elevateAdmin(trimmed);
    if (res.ok) {
      setState('ok');
      setMsg('elevated');
      setToken('');
    } else {
      setState('err');
      setMsg(res.error);
    }
  }

  async function handleLogout() {
    setState('submitting');
    setMsg(null);
    await logoutAdmin();
    // isAdmin will flip to false via auth:status; clear local state too.
    setState('idle');
    setMsg('logged out');
  }

  return (
    <section className="space-y-2">
      <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">admin elevation</p>
      {isAdmin ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-emerald-300 text-[11px]">★ admin (this session)</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={state === 'submitting'}
            className="text-rose-400 hover:text-rose-300 disabled:opacity-50 text-[10px] px-2 py-0.5 rounded border border-rose-500/30 hover:border-rose-400/50 transition"
          >
            log out
          </button>
        </div>
      ) : (
        <form onSubmit={handleElevate} className="flex flex-col gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); if (state === 'err') setState('idle'); }}
            placeholder="ADMIN_TOKEN"
            autoComplete="off"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!token.trim() || state === 'submitting'}
            className="bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] px-2 py-1 rounded transition"
          >
            {state === 'submitting' ? 'verifying…' : 'elevate'}
          </button>
        </form>
      )}
      {msg && (
        <p className={`text-[10px] ${state === 'err' ? 'text-rose-400' : 'text-emerald-400'}`}>
          {msg}
        </p>
      )}
    </section>
  );
}

// ─── shared bits ──────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ?? 'text-slate-200'}>{value}</span>
    </div>
  );
}

function pingColor(ping: number | null | undefined): string {
  if (ping == null) return 'text-slate-500';
  if (ping < 80) return 'text-emerald-400';
  if (ping < 150) return 'text-amber-400';
  return 'text-rose-400';
}

function lagColor(ms: number): string {
  if (ms < 5) return 'text-emerald-400';
  if (ms < 20) return 'text-amber-400';
  return 'text-rose-400';
}

function tickBytesColor(b: number): string {
  if (b < 100_000) return 'text-emerald-400';
  if (b < 500_000) return 'text-amber-400';
  return 'text-rose-400';
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
