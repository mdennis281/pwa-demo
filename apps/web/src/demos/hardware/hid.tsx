/**
 * MODAL DEMO — WebHID pairing probe.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: HIDDemo
 * (originally built via the `permissionRequestDemo` factory; inlined here).
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function HIDDemo() {
  const [out, setOut] = useState('—');

  async function go() {
    try {
      type HID = {
        requestDevice: (o: { filters: unknown[] }) => Promise<{ productName?: string }[]>;
      };
      const h = (navigator as Navigator & { hid?: HID }).hid;
      if (!h) {
        setOut('unsupported');
        return;
      }
      const ds = await h.requestDevice({ filters: [] });
      setOut(ds.length === 0 ? 'no device selected' : `paired: ${ds[0].productName ?? '?'}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={go}>Request HID device</Btn>
      <Out>{out}</Out>
    </div>
  );
}
