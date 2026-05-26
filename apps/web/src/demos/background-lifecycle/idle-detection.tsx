import { useEffect, useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function IdleDetectionDemo() {
  type IdleDetectorCls = new () => {
    addEventListener: (t: string, h: () => void) => void;
    start: (o: { threshold: number; signal?: AbortSignal }) => Promise<void>;
    userState: string;
    screenState: string;
  };
  type IdleDetectorStatic = IdleDetectorCls & { requestPermission: () => Promise<string> };
  const W = window as Window & { IdleDetector?: IdleDetectorStatic };
  const [state, setState] = useState('idle');
  const [out, setOut] = useState('—');
  const ctrlRef = useRef<AbortController | null>(null);

  async function run() {
    if (!W.IdleDetector) return setOut('unsupported');
    try {
      const perm = await W.IdleDetector.requestPermission();
      if (perm !== 'granted') return setOut('permission denied');
      const d = new W.IdleDetector();
      d.addEventListener('change', () => setState(`${d.userState} · ${d.screenState}`));
      const c = new AbortController();
      ctrlRef.current = c;
      await d.start({ threshold: 60_000, signal: c.signal });
      setOut('started (60s threshold)');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  function stop() {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setOut('stopped');
  }

  useEffect(() => () => ctrlRef.current?.abort(), []);

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center">
        <Btn onClick={run}>Start</Btn>
        <Btn variant="ghost" onClick={stop}>Stop</Btn>
        <span className="text-xs text-slate-400">
          state: <span className="font-mono">{state}</span>
        </span>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
