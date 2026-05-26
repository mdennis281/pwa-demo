import { useEffect, useState } from 'react';
import { Out } from '../_shared/ui';

type ConnLike = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };

export default function NetworkInfoDemo() {
  const conn = (navigator as Navigator & { connection?: ConnLike }).connection;
  const [info, setInfo] = useState<ConnLike | undefined>(conn);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: ConnLike & EventTarget }).connection;
    if (!c) return;
    const h = () =>
      setInfo({ effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData });
    (c as EventTarget).addEventListener('change', h);
    return () => (c as EventTarget).removeEventListener('change', h);
  }, []);
  if (!conn) return <Out tone="err">unsupported</Out>;
  return (
    <Out>
      type: {info?.effectiveType ?? '?'} · downlink: {info?.downlink ?? '?'} Mbps · rtt: {info?.rtt ?? '?'} ms · saveData: {String(info?.saveData ?? false)}
    </Out>
  );
}
