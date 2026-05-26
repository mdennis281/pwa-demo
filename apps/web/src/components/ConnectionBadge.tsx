import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export default function ConnectionBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [wsConnected, setWsConnected] = useState(false);
  const [fakeOffline, setFakeOffline] = useState(() => {
    try {
      return sessionStorage.getItem('pwa-demo:fake-offline') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

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

  const toggleFakeOffline = () => {
    const newState = !fakeOffline;
    setFakeOffline(newState);
    try {
      sessionStorage.setItem('pwa-demo:fake-offline', String(newState));
    } catch {
      /* best effort */
    }
    window.dispatchEvent(new CustomEvent('pwa-demo:offline-toggle', { detail: { fakeOffline: newState } }));
  };

  const networkOk = online && !fakeOffline;

  return (
    <div className="text-xs space-y-1">
      <button
        onClick={toggleFakeOffline}
        className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 transition"
        title="Click to toggle offline mode for Background Sync demo"
      >
        <Row label="network" ok={networkOk} okLabel={fakeOffline ? 'offline (fake)' : 'online'} badLabel="offline" />
      </button>
      <Row label="ws" ok={wsConnected} okLabel="connected" badLabel="disconnected" />
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

