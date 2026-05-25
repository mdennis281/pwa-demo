import type { PlayerSnapshot } from '@pwa-demo/shared';

export default function HUD({
  myHeight,
  myMaxHeight,
  players,
  selfId,
  pointerLocked,
  jumpsUsed,
  isPlayer,
  debugOpen,
  onToggleDebug,
  isAdmin,
  onAdminLogin,
}: {
  myHeight: number;
  myMaxHeight: number;
  players: PlayerSnapshot[];
  selfId: string;
  pointerLocked: boolean;
  jumpsUsed: number;
  isPlayer: boolean;
  debugOpen: boolean;
  onToggleDebug: () => void;
  isAdmin: boolean;
  onAdminLogin: () => void;
}) {
  const ranking = [...players]
    .filter((p) => p.role === 'player')
    .sort((a, b) => b.maxHeight - a.maxHeight)
    .slice(0, 8);

  return (
    <div className="absolute inset-0 pointer-events-none text-white z-10">
      {/* Top-left: my altitude + jump indicator. Note `pr-12` reserves room
          for the icon buttons docked in this card's top-right corner. */}
      <div className="absolute top-4 left-4 pointer-events-auto bg-slate-950/70 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 pr-12 font-mono text-sm">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">altitude</div>
        <div className="text-2xl font-bold tabular-nums">{myHeight.toFixed(1)}m</div>
        <div className="text-xs text-slate-400 tabular-nums">best: {myMaxHeight.toFixed(1)}m</div>
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
        {/* corner icons */}
        <div className="absolute top-1 right-1 flex gap-0.5">
          <button
            type="button"
            onClick={onToggleDebug}
            title="Debug panel"
            className={`w-6 h-6 rounded flex items-center justify-center text-[11px] leading-none transition ${
              debugOpen
                ? 'bg-slate-700/90 text-white'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            🐛
          </button>
          <button
            type="button"
            onClick={onAdminLogin}
            title={isAdmin ? 'Admin token (clear to log out)' : 'Admin login'}
            className={`w-6 h-6 rounded flex items-center justify-center text-[11px] leading-none transition ${
              isAdmin
                ? 'text-amber-300 hover:bg-slate-800/70'
                : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800/70'
            }`}
          >
            🔐
          </button>
        </div>
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
          <>WASD · SPACE jump (×2 for double) · hold for higher hop · mouse look · ESC release · <span className="text-amber-300">H wave</span> · <span className="text-pink-300">P party</span></>
        ) : (
          <>click canvas to capture mouse · WASD / SPACE / mouse · H wave · P party</>
        )}
      </div>
    </div>
  );
}
