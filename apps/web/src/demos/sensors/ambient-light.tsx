import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

type Sensor = new () => {
  addEventListener: (t: string, h: () => void) => void;
  start: () => void;
  illuminance: number;
};

export default function AmbientLightDemo() {
  const W = window as Window & { AmbientLightSensor?: Sensor };
  const [lux, setLux] = useState<number | null>(null);
  const [out, setOut] = useState('—');

  function start() {
    if (!W.AmbientLightSensor) return setOut('unsupported');
    try {
      const s = new W.AmbientLightSensor();
      s.addEventListener('reading', () => setLux(s.illuminance));
      s.start();
      setOut('reading…');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={start}>Start</Btn>
      <Out>{lux == null ? out : `${lux} lux`}</Out>
    </div>
  );
}
