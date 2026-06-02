import { useEffect, useRef, useState } from 'react';
import FlowField from '../../components/FlowField';
import { DemoPage } from '../_DemoPage';

type Result = { count: number; ms: number } | null;

export default function WebWorkerDemo() {
  const [n, setN] = useState(200_000_000);
  const [mainResult, setMainResult] = useState<Result>(null);
  const [workerResult, setWorkerResult] = useState<Result>(null);
  const [wasmResult, setWasmResult] = useState<Result>(null);
  const [mainRunning, setMainRunning] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [wasmRunning, setWasmRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const wasmRef = useRef<((n: number) => number) | null>(null);
  const jobIdRef = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/compute.worker.ts', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    let alive = true;
    loadSieveWasm().then((fn) => { if (alive) wasmRef.current = fn; }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function runMain() {
    setMainRunning(true);
    setMainResult(null);
    setTimeout(() => {
      const start = performance.now();
      const count = sievePrimes(n);
      const ms = performance.now() - start;
      setMainResult({ count, ms });
      setMainRunning(false);
    }, 16);
  }

  function runWorker() {
    if (!workerRef.current) return;
    setWorkerRunning(true);
    setWorkerResult(null);
    const jobId = ++jobIdRef.current;
    const onMsg = (e: MessageEvent<{ jobId: number; count: number; ms: number }>) => {
      if (e.data.jobId !== jobId) return;
      setWorkerResult({ count: e.data.count, ms: e.data.ms });
      setWorkerRunning(false);
      workerRef.current?.removeEventListener('message', onMsg);
    };
    workerRef.current.addEventListener('message', onMsg);
    workerRef.current.postMessage({ kind: 'sieve', n, jobId });
  }

  function runWasm() {
    const sieve = wasmRef.current;
    if (!sieve) return;
    setWasmRunning(true);
    setWasmResult(null);
    setTimeout(() => {
      const start = performance.now();
      const count = sieve(n);
      const ms = performance.now() - start;
      setWasmResult({ count, ms });
      setWasmRunning(false);
    }, 16);
  }

  return (
    <DemoPage
      id="worker"
      title="Web Worker"
      blurb="Run a heavy sieve off-thread while a flow field animates."
      maxWidth="5xl"
    >
      <p className="text-slate-400 mb-6">
        A flow-field particle animation runs continuously on the main thread. Click <strong>Main thread</strong> to
        block it — the field freezes. Click <strong>Web Worker</strong> and the animation stays buttery while the
        same sieve runs off-thread. Click <strong>WebAssembly</strong> to run the same sieve compiled to WASM, also on
        the main thread — a tight typed-array loop like this already JITs to near-native, so it lands close to plain JS
        (the <em>Benchmark vs JS</em> demo shows where WASM pulls far ahead).
      </p>

      <FlowField className="mb-6" />

      <label className="block mb-6">
        <span className="text-sm text-slate-400">N</span>
        <input
          type="number"
          value={n}
          min={1000}
          max={50_000_000}
          step={100_000}
          onChange={(e) => setN(Math.max(1000, parseInt(e.target.value || '0', 10)))}
          className="block mt-1 w-48 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel
          title="Main thread"
          subtitle="JS, freezes the animation"
          running={mainRunning}
          result={mainResult}
          onRun={runMain}
          color="rose"
        />
        <Panel
          title="Web Worker"
          subtitle="JS off-thread, stays smooth"
          running={workerRunning}
          result={workerResult}
          onRun={runWorker}
          color="emerald"
        />
        <Panel
          title="WebAssembly"
          subtitle="compiled, on main thread"
          running={wasmRunning}
          result={wasmResult}
          onRun={runWasm}
          color="indigo"
        />
      </div>
    </DemoPage>
  );
}

function Panel({
  title, subtitle, running, result, onRun, color,
}: {
  title: string; subtitle: string; running: boolean; result: Result; onRun: () => void; color: 'rose' | 'emerald' | 'indigo';
}) {
  const cls = color === 'rose'
    ? 'bg-rose-600 hover:bg-rose-500'
    : color === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-500'
    : 'bg-indigo-600 hover:bg-indigo-500';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <button
        onClick={onRun}
        disabled={running}
        className={`mt-3 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50 ${cls}`}
      >
        {running ? 'running…' : 'Run sieve'}
      </button>
      <div className="mt-4 text-sm font-mono">
        {result ? (
          <>
            <div>primes: <span className="text-brand-400">{result.count.toLocaleString()}</span></div>
            <div>time: <span className="text-brand-400">{result.ms.toFixed(1)} ms</span></div>
          </>
        ) : (
          <span className="text-slate-600">— no result yet —</span>
        )}
      </div>
    </div>
  );
}

function sievePrimes(n: number): number {
  const sieve = new Uint8Array(n + 1);
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (sieve[i]) continue;
    count++;
    for (let j = i * i; j <= n; j += i) sieve[j] = 1;
  }
  return count;
}

/**
 * The same sieve, compiled to WebAssembly. Exports `sieve(n: i32) -> i32` and
 * owns its linear memory, growing it to hold n+1 bytes and clearing the region
 * on each call. Hand-authored in WAT and assembled with wabt; the inner loop
 * computes i*i in i64 to avoid 32-bit overflow at large N. 195 bytes.
 */
const SIEVE_WASM_B64 =
  'AGFzbQEAAAABBgFgAX8BfwMCAQAFAwEAAQcPAgNtZW0CAAVzaWV2ZQAACpYBAZMBAwJ/An4CfyAA' +
  'QYCABGpBgIAEbiEFPwAhBiAFIAZLBEAgBSAGa0AAGgtBAEEAIABBAWr8CwAgAKwhBEEAIQJBAiEB' +
  'AkADQCABIABKDQEgAS0AAEUEQCACQQFqIQIgAawgAax+IQMCQANAIAMgBFUNASADp0EBOgAAIAMg' +
  'Aax8IQMMAAsLCyABQQFqIQEMAAsLIAIL';

function sieveWasmBytes() {
  const bin = atob(SIEVE_WASM_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function loadSieveWasm(): Promise<(n: number) => number> {
  const { instance } = await WebAssembly.instantiate(sieveWasmBytes());
  return instance.exports.sieve as (n: number) => number;
}
