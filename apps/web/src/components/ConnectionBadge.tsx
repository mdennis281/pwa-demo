import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export default function ConnectionBadge() {
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    setWsConnected(s.connected);
    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div className="text-xs">
      <div className="px-2 py-1 rounded">
        <Row label="ws" ok={wsConnected} okLabel="connected" badLabel="disconnected" />
      </div>
    </div>
  );
}

function Row({ label, ok, okLabel, badLabel }: { label: string; ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-slate-400">
      <span>{label}</span>
      <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>
        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        {ok ? okLabel : badLabel}
      </span>
    </div>
  );
}

