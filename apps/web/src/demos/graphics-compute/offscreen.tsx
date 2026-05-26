import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function OffscreenDemo() {
  const [out, setOut] = useState('—');
  function go() {
    if (!('OffscreenCanvas' in window)) return setOut('unsupported');
    const c = new OffscreenCanvas(64, 64);
    const ctx = c.getContext('2d');
    if (!ctx) return setOut('no 2d context');
    ctx.fillStyle = '#0fa'; ctx.fillRect(0, 0, 64, 64);
    setOut(`drew on 64×64 offscreen canvas (${c.width}×${c.height})`);
  }
  return (
    <div>
      <Btn onClick={go}>Render off-main</Btn>
      <Out>{out}</Out>
    </div>
  );
}
