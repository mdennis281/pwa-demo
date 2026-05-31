import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DraggablePanel } from './DraggablePanel';

// ════════════════════════════════════════════════════════════════════════
//  RENDER PERFORMANCE OVERLAY
//
//  Two halves that talk through a module-level store:
//   • <RenderStatsCollector/> lives INSIDE the <Canvas>. While mounted it
//     samples WebGLRenderer.info + JS heap + long-tasks every frame/window and
//     publishes 0.5s aggregates.
//   • <RenderPerfOverlay/> is a plain DOM panel (OUTSIDE the canvas) so it can
//     be dragged with a free mouse, polls the store ~4Hz, and exports a 60s
//     JSON capture (clipboard + download) for offline analysis.
//
//  Why these extra metrics: steady-state was already fine; the problem is
//  periodic 100-235ms FREEZES. To attribute them we need:
//   - heapMB  → if it sawtooths and drops on each hitch, the freeze is GC.
//   - longMs  → confirms + sizes a main-thread block (PerformanceObserver).
//   - reactDomMs / reactSceneMs → is the 20Hz re-render (the allocator) to blame?
// ════════════════════════════════════════════════════════════════════════

export type PerfSample = {
  /** seconds since the collector mounted (newest sample last) */
  t: number;
  fps: number;
  /** average frame time over the window (ms) */
  ms: number;
  /** worst single frame in the window (ms) — captures hitches */
  msMax: number;
  calls: number;
  tris: number;
  geometries: number;
  textures: number;
  programs: number;
  /** used JS heap (MB). 0 if performance.memory is unavailable (non-Chrome). */
  heapMB: number;
  /** longest long-task (>50ms main-thread block) in the window, ms. 0 if none. */
  longMs: number;
  /** number of long-tasks in the window. */
  longN: number;
  /** max React commit (actualDuration) for the DOM tree in the window, ms. */
  reactDomMs: number;
  /** max React commit for the 3D scene tree in the window, ms. */
  reactSceneMs: number;
  /** max event-loop lag in the window, ms. A timer fires on the MAIN THREAD
   *  regardless of rAF/vsync — so if a frame stalls AND this spikes, the main
   *  thread was blocked (GC/JS); if a frame stalls but this stays low, the
   *  freeze is OFF the main thread (GPU/compositor). THE decisive metric. */
  loopLagMs: number;
};

type Device = {
  ua: string;
  dpr: number;
  drawW: number;
  drawH: number;
  cssW: number;
  cssH: number;
  renderer: string;
  vendor: string;
  shadows: boolean;
  heapLimitMB: number;
  memSupported: boolean;
};

const FLUSH_MS = 500; // aggregate + publish every 0.5s
const HISTORY = 120; // 120 × 0.5s = 60s lookback

const store = {
  startedAt: 0,
  latest: null as PerfSample | null,
  history: [] as PerfSample[],
  device: null as Device | null,
  // accumulators fed between flushes (max-since-flush, reset on each flush):
  longMax: 0,
  longCount: 0,
  reactDomMax: 0,
  reactSceneMax: 0,
  loopLagMax: 0,
};

/** Fed by <Profiler> wrappers in GameCanvas so we can see how much of each
 *  freeze is React reconciliation vs. something else (GC, socket decode). */
export function reportCommit(which: 'dom' | 'scene', ms: number) {
  if (which === 'dom') { if (ms > store.reactDomMax) store.reactDomMax = ms; }
  else { if (ms > store.reactSceneMax) store.reactSceneMax = ms; }
}

