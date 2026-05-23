import { useEffect, useState } from 'react';
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

export function useMouseLook(canvasEl: HTMLCanvasElement | null, active: boolean): {
  locked: boolean;
} {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active || !canvasEl) return;

    const onClick = () => {
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

  return { locked };
}
