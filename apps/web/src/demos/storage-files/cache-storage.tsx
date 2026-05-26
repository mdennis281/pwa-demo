import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function CacheStorageDemo() {
  const [out, setOut] = useState('—');

  async function run() {
    if (!('caches' in window)) return setOut('unsupported');
    const keys = await caches.keys();
    setOut(`${keys.length} cache(s): ${keys.join(', ') || '(none)'}`);
  }

  return (
    <div>
      <Btn onClick={run}>List caches</Btn>
      <Out>{out}</Out>
    </div>
  );
}
