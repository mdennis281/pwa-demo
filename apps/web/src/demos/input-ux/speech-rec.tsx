import { useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

type Rec = new () => {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export default function SpeechRecDemo() {
  const W = window as Window & { SpeechRecognition?: Rec; webkitSpeechRecognition?: Rec };
  const [out, setOut] = useState('—');
  const [running, setRunning] = useState(false);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  function start() {
    const RC = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!RC) return setOut('unsupported');
    const r = new RC();
    r.lang = 'en-US'; r.interimResults = true;
    r.onresult = (e) => {
      const lines = Array.from(
        { length: (e.results as unknown as { length: number }).length },
        (_, i) => (e.results as unknown as { [k: number]: { 0: { transcript: string }; isFinal: boolean } })[i],
      );
      setOut(lines.map((l) => l[0].transcript).join(' '));
    };
    r.onerror = (e) => setOut(`error: ${e.error}`);
    r.start(); recRef.current = r; setRunning(true);
  }
  function stop() { recRef.current?.stop(); setRunning(false); }
  return (
    <div>
      <div className="flex gap-2 mb-1">
        <Btn onClick={start} disabled={running}>Listen</Btn>
        <Btn variant="ghost" onClick={stop} disabled={!running}>Stop</Btn>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
