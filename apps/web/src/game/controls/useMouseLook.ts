import { useEffect, useRef, useState } from 'react';
import { input } from './input';

const SENS = 0.0025;
const PITCH_MIN = -1.2;
const PITCH_MAX = 0.5;
/** Cap per-event mouse delta. Chromium occasionally delivers absurd or
 *  sign-flipped movementX/Y values on fast motion or right after pointer
 *  lock activates — this prevents the camera from snapping the wrong way. */
const MAX_DELTA_PX = 120;
/** Zoom (mouse wheel) tuning. */
const ZOOM_MIN = 2.5;
const ZOOM_MAX = 14;
const ZOOM_STEP = 0.0035; // per pixel of wheel delta

/**
 * Pointer-lock mouse-look. `active` gates the whole behaviour (desktop only).
 * `allowLock` (default true) gates *acquiring* the lock: when false — e.g. the
 * game is paused — a click won't capture the mouse, and any existing lock is
 * released. Together that makes "paused ⇒ mouse capture lost, no way to get it
 * back" hold until the game resumes.
 */
export function useMouseLook(
  canvasEl: HTMLCanvasElement | null,
  active: boolean,
  allowLock = true,
): {
  locked: boolean;
} {
  const [locked, setLocked] = useState(false);
  // Read inside the click handler without rebinding listeners every toggle.
  const allowLockRef = useRef(allowLock);
  allowLockRef.current = allowLock;

  useEffect(() => {
    if (!active || !canvasEl) return;

    const onClick = () => {
      if (!allowLockRef.current) return; // paused — refuse to (re)capture
      if (document.pointerLockElement !== canvasEl) {
        canvasEl.requestPointerLock?.();
      }
    };

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasEl) return;
      const dx = Math.max(-MAX_DELTA_PX, Math.min(MAX_DELTA_PX, e.movementX));
      const dy = Math.max(-MAX_DELTA_PX, Math.min(MAX_DELTA_PX, e.movementY));
      input.yaw -= dx * SENS;
      input.pitch -= dy * SENS;
      input.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, input.pitch));
    };

    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== canvasEl) return;
      e.preventDefault();
      // Normalize line/page modes to roughly pixel-equivalent deltas.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      input.cameraDist = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, input.cameraDist + e.deltaY * unit * ZOOM_STEP),
      );
    };

    const onChange = () => {
      setLocked(document.pointerLockElement === canvasEl);
    };

    canvasEl.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      canvasEl.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onChange);
    };
  }, [canvasEl, active]);

  // The instant locking is disallowed (pause), drop any current lock. The
  // pointerlockchange listener above flips `locked` to false in response.
  useEffect(() => {
    if (!allowLock && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [allowLock]);

  return { locked };
}
