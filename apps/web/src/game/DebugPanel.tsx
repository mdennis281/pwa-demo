import { useEffect, useRef, useState } from 'react';
import type { PlayerSnapshot, ServerDebugStats } from '@pwa-demo/shared';
import { getSocket, socketMetrics } from '../lib/socket';

type ClientMetrics = {
  rxEvPerSec: number;
  rxBytesPerSec: number;
  txEvPerSec: number;
  txBytesPerSec: number;
  rxBytesTotal: number;
  txBytesTotal: number;
  snapshotCount: number;
  snapshotRate: number; // per second, rolling
  myPing: number | null;
};

export default function DebugPanel({
  open,
  onClose,
  onOpenPerf,
  players,
  selfId,
  myPing,
  snapshotCount,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPerf: () => void;
  players: PlayerSnapshot[];
  selfId: string;
  myPing: number | null;
  snapshotCount: number;
}) {
  const [serverStats, setServerStats] = useState<ServerDebugStats | null>(null);
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics>({
    rxEvPerSec: 0, rxBytesPerSec: 0, txEvPerSec: 0, txBytesPerSec: 0,
    rxBytesTotal: 0, txBytesTotal: 0, snapshotCount: 0, snapshotRate: 0, myPing: null,
  });

  // Previous sample for delta-based per-second rates.
  const prevRef = useRef({
    rxEvents: socketMetrics.rxEvents, rxBytes: socketMetrics.rxBytesEst,
    txEvents: socketMetrics.txEvents, txBytes: socketMetrics.txBytesEst,
    snap: snapshotCount, at: Date.now(),
  });

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

  // Compute per-second rates from deltas every second.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const p = prevRef.current;
      const dt = Math.max(0.001, (now - p.at) / 1000);
      const m = {
        rxEvPerSec: (socketMetrics.rxEvents - p.rxEvents) / dt,
        rxBytesPerSec: (socketMetrics.rxBytesEst - p.rxBytes) / dt,
        txEvPerSec: (socketMetrics.txEvents - p.txEvents) / dt,
        txBytesPerSec: (socketMetrics.txBytesEst - p.txBytes) / dt,
        rxBytesTotal: socketMetrics.rxBytesEst,
        txBytesTotal: socketMetrics.txBytesEst,
        snapshotCount,
        snapshotRate: (snapshotCount - p.snap) / dt,
        myPing,
      };
      setClientMetrics(m);
      prevRef.current = {
        rxEvents: socketMetrics.rxEvents, rxBytes: socketMetrics.rxBytesEst,
        txEvents: socketMetrics.txEvents, txBytes: socketMetrics.txBytesEst,
        snap: snapshotCount, at: now,
      };
    }, 1000);
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

      <button
        onClick={onOpenPerf}
        className="w-full bg-sky-600/80 hover:bg-sky-500 text-white rounded px-2 py-1.5 text-[11px] font-semibold"
      >
        📊 Render performance
      </button>

      {/* client metrics */}
      <section className="space-y-1">
        <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">client</p>
        <Row label="ping" value={myPing !== null ? `${myPing}ms` : '—'} highlight={pingColor(myPing)} />
        <Row label="↓ rx" value={`${fmtBytesRate(clientMetrics.rxBytesPerSec)} · ${clientMetrics.rxEvPerSec.toFixed(0)}/s`} />
        <Row label="↑ tx" value={`${fmtBytesRate(clientMetrics.txBytesPerSec)} · ${clientMetrics.txEvPerSec.toFixed(0)}/s`} />
        <Row label="rx total" value={fmtBytes(clientMetrics.rxBytesTotal)} highlight="text-slate-400" />
        <Row label="tx total" value={fmtBytes(clientMetrics.txBytesTotal)} highlight="text-slate-400" />
        <Row label="snapshots" value={`${clientMetrics.snapshotRate.toFixed(1)}/s (${clientMetrics.snapshotCount})`} />
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
          <Row label="↑ broadcast" value={fmtBytesRate(serverStats.lastTickBytes * serverStats.tickHz)} highlight={tickBytesColor(serverStats.lastTickBytes)} />
          <Row label="last tick bytes" value={fmtBytes(serverStats.lastTickBytes)} highlight="text-slate-400" />
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

function fmtBytesRate(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB/s`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB/s`;
  return `${Math.round(b)} B/s`;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
