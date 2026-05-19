import { useEffect, useRef, useState } from 'react';
import type { PlayerSnapshot, ServerDebugStats } from '@pwa-demo/shared';
import { getSocket, socketMetrics } from '../lib/socket';

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
  players,
  selfId,
  myPing,
  snapshotCount,
}: {
  players: PlayerSnapshot[];
  selfId: string;
  myPing: number | null;
  snapshotCount: number;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <>
      {/* Bug button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Debug panel"
        className={`absolute bottom-16 right-4 z-40 w-8 h-8 rounded-lg flex items-center justify-center text-base transition ${
          open
            ? 'bg-slate-700/90 text-white border border-slate-500/60'
            : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }`}
      >
        🐛
      </button>

      {open && (
        <div className="absolute bottom-28 right-4 z-40 bg-slate-950/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl w-72 p-4 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider">debug</span>
            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 leading-none">×</button>
          </div>

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
      )}
    </>
  );
}

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
