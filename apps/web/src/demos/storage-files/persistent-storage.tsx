import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function PersistentStorageDemo() {
  const [out, setOut] = useState('—');

  async function check() {
    if (!navigator.storage?.persisted) return setOut('unsupported');
    setOut(`persisted: ${await navigator.storage.persisted()}`);
  }

  async function req() {
    if (!navigator.storage?.persist) return setOut('unsupported');
    const ok = await navigator.storage.persist();
    setOut(`persist() → ${ok}`);
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <Btn variant="ghost" onClick={check}>Check</Btn>
        <Btn onClick={req}>Request</Btn>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
