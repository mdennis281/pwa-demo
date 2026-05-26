import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function OPFSDemo() {
  const [out, setOut] = useState('—');

  async function go() {
    if (!navigator.storage?.getDirectory) return setOut('unsupported');
    try {
      const root = await navigator.storage.getDirectory();
      const h = await root.getFileHandle('pwa-demo.txt', { create: true });
      const w = await (h as FileSystemFileHandle & { createWritable: () => Promise<WritableStream<string> & { write: (s: string) => Promise<void>; close: () => Promise<void> }> }).createWritable();
      const stamp = new Date().toISOString();
      await w.write(`written at ${stamp}`);
      await w.close();
      const f = await h.getFile();
      setOut(`wrote & read ${f.size} bytes from OPFS at ${stamp}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={go}>Write & read</Btn>
      <Out>{out}</Out>
    </div>
  );
}
