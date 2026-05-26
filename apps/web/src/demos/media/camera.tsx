import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function CameraDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (ref.current) ref.current.srcObject = s;
      setOut('streaming');
    } catch (e) { setOut((e as Error).message); }
  }
  function stop() {
    const s = ref.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (ref.current) ref.current.srcObject = null;
    setOut('stopped');
  }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Btn onClick={start}>Start</Btn>
        <Btn variant="ghost" onClick={stop}>Stop</Btn>
      </div>
      <video ref={ref} autoPlay playsInline muted className="w-full max-w-xs rounded bg-black/40" />
      <Out>{out}</Out>
    </div>
  );
}
