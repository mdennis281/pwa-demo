import type { PlayerSnapshot } from '@pwa-demo/shared';

export default function HUD({
  myHeight,
  myMaxHeight,
  players,
  selfId,
  pointerLocked,
}: {
  myHeight: number;
  myMaxHeight: number;
  players: PlayerSnapshot[];
  selfId: string;
  pointerLocked: boolean;
}) {
  const ranking = [...players]
    .filter((p) => p.role === 'player')
    .sort((a, b) => b.maxHeight - a.maxHeight)
    .slice(0, 8);

  return (
    <div className="absolute inset-0 pointer-events-none text-white z-10">
      {/* Top-left: my altitude */}
      <div className="absolute top-4 left-4 pointer-events-auto bg-slate-950/70 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 font-mono text-sm">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">altitude</div>
        <div className="text-2xl font-bold tabular-nums">{myHeight.toFixed(1)}m</div>
        <div className="text-xs text-slate-400 tabular-nums">best: {myMaxHeight.toFixed(1)}m</div>
      </div>

      {/* Top-right: leaderboard */}
      <div className="absolute top-4 right-4 pointer-events-auto bg-slate-950/70 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 text-sm min-w-[200px]">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">leaderboard</div>
        {ranking.length === 0 && <div className="text-slate-500 text-xs">no players yet</div>}
        {ranking.map((p, i) => (
          <div key={p.id} className={`flex justify-between gap-2 ${p.id === selfId ? 'text-brand-400' : 'text-slate-200'}`}>
            <span className="truncate">
              {i + 1}. {p.isHost && '★ '}{p.displayName}
            </span>
            <span className="font-mono tabular-nums">{p.maxHeight.toFixed(1)}m</span>
          </div>
        ))}
      </div>

      {/* Bottom-center: controls hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-300 bg-slate-950/60 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 hidden md:block">
        {pointerLocked ? (
          <>WASD move · SPACE jump · mouse look · ESC release cursor</>
        ) : (
          <>click canvas to capture mouse · WASD / SPACE / mouse</>
        )}
      </div>
    </div>
  );
}
