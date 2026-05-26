import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function WebCodecsDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    type Decoder = new (o: { output: () => void; error: (e: Error) => void }) => unknown;
    const W = window as unknown as { VideoDecoder?: Decoder; VideoEncoder?: { isConfigSupported: (c: { codec: string; width: number; height: number }) => Promise<{ supported: boolean }> } };
    if (!W.VideoDecoder || !W.VideoEncoder) return setOut('unsupported');
    const r = await W.VideoEncoder.isConfigSupported({ codec: 'vp8', width: 640, height: 480 });
    setOut(`VP8 640×480 encoder supported: ${r.supported}`);
  }
  return (
    <div>
      <Btn onClick={go}>Probe encoder</Btn>
      <Out>{out}</Out>
    </div>
  );
}
