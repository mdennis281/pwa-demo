/**
 * MODAL DEMO — reference example.
 *
 * Modal demos render only their body. ModalHost provides the title bar,
 * star button, and close affordance. Keep the body compact — overlay max
 * width is ~xl and there's already vertical padding.
 *
 * Standard layout: action row up top, <Out> readout below. Use Btn from
 * _shared/ui.tsx for primary/ghost buttons.
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function VibrationDemo() {
  const [out, setOut] = useState('idle');

  function go(pattern: number | number[]) {
    const ok = navigator.vibrate?.(pattern);
    setOut(ok ? `vibrated ${JSON.stringify(pattern)}` : 'vibrate() returned false');
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <Btn onClick={() => go(200)}>200 ms</Btn>
        <Btn variant="ghost" onClick={() => go([60, 60, 60, 60, 60])}>Pattern</Btn>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
