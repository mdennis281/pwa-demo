import type { PlayerSnapshot } from '@pwa-demo/shared';
import type { Zone } from './worldgen';

export default function HUD({
  myHeight,
  myMaxHeight,
  players,
  selfId,
  pointerLocked,
  jumpsUsed,
  isPlayer,
  zones,
  summitY,
  flying,
  flightUnlocked,
}: {
  myHeight: number;
  myMaxHeight: number;
  players: PlayerSnapshot[];
  selfId: string;
  pointerLocked: boolean;
  jumpsUsed: number;
  isPlayer: boolean;
  zones: Zone[];
  summitY: number;
  flying: boolean;
  flightUnlocked: boolean;
}) {
  const ranking = [...players]
    .filter((p) => p.role === 'player')
    .sort((a, b) => b.maxHeight - a.maxHeight)
    .slice(0, 8);

  // Current named zone + progress toward the summit.
  let zone: Zone | undefined;
  for (const z of zones) if (myHeight >= z.minY) zone = z;
  const progress = summitY > 0 ? Math.max(0, Math.min(1, myHeight / summitY)) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none text-white z-10">
      {/* Top-left: my altitude + jump indicator. Note `pr-12` reserves room
          for the icon buttons docked in this card's top-right corner. */}
      <div className="absolute top-4 left-4 pointer-events-auto bg-slate-950/70 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 font-mono text-sm">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">altitude</div>
        <div className="text-2xl font-bold tabular-nums">{myHeight.toFixed(1)}m</div>
        <div className="text-xs text-slate-400 tabular-nums">best: {myMaxHeight.toFixed(1)}m</div>
        {isPlayer && zone && (
          <div className="mt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: zone.tint }} />
              <span className="text-[11px] font-medium text-slate-200">{zone.name}</span>
            </div>
            <div className="mt-1 h-1.5 w-36 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(progress * 100).toFixed(0)}%`, backgroundColor: zone.tint }} />
            </div>
          </div>
        )}
        {isPlayer && flightUnlocked && (
          <div className={`mt-1.5 text-[11px] font-semibold ${flying ? 'text-amber-300' : 'text-amber-400/70'}`}>
            ✈ {flying ? 'flying — F to land' : 'flight unlocked — press F'}
          </div>
        )}
        {isPlayer && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">jumps</span>
            {[0, 1].map((i) => {
              const available = i >= jumpsUsed;
              return (
                <span
                  key={i}
                  className={`inline-block w-2.5 h-2.5 rounded-full transition ${
                    available
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]'
                      : 'bg-slate-700'
                  }`}
                />
              );
            })}
          </div>
        )}
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
          <>WASD · SPACE jump (×2 double) · hold W on ladders · reach the summit beacon · <span className="text-amber-300">H wave</span> · <span className="text-pink-300">P party</span></>
        ) : (
          <>click canvas to capture mouse · WASD / SPACE / mouse · climb to the summit · H wave · P party</>
        )}
      </div>
    </div>
  );
}
