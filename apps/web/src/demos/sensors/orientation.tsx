/**
 * Compass + spirit level, both driven live by DeviceOrientationEvent.
 *
 * Two independent visualisations sharing one sensor stream:
 *   • Compass  — a rotating card with a fixed lubber line (top index) and a
 *                centre heading readout. Uses iOS `webkitCompassHeading` when
 *                present (true magnetic heading), otherwise derives a heading
 *                from `alpha`.
 *   • Level    — a bullseye bubble level. `beta` (pitch) and `gamma` (roll)
 *                push the bubble off-centre; lay the phone flat and the bubble
 *                settles into the target and turns green.
 *
 * Sensor events fire ~60Hz; we stash the latest reading in a ref and flush to
 * React state from a rAF loop (skipping idle frames) so a perfectly still phone
 * doesn't re-render. Heading is unwrapped into a continuous angle so the dial
 * never spins the long way round as it crosses 0°/360°.
 *
 * Needs a physical device — laptops return null from these events.
 */
import { useEffect, useRef, useState } from 'react';
import { Btn } from '../_shared/ui';

const SIZE = 224;        // px edge of each circular instrument
const MAX_TILT = 30;     // tilt (deg) on either axis that pegs the bubble to the rim
const LEVEL_TOL = 2;     // within this many deg on both axes → "level"
const WINDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type View = { cont: number; heading: number; alpha: number; beta: number; gamma: number; hasData: boolean };

