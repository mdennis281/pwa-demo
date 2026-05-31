/**
 * Page-side companion to the SW's own lifecycle recording (sw.ts).
 *
 * The SW records its `install` / `activate` event timestamps authoritatively.
 * What it CANNOT see about itself is the discrete state machine the browser
 * runs it through — installing → installed (waiting) → activating → activated.
 * The page can: every ServiceWorker object emits `statechange`. Observing that
 * here lets the demo split "install work" from "time spent waiting" from
 * "activate work", which the SW timeline alone can only bracket.
 *
 * Each tracked worker is asked for its OWN version first (querySwInfo), because
 * during an update the `installing` worker is the NEW build — attributing its
 * lifecycle to the page's bundle version would mislabel the record.
 */

import { recordVersion, type SwVersionRecord } from './swHistoryDb';

export type SwInfo = {
  version: string;
  buildTime?: string;
  scope?: string;
  runtimeCaches?: string[];
};

const QUERY_TIMEOUT_MS = 2_000;

/**
 * Ask a specific worker (active, waiting, or installing) for the version it was
 * compiled with, over a one-shot MessageChannel. Resolves null if the worker is
 * absent or doesn't reply in time (older SW without the SW_INFO handler, or a
 * worker too early in its lifecycle to process messages).
 */
export function querySwInfo(worker: ServiceWorker | null | undefined): Promise<SwInfo | null> {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: SwInfo | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const channel = new MessageChannel();
    const timer = setTimeout(() => finish(null), QUERY_TIMEOUT_MS);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      finish((e.data as SwInfo) ?? null);
    };
    try {
      worker.postMessage({ type: 'SW_INFO' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

function stateToPatch(state: ServiceWorkerState, at: number): Partial<SwVersionRecord> {
  switch (state) {
    case 'installing':
      return { installingAt: at };
    case 'installed':
      return { installedAt: at };
    case 'activating':
      return { activatingAt: at };
    case 'activated':
      return { activatedAt: at };
    default:
      return {};
  }
}

async function trackWorker(worker: ServiceWorker | null | undefined): Promise<void> {
  if (!worker) return;
  const initialState = worker.state; // snapshot before the async version query

  const info = await querySwInfo(worker);
  const version = info?.version;
  if (!version) return; // can't attribute its lifecycle — SW timeline still covers it

  const record = (state: ServiceWorkerState) => {
    const patch = stateToPatch(state, Date.now());
    if (Object.keys(patch).length) void recordVersion({ version, ...patch });
  };

  record(initialState);
  if (worker.state !== initialState) record(worker.state); // advanced during the query
  worker.addEventListener('statechange', () => record(worker.state));
}

let tracking = false;

/**
 * Begin page-side lifecycle observation for the active registration.
 * Idempotent — safe to call on every onRegisteredSW.
 */
export function trackSwLifecycle(reg: ServiceWorkerRegistration): void {
  if (tracking) return;
  tracking = true;

  // The worker present right now: installing on a first-ever load, else active.
  void trackWorker(reg.installing ?? reg.waiting ?? reg.active);

  // Each future deploy surfaces its new worker as reg.installing.
  reg.addEventListener('updatefound', () => void trackWorker(reg.installing));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      void querySwInfo(navigator.serviceWorker.controller).then((info) => {
        if (info?.version) void recordVersion({ version: info.version, controlledAt: Date.now() });
      });
    });
  }
}
