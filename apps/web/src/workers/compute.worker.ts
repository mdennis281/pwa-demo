/// <reference lib="WebWorker" />
type Job = { kind: 'sieve'; n: number; jobId: number };

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (e: MessageEvent<Job>) => {
  const { kind, n, jobId } = e.data;
  if (kind !== 'sieve') return;
  const start = performance.now();
  const count = sievePrimes(n);
  const ms = performance.now() - start;
  worker.postMessage({ jobId, count, ms });
};

export {};

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