export default function OrientationDemo() {
  const [running, setRunning] = useState(false);
  const [denied, setDenied] = useState(false);
  const [view, setView] = useState<View>({ cont: 0, heading: 0, alpha: 0, beta: 0, gamma: 0, hasData: false });

  const raw = useRef({ heading: 0, alpha: 0, beta: 0, gamma: 0, hasData: false });
  const contRef = useRef(0);
  const sentRef = useRef({ cont: 0, beta: 0, gamma: 0, hasData: false });

  async function start() {
    if (!('DeviceOrientationEvent' in window)) { setDenied(true); return; }
    const DO = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (typeof DO.requestPermission === 'function') {
      try {
        const p = await DO.requestPermission();
        if (p !== 'granted') { setDenied(true); return; }
      } catch { setDenied(true); return; }
    }
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;

    function onOrient(e: DeviceOrientationEvent) {
      const wh = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const heading = typeof wh === 'number' && !Number.isNaN(wh)
        ? wh                              // iOS: true compass heading, 0=N, clockwise
        : (360 - (e.alpha ?? 0)) % 360;   // others: derive from alpha
      raw.current = { heading, alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0, hasData: true };
    }

    // Android exposes absolute (north-referenced) orientation under a separate
    // event; iOS folds it into the regular one via webkitCompassHeading.
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evt, onOrient as EventListener);

    let rafId = 0;
    const tick = () => {
      const r = raw.current;
      // Unwrap heading so the dial takes the short way across the 0°/360° seam.
      const cur = ((contRef.current % 360) + 360) % 360;
      const delta = ((r.heading - cur + 540) % 360) - 180;
      contRef.current += delta;

      const s = sentRef.current;
      const moved =
        Math.abs(contRef.current - s.cont) > 0.1 ||
        Math.abs(r.beta - s.beta) > 0.1 ||
        Math.abs(r.gamma - s.gamma) > 0.1 ||
        r.hasData !== s.hasData;
      if (moved) {
        sentRef.current = { cont: contRef.current, beta: r.beta, gamma: r.gamma, hasData: r.hasData };
        setView({ cont: contRef.current, heading: r.heading, alpha: r.alpha, beta: r.beta, gamma: r.gamma, hasData: r.hasData });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener(evt, onOrient as EventListener);
      cancelAnimationFrame(rafId);
    };
  }, [running]);

  if (!running) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          Turn your phone into a live compass and spirit level, both driven by{' '}
          <span className="text-slate-300">DeviceOrientationEvent</span>.
        </p>
        {denied && (
          <p className="text-xs text-rose-300 leading-relaxed">
            Couldn’t read orientation. On iOS: Settings → Safari → Motion &amp; Orientation Access, then retry.
            On desktop these sensors usually return nothing — open this on a phone.
          </p>
        )}
        <Btn onClick={start}>{denied ? 'Try again' : 'Start'}</Btn>
      </div>
    );
  }

  const heading = (((Math.round(view.heading) % 360) + 360) % 360);
  const cardinal = WINDS[Math.round(heading / 45) % 8];
  const level = Math.abs(view.beta) <= LEVEL_TOL && Math.abs(view.gamma) <= LEVEL_TOL;

  return (
    <div className="space-y-6">
      {!view.hasData && (
        <p className="text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded px-3 py-2">
          Waiting for sensor data… if nothing moves, this device has no orientation sensor — open the demo on a phone.
        </p>
      )}

      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
        {/* ── Compass ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-3">
          <SectionLabel>Compass</SectionLabel>
          <Compass cont={view.cont} heading={heading} cardinal={cardinal} />
          <div className="text-[11px] text-slate-500">heading from magnetic north</div>
        </section>

        {/* ── Level ───────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-3">
          <SectionLabel>Level</SectionLabel>
          <BubbleLevel beta={view.beta} gamma={view.gamma} level={level} />
          <div className="flex gap-2">
            <Stat label="Pitch" value={`${view.beta.toFixed(1)}°`} on={Math.abs(view.beta) <= LEVEL_TOL} />
            <Stat label="Roll" value={`${view.gamma.toFixed(1)}°`} on={Math.abs(view.gamma) <= LEVEL_TOL} />
          </div>
          <div className="text-[11px] text-slate-500">lay the phone flat on a surface</div>
        </section>
      </div>

      <div className="border-t border-slate-800 pt-3 text-center font-mono text-[11px] text-slate-600 tabular-nums">
        α {Math.round(view.alpha)}° · β {Math.round(view.beta)}° · γ {Math.round(view.gamma)}°
      </div>
    </div>
  );
}

// ─── compass ────────────────────────────────────────────────────────────────

function Compass({ cont, heading, cardinal }: { cont: number; heading: number; cardinal: string }) {
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = i * 15;
    const major = a % 90 === 0;
    const mid = a % 45 === 0;
    const len = major ? 7 : mid ? 5 : 3;
    const rad = (a * Math.PI) / 180;
    const sin = Math.sin(rad), cos = Math.cos(rad);
    ticks.push(
      <line
        key={i}
        x1={50 + 47 * sin} y1={50 - 47 * cos}
        x2={50 + (47 - len) * sin} y2={50 - (47 - len) * cos}
        stroke={a === 0 ? '#fb7185' : major ? '#cbd5e1' : '#475569'}
        strokeWidth={major ? 1.3 : 0.7}
        strokeLinecap="round"
      />,
    );
  }
  const letters: ReadonlyArray<readonly [string, number]> = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* face */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="compass-face" cx="50%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0b1120" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#compass-face)" stroke="#334155" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="#1e293b" strokeWidth="0.6" />
      </svg>

      {/* rotating card — letters, ticks and needle all turn with magnetic north */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        style={{ transform: `rotate(${-cont}deg)`, transition: 'transform 120ms linear' }}
      >
        {ticks}
        {/* needle: red north half, slate south half */}
        <polygon points="50,14 47,50 53,50" fill="#fb7185" />
        <polygon points="50,86 47,50 53,50" fill="#475569" />
        {letters.map(([ch, a]) => {
          const rad = (a * Math.PI) / 180;
          return (
            <text
              key={ch}
              x={50 + 33 * Math.sin(rad)}
              y={50 - 33 * Math.cos(rad)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fontWeight="700"
              fill={ch === 'N' ? '#fb7185' : '#e2e8f0'}
            >
              {ch}
            </text>
          );
        })}
      </svg>

      {/* fixed overlay — centre mask, readout and top lubber line */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r="23" fill="#0b1120" opacity="0.92" />
        <polygon points="50,5 46,12.5 54,12.5" fill="#38bdf8" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-2xl font-semibold leading-none tabular-nums text-slate-100">{heading}°</div>
        <div className="mt-1 font-mono text-xs tracking-[0.25em] text-brand-400">{cardinal}</div>
      </div>
    </div>
  );
}

// ─── bubble level ────────────────────────────────────────────────────────────

function BubbleLevel({ beta, gamma, level }: { beta: number; gamma: number; level: boolean }) {
  const bubbleR = 20;                     // px radius of the bubble
  const maxOff = SIZE / 2 - bubbleR - 8;  // keep the bubble inside the housing
  const ox = clamp(gamma / MAX_TILT, -1, 1) * maxOff;
  const oy = clamp(beta / MAX_TILT, -1, 1) * maxOff;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r="49" fill="#0b1120" stroke="#334155" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="#1e293b" strokeWidth="0.6" />
        {/* crosshair */}
        <line x1="50" y1="9" x2="50" y2="91" stroke="#1e293b" strokeWidth="0.7" />
        <line x1="9" y1="50" x2="91" y2="50" stroke="#1e293b" strokeWidth="0.7" />
        {/* centre target ring — greens when level */}
        <circle
          cx="50" cy="50" r="13"
          fill="none"
          stroke={level ? '#34d399' : '#475569'}
          strokeWidth="1.2"
          style={{ transition: 'stroke 200ms' }}
        />
      </svg>

      {/* bubble */}
      <div
        className="absolute rounded-full"
        style={{
          width: bubbleR * 2,
          height: bubbleR * 2,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
          transition: 'transform 90ms linear, background 200ms, box-shadow 200ms',
          background: level
            ? 'radial-gradient(circle at 35% 30%, #6ee7b7, #10b981)'
            : 'radial-gradient(circle at 35% 30%, #7dd3fc, #0ea5e9)',
          boxShadow: level
            ? '0 0 18px 2px rgba(16,185,129,0.55)'
            : '0 0 10px 1px rgba(14,165,233,0.30)',
        }}
      />

      {level && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium tracking-[0.2em] text-emerald-300">
          LEVEL
        </div>
      )}
    </div>
  );
}

// ─── small bits ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">{children}</div>;
}

function Stat({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div
      className={`min-w-[5.5rem] rounded-md border px-3 py-1.5 text-center transition-colors ${
        on ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${on ? 'text-emerald-300' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}
