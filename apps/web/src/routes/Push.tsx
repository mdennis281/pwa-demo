import { useEffect, useRef, useState } from 'react';
import {
  getExistingSubscription,
  onPushEvent,
  scheduleDelayedTest,
  sendTest,
  subscribe,
  unsubscribe,
} from '../lib/push';

export default function Push() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [delaySec, setDelaySec] = useState(5);
  // null = no scheduled push; otherwise the unix-ms target for the live tick.
  const [firesAt, setFiresAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Hold the timeout that flips firesAt back to null after fire so the
  // countdown clears cleanly without leaving the tick loop running.
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    getExistingSubscription().then(setSub).catch(() => {});
  }, []);

  // Subscribe to SW broadcasts. This is the diagnostic path that proves the
  // SW received the push even when the OS suppresses the notification UI
  // (Focus Assist, system DND, per-app blocks etc.). Without this signal
  // the user can't tell "didn't reach SW" from "reached SW but no popup".
  useEffect(() => {
    return onPushEvent((e) => {
      if (e.type === 'push:received') {
        append(`★ SW received push: "${e.title}"`);
      } else if (e.type === 'push:shown') {
        append('★ SW showed notification — check OS notification area / Focus Assist');
      } else if (e.type === 'push:error') {
        append(`★ SW showNotification error: ${e.message}`);
      }
    });
  }, []);

  // Tick the countdown only while one is active. Stops as soon as firesAt
  // clears so we're not running setInterval forever in the background.
  useEffect(() => {
    if (firesAt === null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [firesAt]);

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

  async function handleScheduleDelayed() {
    setBusy(true);
    try {
      const r = await scheduleDelayedTest(delaySec);
      setFiresAt(r.firesAt);
      append(`scheduled: fires in ${r.delaySeconds}s — safe to close this tab`);
      // Clear the visible countdown a beat after fire so the user sees "0s"
      // briefly. The actual push arrival is reported by the SW listener
      // (★ SW received push) — that's the source of truth.
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        setFiresAt(null);
        clearTimerRef.current = null;
      }, r.delaySeconds * 1000 + 500);
    } catch (e) {
      append(`delayed schedule failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const remainingMs = firesAt === null ? 0 : Math.max(0, firesAt - nowMs);
  const remainingSec = Math.ceil(remainingMs / 1000);

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

      <div className="flex flex-wrap gap-2 mb-3">
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

      <div className="flex flex-wrap items-center gap-2 mb-6 bg-slate-900 border border-slate-800 rounded-lg p-3">
        <span className="text-xs text-slate-400">Delayed send — close the tab and you'll still get pinged:</span>
        <label className="flex items-center gap-1 text-xs text-slate-300">
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            value={delaySec}
            onChange={(e) => setDelaySec(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            disabled={busy || firesAt !== null}
            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm font-mono disabled:opacity-50"
            aria-label="Delay seconds"
          />
          <span className="text-slate-500">seconds</span>
        </label>
        <Btn onClick={handleScheduleDelayed} disabled={busy || !sub || firesAt !== null}>
          Schedule
        </Btn>
        {firesAt !== null && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-500/15 border border-brand-500/40 text-brand-100 text-xs font-mono"
            role="status"
            aria-live="polite"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            firing in {remainingSec}s
          </span>
        )}
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
