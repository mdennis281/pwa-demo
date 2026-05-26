import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BeaconDemo() {
  const [out, setOut] = useState('—');
  function fire() {
    if (typeof navigator.sendBeacon !== 'function') return setOut('unsupported');
    const ok = navigator.sendBeacon(
      '/__beacon__',
      new Blob([JSON.stringify({ at: Date.now() })], { type: 'application/json' }),
    );
    setOut(`sendBeacon → ${ok} (fire-and-forget; endpoint may 404 — that's fine)`);
  }
  return (
    <div>
      <Btn onClick={fire}>Send beacon</Btn>
      <Out>{out}</Out>
    </div>
  );
}
