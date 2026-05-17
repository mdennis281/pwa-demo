import { useEffect, useRef, useState } from 'react';

type Result = { count: number; ms: number } | null;

export default function WebWorker() {
  const [n, setN] = useState(2_000_000);
  const [mainResult, setMainResult] = useState<Result>(null);
  const [workerResult, setWorkerResult] = useState<Result>(null);
  const [mainRunning, setMainRunning] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const jobIdRef = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/compute.worker.ts', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Web Worker</h1>
      <p className="text-slate-400 mb-6">
        Sieve of Eratosthenes up to <strong>N</strong>. Watch the spinner: the main thread version freezes the UI; the worker keeps it smooth.
      </p>

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

      <div className="mb-6 flex items-center gap-3">
        <div className="text-2xl" aria-hidden>
          <Spinner />
        </div>
        <span className="text-sm text-slate-500">if this spinner stutters → main thread is blocked</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel
          title="Main thread"
          subtitle="will freeze the UI"
          running={mainRunning}
          result={mainResult}
          onRun={runMain}
          color="rose"
        />
        <Panel
          title="Web Worker"
          subtitle="off-thread, UI stays smooth"
          running={workerRunning}
          result={workerResult}
          onRun={runWorker}
          color="emerald"
        />
      </div>
    </div>
  );
}

function Panel({
  title, subtitle, running, result, onRun, color,
}: {
  title: string; subtitle: string; running: boolean; result: Result; onRun: () => void; color: 'rose' | 'emerald';
}) {
  const cls = color === 'rose'
    ? 'bg-rose-600 hover:bg-rose-500'
    : 'bg-emerald-600 hover:bg-emerald-500';
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

function Spinner() {
  return (
    <span
      className="inline-block w-6 h-6 border-2 border-slate-700 border-t-brand-400 rounded-full animate-spin"
      aria-label="spinner"
    />
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