type PerfMemory = { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
function perfMemory(): PerfMemory | null {
  return (performance as unknown as { memory?: PerfMemory }).memory ?? null;
}

/** Lives inside <Canvas>. Mount it only while the overlay is open. */
export function RenderStatsCollector() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const acc = useRef({ frames: 0, msSum: 0, msMax: 0, last: 0, sinceFlush: 0 });

  useEffect(() => {
    let renderer = 'unknown';
    let vendor = 'unknown';
    try {
      const ctx = gl.getContext();
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        renderer = String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
        vendor = String(ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL));
      }
    } catch {
      /* extension unavailable — leave as 'unknown' */
    }
    const mem = perfMemory();
    store.startedAt = performance.now();
    store.history = [];
    store.latest = null;
    store.longMax = 0;
    store.longCount = 0;
    store.reactDomMax = 0;
    store.reactSceneMax = 0;
    store.loopLagMax = 0;
    store.device = {
      ua: navigator.userAgent,
      dpr: gl.getPixelRatio(),
      drawW: gl.domElement.width,
      drawH: gl.domElement.height,
      cssW: Math.round(size.width),
      cssH: Math.round(size.height),
      renderer,
      vendor,
      shadows: gl.shadowMap.enabled,
      heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 0,
      memSupported: !!mem,
    };
    acc.current = { frames: 0, msSum: 0, msMax: 0, last: performance.now(), sinceFlush: 0 };

    // Long-task observer: the browser reports any main-thread block >50ms. This
    // is the most direct measurement of the freeze itself.
    let obs: PerformanceObserver | null = null;
    try {
      obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          store.longCount += 1;
          if (e.duration > store.longMax) store.longMax = e.duration;
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    } catch {
      /* longtask unsupported — leave at 0 */
    }

    // Event-loop lag probe. This timer is scheduled on the MAIN THREAD and is
    // independent of requestAnimationFrame / vsync / the GPU. Comparing its lag
    // against the frame stall separates the two possible causes:
    //   frame stalls + lag spikes  → main thread blocked (GC / long JS)
    //   frame stalls + lag ~0       → main thread free → GPU / compositor stall
    let timer = 0;
    let expected = performance.now() + 20;
    const tick = () => {
      const t = performance.now();
      const lag = t - expected;
      if (lag > store.loopLagMax) store.loopLagMax = lag;
      expected = t + 20;
      timer = setTimeout(tick, 20) as unknown as number;
    };
    timer = setTimeout(tick, 20) as unknown as number;

    return () => { obs?.disconnect(); clearTimeout(timer); };
  }, [gl, size.width, size.height]);

  useFrame(() => {
    const a = acc.current;
    const now = performance.now();
    const dt = now - a.last;
    a.last = now;
    a.frames += 1;
    a.msSum += dt;
    if (dt > a.msMax) a.msMax = dt;
    a.sinceFlush += dt;
    if (a.sinceFlush < FLUSH_MS) return;

    const r1 = (n: number) => Math.round(n * 10) / 10;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const mem = perfMemory();
    const sample: PerfSample = {
      t: r1((now - store.startedAt) / 1000),
      fps: r1((a.frames * 1000) / a.sinceFlush),
      ms: r2(a.msSum / a.frames),
      msMax: r2(a.msMax),
      calls: gl.info.render.calls,
      tris: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      heapMB: mem ? r1(mem.usedJSHeapSize / 1048576) : 0,
      longMs: Math.round(store.longMax),
      longN: store.longCount,
      reactDomMs: r2(store.reactDomMax),
      reactSceneMs: r2(store.reactSceneMax),
      loopLagMs: Math.round(store.loopLagMax),
    };
    store.latest = sample;
    store.history.push(sample);
    if (store.history.length > HISTORY) store.history.shift();
    a.frames = 0;
    a.msSum = 0;
    a.msMax = 0;
    a.sinceFlush = 0;
    store.longMax = 0;
    store.longCount = 0;
    store.reactDomMax = 0;
    store.reactSceneMax = 0;
    store.loopLagMax = 0;
  });

  return null;
}

// ─── export helpers ─────────────────────────────────────────────────────

function summarize(arr: number[]) {
  if (!arr.length) return { avg: 0, min: 0, max: 0 };
  const sum = arr.reduce((x, y) => x + y, 0);
  return {
    avg: Math.round((sum / arr.length) * 10) / 10,
    min: Math.min(...arr),
    max: Math.max(...arr),
  };
}

