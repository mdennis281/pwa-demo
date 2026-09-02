import { useEffect, useState } from 'react';

/**
 * Window Controls Overlay detection, shared by everything that paints into
 * the titlebar strip (components/WcoTitlebar, demos/install-pwa/wco-takeover).
 *
 * `active` keys off the display-mode media query rather than
 * `navigator.windowControlsOverlay.visible` on purpose: the `env(titlebar-area-*)`
 * variables the strip is positioned with follow the media query, so anything
 * reading them has to agree with it.
 *
 * The richer live geometry readout (rect, geometrychange counter, why-isn't-it-on
 * diagnostics) lives in demos/install-pwa/wco.tsx — this is just the yes/no.
 */

type WCO = {
  visible: boolean;
  addEventListener: (t: string, h: () => void) => void;
  removeEventListener: (t: string, h: () => void) => void;
};

/**
 *   unsupported — no WCO API at all (mobile, Firefox/Safari, older Chromium)
 *   tab         — API is present but this is a browser tab, so there's no
 *                 titlebar to claim; the app has to be installed first
 *   inactive    — installed window, but the strip still belongs to the OS
 *   active      — the app is painting into the titlebar right now
 *
 * `tab` and `inactive` need telling apart because Chromium exposes
 * `navigator.windowControlsOverlay` in ordinary desktop tabs too — the API
 * being present says nothing about whether you're installed.
 */
export type WcoStatus = 'unsupported' | 'tab' | 'inactive' | 'active';

/** Display modes that mean "running as an installed app window". */
const INSTALLED_MODES = ['standalone', 'minimal-ui', 'fullscreen'] as const;

function wcoApi(): WCO | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { windowControlsOverlay?: WCO }).windowControlsOverlay ?? null;
}

export function wcoStatus(): WcoStatus {
  if (typeof window === 'undefined' || !window.matchMedia) return 'unsupported';
  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return 'active';
  if (!wcoApi()) return 'unsupported';
  const installed = INSTALLED_MODES.some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  return installed ? 'inactive' : 'tab';
}

/** Live `wcoStatus()` — re-renders when the user hits "Hide title bar". */
export function useWcoStatus(): WcoStatus {
  const [status, setStatus] = useState(wcoStatus);

  useEffect(() => {
    const sync = () => setStatus(wcoStatus());
    sync();
    // Watch every mode we distinguish, not just WCO: toggling the overlay
    // flips standalone too, and OS fullscreen hides the strip outright.
    const watched = ['window-controls-overlay', ...INSTALLED_MODES].map((m) => {
      const mql = window.matchMedia(`(display-mode: ${m})`);
      mql.addEventListener('change', sync);
      return mql;
    });
    // geometrychange covers the overlay collapsing (e.g. window dragged too
    // narrow for the OS to draw controls) without the display mode flipping.
    const api = wcoApi();
    api?.addEventListener('geometrychange', sync);
    return () => {
      watched.forEach((mql) => mql.removeEventListener('change', sync));
      api?.removeEventListener('geometrychange', sync);
    };
  }, []);

  return status;
}

/** Convenience wrapper for the common "am I in the titlebar?" check. */
export function useWcoActive(): boolean {
  return useWcoStatus() === 'active';
}
