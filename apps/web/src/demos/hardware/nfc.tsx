/**
 * MODAL DEMO — Web NFC tag scanner.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: NFCDemo.
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function NFCDemo() {
  const [out, setOut] = useState('—');

  async function scan() {
    type Reader = new () => {
      scan: () => Promise<void>;
      onreading: ((e: { serialNumber: string }) => void) | null;
    };
    const W = window as Window & { NDEFReader?: Reader };
    if (!W.NDEFReader) {
      setOut('unsupported');
      return;
    }
    try {
      const r = new W.NDEFReader();
      await r.scan();
      r.onreading = (e) => setOut(`tag: ${e.serialNumber}`);
      setOut('scanning…');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={scan}>Scan NFC</Btn>
      <Out>{out}</Out>
    </div>
  );
}
