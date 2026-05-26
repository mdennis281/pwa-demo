import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function WebGPUDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ requestDevice: () => Promise<unknown>; info?: { vendor?: string; architecture?: string } } | null> } }).gpu;
    if (!gpu) return setOut('unsupported');
    const a = await gpu.requestAdapter();
    if (!a) return setOut('no adapter');
    await a.requestDevice();
    setOut(`adapter: ${a.info?.vendor ?? '?'} / ${a.info?.architecture ?? '?'}`);
  }
  return (
    <div>
      <Btn onClick={go}>Request adapter</Btn>
      <Out>{out}</Out>
    </div>
  );
}
