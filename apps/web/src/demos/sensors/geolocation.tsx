import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function GeolocationDemo() {
  const [out, setOut] = useState('—');

  function get() {
    if (!navigator.geolocation) return setOut('unsupported');
    setOut('locating…');
    navigator.geolocation.getCurrentPosition(
      (p) => setOut(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} · ±${p.coords.accuracy.toFixed(0)} m`),
      (e) => setOut(`error: ${e.message}`),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  return (
    <div>
      <Btn onClick={get}>Get position</Btn>
      <Out>{out}</Out>
    </div>
  );
}
