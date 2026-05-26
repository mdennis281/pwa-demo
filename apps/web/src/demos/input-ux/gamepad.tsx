import { useEffect, useState } from 'react';
import { Out } from '../_shared/ui';

export default function GamepadDemo() {
  const [pads, setPads] = useState<string[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const gs = navigator.getGamepads?.() ?? [];
      const lines: string[] = [];
      for (const g of gs) {
        if (!g) continue;
        const axes = g.axes.map((a) => a.toFixed(2)).join(', ');
        const buttons = g.buttons.map((b, i) => (b.pressed ? i : '')).filter(Boolean).join(',') || '—';
        lines.push(`${g.id} · axes [${axes}] · pressed [${buttons}]`);
      }
      setPads(lines);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Out>
      {pads.length === 0 ? 'press any button on a connected controller' : pads.map((l, i) => <div key={i}>{l}</div>)}
    </Out>
  );
}
