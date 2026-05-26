import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function StorageQuotaDemo() {
  const [out, setOut] = useState('—');

  async function run() {
    if (!navigator.storage?.estimate) return setOut('unsupported');
    const e = await navigator.storage.estimate();
    const used = ((e.usage ?? 0) / 1024 / 1024).toFixed(2);
    const quota = ((e.quota ?? 0) / 1024 / 1024 / 1024).toFixed(2);
    setOut(`used: ${used} MiB · quota: ${quota} GiB`);
  }

  return (
    <div>
      <Btn onClick={run}>Estimate</Btn>
      <Out>{out}</Out>
    </div>
  );
}
