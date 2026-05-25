import { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectInstallContext,
  detectInstalledElsewhere,
  isInstalled,
  onInstallAvailability,
  onInstalledChange,
  openInstalledApp,
  promptInstall,
  type InstallContext,
} from '../lib/install';

const DISMISS_KEY = 'pwa-install-dismissed-until';
const DISMISS_MS = 24 * 60 * 60 * 1000;
// How long to wait for the browser to fire beforeinstallprompt before
// falling back to manual instructions. Chrome typically fires within a few
// hundred ms of paint; this gives plenty of slack without making the user
// stare at a blank slot.
const GRACE_MS = 1500;

type Phase =
  // Still deciding what to render. NOTHING is shown in this phase, so a
  // late-arriving beforeinstallprompt event doesn't cause a manual→native
  // flicker.
  | 'init'
  // Running INSIDE the installed PWA — render nothing.
  | 'installed'
  // User dismissed within the cooldown window — render nothing.
  | 'dismissed'
  // beforeinstallprompt fired — show the one-click Install button.
  | 'native'
  // PWA is installed elsewhere on this device (browser tab is showing the
  // site) — show "Open" deep-link button instead of "Install".
  | 'installed-elsewhere'
  // Grace period elapsed without an install event — show browser-specific
  // instructions instead.
  | 'manual';

function readDismissedUntil(): number {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Floating CTA that handles the "Install as PWA" first-touch UX.
 *
 *  Three render states (plus two hidden ones):
 *  - native: Chrome/Edge/etc. surfaced beforeinstallprompt → one-click button
 *  - manual: no native prompt available → expandable browser-specific steps
 *  - hidden: already installed, user dismissed within 24h, or still deciding
 *
 *  The "init" phase intentionally renders nothing so a late beforeinstallprompt
 *  doesn't flicker manual→native. ~1.5s grace then settles on manual.
 */
export default function InstallPrompt() {
  const [phase, setPhase] = useState<Phase>('init');
  const [expanded, setExpanded] = useState(false);
  const ctx = useMemo<InstallContext>(detectInstallContext, []);
  // Stable ref so the grace-timer callback always sees the latest phase
  // without resubscribing every render.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    // SSR / non-browser guard — bail before touching window.
    if (typeof window === 'undefined') return;

    let cancelled = false;
    // Phases that should NOT be overridden by later-arriving signals.
    const isTerminal = (p: Phase) => p === 'installed' || p === 'dismissed';

    if (isInstalled()) {
      setPhase('installed');
    } else if (readDismissedUntil() > Date.now()) {
      setPhase('dismissed');
    }

    // Authoritative "installed somewhere on this device" check. If it
    // resolves true we override anything except a hard terminal phase, so
    // the user sees Open rather than Install/manual instructions even if
    // beforeinstallprompt fires first (in practice it shouldn't, but be safe).
    void detectInstalledElsewhere().then((installedHere) => {
      if (cancelled) return;
      if (installedHere && !isTerminal(phaseRef.current)) {
        setPhase('installed-elsewhere');
      }
    });

    // Always wire the subscriptions so we react if state changes (e.g. user
    // installs through a separate browser UI, or pops the page into its own
    // window). The handlers short-circuit when already in a terminal phase.
    const offAvail = onInstallAvailability((available) => {
      if (
        available &&
        !isTerminal(phaseRef.current) &&
        phaseRef.current !== 'installed-elsewhere'
      ) {
        setPhase('native');
      } else if (!available && phaseRef.current === 'native') {
        // Lost the deferred event (after a prompt) — fall back to manual so
        // the user still has a way through.
        setPhase('manual');
      }
    });
    const offInstalled = onInstalledChange((installed) => {
      if (installed) setPhase('installed');
    });

    // If we're still undecided after the grace period, commit to manual.
    const graceTimer = window.setTimeout(() => {
      if (phaseRef.current === 'init') setPhase('manual');
    }, GRACE_MS);

    return () => {
      cancelled = true;
      offAvail();
      offInstalled();
      window.clearTimeout(graceTimer);
    };
  }, []);

  if (phase === 'init' || phase === 'installed' || phase === 'dismissed') return null;

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      // Deferred event was consumed or never existed — switch to manual.
      setPhase('manual');
    }
    // 'accepted' fires onInstalledChange → onInstalled effect → 'installed' phase.
    // 'dismissed' triggers onInstallAvailability(false) → 'manual' phase.
  }

  function handleOpen() {
    openInstalledApp();
    // We don't flip phase here. If the hand-off works, the browser navigates
    // away and this component unmounts. If it doesn't (no protocol handler
    // registered, user denied earlier), we stay put and the fallback hint
    // below stays visible so the user has a path.
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      // localStorage can throw in private mode / quota / disabled cookies;
      // silently swallow — worst case is the prompt comes back next visit.
    }
    setPhase('dismissed');
  }

  const isOpenPhase = phase === 'installed-elsewhere';
  const title = isOpenPhase ? 'PWA Demo is installed' : 'Install PWA Demo';

  return (
    <section
      // aria-live polite so screen readers announce it once it settles in,
      // but only once — not on every re-render.
      aria-live="polite"
      className="bg-gradient-to-r from-brand-600/15 via-slate-900 to-slate-900 border border-brand-500/30 rounded-lg p-4 my-6 relative"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="absolute top-2 right-2 text-slate-500 hover:text-slate-200 w-6 h-6 flex items-center justify-center rounded text-lg leading-none"
      >
        ×
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="text-2xl shrink-0 leading-none mt-0.5" aria-hidden="true">
          {isOpenPhase ? '↗' : '⤓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-brand-100">{title}</div>

          {phase === 'native' && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Runs in its own window, works offline, and gets push notifications. One-click
              install — no app store.
            </p>
          )}

          {phase === 'installed-elsewhere' && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              You've already installed it on this device. Open the app for the full
              standalone experience.
              <span className="block text-slate-500 mt-1">
                If the app doesn't pop open, launch it from your taskbar, dock, or home
                screen.
              </span>
            </p>
          )}

          {phase === 'manual' && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {ctx.unsupported ? (
                <>
                  <span className="text-amber-300">{ctx.label}</span> can't install web apps —
                  open this page in Chrome, Edge, or Brave to install.
                </>
              ) : (
                <>
                  Quick install on <span className="text-slate-200">{ctx.label}</span> —{' '}
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-brand-300 hover:text-brand-200 underline underline-offset-2"
                  >
                    {expanded ? 'hide steps' : 'show steps'}
                  </button>
                </>
              )}
            </p>
          )}

          {phase === 'manual' && (expanded || ctx.unsupported) && (
            <ol className="mt-3 text-xs text-slate-300 list-decimal list-inside space-y-1 marker:text-slate-500">
              {ctx.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>

        {phase === 'native' && (
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-medium text-sm self-center"
          >
            Install
          </button>
        )}
        {phase === 'installed-elsewhere' && (
          <button
            type="button"
            onClick={handleOpen}
            className="shrink-0 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-medium text-sm self-center"
          >
            Open
          </button>
        )}
      </div>
    </section>
  );
}
