/**
 * MODAL DEMO — App icon badging.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: BadgingDemo.
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BadgingDemo() {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const [n, setN] = useState(1);
  const [out, setOut] = useState('—');

  async function set() {
    if (!nav.setAppBadge) return setOut('unsupported');
    try {
      await nav.setAppBadge(n);
      setOut(`badge set to ${n}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  async function clear() {
    if (!nav.clearAppBadge) return setOut('unsupported');
    try {
      await nav.clearAppBadge();
      setOut('cleared');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <input
        type="number"
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
      />
      <Btn onClick={set}>Set</Btn>
      <Btn variant="ghost" onClick={clear}>
        Clear
      </Btn>
      <Out>{out}</Out>
    </div>
  );
}
