import { useEffect, useRef, useState } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  life: number;
};

const PARTICLE_COUNT = 320;
const TRAIL_FADE = 0.08;
const SPEED = 1.6;

export default function FlowField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width));
      height = 260;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => spawn(width, height));

    let raf = 0;
    let lastFpsT = performance.now();
    let frames = 0;
    let t = 0;

    const draw = (now: number) => {
      t = now * 0.0006;

      ctx.fillStyle = `rgba(15, 23, 42, ${TRAIL_FADE})`;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';

      for (const p of particles) {
        const fx = p.x * 0.006;
        const fy = p.y * 0.006;
        const angle =
          Math.sin(fx + t) * Math.PI +
          Math.cos(fy * 1.3 - t * 0.7) * Math.PI * 0.5;

        const ax = Math.cos(angle) * SPEED;
        const ay = Math.sin(angle) * SPEED;

        p.vx = p.vx * 0.92 + ax * 0.08;
        p.vy = p.vy * 0.92 + ay * 0.08;

        const px = p.x;
        const py = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;

        if (p.life <= 0 || p.x < -8 || p.x > width + 8 || p.y < -8 || p.y > height + 8) {
          const fresh = spawn(width, height);
          p.x = fresh.x; p.y = fresh.y; p.vx = fresh.vx; p.vy = fresh.vy;
          p.hue = fresh.hue; p.life = fresh.life;
          continue;
        }

        const alpha = Math.min(1, p.life / 60);
        ctx.strokeStyle = `hsla(${p.hue}, 90%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      frames++;
      if (now - lastFpsT >= 500) {
        setFps(Math.round((frames * 1000) / (now - lastFpsT)));
        frames = 0;
        lastFpsT = now;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const fpsColor =
    fps >= 50 ? 'text-emerald-400'
    : fps >= 25 ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <div
      ref={wrapRef}
      className={`relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 ${className}`}
    >
      <canvas ref={canvasRef} className="block w-full" aria-hidden />
      <div className="absolute top-2 right-3 text-xs font-mono bg-slate-950/70 backdrop-blur px-2 py-1 rounded border border-slate-800">
        <span className="text-slate-500">fps </span>
        <span className={fpsColor}>{fps.toString().padStart(2, '0')}</span>
      </div>
    </div>
  );
}

function spawn(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    hue: 180 + Math.random() * 60,
    life: 120 + Math.random() * 180,
  };
}
