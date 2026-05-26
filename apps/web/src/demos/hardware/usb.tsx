/**
 * MODAL DEMO — WebUSB pairing probe.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: USBDemo
 * (originally built via the `permissionRequestDemo` factory; inlined here).
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function USBDemo() {
  const [out, setOut] = useState('—');

  async function go() {
    try {
      type USB = {
        requestDevice: (o: {
          filters: unknown[];
        }) => Promise<{ productName?: string; manufacturerName?: string }>;
      };
      const u = (navigator as Navigator & { usb?: USB }).usb;
      if (!u) {
        setOut('unsupported');
        return;
      }
      const d = await u.requestDevice({ filters: [] });
      setOut(`paired: ${d.manufacturerName ?? '?'} ${d.productName ?? ''}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={go}>Request USB device</Btn>
      <Out>{out}</Out>
    </div>
  );
}