function buildExport() {
  const hist = store.history.slice();
  const span = hist.length ? Math.round(hist[hist.length - 1].t - hist[0].t) : 0;

  // Allocation rate + GC count, derived from the heap sawtooth.
  let allocSum = 0;
  let gcDrops = 0;
  for (let i = 1; i < hist.length; i++) {
    const d = hist[i].heapMB - hist[i - 1].heapMB;
    if (d > 0) allocSum += d;
    else if (d < -1) gcDrops += 1; // a >1MB drop ≈ a collection
  }

  // Every hitch (worst-frame ≥60ms) with its correlates, so the cause is
  // readable at a glance: does it line up with a heap drop (GC), a geometry
  // jump (mount), or a big React commit?
  const hitches = [] as Array<Record<string, number>>;
  for (let i = 0; i < hist.length; i++) {
    const s = hist[i];
    if (s.msMax < 60) continue;
    const p = hist[i - 1];
    hitches.push({
      t: s.t,
      msMax: s.msMax,
      longMs: s.longMs,
      heapMB: s.heapMB,
      heapDeltaMB: p ? Math.round((s.heapMB - p.heapMB) * 10) / 10 : 0,
      geomDelta: p ? s.geometries - p.geometries : 0,
      reactDomMs: s.reactDomMs,
      reactSceneMs: s.reactSceneMs,
      loopLagMs: s.loopLagMs,
    });
  }

  return {
    _doc:
      'tower-climb render-perf capture. fps higher=better; ms/calls/tris lower=better; ' +
      '0.5s aggregates, newest last. DECISIVE: in a `hitches` row, if loopLagMs is also high ' +
      'the main thread was BLOCKED during the freeze (GC / long JS) → fixable in JS; if loopLagMs ' +
      'stays low (<~30) while msMax is huge, the main thread was FREE → the stall is GPU/compositor/' +
      'present, NOT a JS problem. longMs = browser-reported long task (≥50ms main-thread). ' +
      'reactDomMs/reactSceneMs = React commit time. heapMB sawtooth + allocRateMBPerSec/gcDrops ' +
      'show GC pressure (note: 0.5s sampling smears sub-second GC).',
    capturedAt: new Date().toISOString(),
    lookbackSeconds: span,
    sampleCount: hist.length,
    device: store.device,
    summary: {
      fps: summarize(hist.map((h) => h.fps)),
      frameMs: summarize(hist.map((h) => h.ms)),
      frameMsMax: summarize(hist.map((h) => h.msMax)),
      drawCalls: summarize(hist.map((h) => h.calls)),
      triangles: summarize(hist.map((h) => h.tris)),
      heapMB: summarize(hist.map((h) => h.heapMB)),
      allocRateMBPerSec: span ? Math.round((allocSum / span) * 10) / 10 : 0,
      gcDrops,
      longTaskMs: summarize(hist.map((h) => h.longMs)),
      longTaskCount: hist.reduce((n, h) => n + h.longN, 0),
      reactDomMs: summarize(hist.map((h) => h.reactDomMs)),
      reactSceneMs: summarize(hist.map((h) => h.reactSceneMs)),
      loopLagMs: summarize(hist.map((h) => h.loopLagMs)),
      geometries: store.latest?.geometries ?? null,
      textures: store.latest?.textures ?? null,
      programs: store.latest?.programs ?? null,
    },
    hitches,
    samples: hist,
  };
}

