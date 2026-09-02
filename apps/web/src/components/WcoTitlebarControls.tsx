import { useEffect, useRef, useState } from 'react';
import {
  dismissWcoAlert,
  markWcoAlertsRead,
  resetWcoTakeover,
  toggleWcoEffect,
  useWcoTakeover,
  type WcoAlert,
  type WcoAlertTone,
} from '../lib/wcoTakeover';

/**
 * The alert bell + settings gear that replace the app title under the
 * titlebar-takeover demo (demos/install-pwa/wco-takeover, button 1).
 *
 * Both open popovers that hang *below* the titlebar strip, over the page —
 * the thing that makes WCO read as native rather than decorative. Because the
 * strip is a drag region, every interactive part in here has to opt back out
 * via `.wco-no-drag` / `.wco-popover` (see styles.css), or Chromium swallows
 * the click and moves the window instead.
 */
export default function WcoTitlebarControls() {
  const { alerts, unread, rainbow, duck } = useWcoTakeover();
  const [open, setOpen] = useState<'alerts' | 'settings' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape, same as any menu. Pointerdown rather
  // than click so starting a window drag closes it too.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleAlerts() {
    setOpen((o) => (o === 'alerts' ? null : 'alerts'));
    markWcoAlertsRead();
  }

  return (
    <div ref={rootRef} className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={toggleAlerts}
        aria-expanded={open === 'alerts'}
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
        className="wco-no-drag relative grid h-6 w-6 place-items-center rounded hover:bg-white/10"
      >
        <BellIcon ringing={unread > 0} />
        {unread > 0 && (
          <span className="wco-badge pointer-events-none absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none tabular-nums text-white">
            {unread}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => (o === 'settings' ? null : 'settings'))}
        aria-expanded={open === 'settings'}
        aria-label="Titlebar settings"
        className="wco-no-drag grid h-6 w-6 place-items-center rounded hover:bg-white/10"
      >
        <GearIcon />
      </button>

      {open === 'alerts' && <AlertsPopover alerts={alerts} />}
      {open === 'settings' && <SettingsPopover rainbow={rainbow} duck={duck} />}
    </div>
  );
}

// ─── popovers ─────────────────────────────────────────────────────────────

function AlertsPopover({ alerts }: { alerts: WcoAlert[] }) {
  return (
    <div className="wco-popover w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Alerts</span>
        <span className="text-[10px] text-slate-500">{alerts.length} active</span>
      </div>
      {alerts.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-slate-500">All clear.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="group flex items-start gap-2 border-b border-slate-800 px-3 py-2 last:border-b-0"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[a.tone]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-100">{a.title}</span>
                <span className="block truncate text-[11px] text-slate-500">{a.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => dismissWcoAlert(a.id)}
                aria-label={`Dismiss ${a.title}`}
                className="shrink-0 rounded px-1 text-xs text-slate-600 opacity-0 transition hover:text-slate-200 focus-visible:opacity-100 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TONE_DOT: Record<WcoAlertTone, string> = {
  info: 'bg-sky-400',
  warn: 'bg-amber-400',
  ok: 'bg-emerald-400',
};

/**
 * The gear menu drives the very strip it is drawn in — the shortest proof
 * available that this is ordinary app UI, not browser chrome.
 */
function SettingsPopover({ rainbow, duck }: { rainbow: boolean; duck: boolean }) {
  return (
    <div className="wco-popover w-56 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl">
      <div className="border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Titlebar
      </div>
      <div className="p-1">
        <Switch label="Rainbow" on={rainbow} onClick={() => toggleWcoEffect('rainbow')} />
        <Switch label="Duck" on={duck} onClick={() => toggleWcoEffect('duck')} />
      </div>
      <div className="border-t border-slate-800 p-1">
        <button
          type="button"
          onClick={resetWcoTakeover}
          className="w-full rounded px-2 py-1.5 text-left text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          Restore default titlebar
        </button>
      </div>
    </div>
  );
}

function Switch({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left transition hover:bg-slate-800"
    >
      <span className="text-xs text-slate-200">{label}</span>
      <span
        className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition ${
          on ? 'bg-brand-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-slate-950 transition-transform ${
            on ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

// ─── icons ────────────────────────────────────────────────────────────────

function BellIcon({ ringing }: { ringing: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 ${ringing ? 'wco-bell' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2a4 4 0 0 0-4 4c0 3-1 4-1 4h10s-1-1-1-4a4 4 0 0 0-4-4Z" />
      <path d="M6.6 12.5a1.6 1.6 0 0 0 2.8 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4" />
    </svg>
  );
}
