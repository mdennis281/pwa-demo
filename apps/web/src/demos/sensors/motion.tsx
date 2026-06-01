import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function MotionDemo() {
  const [v, setV] = useState({ x: 0, y: 0, z: 0 });
  const [running, setRunning] = useState(false);
  const [stalled, setStalled] = useState(false);
  const gotData = useRef(false);

  async function start() {
    if (!('DeviceMotionEvent' in window)) return;
    const DM = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    if (typeof DM.requestPermission === 'function') {
      const p = await DM.requestPermission();
      if (p !== 'granted') return;
    }
    const h = (e: DeviceMotionEvent) => {
      gotData.current = true;
      setV({
        x: e.accelerationIncludingGravity?.x ?? 0,
        y: e.accelerationIncludingGravity?.y ?? 0,
        z: e.accelerationIncludingGravity?.z ?? 0,
      });
    };
    window.addEventListener('devicemotion', h);
    setRunning(true);
    setStalled(false);
    // Permission granted but no events within ~2s is the signature of a browser
    // that blocks the sensor as anti-fingerprinting — Brave does this by default
    // (the DeviceMotionEvent constructor still exists, so this reads as
    // "supported", but the event never fires). Or it's a desktop with no
    // accelerometer. Either way, say so instead of sitting silently at 0.00.
    window.setTimeout(() => { if (!gotData.current) setStalled(true); }, 2000);
  }

  return (
    <div>
      <Btn onClick={start} disabled={running}>Start</Btn>
      <Out>x: {v.x.toFixed(2)} · y: {v.y.toFixed(2)} · z: {v.z.toFixed(2)} m/s²</Out>
      {stalled && !gotData.current && (
        <p className="mt-2 text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded px-3 py-2 leading-relaxed">
          No sensor data arriving. Some browsers — notably{' '}
          <span className="font-medium text-amber-200">Brave</span> — block motion sensors as an
          anti-fingerprinting measure: lower Shields for this site (tap the lion icon) and reload.
          On a desktop these sensors return nothing — open this on a phone.
        </p>
      )}
    </div>
  );
}
