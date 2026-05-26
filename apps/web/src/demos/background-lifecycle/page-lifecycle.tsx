import { useEffect, useState } from 'react';
import { Out } from '../_shared/ui';

export default function PageLifecycleDemo() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    const events = ['visibilitychange', 'freeze', 'resume', 'pageshow', 'pagehide'];
    const h = (e: Event) =>
      setLog((l) =>
        [
          `${new Date().toLocaleTimeString()} · ${e.type}${
            e.type === 'visibilitychange' ? ` (${document.visibilityState})` : ''
          }`,
          ...l,
        ].slice(0, 8),
      );
    events.forEach((t) => document.addEventListener(t, h));
    return () => events.forEach((t) => document.removeEventListener(t, h));
  }, []);
  return (
    <Out>
      <div className="text-slate-500 mb-1">switch tabs or minimize:</div>
      {log.length === 0 ? (
        <div className="text-slate-500">no events yet</div>
      ) : (
        log.map((l, i) => <div key={i}>{l}</div>)
      )}
    </Out>
  );
}
