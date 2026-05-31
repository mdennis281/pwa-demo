/**
 * Suppress pinch-zoom on iOS Safari browser tabs.
 *
 * The viewport meta (`maximum-scale=1, user-scalable=no` in index.html) already
 * disables zoom on Android Chrome and installed iOS PWAs, and `touch-action:
 * manipulation` (styles.css) kills double-tap zoom everywhere. But iOS Safari
 * deliberately ignores the viewport zoom flags in a normal tab, so pinch-zoom
 * still fires there and interferes with the interactive demos. The only lever
 * left is preventing Safari's non-standard `gesture*` events.
 *
 * Listeners are passive:false so preventDefault() takes effect. Also blocks the
 * double-tap-zoom that slips through `touch-action` on older iOS by swallowing
 * the second tap within 300ms.
 */
export function suppressZoomGestures(): void {
  // Safari-only pinch gesture events. preventDefault on start is enough to stop
  // the zoom; guarding all three avoids partial scaling on some iOS versions.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(
      type,
      (e) => e.preventDefault(),
      { passive: false },
    );
  }

  // Double-tap-to-zoom fallback for iOS versions where `touch-action` is not
  // fully honored: a second tap < 300ms after the first is the zoom trigger.
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = e.timeStamp;
      if (now - lastTouchEnd < 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}
