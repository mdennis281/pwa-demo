import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function FetchDemo() {
  const [out, setOut] = useState('—');
  async function run() {
    try {
      const t0 = performance.now();
      const r = await fetch('/manifest.webmanifest', { cache: 'no-store' });
      const dt = (performance.now() - t0).toFixed(1);
      setOut(`${r.status} ${r.statusText} · ${dt} ms · ${r.headers.get('content-type') ?? '?'}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }
  return (
    <div>
      <Btn onClick={run}>GET /manifest.webmanifest</Btn>
      <Out>{out}</Out>
    </div>
  );
}
