export type Cheats = {
  fly: boolean;
  infiniteJumps: boolean;
};

export const DEFAULT_CHEATS: Cheats = {
  fly: false,
  infiniteJumps: false,
};

export default function CheatMenu({
  open,
  cheats,
  onChange,
  onClose,
}: {
  open: boolean;
  cheats: Cheats;
  onChange: (next: Cheats) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 backdrop-blur border border-amber-500/40 rounded-lg p-5 min-w-[300px] shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-amber-200 font-semibold text-sm uppercase tracking-wider">cheats</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs"
        >
          close (Ctrl+C)
        </button>
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <Toggle
          label="Fly mode"
          help="W/A/S/D + Space (up) + Shift (down). No collisions."
          checked={cheats.fly}
          onChange={(v) => onChange({ ...cheats, fly: v })}
        />
        <Toggle
          label="Unlimited jumps"
          help="Spam space. Default is double jump."
          checked={cheats.infiniteJumps}
          onChange={(v) => onChange({ ...cheats, infiniteJumps: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  label, help, checked, onChange,
}: {
  label: string; help?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-10 h-5 rounded-full transition relative shrink-0 ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <div className="min-w-0">
        <div className="font-medium text-slate-100">{label}</div>
        {help && <div className="text-xs text-slate-400">{help}</div>}
      </div>
    </label>
  );
}
