import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function ShareDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    if (typeof navigator.share !== 'function') return setOut('unsupported');
    try {
      await navigator.share({ title: 'PWA Demo', text: 'Check out what the web can do', url: location.href });
      setOut('shared');
    } catch (e) {
      setOut((e as Error).message);
    }
  }
  return (
    <div>
      <Btn onClick={go}>Share this page</Btn>
      <Out>{out}</Out>
    </div>
  );
}
