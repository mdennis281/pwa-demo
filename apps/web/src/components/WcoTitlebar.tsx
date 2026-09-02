import { useEffect } from 'react';
import { pwaEnv, envLogoFilter } from '../lib/env';
import { useWcoActive } from '../lib/wco';
import { resetWcoTakeover, useWcoTakeover } from '../lib/wcoTakeover';
import WcoTitlebarControls from './WcoTitlebarControls';

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
 *
 * The default is logo + app name. The titlebar-takeover demo
 * (demos/install-pwa/wco-takeover) can swap that for app controls, a rainbow
 * background, or a duck, via the store in lib/wcoTakeover.
 */
export default function WcoTitlebar() {
  const active = useWcoActive();
  const { controls, rainbow, duck } = useWcoTakeover();

  // Handing the strip back to the OS has to hand the takeover back with it,
  // or the demo's switches end up claiming effects that aren't on screen.
  useEffect(() => {
    if (!active) resetWcoTakeover();
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={`wco-titlebar z-[60] flex items-center gap-2 border-b px-3 ${
        rainbow ? 'wco-rainbow border-white/20' : 'border-slate-800 bg-slate-900 text-slate-400'
      }`}
      // Normally the strip is decoration + a window handle, and the same
      // branding is already in the sidebar — so keep it out of the
      // accessibility tree. Once the demo puts real controls up there it has
      // to come back: focusable children inside aria-hidden is an a11y bug.
      aria-hidden={controls ? undefined : true}
    >
      {rainbow && <span className="wco-rainbow-band" aria-hidden="true" />}
      {duck && <WcoDuck />}
      <img src="/logo.svg" alt="" className="w-4 h-4 shrink-0" style={{ filter: envLogoFilter }} />
      {controls ? (
        <>
          <span className="flex-1" />
          <WcoTitlebarControls />
        </>
      ) : (
        <span className="text-xs font-medium truncate">{pwaEnv.name}</span>
      )}
    </div>
  );
}

/**
 * Decorative walk-cycle, parked on its own z-index -1 layer so it passes
 * behind the logo and controls. All three motions (crossing, waddle, legs)
 * are CSS keyframes in styles.css — nothing here re-renders per frame.
 */
function WcoDuck() {
  return (
    <span className="wco-duck-track" aria-hidden="true">
      <span className="wco-duck">
        {/* Drawn back-to-front so overlaps do the shaping: legs and neck are
            laid down first and the body/head cover their ends, which keeps
            the silhouette free of seams without any path arithmetic. */}
        <svg className="wco-duck-art" viewBox="0 0 40 30" fill="none">
          <path
            className="wco-duck-leg"
            d="M13 20v5.5l3.5 1.2"
            stroke="#ea580c"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="wco-duck-leg wco-duck-leg--far"
            d="M19 20v5.5l3.5 1.2"
            stroke="#c2410c"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 12 3 9l1 8z"
            fill="#fbbf24"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* neck: a round-capped stroke, so it blends into both ends */}
          <path d="M22 18 28 10" stroke="#fcd34d" strokeWidth="8" strokeLinecap="round" />
          <ellipse cx="17" cy="16" rx="11" ry="7.5" fill="#fcd34d" />
          <circle cx="30" cy="8" r="5.5" fill="#fde68a" />
          <path d="M34.5 7 40 8.8l-5.5 2z" fill="#f97316" />
          <circle cx="31" cy="6.5" r="1.1" fill="#1f2937" />
          <ellipse cx="16" cy="16" rx="6" ry="4" fill="#fbbf24" />
        </svg>
      </span>
    </span>
  );
}
