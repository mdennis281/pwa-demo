/**
 * MODAL DEMO — OS-level notifications.
 *
 * Renders body only. Ported 1:1 from lib/demos.tsx :: NotificationsDemo.
 */
import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function NotificationsDemo() {
  const [perm, setPerm] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [out, setOut] = useState('—');

  async function request() {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  function show() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      setOut('permission needed');
      return;
    }
    new Notification('Hello from the PWA Demo', {
      body: 'Fired at ' + new Date().toLocaleTimeString(),
    });
    setOut('shown');
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <span className="text-xs text-slate-400">
        permission: <span className="font-mono">{perm}</span>
      </span>
      <Btn variant="ghost" onClick={request} disabled={perm === 'granted'}>
        Request
      </Btn>
      <Btn onClick={show} disabled={perm !== 'granted'}>
        Show notification
      </Btn>
      <Out>{out}</Out>
    </div>
  );
}
