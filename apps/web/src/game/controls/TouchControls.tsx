import { useEffect, useRef, useState } from 'react';
import { input } from './input';

const JOY_RADIUS = 60;
const LOOK_SENS_X = 0.005;
const LOOK_SENS_Y = 0.004;
const PITCH_MIN = -1.2;
const PITCH_MAX = 0.5;

export default function TouchControls({ active }: { active: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [joy, setJoy] = useState<{ cx: number; cy: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const moveTouch = { id: -1, cx: 0, cy: 0 };
    const lookTouch = { id: -1, lastX: 0, lastY: 0 };

    const onStart = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const isJump = (e.target as HTMLElement | null)?.dataset?.jump === '1';
      if (isJump) return; // jump button handles itself
      const w = window.innerWidth;
      const leftHalf = e.clientX < w / 2;
      if (leftHalf && moveTouch.id === -1) {
        moveTouch.id = e.pointerId;
        moveTouch.cx = e.clientX;
        moveTouch.cy = e.clientY;
        setJoy({ cx: e.clientX, cy: e.clientY, dx: 0, dy: 0 });
      } else if (!leftHalf && lookTouch.id === -1) {
        lookTouch.id = e.pointerId;
        lookTouch.lastX = e.clientX;
        lookTouch.lastY = e.clientY;
      }
      wrap.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (e.pointerId === moveTouch.id) {
        const dx = e.clientX - moveTouch.cx;
        const dy = e.clientY - moveTouch.cy;
        const mag = Math.hypot(dx, dy);
        const clamp = mag > JOY_RADIUS ? JOY_RADIUS / mag : 1;
        const ndx = dx * clamp;
        const ndy = dy * clamp;
        setJoy({ cx: moveTouch.cx, cy: moveTouch.cy, dx: ndx, dy: ndy });
        input.right = ndx / JOY_RADIUS;
        input.forward = -ndy / JOY_RADIUS;
      } else if (e.pointerId === lookTouch.id) {
        const dx = e.clientX - lookTouch.lastX;
        const dy = e.clientY - lookTouch.lastY;
        lookTouch.lastX = e.clientX;
        lookTouch.lastY = e.clientY;
        input.yaw -= dx * LOOK_SENS_X;
        input.pitch -= dy * LOOK_SENS_Y;
        input.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, input.pitch));
      }
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === moveTouch.id) {
        moveTouch.id = -1;
        setJoy(null);
        input.forward = 0;
        input.right = 0;
      } else if (e.pointerId === lookTouch.id) {
        lookTouch.id = -1;
      }
    };

    wrap.addEventListener('pointerdown', onStart);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onEnd);
    wrap.addEventListener('pointercancel', onEnd);
    return () => {
      wrap.removeEventListener('pointerdown', onStart);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerup', onEnd);
      wrap.removeEventListener('pointercancel', onEnd);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-20 touch-none select-none"
      style={{ WebkitUserSelect: 'none' }}
    >
      {joy && (
        <>
          <div
            className="absolute rounded-full border-2 border-white/40 pointer-events-none"
            style={{
              left: joy.cx - JOY_RADIUS,
              top: joy.cy - JOY_RADIUS,
              width: JOY_RADIUS * 2,
              height: JOY_RADIUS * 2,
            }}
          />
          <div
            className="absolute rounded-full bg-white/70 pointer-events-none"
            style={{
              left: joy.cx + joy.dx - 22,
              top: joy.cy + joy.dy - 22,
              width: 44,
              height: 44,
            }}
          />
        </>
      )}
      <button
        type="button"
        data-jump="1"
        onPointerDown={(e) => {
          e.preventDefault();
          input.jumpPressed = true;
          input.jumpHeld = true;
        }}
        onPointerUp={() => { input.jumpHeld = false; }}
        onPointerCancel={() => { input.jumpHeld = false; }}
        onPointerLeave={() => { input.jumpHeld = false; }}
        className="absolute bottom-8 right-8 w-20 h-20 rounded-full bg-brand-500/90 text-slate-950 font-bold text-lg shadow-lg active:scale-95"
      >
        JUMP
      </button>
    </div>
  );
}
