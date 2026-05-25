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
// Sticky "user told us they aren't installed" — set when they click
// "show install steps anyway" from the maybe-installed inference. Stops us
// from second-guessing them every page load.
const NOT_INSTALLED_KEY = 'pwa-install-user-says-no';
const NOT_INSTALLED_MS = 24 * 60 * 60 * 1000;
// How long to wait for the browser to fire beforeinstallprompt before
// committing to a fallback phase. Bumped from 1.5s → 3s because Chromium
// occasionally takes 2+ seconds on slower pages, and the cost of waiting
// is just an empty slot — much better than a manual→native flicker.
const GRACE_MS = 3000;

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
  // Authoritative installed-on-this-device signal (getInstalledRelatedApps
  // or our localStorage flag from a prior appinstalled event).
  | 'installed-elsewhere'
  // INFERRED installed: Chromium browser, grace expired, beforeinstallprompt
  // never fired. Chrome suppresses that event for already-installed PWAs, so
  // this is the strongest inverse signal we have when the explicit detection
  // APIs come up empty (which they do for users who installed before our
  // related_applications manifest entry shipped). Surfaces Open as primary,
  // with "show install steps anyway" as the escape hatch for false positives.
  | 'maybe-installed'
  // Grace period elapsed without any install signal — show browser-specific
  // instructions.
  | 'manual';

function readTimestamp(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Chromium browsers fire beforeinstallprompt for installable sites and
 *  suppress it for already-installed ones. That makes "no event fired
 *  within the grace period" a strong (inverse) signal of installed state —
 *  but only on this browser family. Firefox/Safari never fire it at all,
 *  so the same silence means nothing there. */
function isChromiumFamily(family: string): boolean {
  return family === 'chromium-desktop' || family === 'chromium-android' || family === 'edge-desktop';
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
    } else if (readTimestamp(DISMISS_KEY) > Date.now()) {
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

    // Grace expired with no explicit signal. Route based on browser family:
    //   Chromium where user hasn't recently said "I'm not installed":
    //     → maybe-installed (Open is primary, manual is the escape hatch)
    //   Everything else (Firefox, Safari, opted-out Chromium):
    //     → manual (Install steps front and center)
    const graceTimer = window.setTimeout(() => {
      if (phaseRef.current !== 'init') return;
      const userSaidNoUntil = readTimestamp(NOT_INSTALLED_KEY);
      const userRecentlyOptedOut = userSaidNoUntil > Date.now();
      if (isChromiumFamily(ctx.family) && !userRecentlyOptedOut) {
        setPhase('maybe-installed');
      } else {
        setPhase('manual');
      }
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

  function handleUserSaysNotInstalled() {
    // Suppress the maybe-installed inference for 24h so they're not asked
    // again every visit. If they DO install via the manual steps, the
    // appinstalled event sets the authoritative flag and detectInstalled-
    // Elsewhere takes over from there.
    try {
      window.localStorage.setItem(NOT_INSTALLED_KEY, String(Date.now() + NOT_INSTALLED_MS));
    } catch {
      /* same private-mode swallow as dismiss */
    }
    setPhase('manual');
  }

  const isOpenPhase = phase === 'installed-elsewhere' || phase === 'maybe-installed';
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

          {phase === 'maybe-installed' && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Looks like PWA Demo is already installed on this device — your browser
              didn't offer the install prompt, which usually means it's installed.
              <span className="block text-slate-500 mt-1">
                Not installed?{' '}
                <button
                  type="button"
                  onClick={handleUserSaysNotInstalled}
                  className="text-brand-300 hover:text-brand-200 underline underline-offset-2"
                >
                  show install steps anyway
                </button>
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
        {(phase === 'installed-elsewhere' || phase === 'maybe-installed') && (
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
