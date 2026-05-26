import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function OrientationDemo() {
  const [v, setV] = useState({ a: 0, b: 0, g: 0 });
  const [running, setRunning] = useState(false);

  async function start() {
    if (!('DeviceOrientationEvent' in window)) return;
    const DO = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (typeof DO.requestPermission === 'function') {
      const p = await DO.requestPermission();
      if (p !== 'granted') return;
    }
    window.addEventListener('deviceorientation', (e) => setV({ a: e.alpha ?? 0, b: e.beta ?? 0, g: e.gamma ?? 0 }));
    setRunning(true);
  }

  return (
    <div>
      <Btn onClick={start} disabled={running}>Start</Btn>
      <Out>α (compass): {v.a.toFixed(1)}° · β (tilt fwd/back): {v.b.toFixed(1)}° · γ (tilt left/right): {v.g.toFixed(1)}°</Out>
    </div>
  );
}
