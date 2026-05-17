import { useEffect, useState } from 'react';
import { input } from './input';

const SENS = 0.0025;
const PITCH_MIN = -1.2;
const PITCH_MAX = 0.5;

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
      input.yaw -= e.movementX * SENS;
      input.pitch -= e.movementY * SENS;
      input.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, input.pitch));
    };

    const onChange = () => {
      setLocked(document.pointerLockElement === canvasEl);
    };

    canvasEl.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      canvasEl.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onChange);
    };
  }, [canvasEl, active]);

  return { locked };
}
