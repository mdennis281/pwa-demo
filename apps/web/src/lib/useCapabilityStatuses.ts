import { useEffect, useState } from 'react';
import { CAPABILITIES, type Support } from './capabilities';

/** Shared capability status state. Runs each capability's sync `check()` once
 *  at mount, then awaits any async `refine()` and merges results. Used by the
 *  sidebar, home overview, and category drill-down so they stay in sync. */
export function useCapabilityStatuses(): Record<string, Support> {
  const [statuses, setStatuses] = useState<Record<string, Support>>(() =>
    Object.fromEntries(CAPABILITIES.map((c) => [c.id, c.check()])),
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.ready.catch(() => null)
        : null;
      const updates: Record<string, Support> = {};
      for (const cap of CAPABILITIES) {
        if (cap.refine) {
          try { updates[cap.id] = await cap.refine(reg); }
          catch { updates[cap.id] = 'unknown'; }
        }
      }
      if (!cancelled) setStatuses((p) => ({ ...p, ...updates }));
    })();
    return () => { cancelled = true; };
  }, []);
  return statuses;
}
