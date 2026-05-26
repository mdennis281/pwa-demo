/**
 * MODAL DEMO — Web Bluetooth pairing probe.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: BluetoothDemo
 * (originally built via the `permissionRequestDemo` factory; inlined here).
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BluetoothDemo() {
  const [out, setOut] = useState('—');

  async function go() {
    try {
      type BT = {
        requestDevice: (o: { acceptAllDevices: boolean }) => Promise<{ name?: string; id: string }>;
      };
      const bt = (navigator as Navigator & { bluetooth?: BT }).bluetooth;
      if (!bt) {
        setOut('unsupported');
        return;
      }
      const d = await bt.requestDevice({ acceptAllDevices: true });
      setOut(`paired: ${d.name ?? '(unnamed)'} · ${d.id}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={go}>Request BLE device</Btn>
      <Out>{out}</Out>
    </div>
  );
}
