import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BatteryDemo() {
  const [info, setInfo] = useState<string>('—');

  async function go() {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        chargingTime: number;
        dischargingTime: number;
      }>;
    };
    if (!nav.getBattery) {
      setInfo('unsupported');
      return;
    }
    const b = await nav.getBattery();
    const t = (s: number) => (Number.isFinite(s) ? `${Math.round(s / 60)} min` : '∞');
    setInfo(
      `${(b.level * 100).toFixed(0)}% · ${b.charging ? 'charging' : 'on battery'} · to full: ${t(b.chargingTime)} · to empty: ${t(b.dischargingTime)}`,
    );
  }

  return (
    <div>
      <Btn onClick={go}>Read battery</Btn>
      <Out>{info}</Out>
    </div>
  );
}
