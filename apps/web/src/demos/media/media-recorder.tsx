import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function MediaRecorderDemo() {
  const [out, setOut] = useState('idle');
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        const b = new Blob(chunks, { type: r.mimeType });
        setUrl(URL.createObjectURL(b));
        s.getTracks().forEach((t) => t.stop());
        setOut(`stopped · ${b.size} bytes`);
      };
      r.start(); recRef.current = r; setOut('recording…');
    } catch (e) { setOut((e as Error).message); }
  }
  function stop() { recRef.current?.stop(); }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Btn onClick={start}>Record audio</Btn>
        <Btn variant="ghost" onClick={stop}>Stop</Btn>
      </div>
      {url && <audio controls src={url} className="block max-w-xs" />}
      <Out>{out}</Out>
    </div>
  );
}
