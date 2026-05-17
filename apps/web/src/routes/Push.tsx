import { useEffect, useState } from 'react';
import { getExistingSubscription, sendTest, subscribe, unsubscribe } from '../lib/push';

export default function Push() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    getExistingSubscription().then(setSub).catch(() => {});
  }, []);

  function append(line: string) {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 50));
  }

  async function handleRequestPermission() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      append(`permission → ${result}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscribe() {
    setBusy(true);
    try {
      const s = await subscribe();
      setSub(s);
      append('subscribed and posted to server');
    } catch (e) {
      append(`subscribe failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    try {
      const ok = await unsubscribe();
      setSub(null);
      append(ok ? 'unsubscribed' : 'no subscription to remove');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTest() {
    setBusy(true);
    try {
      const r = await sendTest();
      append(`server: sent=${r.sent} failed=${r.failed} total=${r.total}`);
    } catch (e) {
      append(`send failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const installed =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Web Push</h1>
      <p className="text-slate-400 mb-6">
        Subscribe and have the server push a notification — works even when the tab is closed.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 text-sm">
        <Row label="Notification.permission" value={permission} />
        <Row label="Service Worker"          value={'serviceWorker' in navigator ? 'available' : 'unsupported'} />
        <Row label="PushManager"             value={'PushManager' in window ? 'available' : 'unsupported'} />
        <Row label="Subscription"            value={sub ? 'active' : 'none'} />
        <Row label="Installed (PWA)"         value={installed ? 'yes' : 'no'} />
      </div>

      {!installed && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
        <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          On iOS, Web Push only works after you install the PWA to your home screen.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <Btn onClick={handleRequestPermission} disabled={busy || permission === 'granted'}>
          1. Request permission
        </Btn>
        <Btn onClick={handleSubscribe} disabled={busy || permission !== 'granted' || !!sub}>
          2. Subscribe
        </Btn>
        <Btn onClick={handleSendTest} disabled={busy || !sub}>
          3. Send test
        </Btn>
        <Btn onClick={handleUnsubscribe} disabled={busy || !sub} variant="ghost">
          Unsubscribe
        </Btn>
      </div>

      {sub && (
        <details className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs">
          <summary className="cursor-pointer text-slate-400">subscription JSON</summary>
          <pre className="mt-2 overflow-x-auto">{JSON.stringify(sub.toJSON(), null, 2)}</pre>
        </details>
      )}

      <h2 className="text-sm font-medium text-slate-400 mb-2">log</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs h-48 overflow-y-auto">
        {log.length === 0 ? <span className="text-slate-600">empty</span> : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-800 last:border-b-0 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono">{value}</span>
    </div>
  );
}

function Btn({
  onClick, disabled, children, variant = 'primary',
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'primary' | 'ghost';
}) {
  const cls = variant === 'primary'
    ? 'bg-brand-500 hover:bg-brand-400 text-slate-950'
    : 'bg-slate-800 hover:bg-slate-700 text-slate-200';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 text-sm rounded-md font-medium disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}
