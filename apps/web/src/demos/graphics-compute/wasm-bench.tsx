import { useEffect, useRef, useState } from 'react';
import { DemoPage } from '../_DemoPage';

/**
 * JS vs WebAssembly benchmark. Runs the *same* algorithm both ways and times
 * it, to show honestly where WASM wins and where it doesn't:
 *
 *   - 64-bit hash (i64): WASM has native 64-bit integer registers; JS has no
 *     int64 at all, so it must fall back to BigInt (heap-allocated). WASM wins
 *     by ~50-80×. This is the headline case.
 *   - Mandelbrot (f64): plain double-precision math in a tight loop — exactly
 *     what modern JS engines JIT to near-native. WASM barely pulls ahead. This
 *     is here on purpose: WASM isn't magic, it wins on structural advantages.
 *
 * Both WASM modules were hand-authored in WAT and assembled with wabt; the JS
 * references below are bit-for-bit identical to them (verified at build time).
 */

type Workload = 'hash' | 'mandel';
type Bench = { jsMs: number; wasmMs: number; identical: boolean; detail: string } | null;

const U64 = (1n << 64n) - 1n;
const MW = 600;
const MH = 450;

// 64-bit FNV-style mixing hash, `iters` rounds. Exports hash64(i64) -> i64. 109 bytes.
const HASH_WASM_B64 =
  'AGFzbQEAAAABBgFgAX4BfgMCAQAHCgEGaGFzaDY0AAAKSwFJAQJ+QoOH9JyH9sOyFCEBQgAhAgJA' +
  'A0AgAiAAWg0BIAEgAoUhASABQrODgICAIH4hASABIAFCIYiFIQEgAkIBfCECDAALCyABCw==';

// Mandelbrot. Exports mandel(w,h,maxIter,cx,cy,scale) writing one i32 iteration
// count per pixel into linear memory `mem`. 360 bytes.
const MANDEL_WASM_B64 =
  'AGFzbQEAAAABCgFgBn9/f3x8fAADAgEABQMBAAEHEAIDbWVtAgAGbWFuZGVsAAAKtgIBswIDBH8I' +
  'fAJ/IAAgAWxBBGxB//8DakGAgARuIRI/ACETIBIgE0sEQCASIBNrQAAaCyAAt0QAAAAAAADgP6Ih' +
  'ECABt0QAAAAAAADgP6IhEUEAIQhBACEHAkADQCAHIAFODQEgBCAHtyARoSAFoqAhC0EAIQYCQANA' +
  'IAYgAE4NASADIAa3IBChIAWioCEKRAAAAAAAAAAAIQxEAAAAAAAAAAAhDUQAAAAAAAAAACEORAAA' +
  'AAAAAAAAIQ9BACEJAkADQCAJIAJODQEgDiAPoEQAAAAAAAAQQGQNAUQAAAAAAAAAQCAMIA2ioiAL' +
  'oCENIA4gD6EgCqAhDCAMIAyiIQ4gDSANoiEPIAlBAWohCQwACwsgCCAJNgIAIAhBBGohCCAGQQFq' +
  'IQYMAAsLIAdBAWohBwwACwsL';

