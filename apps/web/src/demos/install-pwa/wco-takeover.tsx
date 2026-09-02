/**
 * MODAL DEMO — Titlebar takeover.
 *
 * The one demo that reaches outside its own box. Every other demo renders
 * into the modal body and stops there; this one repaints the app's titlebar
 * strip, which lives in the root Layout. That's the entire point: under
 * Window Controls Overlay the titlebar isn't browser chrome any more, it's
 * your page — so any code in the app can own it the way a native app owns
 * its own window decorations.
 *
 * The reach-out goes through lib/wcoTakeover rather than a querySelector
 * into someone else's DOM, so React stays the only thing writing to that
 * subtree. Effects are gated on WCO actually being on (they have nowhere to
 * land otherwise) and held in memory only — reload restores the plain bar.
 */
import { Link } from 'react-router';
import { Btn } from '../_shared/ui';
import { useWcoStatus, type WcoStatus } from '../../lib/wco';
import { resetWcoTakeover, toggleWcoEffect, useWcoTakeover, type WcoEffect } from '../../lib/wcoTakeover';

const EFFECTS: { key: WcoEffect; title: string; detail: string }[] = [
  {
    key: 'controls',
    title: 'App controls',
    detail:
      'Drops the app title and puts a live alert bell + settings gear up there. Both open real menus that hang down over the page.',
  },
  {
    key: 'rainbow',
    title: 'Rainbow header',
    detail: 'Sweeps a seamless hue gradient across the strip, under a scrim that keeps the chrome readable.',
  },
  {
    key: 'duck',
    title: 'Duck',
    detail: 'Waddles a duck across the titlebar, behind the logo. Because nothing is stopping you.',
  },
];

export default function WcoTakeoverDemo() {
  const status = useWcoStatus();
  const takeover = useWcoTakeover();
  const active = status === 'active';
  const anyOn = takeover.controls || takeover.rainbow || takeover.duck;

  return (
    <div className="space-y-4">
      <Gate status={status} />

      <div className="space-y-2">
        {EFFECTS.map((e, i) => (
          <EffectButton
            key={e.key}
            index={i + 1}
            title={e.title}
            detail={e.detail}
            on={takeover[e.key]}
            disabled={!active}
            onClick={() => toggleWcoEffect(e.key)}
          />
        ))}
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-slate-800 pt-3">
        <p className="text-[11px] leading-snug text-slate-500">
          Effects stack, and they outlive this modal — close it and the strip stays yours until you
          restore it, turn the overlay off, or reload.
        </p>
        <Btn variant="ghost" disabled={!anyOn} onClick={resetWcoTakeover}>
          Restore
        </Btn>
      </div>
    </div>
  );
}

/**
 * The check. Everything below it is inert without a titlebar to paint into,
 * so say plainly which of the two ways it can be missing you've hit.
 */
function Gate({ status }: { status: WcoStatus }) {
  if (status === 'active') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-200">
        <span aria-hidden="true">✓</span>
        <span>
          Window Controls Overlay is on — the strip along the top of this window is the app's, not the
          browser's. Take it.
        </span>
      </div>
    );
  }

  if (status === 'inactive') {
    return (
      <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
        <p className="font-semibold">The overlay is available, but it isn't on.</p>
        <p className="text-slate-300">
          You're in an installed window and the API is here, so the one missing step is the runtime
          toggle: click the <strong className="text-amber-200">⌃ "Hide title bar"</strong> button in this
          window's titlebar. Nothing in the manifest can flip it for you — only the user can. This panel
          unlocks the moment you do, no reload.
        </p>
        <p>
          <Link to="/d/wco" className="underline hover:text-amber-100">
            Overlay inspector →
          </Link>
        </p>
      </div>
    );
  }

  if (status === 'tab') {
    return (
      <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
        <p className="font-semibold">This is a browser tab — there's no titlebar to take.</p>
        <p className="text-slate-300">
          The API is exposed here, but Chromium exposes it in ordinary tabs too; it only means anything
          inside an installed window. Install the app, launch it from your OS app launcher, then hit the{' '}
          <strong className="text-amber-200">⌃ "Hide title bar"</strong> button in its titlebar.
        </p>
        <p className="flex gap-3">
          <Link to="/d/manifest" className="underline hover:text-amber-100">
            Install the app →
          </Link>
          <Link to="/d/wco" className="underline hover:text-amber-100">
            Overlay inspector →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
      <p className="font-semibold">No Window Controls Overlay here.</p>
      <p className="text-slate-300">
        <code className="rounded bg-slate-950 px-1 py-0.5">navigator.windowControlsOverlay</code> isn't
        exposed. It's desktop-only, Chromium 105+, and only inside an installed PWA window — a browser
        tab never gets one.
      </p>
      <p>
        <Link to="/d/wco" className="underline hover:text-rose-100">
          Overlay inspector →
        </Link>
      </p>
    </div>
  );
}

function EffectButton({
  index,
  title,
  detail,
  on,
  disabled,
  onClick,
}: {
  index: number;
  title: string;
  detail: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? 'border-brand-500/50 bg-brand-500/10'
          : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-800/40'
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
          on ? 'bg-brand-500 text-slate-950' : 'bg-slate-800 text-slate-400'
        }`}
      >
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100">{title}</span>
        <span className="block text-xs leading-snug text-slate-500">{detail}</span>
      </span>
      <span
        className={`mt-1 shrink-0 font-mono text-[10px] uppercase tracking-wider ${
          on ? 'text-brand-300' : 'text-slate-600'
        }`}
      >
        {on ? 'on' : 'off'}
      </span>
    </button>
  );
}
