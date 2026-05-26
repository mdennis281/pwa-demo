import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function FSAccessDemo() {
  const [out, setOut] = useState('—');

  async function pick() {
    const W = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    if (!W.showOpenFilePicker) return setOut('unsupported');
    try {
      const [h] = await W.showOpenFilePicker();
      const f = await h.getFile();
      setOut(`${f.name} · ${f.size} bytes · ${f.type || 'unknown'}`);
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <Btn onClick={pick}>Open file</Btn>
      <Out>{out}</Out>
    </div>
  );
}
