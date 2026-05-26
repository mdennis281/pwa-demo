import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function WakeLockDemo() {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (k: string) => Promise<{ release: () => Promise<void> }> };
  };
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [held, setHeld] = useState(false);
  const [out, setOut] = useState('idle');

  async function acquire() {
    if (!nav.wakeLock) return setOut('unsupported');
    try {
      const l = await nav.wakeLock.request('screen');
      lockRef.current = l;
      setHeld(true);
      setOut('screen lock held');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  async function release() {
    await lockRef.current?.release();
    lockRef.current = null;
    setHeld(false);
    setOut('released');
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <Btn onClick={acquire} disabled={held}>Acquire</Btn>
        <Btn variant="ghost" onClick={release} disabled={!held}>Release</Btn>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