export default function WasmBenchDemo() {
  const [workload, setWorkload] = useState<Workload>('hash');
  const [hashMillions, setHashMillions] = useState(3);
  const [mandelIter, setMandelIter] = useState(256);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Bench>(null);

  const hashRef = useRef<((iters: bigint) => bigint) | null>(null);
  const mandelRef = useRef<{
    fn: (w: number, h: number, mi: number, cx: number, cy: number, s: number) => void;
    memory: WebAssembly.Memory;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<Uint8Array | null>(null);
  const sinkRef = useRef(0n);

  useEffect(() => {
    let alive = true;
    Promise.all([
      WebAssembly.instantiate(bytesFromB64(HASH_WASM_B64)),
      WebAssembly.instantiate(bytesFromB64(MANDEL_WASM_B64)),
    ])
      .then(([hashMod, mandMod]) => {
        if (!alive) return;
        hashRef.current = hashMod.instance.exports.hash64 as (iters: bigint) => bigint;
        mandelRef.current = {
          fn: mandMod.instance.exports.mandel as never,
          memory: mandMod.instance.exports.mem as WebAssembly.Memory,
        };
        setLoaded(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  function run() {
    if (!loaded || running) return;
    setRunning(true);
    setResult(null);
    // let the "running…" state paint before we block the main thread
    setTimeout(() => {
      const r = workload === 'hash' ? runHash() : runMandel();
      setResult(r);
      setRunning(false);
    }, 32);
  }

  function runHash(): Bench {
    const fn = hashRef.current;
    if (!fn) return null;
    const iters = BigInt(hashMillions) * 1_000_000n;

    let jacc = 0n;
    const jsMs = timeBest(() => { jacc = (jacc ^ hashJS(iters)) & U64; });
    let wacc = 0n;
    const wasmMs = timeBest(() => { wacc = (wacc ^ fn(iters)) & U64; });
    sinkRef.current = jacc ^ wacc; // observe the results so nothing is optimized away

    const jsH = hashJS(iters);
    const wasmH = fn(iters) & U64;
    return {
      jsMs,
      wasmMs,
      identical: jsH === wasmH,
      detail: `hash = 0x${wasmH.toString(16).padStart(16, '0')}`,
    };
  }

  function runMandel(): Bench {
    const m = mandelRef.current;
    if (!m) return null;
    const w = MW, h = MH, maxIter = mandelIter;
    const cx = -0.75, cy = 0, scale = 3.5 / w;

    const wasmMs = timeBest(() => m.fn(w, h, maxIter, cx, cy, scale));
    const wasmOut = new Int32Array(m.memory.buffer, 0, w * h).slice();

    const jsOut = new Int32Array(w * h);
    const jsMs = timeBest(() => mandelJS(jsOut, w, h, maxIter, cx, cy, scale));

    let mism = 0;
    for (let i = 0; i < wasmOut.length; i++) if (wasmOut[i] !== jsOut[i]) mism++;
    paintMandel(wasmOut, w, h, maxIter);

    return {
      jsMs,
      wasmMs,
      identical: mism === 0,
      detail: `${(w * h).toLocaleString()} pixels · max ${maxIter} iterations`,
    };
  }

  function paintMandel(iters: Int32Array, w: number, h: number, maxIter: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pal = getPalette(paletteRef);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const it = iters[i];
      const o = i * 4;
      if (it >= maxIter) {
        d[o] = d[o + 1] = d[o + 2] = 8; // inside the set
      } else {
        const c = (it & 255) * 3;
        d[o] = pal[c]; d[o + 1] = pal[c + 1]; d[o + 2] = pal[c + 2];
      }
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const ratio = result ? result.jsMs / result.wasmMs : 0;

  return (
    <DemoPage
      id="wasm-bench"
      title="Benchmark vs JS"
      blurb="Race the same algorithm in JavaScript and WebAssembly — see where WASM wins big and where it just ties."
      maxWidth="4xl"
    >
      <p className="text-slate-400 mb-6 text-sm">
        Each workload runs the <strong>identical algorithm</strong> twice — once in plain JS, once as a hand-built
        WASM module — and reports the fastest of three runs. The outputs are checked to be bit-for-bit equal, so it's
        a fair race. The interesting part is that WASM doesn't always win: it pulls ahead only where it has a
        structural edge the JS engine can't match.
      </p>

      {/* workload selector */}
      <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-1 mb-5">
        {([['hash', '64-bit hash (i64)'], ['mandel', 'Mandelbrot (f64)']] as const).map(([w, label]) => (
          <button
            key={w}
            onClick={() => { setWorkload(w); setResult(null); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              workload === w ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* workload blurb + control */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-5">
        {workload === 'hash' ? (
          <>
            <p className="text-sm text-slate-300 mb-4">
              A 64-bit mixing hash, run for millions of rounds. JS numbers are 64-bit floats and can't hold a 64-bit
              integer, so the JS version must use <code className="text-brand-300">BigInt</code> — which allocates on
              every operation. WASM uses native <code className="text-brand-300">i64</code> registers.
            </p>
            <label className="block text-sm">
              <span className="text-slate-400">Rounds: {hashMillions}M</span>
              <input
                type="range" min={1} max={15} step={1}
                value={hashMillions}
                onChange={(e) => setHashMillions(parseInt(e.target.value, 10))}
                className="block w-full max-w-sm mt-1 accent-brand-500"
              />
            </label>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-4">
              A Mandelbrot fractal — plain <code className="text-brand-300">f64</code> arithmetic in a tight per-pixel
              loop. This is the kind of code modern JS engines JIT to nearly native speed, so don't expect a blowout.
            </p>
            <label className="block text-sm">
              <span className="text-slate-400">Max iterations: {mandelIter}</span>
              <input
                type="range" min={64} max={1024} step={64}
                value={mandelIter}
                onChange={(e) => setMandelIter(parseInt(e.target.value, 10))}
                className="block w-full max-w-sm mt-1 accent-brand-500"
              />
            </label>
          </>
        )}
      </div>

      <button
        onClick={run}
        disabled={!loaded || running}
        className="px-5 py-2.5 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-sm disabled:opacity-50 transition"
      >
        {failed ? 'WASM failed to load' : !loaded ? 'loading WASM…' : running ? 'running…' : 'Run benchmark'}
      </button>

      {/* mandelbrot canvas */}
      {workload === 'mandel' && (
        <canvas
          ref={canvasRef}
          width={MW}
          height={MH}
          className="mt-6 w-full max-w-2xl h-auto rounded-lg border border-slate-800 bg-slate-950"
        />
      )}

      {/* results */}
      {result && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-4 text-xs">
            <span className="font-mono text-slate-400 break-all">{result.detail}</span>
            <span className={result.identical ? 'text-emerald-400' : 'text-rose-400'}>
              {result.identical ? '✓ identical output' : '✗ outputs differ'}
            </span>
          </div>

          <Bar label="JavaScript" ms={result.jsMs} max={Math.max(result.jsMs, result.wasmMs)} color="bg-amber-500" />
          <Bar label="WebAssembly" ms={result.wasmMs} max={Math.max(result.jsMs, result.wasmMs)} color="bg-indigo-500" />

          <div className="mt-5 text-center">
            <div className="text-3xl font-bold">
              {ratio >= 1.15 ? (
                <span className="text-indigo-400">WASM {fmtRatio(ratio)}× faster</span>
              ) : ratio <= 0.87 ? (
                <span className="text-amber-400">JS {fmtRatio(1 / ratio)}× faster</span>
              ) : (
                <span className="text-slate-300">≈ same speed ({ratio.toFixed(2)}×)</span>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            {workload === 'hash'
              ? 'JS has no 64-bit integer type, so this falls back to BigInt — correct, but it allocates on every operation. WASM’s native i64 registers make the difference. This is one of the clearest real-world reasons to reach for WebAssembly.'
              : 'Tight f64 math like this is exactly what JS engines already optimize beautifully, so WASM barely moves the needle. WebAssembly isn’t automatically faster — it wins on structural advantages (native i64 above, SIMD, predictable memory), not on math the JIT already nails.'}
          </p>
        </div>
      )}
    </DemoPage>
  );
}

function Bar({ label, ms, max, color }: { label: string; ms: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (ms / max) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-mono text-slate-400">{ms.toFixed(1)} ms</span>
      </div>
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtRatio(r: number): string {
  return r >= 10 ? Math.round(r).toString() : r.toFixed(1);
}

/** Best (fastest) of three runs — the first run warms the JIT, the min discards it. */
function timeBest(fn: () => void): number {
  let best = Infinity;
  for (let r = 0; r < 3; r++) {
    const t = performance.now();
    fn();
    const dt = performance.now() - t;
    if (dt < best) best = dt;
  }
  return best;
}

function bytesFromB64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getPalette(ref: React.RefObject<Uint8Array | null>): Uint8Array {
  if (ref.current) return ref.current;
  const p = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 256;
    p[i * 3] = Math.round(255 * (0.5 + 0.5 * Math.cos(6.28318 * (t + 0.0))));
    p[i * 3 + 1] = Math.round(255 * (0.5 + 0.5 * Math.cos(6.28318 * (t + 0.33))));
    p[i * 3 + 2] = Math.round(255 * (0.5 + 0.5 * Math.cos(6.28318 * (t + 0.67))));
  }
  ref.current = p;
  return p;
}

// ── JS reference implementations — bit-for-bit identical to the WASM modules ──

function hashJS(iters: bigint): bigint {
  let h = 1469598103934665603n;
  for (let i = 0n; i < iters; i++) {
    h = (h ^ i) & U64;
    h = (h * 1099511628211n) & U64;
    h = (h ^ (h >> 33n)) & U64;
  }
  return h;
}

function mandelJS(out: Int32Array, w: number, h: number, maxIter: number, cx: number, cy: number, scale: number) {
  const halfW = w * 0.5, halfH = h * 0.5;
  let idx = 0;
  for (let py = 0; py < h; py++) {
    const y0 = cy + (py - halfH) * scale;
    for (let px = 0; px < w; px++) {
      const x0 = cx + (px - halfW) * scale;
      let zx = 0, zy = 0, zx2 = 0, zy2 = 0, iter = 0;
      while (iter < maxIter) {
        if (zx2 + zy2 > 4.0) break;
        zy = 2 * (zx * zy) + y0;
        zx = (zx2 - zy2) + x0;
        zx2 = zx * zx;
        zy2 = zy * zy;
        iter++;
      }
      out[idx++] = iter;
    }
  }
}
