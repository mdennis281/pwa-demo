import { useEffect, useState } from 'react';
import { pwaEnv, envLogoFilter } from '../lib/env';

/**
 * App-drawn titlebar for Window Controls Overlay.
 *
 * Under WCO the browser hands the whole top strip to the page and only keeps
 * the window buttons, which means the usual "drag the titlebar to move the
 * window" gesture is gone — the page paints there instead. This component
 * gives it back: a fixed strip covering the free part of the titlebar area
 * (`.wco-titlebar` in styles.css) marked `app-region: drag`.
 *
 * It renders nothing outside WCO, so mobile/browser/standalone are untouched.
 * Layout reserves the space via `--wco-h`, which is 0px everywhere else.
 */
export default function WcoTitlebar() {
  const [active, setActive] = useState(isWco);

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: window-controls-overlay)');
    const sync = () => setActive(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  if (!active) return null;

  return (
    <div
      className="wco-titlebar z-40 flex items-center gap-2 bg-slate-900 border-b border-slate-800 px-3 text-slate-400"
      // The strip is decoration + a window handle; the same branding is already
      // in the sidebar, so keep it out of the accessibility tree.
      aria-hidden="true"
    >
      <img src="/logo.svg" alt="" className="w-4 h-4 shrink-0" style={{ filter: envLogoFilter }} />
      <span className="text-xs font-medium truncate">{pwaEnv.name}</span>
    </div>
  );
}

function isWco(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: window-controls-overlay)').matches
  );
}
