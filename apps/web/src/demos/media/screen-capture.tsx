import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function ScreenCaptureDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function start() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (ref.current) ref.current.srcObject = s;
      setOut('capturing');
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <Btn onClick={start}>Share screen</Btn>
      <video ref={ref} autoPlay playsInline muted className="w-full max-w-xs mt-2 rounded bg-black/40" />
      <Out>{out}</Out>
    </div>
  );
}
