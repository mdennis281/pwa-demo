import { DraggablePanel } from './DraggablePanel';

/** The ⚙ launcher. A draggable panel with the graphics toggles (shadows) and
 *  entries that open the diagnostic overlays (render / network perf), each of
 *  which is its own independently-draggable panel. */
export function SettingsMenu({
  open,
  onClose,
  shadowsOn,
  onToggleShadows,
  onOpenPerf,
  onOpenNetwork,
}: {
  open: boolean;
  onClose: () => void;
  shadowsOn: boolean;
  onToggleShadows: (on: boolean) => void;
  onOpenPerf: () => void;
  onOpenNetwork: () => void;
}) {
  if (!open) return null;
  return (
    <DraggablePanel
      title="Settings"
      icon="⚙"
      titleColor="text-amber-300"
      accent="border-amber-500/40"
      onClose={onClose}
      defaultPos={{ x: 16, y: 80 }}
    >
      <p className="text-slate-500 text-[9px] uppercase tracking-wider">graphics</p>
      <button
        type="button"
        onClick={() => onToggleShadows(!shadowsOn)}
        className="w-full flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-800/70 cursor-pointer"
      >
        <span className="text-slate-300">Shadows</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${shadowsOn ? 'bg-emerald-600/80 text-white' : 'bg-slate-700 text-slate-300'}`}>
          {shadowsOn ? 'ON' : 'OFF'}
        </span>
      </button>
      <p className="text-[9px] text-slate-500 px-2 -mt-1 leading-tight">
        Auto-off on software GPUs. Biggest GPU-stall reducer — turn off if the game freezes.
      </p>

      <div className="border-t border-slate-800 my-1.5" />

      <p className="text-slate-500 text-[9px] uppercase tracking-wider">diagnostics</p>
      <button
        type="button"
        onClick={onOpenPerf}
        className="w-full text-left rounded px-2 py-1.5 hover:bg-slate-800/70 text-sky-300 cursor-pointer"
      >
        📊 Render performance
      </button>
      <button
        type="button"
        onClick={onOpenNetwork}
        className="w-full text-left rounded px-2 py-1.5 hover:bg-slate-800/70 text-sky-300 cursor-pointer"
      >
        📡 Network performance
      </button>
    </DraggablePanel>
  );
}