function downloadJson(json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `render-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── overlay UI ─────────────────────────────────────────────────────────

function fpsColor(fps: number): string {
  if (fps >= 55) return '#34d399'; // emerald
  if (fps >= 30) return '#fbbf24'; // amber
  return '#fb7185'; // rose
}

/** A tiny inline sparkline. `cap` is the chart ceiling; pass 0 to auto-scale. */
function Sparkline({ values, cap, color, guides }: { values: number[]; cap?: number; color: string; guides?: number[] }) {
  const W = 232;
  const H = 30;
  if (values.length < 2) {
    return <div style={{ height: H }} className="flex items-center justify-center text-[10px] text-slate-500">collecting…</div>;
  }
  const top = cap && cap > 0 ? cap : Math.max(1, ...values) * 1.1;
  const n = values.length;
  const pts = values
    .map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - Math.min(v, top) / top * H).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={W} height={H} className="block">
      {(guides ?? []).map((g, i) => {
        const y = H - (g / top) * H;
        return <line key={i} x1={0} y1={y} x2={W} y2={y} stroke="#334155" strokeWidth={1} strokeDasharray="3 3" />;
      })}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

export function RenderPerfOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 250);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const s = store.latest;
  const dev = store.device;

  const copyJson = async () => {
    const json = JSON.stringify(buildExport(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      downloadJson(json);
    }
  };

  return (
    <DraggablePanel title="Render perf" icon="📊" onClose={onClose} defaultPos={{ x: 16, y: 80 }}>
        <div className="flex items-baseline justify-between">
          <span className="text-slate-400">FPS</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: fpsColor(s?.fps ?? 0) }}>
            {s ? s.fps.toFixed(0) : '—'}
          </span>
        </div>
        <Sparkline values={store.history.map((h) => h.fps)} cap={60} color="#38bdf8" guides={[30, 60]} />
        <div className="text-[9px] text-slate-500 -mt-1">fps · 60s · dashed 30/60</div>

        <div className="border-t border-slate-800 my-1" />
        <Row label="frame avg" value={s ? `${s.ms.toFixed(1)} ms` : '—'} />
        <Row label="frame worst" value={s ? `${s.msMax.toFixed(0)} ms` : '—'} color={s && s.msMax > 33 ? '#fb7185' : undefined} />
        <Row label="loop lag" value={s ? `${s.loopLagMs} ms` : '—'} color={s && s.loopLagMs > 50 ? '#fb7185' : '#34d399'} />
        <Row label="long task" value={s ? `${s.longMs} ms ×${s.longN}` : '—'} color={s && s.longMs > 50 ? '#fb7185' : '#34d399'} />

        <div className="border-t border-slate-800 my-1" />
        {dev?.memSupported ? (
          <>
            <Row label="JS heap" value={s ? `${s.heapMB.toFixed(0)} / ${dev.heapLimitMB} MB` : '—'} />
            <Sparkline values={store.history.map((h) => h.heapMB)} color="#f472b6" />
            <div className="text-[9px] text-slate-500 -mt-1">heap · sawtooth+drop on a hitch = GC</div>
          </>
        ) : (
          <Row label="JS heap" value="n/a (non-Chrome)" />
        )}

        <div className="border-t border-slate-800 my-1" />
        <Row label="React dom" value={s ? `${s.reactDomMs.toFixed(0)} ms` : '—'} color={s && s.reactDomMs > 16 ? '#fbbf24' : undefined} />
        <Row label="React scene" value={s ? `${s.reactSceneMs.toFixed(0)} ms` : '—'} color={s && s.reactSceneMs > 16 ? '#fbbf24' : undefined} />
        <Row label="draw calls" value={s ? String(s.calls) : '—'} />
        <Row label="triangles" value={s ? s.tris.toLocaleString() : '—'} />
        <Row label="geometries" value={s ? String(s.geometries) : '—'} />

        <div className="border-t border-slate-800 my-1" />
        <Row label="resolution" value={dev ? `${dev.cssW}×${dev.cssH} @${dev.dpr}x` : '—'} />
        <Row label="shadows" value={dev ? (dev.shadows ? 'on' : 'off') : '—'} color={dev?.shadows ? '#fbbf24' : '#34d399'} />

        <div className="flex gap-1.5 pt-1.5">
          <button
            onClick={copyJson}
            className="flex-1 bg-sky-600/80 hover:bg-sky-500 text-white rounded px-2 py-1 cursor-pointer"
          >
            {copied ? 'copied ✓' : 'copy 60s JSON'}
          </button>
          <button
            onClick={() => downloadJson(JSON.stringify(buildExport(), null, 2))}
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 rounded px-2 py-1 cursor-pointer"
            title="Download capture as .json"
          >
            ⬇
          </button>
        </div>
    </DraggablePanel>
  );
}
