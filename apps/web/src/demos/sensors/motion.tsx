import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function MotionDemo() {
  const [v, setV] = useState({ x: 0, y: 0, z: 0 });
  const [running, setRunning] = useState(false);

  async function start() {
    if (!('DeviceMotionEvent' in window)) return;
    const DM = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    if (typeof DM.requestPermission === 'function') {
      const p = await DM.requestPermission();
      if (p !== 'granted') return;
    }
    const h = (e: DeviceMotionEvent) => setV({
      x: e.accelerationIncludingGravity?.x ?? 0,
      y: e.accelerationIncludingGravity?.y ?? 0,
      z: e.accelerationIncludingGravity?.z ?? 0,
    });
    window.addEventListener('devicemotion', h);
    setRunning(true);
  }

  return (
    <div>
      <Btn onClick={start} disabled={running}>Start</Btn>
      <Out>x: {v.x.toFixed(2)} · y: {v.y.toFixed(2)} · z: {v.z.toFixed(2)} m/s²</Out>
    </div>
  );
}
