import { useEffect, useState } from 'react';
import { applyUpdate, usePwa } from '../lib/pwa';

/**
 * Bottom-of-screen toasts for the service-worker lifecycle:
 *   • a new version is waiting  → "Updating to vX…" with a short countdown,
 *     then auto-applies (skip-waiting + reload). A "Reload now" button skips
 *     the wait; this is the "just push the update" behaviour.
 *   • everything cached offline → a brief one-time "Ready to work offline".
 *
 * Mounted once, in Layout. Reads the shared store in lib/pwa.ts.
 */

// Seconds the update toast lingers before auto-reloading. Long enough to be
// noticed and to hit "Reload now", short enough to feel like an auto-update.
const AUTO_APPLY_SECONDS = 3;

export default function PwaUpdater() {
  const { needRefresh, updating, offlineReady, version } = usePwa();
  const shortVersion = `v${version}`;

  const [countdown, setCountdown] = useState(AUTO_APPLY_SECONDS);
  const [offlineToast, setOfflineToast] = useState(false);

  // Arm the auto-apply countdown the moment an update is waiting.
  useEffect(() => {
    if (!needRefresh || updating) return;
    setCountdown(AUTO_APPLY_SECONDS);
    const apply = window.setTimeout(applyUpdate, AUTO_APPLY_SECONDS * 1000);
    const tick = window.setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => {
      window.clearTimeout(apply);
      window.clearInterval(tick);
    };
  }, [needRefresh, updating]);

  // Show the "offline ready" confirmation once, then fade it out.
  useEffect(() => {
    if (!offlineReady) return;
    setOfflineToast(true);
    const id = window.setTimeout(() => setOfflineToast(false), 4000);
    return () => window.clearTimeout(id);
  }, [offlineReady]);

  const showUpdate = needRefresh || updating;
  if (!showUpdate && !offlineToast) return null;

  return (
    <div className="fixed z-50 bottom-[max(env(safe-area-inset-bottom),1rem)] right-[max(env(safe-area-inset-right),1rem)] left-[max(env(safe-area-inset-left),1rem)] sm:left-auto flex flex-col items-stretch sm:items-end gap-2">
      {showUpdate && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-500/40 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/40 sm:max-w-sm">
          <span
            className="inline-block w-4 h-4 shrink-0 rounded-full border-2 border-brand-400 border-t-transparent animate-spin"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-100">
              Updating to {shortVersion}
            </div>
            <div className="text-xs text-slate-400">
              {updating
                ? 'reloading…'
                : `reloading in ${countdown}s`}
            </div>
          </div>
          {!updating && (
            <button
              type="button"
              onClick={applyUpdate}
              className="shrink-0 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 text-sm font-medium"
            >
              Reload now
            </button>
          )}
        </div>
      )}

      {offlineToast && !showUpdate && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/40 sm:max-w-sm">
          <span className="text-emerald-400" aria-hidden>✓</span>
          <div className="text-sm text-slate-100">Ready to work offline</div>
        </div>
      )}
    </div>
  );
}
