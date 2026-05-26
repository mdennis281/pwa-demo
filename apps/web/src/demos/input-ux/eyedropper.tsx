import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

type ED = new () => { open: () => Promise<{ sRGBHex: string }> };

export default function EyeDropperDemo() {
  const W = window as Window & { EyeDropper?: ED };
  const [color, setColor] = useState<string | null>(null);
  const [out, setOut] = useState('—');
  async function go() {
    if (!W.EyeDropper) return setOut('unsupported');
    try { const r = await new W.EyeDropper().open(); setColor(r.sRGBHex); setOut(r.sRGBHex); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div className="flex items-center gap-2">
      <Btn onClick={go}>Pick color</Btn>
      {color && <span className="inline-block w-6 h-6 rounded border border-slate-600" style={{ background: color }} />}
      <Out>{out}</Out>
    </div>
  );
}
