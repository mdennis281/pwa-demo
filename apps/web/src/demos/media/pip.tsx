import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function PiPDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function go() {
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) return setOut('unsupported or disabled');
    try { await ref.current?.requestPictureInPicture(); setOut('opened'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <video ref={ref} autoPlay loop muted playsInline className="w-full max-w-xs rounded bg-black/40"
        src="/demo-video.webm" />
      <div className="mt-2"><Btn onClick={go}>Open PiP</Btn></div>
      <Out>{out}</Out>
    </div>
  );
}
