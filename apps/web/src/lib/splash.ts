// Coordinates fading out the inline loading splash defined in index.html.
//
// The splash itself (markup, tagline rotation, fade-out animation) lives in
// index.html so it paints before this bundle loads. This module only decides
// *when* to dismiss it: once the first route's content is actually committed,
// not merely when the app shell mounts — otherwise the fade would briefly
// reveal a bare <Suspense> fallback before the page paints.
//
// Two conditions gate the dismiss:
//   1. A minimum visible time has elapsed, so a fast (SW-cached) load still
//      shows the brand for a beat rather than flashing.
//   2. No lazy route chunk is still resolving (`pending === 0`).
// A hard safety timeout fires regardless, so a hung chunk can never strand the
// user on the splash.

declare global {
  interface Window {
    __splash?: { dismiss: () => void };
  }
}

let pending = 0;
let minElapsed = false;
let done = false;

function maybeDismiss(): void {
  if (done || !minElapsed || pending > 0) return;
  done = true;
  window.__splash?.dismiss();
}

/**
 * Hold the splash up while a lazy route chunk resolves. Call from a
 * Suspense-fallback effect: it increments a counter on mount and the returned
 * cleanup decrements it on unmount (= the chunk has resolved and real content
 * is committed). A no-op once the splash is already gone.
 */
export function holdSplashForRoute(): () => void {
  if (done) return () => {};
  pending += 1;
  return () => {
    pending = Math.max(0, pending - 1);
    maybeDismiss();
  };
}

/**
 * Start the minimum-visible timer and the safety backstop. Call once, right
 * after handing the tree to createRoot().render().
 */
export function armSplashDismiss(minMs = 1200, maxMs = 8000): void {
  if (typeof window === 'undefined' || !window.__splash) return;
  window.setTimeout(() => {
    minElapsed = true;
    maybeDismiss();
  }, minMs);
  window.setTimeout(() => {
    minElapsed = true;
    pending = 0;
    maybeDismiss();
  }, maxMs);
}
