import { useEffect, useState } from 'react';
import { Out } from '../_shared/ui';

export default function ServiceWorkerDemo() {
  const [info, setInfo] = useState('checking…');
  useEffect(() => {
    if (!('serviceWorker' in navigator)) { setInfo('unsupported'); return; }
    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) { setInfo('not registered'); return; }
      setInfo(`${r.active?.state ?? 'unknown'} · scope ${r.scope}`);
    });
  }, []);
  return <Out>{info}</Out>;
}
