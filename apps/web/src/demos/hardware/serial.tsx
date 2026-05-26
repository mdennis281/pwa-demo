/**
 * MODAL DEMO — Web Serial pairing probe.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: SerialDemo
 * (originally built via the `permissionRequestDemo` factory; inlined here).
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function SerialDemo() {
  const [out, setOut] = useState('—');

  async function go() {
    try {
      type Serial = {
        requestPort: () => Promise<{
          getInfo: () => { usbVendorId?: number; usbProductId?: number };
        }>;
      };
      const s = (navigator as Navigator & { serial?: Serial }).serial;
      if (!s) {
        setOut('unsupported');
        return;
      }
      const p = await s.requestPort();
      const i = p.getInfo();
      setOut(`paired: vendor ${i.usbVendorId ?? '?'} · product ${i.usbProductId ?? '?'}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={go}>Request serial port</Btn>
      <Out>{out}</Out>
    </div>
  );
}
