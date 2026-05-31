import { useEffect, useRef, useState } from 'react';

/**
 * Custom pull-to-refresh for touch / mobile.
 *
 * When the page is scrolled to the very top, dragging down past a threshold
 * arms a refresh: a badge descends from the top edge, a ring fills and the
 * arrow flips to point up ("release to refresh"). Releasing past the threshold
 * reloads; dragging back up (or not reaching the threshold) cancels and the
 * badge snaps away.
 *
 * We own the gesture ourselves (and suppress the browser's native
 * pull-to-refresh via `overscroll-behavior-y` in styles.css) so the affordance
 * is consistent across installed-PWA and in-browser, and so it can't fire on
 * top of the game canvas or while a modal/menu has locked scroll.
 */

const THRESHOLD = 70; // damped px the badge must travel to arm a refresh
const MAX_PULL = 120; // clamp so a long drag doesn't run the badge off-screen
const RESISTANCE = 0.5; // finger travel → badge travel (rubber-band feel)
const RING = 2 * Math.PI * 16; // circumference of the r=16 progress ring

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mirror state into refs so the once-registered native listeners read the
  // latest values without re-binding on every touchmove frame.
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  pullRef.current = pull;
  refreshingRef.current = refreshing;

  const startY = useRef(0);
  const tracking = useRef(false); // we've claimed this gesture as a pull
  const wasArmed = useRef(false);

  useEffect(() => {
    // A pull may only begin at the very top of the page, with scroll not
    // locked (modal / mobile menu open both set body overflow:hidden), and not
    // on a canvas or anything that opts out (the 3D game grabs its own touches).
    const canStart = (target: EventTarget | null): boolean =>
      window.scrollY <= 0 &&
      document.documentElement.scrollTop <= 0 &&
      document.body.style.overflow !== 'hidden' &&
      !(target instanceof Element && target.closest('canvas, [data-no-pull-refresh]'));

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      if (!canStart(e.target)) return;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
      wasArmed.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        // Pulling back up / scrolling into content — hand the gesture back to
        // native scroll for the rest of this touch and snap the badge away.
        tracking.current = false;
        setDragging(false);
        if (pullRef.current) setPull(0);
        return;
      }
      // We own this gesture: stop native scroll + the browser's pull-to-refresh.
      e.preventDefault();
      const d = Math.min(dy * RESISTANCE, MAX_PULL);
      const armed = d >= THRESHOLD;
      if (armed && !wasArmed.current) navigator.vibrate?.(10); // tick on arm
      wasArmed.current = armed;
      setDragging(true);
      setPull(d);
    };

    const onEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        // Let the spinner paint for a beat so the gesture visibly "commits"
        // before the reload tears the page down.
        window.setTimeout(() => window.location.reload(), 450);
      } else {
        setPull(0);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const progress = Math.min(pull / THRESHOLD, 1);
  const armed = pull >= THRESHOLD;
  const settle = dragging ? 'none' : 'transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease';
  const inner = dragging ? 'none' : '0.2s ease';

  return (
    <div
      aria-hidden={!refreshing}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-safe"
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800/95 shadow-lg shadow-black/30"
        style={{
          transform: `translateY(${pull - 56}px)`,
          opacity: refreshing ? 1 : Math.min(pull / 40, 1),
          transition: settle,
        }}
      >
        {refreshing ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-brand-400" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="2.5" />
              <circle
                cx="22"
                cy="22"
                r="16"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - progress)}
                transform="rotate(-90 22 22)"
                style={{ transition: inner }}
              />
            </svg>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 ${armed ? 'text-brand-400' : 'text-slate-400'}`}
              style={{ transform: `rotate(${progress * 180}deg)`, transition: inner }}
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
