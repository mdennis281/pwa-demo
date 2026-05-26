import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

// ────────────────────── shared bits ──────────────────────

const btn =
  'px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-medium text-xs transition';
const btnGhost =
  'px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs transition';

function Out({ children, mono = true, tone = 'default' }: { children: React.ReactNode; mono?: boolean; tone?: 'default' | 'err' | 'ok' }) {
  const color = tone === 'err' ? 'text-rose-300' : tone === 'ok' ? 'text-emerald-300' : 'text-slate-300';
  return (
    <div className={`text-xs ${mono ? 'font-mono' : ''} ${color} mt-2 break-all`}>{children}</div>
  );
}

// ────────────────────── Install & PWA ──────────────────────

function ServiceWorkerDemo() {
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

function RelatedAppsDemo() {
  const [out, setOut] = useState('not yet checked');
  async function run() {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    if (typeof nav.getInstalledRelatedApps !== 'function') { setOut('unsupported'); return; }
    try {
      const apps = await nav.getInstalledRelatedApps();
      setOut(`${apps.length} match(es): ${JSON.stringify(apps)}`);
    } catch (e) { setOut(`error: ${(e as Error).message}`); }
  }
  return (
    <div>
      <button onClick={run} className={btn}>Check related apps</button>
      <Out>{out}</Out>
    </div>
  );
}

function LaunchQueueDemo() {
  const lq = (window as Window & { launchQueue?: { setConsumer: (cb: (p: unknown) => void) => void } }).launchQueue;
  if (!lq) return <Out tone="err">unsupported</Out>;
  return <Out>launchQueue present. Launch the installed PWA with a file or URL to deliver a LaunchParams to it.</Out>;
}

// ────────────────────── Notifications ──────────────────────

function VibrationDemo() {
  const [out, setOut] = useState('idle');
  function go(pattern: number | number[]) {
    const ok = navigator.vibrate?.(pattern);
    setOut(ok ? `vibrated ${JSON.stringify(pattern)}` : 'vibrate() returned false');
  }
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={() => go(200)} className={btn}>200 ms</button>
      <button onClick={() => go([60, 60, 60, 60, 60])} className={btnGhost}>Pattern</button>
      <Out>{out}</Out>
    </div>
  );
}

function BadgingDemo() {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  const [n, setN] = useState(1);
  const [out, setOut] = useState('—');
  async function set() {
    if (!nav.setAppBadge) return setOut('unsupported');
    try { await nav.setAppBadge(n); setOut(`badge set to ${n}`); }
    catch (e) { setOut((e as Error).message); }
  }
  async function clear() {
    if (!nav.clearAppBadge) return setOut('unsupported');
    try { await nav.clearAppBadge(); setOut('cleared'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <input type="number" value={n} onChange={(e) => setN(Number(e.target.value))}
        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
      <button onClick={set} className={btn}>Set</button>
      <button onClick={clear} className={btnGhost}>Clear</button>
      <Out>{out}</Out>
    </div>
  );
}

function NotificationsDemo() {
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [out, setOut] = useState('—');
  async function request() {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }
  function show() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') { setOut('permission needed'); return; }
    new Notification('Hello from the PWA Demo', { body: 'Fired at ' + new Date().toLocaleTimeString() });
    setOut('shown');
  }
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <span className="text-xs text-slate-400">permission: <span className="font-mono">{perm}</span></span>
      <button onClick={request} className={btnGhost} disabled={perm === 'granted'}>Request</button>
      <button onClick={show} className={btn} disabled={perm !== 'granted'}>Show notification</button>
      <Out>{out}</Out>
    </div>
  );
}

// ────────────────────── Background & lifecycle ──────────────────────

function WakeLockDemo() {
  const nav = navigator as Navigator & { wakeLock?: { request: (k: string) => Promise<{ release: () => Promise<void> }> } };
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [held, setHeld] = useState(false);
  const [out, setOut] = useState('idle');
  async function acquire() {
    if (!nav.wakeLock) return setOut('unsupported');
    try {
      const l = await nav.wakeLock.request('screen');
      lockRef.current = l;
      setHeld(true); setOut('screen lock held');
    } catch (e) { setOut((e as Error).message); }
  }
  async function release() {
    await lockRef.current?.release();
    lockRef.current = null;
    setHeld(false); setOut('released');
  }
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={acquire} className={btn} disabled={held}>Acquire</button>
      <button onClick={release} className={btnGhost} disabled={!held}>Release</button>
      <Out>{out}</Out>
    </div>
  );
}

function IdleDemo() {
  type IdleDetectorCls = new () => { addEventListener: (t: string, h: () => void) => void; start: (o: { threshold: number; signal?: AbortSignal }) => Promise<void>; userState: string; screenState: string };
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
    } catch (e) { setOut((e as Error).message); }
  }
  function stop() { ctrlRef.current?.abort(); ctrlRef.current = null; setOut('stopped'); }
  useEffect(() => () => ctrlRef.current?.abort(), []);
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button onClick={run} className={btn}>Start</button>
      <button onClick={stop} className={btnGhost}>Stop</button>
      <span className="text-xs text-slate-400">state: <span className="font-mono">{state}</span></span>
      <Out>{out}</Out>
    </div>
  );
}

function PageLifecycleDemo() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    const events = ['visibilitychange', 'freeze', 'resume', 'pageshow', 'pagehide'];
    const h = (e: Event) => setLog((l) => [`${new Date().toLocaleTimeString()} · ${e.type}${e.type === 'visibilitychange' ? ` (${document.visibilityState})` : ''}`, ...l].slice(0, 8));
    events.forEach((t) => document.addEventListener(t, h));
    return () => events.forEach((t) => document.removeEventListener(t, h));
  }, []);
  return (
    <Out>
      <div className="text-slate-500 mb-1">switch tabs or minimize:</div>
      {log.length === 0 ? <div className="text-slate-500">no events yet</div> : log.map((l, i) => <div key={i}>{l}</div>)}
    </Out>
  );
}

function BgSyncDemo() {
  const [out, setOut] = useState('—');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [queue, setQueue] = useState<Array<{ id: string; msg: string; at: number; synced?: boolean }>>([]);
  const [fakeOffline, setFakeOffline] = useState(false);
  const [formValue, setFormValue] = useState('');

  async function registerSync() {
    const reg = await navigator.serviceWorker?.ready;
    const r = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
    if (!r?.sync) return setOut('unsupported (SW + SyncManager required)');
    try {
      await r.sync.register('pbs-demo');
      setOut('sync registered');
      pollQueue();
    } catch (e) { setOut((e as Error).message); }
  }

  async function submitItem() {
    if (!formValue.trim()) return;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('pwa-demo', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('pbs-sync');
          req.result.createObjectStore('pbs-queue', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (fakeOffline) {
        const tx = db.transaction('pbs-queue', 'readwrite');
        const id = `${Date.now()}-${Math.random()}`;
        await new Promise<void>((resolve, reject) => {
          const req = tx.objectStore('pbs-queue').add({ id, msg: formValue, at: Date.now(), synced: false });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        setFormValue('');
        pollQueue();
      } else {
        const tx = db.transaction(['pbs-queue', 'pbs-sync'], 'readwrite');
        const id = `${Date.now()}-${Math.random()}`;
        await new Promise<void>((resolve, reject) => {
          const req = tx.objectStore('pbs-queue').add({ id, msg: formValue, at: Date.now(), synced: true });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        await new Promise<void>((resolve) => {
          tx.objectStore('pbs-sync').put({ lastSync: Date.now() }, 'pbs-demo');
          resolve();
        });
        setFormValue('');
        pollQueue();
      }
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  async function pollQueue() {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('pwa-demo', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('pbs-sync');
          req.result.createObjectStore('pbs-queue', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const txSync = db.transaction('pbs-sync', 'readonly');
      const syncData = await new Promise<{ lastSync: number } | undefined>((resolve, reject) => {
        const req = txSync.objectStore('pbs-sync').get('pbs-demo');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (syncData?.lastSync) {
        const time = new Date(syncData.lastSync).toLocaleTimeString();
        setLastSync(`${time} UTC`);
      }

      const txQueue = db.transaction('pbs-queue', 'readonly');
      const items = await new Promise<any[]>((resolve, reject) => {
        const req = txQueue.objectStore('pbs-queue').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      setQueue(items.sort((a, b) => b.at - a.at));
    } catch {
      /* best effort */
    }
  }

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ fakeOffline: boolean }>).detail;
      setFakeOffline(detail.fakeOffline);
    };
    window.addEventListener('pwa-demo:offline-toggle', handleToggle);
    return () => window.removeEventListener('pwa-demo:offline-toggle', handleToggle);
  }, []);

  useEffect(() => {
    const id = window.setInterval(pollQueue, 2000);
    pollQueue();
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={registerSync} className={btn}>Register sync</button>
        <button onClick={pollQueue} className={btnGhost}>Refresh</button>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-slate-400">submit while offline (toggle in sidebar):</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitItem()}
            placeholder="message"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
          />
          <button onClick={submitItem} className={btn}>Submit</button>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="text-xs bg-slate-800/40 border border-slate-700 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
          <div className="text-slate-400 font-mono text-[10px]">queue ({queue.length}):</div>
          {queue.map((item) => (
            <div key={item.id} className={`font-mono text-[10px] ${item.synced ? 'text-emerald-300' : 'text-amber-300'}`}>
              {item.synced ? '✓' : '◴'} {item.msg} · {new Date(item.at).toLocaleTimeString()}
            </div>
          ))}
        </div>
      )}

      <Out>{out}</Out>
      {lastSync && <Out tone="ok">last sync: {lastSync}</Out>}
      <div className="text-xs text-slate-500">toggle offline mode in sidebar, submit items, then go back online to flush the queue</div>
    </div>
  );
}

function BgFetchDemo() {
  const [mb, setMb] = useState(5);
  const [fetchId, setFetchId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('—');

  async function start() {
    if (!('serviceWorker' in navigator) || !('BackgroundFetchManager' in window)) {
      return setStatus('unsupported (Chrome/Edge + SW required)');
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const bgManager = (reg as ServiceWorkerRegistration & { backgroundFetch?: { fetch: (id: string, urls: string[], opts: { icons: Array<{ src: string; sizes: string; type: string }>; title: string }) => Promise<{ id: string }> } }).backgroundFetch;

      if (!bgManager) return setStatus('BackgroundFetchManager unavailable');

      const id = `demo-${Date.now()}`;
      const result = await bgManager.fetch(id, [`/api/bg-fetch-demo?mb=${mb}`], {
        title: `Download ${mb}MB`,
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      });

      setFetchId(result.id);
      setStatus('downloading…');

      const pollInterval = setInterval(async () => {
        try {
          const bg = (reg as any).backgroundFetch;
          const fetches = await bg.getIds();
          const f = fetches.includes(id) ? await bg.get(id) : null;
          if (!f) {
            clearInterval(pollInterval);
            setStatus('completed');
            setProgress(100);
            return;
          }
          const pct = f.downloadTotal ? Math.round((f.downloaded / f.downloadTotal) * 100) : 0;
          setProgress(pct);
        } catch (e) {
          clearInterval(pollInterval);
          setStatus((e as Error).message);
        }
      }, 500);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <select value={mb} onChange={(e) => setMb(Number(e.target.value))} disabled={!!fetchId} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs">
          <option value={1}>1 MB</option>
          <option value={5}>5 MB</option>
          <option value={10}>10 MB</option>
        </select>
        <button onClick={start} disabled={!!fetchId} className={btn}>Start download</button>
      </div>
      {fetchId && <div className="text-xs text-slate-400">fetch id: {fetchId}</div>}
      {progress > 0 && <div className="w-full bg-slate-800 rounded overflow-hidden"><div className="bg-brand-500 h-2 transition-all" style={{ width: `${progress}%` }} /></div>}
      {progress > 0 && progress < 100 && <div className="text-xs text-slate-400">{progress}%</div>}
      <Out>{status}</Out>
    </div>
  );
}

// ────────────────────── Storage & files ──────────────────────

function CacheStorageDemo() {
  const [out, setOut] = useState('—');
  async function run() {
    if (!('caches' in window)) return setOut('unsupported');
    const keys = await caches.keys();
    setOut(`${keys.length} cache(s): ${keys.join(', ') || '(none)'}`);
  }
  return (
    <div>
      <button onClick={run} className={btn}>List caches</button>
      <Out>{out}</Out>
    </div>
  );
}

function StorageEstimateDemo() {
  const [out, setOut] = useState('—');
  async function run() {
    if (!navigator.storage?.estimate) return setOut('unsupported');
    const e = await navigator.storage.estimate();
    const used = ((e.usage ?? 0) / 1024 / 1024).toFixed(2);
    const quota = ((e.quota ?? 0) / 1024 / 1024 / 1024).toFixed(2);
    setOut(`used: ${used} MiB · quota: ${quota} GiB`);
  }
  return (
    <div>
      <button onClick={run} className={btn}>Estimate</button>
      <Out>{out}</Out>
    </div>
  );
}

function PersistentStorageDemo() {
  const [out, setOut] = useState('—');
  async function check() {
    if (!navigator.storage?.persisted) return setOut('unsupported');
    setOut(`persisted: ${await navigator.storage.persisted()}`);
  }
  async function req() {
    if (!navigator.storage?.persist) return setOut('unsupported');
    const ok = await navigator.storage.persist();
    setOut(`persist() → ${ok}`);
  }
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={check} className={btnGhost}>Check</button>
      <button onClick={req} className={btn}>Request</button>
      <Out>{out}</Out>
    </div>
  );
}

function FSAccessDemo() {
  const [out, setOut] = useState('—');
  async function pick() {
    const W = window as Window & { showOpenFilePicker?: () => Promise<FileSystemFileHandle[]> };
    if (!W.showOpenFilePicker) return setOut('unsupported');
    try {
      const [h] = await W.showOpenFilePicker();
      const f = await h.getFile();
      setOut(`${f.name} · ${f.size} bytes · ${f.type || 'unknown'}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={pick} className={btn}>Open file</button>
      <Out>{out}</Out>
    </div>
  );
}

function OPFSDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    if (!navigator.storage?.getDirectory) return setOut('unsupported');
    try {
      const root = await navigator.storage.getDirectory();
      const h = await root.getFileHandle('pwa-demo.txt', { create: true });
      const w = await (h as FileSystemFileHandle & { createWritable: () => Promise<WritableStream<string> & { write: (s: string) => Promise<void>; close: () => Promise<void> }> }).createWritable();
      const stamp = new Date().toISOString();
      await w.write(`written at ${stamp}`); await w.close();
      const f = await h.getFile();
      setOut(`wrote & read ${f.size} bytes from OPFS at ${stamp}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={go} className={btn}>Write & read</button>
      <Out>{out}</Out>
    </div>
  );
}

// ────────────────────── Networking ──────────────────────

function FetchDemo() {
  const [out, setOut] = useState('—');
  async function run() {
    try {
      const t0 = performance.now();
      const r = await fetch('/manifest.webmanifest', { cache: 'no-store' });
      const dt = (performance.now() - t0).toFixed(1);
      setOut(`${r.status} ${r.statusText} · ${dt} ms · ${r.headers.get('content-type') ?? '?'}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={run} className={btn}>GET /manifest.webmanifest</button>
      <Out>{out}</Out>
    </div>
  );
}

function NetworkInfoDemo() {
  type ConnLike = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  const conn = (navigator as Navigator & { connection?: ConnLike }).connection;
  const [info, setInfo] = useState<ConnLike | undefined>(conn);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: ConnLike & EventTarget }).connection;
    if (!c) return;
    const h = () => setInfo({ effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData });
    (c as EventTarget).addEventListener('change', h);
    return () => (c as EventTarget).removeEventListener('change', h);
  }, []);
  if (!conn) return <Out tone="err">unsupported</Out>;
  return <Out>type: {info?.effectiveType ?? '?'} · downlink: {info?.downlink ?? '?'} Mbps · rtt: {info?.rtt ?? '?'} ms · saveData: {String(info?.saveData ?? false)}</Out>;
}

function BeaconDemo() {
  const [out, setOut] = useState('—');
  function fire() {
    if (typeof navigator.sendBeacon !== 'function') return setOut('unsupported');
    const ok = navigator.sendBeacon('/__beacon__', new Blob([JSON.stringify({ at: Date.now() })], { type: 'application/json' }));
    setOut(`sendBeacon → ${ok} (fire-and-forget; endpoint may 404 — that's fine)`);
  }
  return (
    <div>
      <button onClick={fire} className={btn}>Send beacon</button>
      <Out>{out}</Out>
    </div>
  );
}

function WebTransportDemo() {
  return <Out>requires an HTTP/3 server. Detection only — try `new WebTransport(url)` in console.</Out>;
}

// ────────────────────── Hardware ──────────────────────

function permissionRequestDemo(label: string, run: () => Promise<string>) {
  return function Cmp() {
    const [out, setOut] = useState('—');
    async function go() {
      try { setOut(await run()); } catch (e) { setOut((e as Error).message); }
    }
    return (
      <div>
        <button onClick={go} className={btn}>{label}</button>
        <Out>{out}</Out>
      </div>
    );
  };
}

const BluetoothDemo = permissionRequestDemo('Request BLE device', async () => {
  type BT = { requestDevice: (o: { acceptAllDevices: boolean }) => Promise<{ name?: string; id: string }> };
  const bt = (navigator as Navigator & { bluetooth?: BT }).bluetooth;
  if (!bt) return 'unsupported';
  const d = await bt.requestDevice({ acceptAllDevices: true });
  return `paired: ${d.name ?? '(unnamed)'} · ${d.id}`;
});

const USBDemo = permissionRequestDemo('Request USB device', async () => {
  type USB = { requestDevice: (o: { filters: unknown[] }) => Promise<{ productName?: string; manufacturerName?: string }> };
  const u = (navigator as Navigator & { usb?: USB }).usb;
  if (!u) return 'unsupported';
  const d = await u.requestDevice({ filters: [] });
  return `paired: ${d.manufacturerName ?? '?'} ${d.productName ?? ''}`;
});

const SerialDemo = permissionRequestDemo('Request serial port', async () => {
  type Serial = { requestPort: () => Promise<{ getInfo: () => { usbVendorId?: number; usbProductId?: number } }> };
  const s = (navigator as Navigator & { serial?: Serial }).serial;
  if (!s) return 'unsupported';
  const p = await s.requestPort();
  const i = p.getInfo();
  return `paired: vendor ${i.usbVendorId ?? '?'} · product ${i.usbProductId ?? '?'}`;
});

const HIDDemo = permissionRequestDemo('Request HID device', async () => {
  type HID = { requestDevice: (o: { filters: unknown[] }) => Promise<{ productName?: string }[]> };
  const h = (navigator as Navigator & { hid?: HID }).hid;
  if (!h) return 'unsupported';
  const ds = await h.requestDevice({ filters: [] });
  return ds.length === 0 ? 'no device selected' : `paired: ${ds[0].productName ?? '?'}`;
});

function NFCDemo() {
  const [out, setOut] = useState('—');
  async function scan() {
    type Reader = new () => { scan: () => Promise<void>; onreading: ((e: { serialNumber: string }) => void) | null };
    const W = window as Window & { NDEFReader?: Reader };
    if (!W.NDEFReader) return setOut('unsupported');
    try {
      const r = new W.NDEFReader();
      await r.scan();
      r.onreading = (e) => setOut(`tag: ${e.serialNumber}`);
      setOut('scanning…');
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={scan} className={btn}>Scan NFC</button>
      <Out>{out}</Out>
    </div>
  );
}

// ────────────────────── Sensors ──────────────────────

function GeolocationDemo() {
  const [out, setOut] = useState('—');
  function get() {
    if (!navigator.geolocation) return setOut('unsupported');
    setOut('locating…');
    navigator.geolocation.getCurrentPosition(
      (p) => setOut(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} · ±${p.coords.accuracy.toFixed(0)} m`),
      (e) => setOut(`error: ${e.message}`),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }
  return (
    <div>
      <button onClick={get} className={btn}>Get position</button>
      <Out>{out}</Out>
    </div>
  );
}

function MotionDemo() {
  const [v, setV] = useState({ x: 0, y: 0, z: 0 });
  const [running, setRunning] = useState(false);
  async function start() {
    if (!('DeviceMotionEvent' in window)) return;
    const DM = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    if (typeof DM.requestPermission === 'function') {
      const p = await DM.requestPermission();
      if (p !== 'granted') return;
    }
    const h = (e: DeviceMotionEvent) => setV({
      x: e.accelerationIncludingGravity?.x ?? 0,
      y: e.accelerationIncludingGravity?.y ?? 0,
      z: e.accelerationIncludingGravity?.z ?? 0,
    });
    window.addEventListener('devicemotion', h);
    setRunning(true);
  }
  return (
    <div>
      <button onClick={start} className={btn} disabled={running}>Start</button>
      <Out>x: {v.x.toFixed(2)} · y: {v.y.toFixed(2)} · z: {v.z.toFixed(2)} m/s²</Out>
    </div>
  );
}

function OrientationDemo() {
  const [v, setV] = useState({ a: 0, b: 0, g: 0 });
  const [running, setRunning] = useState(false);
  async function start() {
    if (!('DeviceOrientationEvent' in window)) return;
    const DO = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (typeof DO.requestPermission === 'function') {
      const p = await DO.requestPermission();
      if (p !== 'granted') return;
    }
    window.addEventListener('deviceorientation', (e) => setV({ a: e.alpha ?? 0, b: e.beta ?? 0, g: e.gamma ?? 0 }));
    setRunning(true);
  }
  return (
    <div>
      <button onClick={start} className={btn} disabled={running}>Start</button>
      <Out>α (compass): {v.a.toFixed(1)}° · β (tilt fwd/back): {v.b.toFixed(1)}° · γ (tilt left/right): {v.g.toFixed(1)}°</Out>
    </div>
  );
}

function AmbientLightDemo() {
  type Sensor = new () => { addEventListener: (t: string, h: () => void) => void; start: () => void; illuminance: number };
  const W = window as Window & { AmbientLightSensor?: Sensor };
  const [lux, setLux] = useState<number | null>(null);
  const [out, setOut] = useState('—');
  function start() {
    if (!W.AmbientLightSensor) return setOut('unsupported');
    try {
      const s = new W.AmbientLightSensor();
      s.addEventListener('reading', () => setLux(s.illuminance));
      s.start();
      setOut('reading…');
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={start} className={btn}>Start</button>
      <Out>{lux == null ? out : `${lux} lux`}</Out>
    </div>
  );
}

function BatteryDemo() {
  const [info, setInfo] = useState<string>('—');
  async function go() {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; chargingTime: number; dischargingTime: number }> };
    if (!nav.getBattery) { setInfo('unsupported'); return; }
    const b = await nav.getBattery();
    const t = (s: number) => Number.isFinite(s) ? `${Math.round(s / 60)} min` : '∞';
    setInfo(`${(b.level * 100).toFixed(0)}% · ${b.charging ? 'charging' : 'on battery'} · to full: ${t(b.chargingTime)} · to empty: ${t(b.dischargingTime)}`);
  }
  return (
    <div>
      <button onClick={go} className={btn}>Read battery</button>
      <Out>{info}</Out>
    </div>
  );
}

// ────────────────────── Media ──────────────────────

function CameraDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (ref.current) ref.current.srcObject = s;
      setOut('streaming');
    } catch (e) { setOut((e as Error).message); }
  }
  function stop() {
    const s = ref.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (ref.current) ref.current.srcObject = null;
    setOut('stopped');
  }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={start} className={btn}>Start</button>
        <button onClick={stop} className={btnGhost}>Stop</button>
      </div>
      <video ref={ref} autoPlay playsInline muted className="w-full max-w-xs rounded bg-black/40" />
      <Out>{out}</Out>
    </div>
  );
}

function ScreenCaptureDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function start() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (ref.current) ref.current.srcObject = s;
      setOut('capturing');
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={start} className={btn}>Share screen</button>
      <video ref={ref} autoPlay playsInline muted className="w-full max-w-xs mt-2 rounded bg-black/40" />
      <Out>{out}</Out>
    </div>
  );
}

function PiPDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  async function go() {
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) return setOut('unsupported or disabled');
    try { await ref.current?.requestPictureInPicture(); setOut('opened'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <video ref={ref} autoPlay loop muted playsInline className="w-full max-w-xs rounded bg-black/40"
        src="/demo-video.webm" />
      <div className="mt-2"><button onClick={go} className={btn}>Open PiP</button></div>
      <Out>{out}</Out>
    </div>
  );
}

function MediaRecorderDemo() {
  const [out, setOut] = useState('idle');
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        const b = new Blob(chunks, { type: r.mimeType });
        setUrl(URL.createObjectURL(b));
        s.getTracks().forEach((t) => t.stop());
        setOut(`stopped · ${b.size} bytes`);
      };
      r.start(); recRef.current = r; setOut('recording…');
    } catch (e) { setOut((e as Error).message); }
  }
  function stop() { recRef.current?.stop(); }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={start} className={btn}>Record audio</button>
        <button onClick={stop} className={btnGhost}>Stop</button>
      </div>
      {url && <audio controls src={url} className="block max-w-xs" />}
      <Out>{out}</Out>
    </div>
  );
}

function WebRTCDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    const pc = new RTCPeerConnection();
    pc.createDataChannel('demo');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setOut(`local SDP created (${offer.sdp?.length} bytes) — full P2P needs a signaling channel.`);
    pc.close();
  }
  return (
    <div>
      <button onClick={go} className={btn}>Create offer</button>
      <Out>{out}</Out>
    </div>
  );
}

function WebCodecsDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    type Decoder = new (o: { output: () => void; error: (e: Error) => void }) => unknown;
    const W = window as unknown as { VideoDecoder?: Decoder; VideoEncoder?: { isConfigSupported: (c: { codec: string; width: number; height: number }) => Promise<{ supported: boolean }> } };
    if (!W.VideoDecoder || !W.VideoEncoder) return setOut('unsupported');
    const r = await W.VideoEncoder.isConfigSupported({ codec: 'vp8', width: 640, height: 480 });
    setOut(`VP8 640×480 encoder supported: ${r.supported}`);
  }
  return (
    <div>
      <button onClick={go} className={btn}>Probe encoder</button>
      <Out>{out}</Out>
    </div>
  );
}

// ────────────────────── Input & UX ──────────────────────

function ShareDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    if (typeof navigator.share !== 'function') return setOut('unsupported');
    try { await navigator.share({ title: 'PWA Demo', text: 'Check out what the web can do', url: location.href }); setOut('shared'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={go} className={btn}>Share this page</button>
      <Out>{out}</Out>
    </div>
  );
}

function ClipboardDemo() {
  const [text, setText] = useState('Hello from the PWA Demo · ' + new Date().toLocaleTimeString());
  const [read, setRead] = useState<string>('');
  const [out, setOut] = useState('—');
  async function write() {
    try { await navigator.clipboard.writeText(text); setOut('copied'); }
    catch (e) { setOut((e as Error).message); }
  }
  async function readIt() {
    try { setRead(await navigator.clipboard.readText()); setOut('read'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
      <div className="flex gap-2">
        <button onClick={write} className={btn}>Copy</button>
        <button onClick={readIt} className={btnGhost}>Paste</button>
      </div>
      {read && <div className="text-xs font-mono text-slate-300">paste: {read}</div>}
      <Out>{out}</Out>
    </div>
  );
}

function GamepadDemo() {
  const [pads, setPads] = useState<string[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const gs = navigator.getGamepads?.() ?? [];
      const lines: string[] = [];
      for (const g of gs) {
        if (!g) continue;
        const axes = g.axes.map((a) => a.toFixed(2)).join(', ');
        const buttons = g.buttons.map((b, i) => (b.pressed ? i : '')).filter(Boolean).join(',') || '—';
        lines.push(`${g.id} · axes [${axes}] · pressed [${buttons}]`);
      }
      setPads(lines);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <Out>{pads.length === 0 ? 'press any button on a connected controller' : pads.map((l, i) => <div key={i}>{l}</div>)}</Out>;
}

function SpeechSynDemo() {
  const [text, setText] = useState('Progressive web apps are surprisingly capable.');
  function speak() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  return (
    <div className="flex flex-col gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
      <div><button onClick={speak} className={btn}>Speak</button></div>
    </div>
  );
}

function SpeechRecDemo() {
  type Rec = new () => { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null; onerror: ((e: { error: string }) => void) | null };
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
      const lines = Array.from({ length: (e.results as unknown as { length: number }).length }, (_, i) => (e.results as unknown as { [k: number]: { 0: { transcript: string }; isFinal: boolean } })[i]);
      setOut(lines.map((l) => l[0].transcript).join(' '));
    };
    r.onerror = (e) => setOut(`error: ${e.error}`);
    r.start(); recRef.current = r; setRunning(true);
  }
  function stop() { recRef.current?.stop(); setRunning(false); }
  return (
    <div>
      <div className="flex gap-2 mb-1">
        <button onClick={start} className={btn} disabled={running}>Listen</button>
        <button onClick={stop} className={btnGhost} disabled={!running}>Stop</button>
      </div>
      <Out>{out}</Out>
    </div>
  );
}

function ContactsDemo() {
  const [out, setOut] = useState('—');
  async function pick() {
    type Picker = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
    const c = (navigator as Navigator & { contacts?: Picker }).contacts;
    if (!c?.select) return setOut('unsupported');
    try {
      const picks = await c.select(['name', 'tel'], { multiple: true });
      setOut(`${picks.length} picked: ${picks.map((p) => p.name?.[0] ?? '?').join(', ')}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={pick} className={btn}>Pick contacts</button>
      <Out>{out}</Out>
    </div>
  );
}

function EyeDropperDemo() {
  type ED = new () => { open: () => Promise<{ sRGBHex: string }> };
  const W = window as Window & { EyeDropper?: ED };
  const [color, setColor] = useState<string | null>(null);
  const [out, setOut] = useState('—');
  async function go() {
    if (!W.EyeDropper) return setOut('unsupported');
    try { const r = await new W.EyeDropper().open(); setColor(r.sRGBHex); setOut(r.sRGBHex); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={go} className={btn}>Pick color</button>
      {color && <span className="inline-block w-6 h-6 rounded border border-slate-600" style={{ background: color }} />}
      <Out>{out}</Out>
    </div>
  );
}

// ────────────────────── Identity & payments ──────────────────────

// WebAuthn helpers — base64url for moving Uint8Arrays through localStorage.
function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s: string): ArrayBuffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

const WEBAUTHN_CRED_KEY = 'demo:webauthn:credId';
const WEBAUTHN_USER_KEY = 'demo:webauthn:user';

function WebAuthnDemo() {
  // Self-contained register/authenticate demo. A real app verifies the
  // assertion server-side; here we just prove the browser can create and
  // assert a credential against the same origin. The credential ID lives
  // in localStorage so "sign in" works across reloads.
  const [username, setUsername] = useState('demo@example.com');
  const [storedUser, setStoredUser] = useState<string | null>(
    typeof window === 'undefined' ? null : window.localStorage.getItem(WEBAUTHN_USER_KEY),
  );
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

  async function register() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'PWA Demo', id: location.hostname },
          user: { id: userId, name: username, displayName: username },
          // ES256 + RS256 cover virtually every authenticator in the wild.
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
          attestation: 'none',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return setOut({ tone: 'err', msg: 'create() returned null' });
      const credId = b64uEncode(cred.rawId);
      window.localStorage.setItem(WEBAUTHN_CRED_KEY, credId);
      window.localStorage.setItem(WEBAUTHN_USER_KEY, username);
      setStoredUser(username);
      setOut({ tone: 'ok', msg: `registered passkey for ${username} (id: ${credId.slice(0, 12)}…)` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  async function authenticate() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    const credId = window.localStorage.getItem(WEBAUTHN_CRED_KEY);
    if (!credId) return setOut({ tone: 'err', msg: 'no credential — register first' });
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: b64uDecode(credId), type: 'public-key' }],
          userVerification: 'preferred',
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!assertion) return setOut({ tone: 'err', msg: 'get() returned null' });
      setOut({ tone: 'ok', msg: `signed in as ${storedUser} — assertion ${assertion.id.slice(0, 12)}…` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  function forget() {
    window.localStorage.removeItem(WEBAUTHN_CRED_KEY);
    window.localStorage.removeItem(WEBAUTHN_USER_KEY);
    setStoredUser(null);
    setOut({ tone: 'default', msg: 'cleared local credential (the authenticator still has it)' });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!!storedUser}
          placeholder="user@example.com"
          className="flex-1 min-w-[12rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono disabled:opacity-60"
        />
        <button onClick={register} disabled={!supported || !!storedUser} className={btn}>Register passkey</button>
        <button onClick={authenticate} disabled={!supported || !storedUser} className={btn}>Sign in</button>
        <button onClick={forget} disabled={!storedUser} className={btnGhost}>Forget</button>
      </div>
      <div className="text-[10px] text-slate-500">
        {storedUser ? `Saved credential for ${storedUser}` : 'No credential stored yet'}
      </div>
      <Out tone={out.tone}>{out.msg}</Out>
      <div className="mt-1.5">
        <RouteDemoLink to="/passkeys" label="Full demo (server verification + diagnostics)" />
      </div>
    </div>
  );
}

function PaymentDemo() {
  // basic-card was removed from Chromium in 2023, which is why the old probe
  // returned false on a working browser. Probe the modern URL-based methods
  // (Google Pay test env + Apple Pay) plus the legacy probe so users see
  // exactly what their browser does and doesn't accept. The Show sheet
  // button opens the real OS payment UI with a $0.01 placeholder — cancel
  // it; the demo never settles a charge.
  type ProbeResult = { method: string; canMake: boolean | null; err?: string };
  const [probes, setProbes] = useState<ProbeResult[]>([]);
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  const supported = typeof window !== 'undefined' && 'PaymentRequest' in window;

  // Methods covering the three realistic Chromium paths today plus the
  // legacy one so the probe shows the deprecation transparently.
  const methods: PaymentMethodData[] = [
    {
      supportedMethods: 'https://google.com/pay',
      data: {
        apiVersion: 2,
        apiVersionMinor: 0,
        merchantInfo: { merchantName: 'PWA Demo' },
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['VISA', 'MASTERCARD'],
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: { gateway: 'example', gatewayMerchantId: 'exampleGatewayMerchantId' },
          },
        }],
      },
    },
    { supportedMethods: 'https://apple.com/apple-pay' },
    { supportedMethods: 'basic-card' },
  ];

  const details: PaymentDetailsInit = {
    total: { label: 'PWA Demo (test)', amount: { currency: 'USD', value: '0.01' } },
    displayItems: [
      { label: 'Demo line item', amount: { currency: 'USD', value: '0.01' } },
    ],
  };

  async function probe() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    const results: ProbeResult[] = [];
    for (const m of methods) {
      try {
        const pr = new PaymentRequest([m], details);
        const can = await pr.canMakePayment();
        results.push({ method: m.supportedMethods, canMake: can });
      } catch (e) {
        results.push({ method: m.supportedMethods, canMake: null, err: (e as Error).message });
      }
    }
    setProbes(results);
    const anyOk = results.some((r) => r.canMake === true);
    setOut({
      tone: anyOk ? 'ok' : 'err',
      msg: anyOk ? 'at least one method is usable — try Show sheet' : 'no payment method available on this browser/OS',
    });
  }

  async function showSheet() {
    if (!supported) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      const pr = new PaymentRequest(methods, details, { requestPayerEmail: true });
      const response = await pr.show();
      // Demo only — never settle a real charge. We acknowledge the response
      // so the browser dismisses the sheet cleanly.
      await response.complete('success');
      setOut({ tone: 'ok', msg: `paid via ${response.methodName} (demo — no real charge)` });
    } catch (e) {
      const msg = (e as Error).message;
      const cancelled = /cancel|aborterror|the request has been cancelled/i.test(msg);
      setOut({ tone: cancelled ? 'default' : 'err', msg: cancelled ? 'sheet cancelled' : msg });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={probe} disabled={!supported} className={btn}>Probe methods</button>
        <button onClick={showSheet} disabled={!supported} className={btnGhost}>Show sheet ($0.01 test)</button>
      </div>
      {probes.length > 0 && (
        <div className="text-[10px] font-mono text-slate-400 space-y-0.5 bg-slate-950/60 border border-slate-800 rounded p-2">
          {probes.map((p) => (
            <div key={p.method} className="flex gap-2">
              <span className={p.canMake ? 'text-emerald-300' : p.canMake === false ? 'text-rose-300' : 'text-amber-300'}>
                {p.canMake === true ? '✓' : p.canMake === false ? '✗' : '!'}
              </span>
              <span className="truncate">{p.method}</span>
              <span className="text-slate-500">{p.err ? `(${p.err})` : ''}</span>
            </div>
          ))}
        </div>
      )}
      <Out tone={out.tone}>{out.msg}</Out>
    </div>
  );
}

function CredMgmtDemo() {
  // Browser-managed PASSWORD credentials (the original Credential Management
  // API — different from WebAuthn/passkeys above). Save triggers the
  // browser's "Save password?" prompt; Auto-fill triggers the account
  // chooser. Chromium-only: Firefox/Safari implement navigator.credentials
  // but not PasswordCredential, so the constructor is the supported check.
  const [username, setUsername] = useState('demo@example.com');
  const [password, setPassword] = useState('hunter2-demo');
  const [out, setOut] = useState<{ tone: 'default' | 'ok' | 'err'; msg: string }>({
    tone: 'default', msg: '—',
  });
  // PasswordCredential is non-standard in lib.dom — narrow via globalThis.
  type PasswordCredentialCtor = new (init: { id: string; password: string; name?: string }) => unknown;
  const W = window as Window & { PasswordCredential?: PasswordCredentialCtor };
  const supported = typeof window !== 'undefined' && typeof W.PasswordCredential === 'function';

  async function save() {
    if (!supported) return setOut({ tone: 'err', msg: 'PasswordCredential unsupported (Chromium only)' });
    try {
      const cred = new W.PasswordCredential!({ id: username, password, name: username });
      await navigator.credentials.store(cred as Credential);
      setOut({ tone: 'ok', msg: `stored — accept the browser prompt to confirm save for ${username}` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  async function autofill() {
    if (!('credentials' in navigator)) return setOut({ tone: 'err', msg: 'unsupported' });
    try {
      // `mediation: 'optional'` shows the account chooser only when a saved
      // credential matches this origin; 'required' forces it every time.
      const cred = (await navigator.credentials.get({
        password: true,
        mediation: 'optional',
      } as CredentialRequestOptions)) as (Credential & { id?: string; password?: string }) | null;
      if (!cred) return setOut({ tone: 'default', msg: 'no credential picked (user dismissed or none saved)' });
      setUsername(cred.id ?? '');
      setPassword(cred.password ?? '');
      setOut({ tone: 'ok', msg: `auto-filled credential for ${cred.id}` });
    } catch (e) {
      setOut({ tone: 'err', msg: (e as Error).message });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="username"
          className="flex-1 min-w-[10rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="password"
          className="flex-1 min-w-[10rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={!supported || !username || !password} className={btn}>Save to browser</button>
        <button onClick={autofill} className={btnGhost}>Auto-fill</button>
      </div>
      <Out tone={out.tone}>{out.msg}</Out>
    </div>
  );
}

function WebOTPDemo() {
  return <Out>Android Chrome only. Trigger flow on a real SMS-receiving device.</Out>;
}

// ────────────────────── Graphics & compute ──────────────────────

function WebGLDemo({ version }: { version: 1 | 2 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [out, setOut] = useState('—');
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const gl = (version === 2 ? c.getContext('webgl2') : c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) { setOut('context unavailable'); return; }
    gl.clearColor(0.12, 0.85, 0.55, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const ext = gl.getParameter(gl.VERSION);
    setOut(String(ext));
  }, [version]);
  return (
    <div>
      <canvas ref={ref} width={140} height={48} className="rounded border border-slate-700" />
      <Out>{out}</Out>
    </div>
  );
}

function WebGPUDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ requestDevice: () => Promise<unknown>; info?: { vendor?: string; architecture?: string } } | null> } }).gpu;
    if (!gpu) return setOut('unsupported');
    const a = await gpu.requestAdapter();
    if (!a) return setOut('no adapter');
    await a.requestDevice();
    setOut(`adapter: ${a.info?.vendor ?? '?'} / ${a.info?.architecture ?? '?'}`);
  }
  return (
    <div>
      <button onClick={go} className={btn}>Request adapter</button>
      <Out>{out}</Out>
    </div>
  );
}

function OffscreenDemo() {
  const [out, setOut] = useState('—');
  function go() {
    if (!('OffscreenCanvas' in window)) return setOut('unsupported');
    const c = new OffscreenCanvas(64, 64);
    const ctx = c.getContext('2d');
    if (!ctx) return setOut('no 2d context');
    ctx.fillStyle = '#0fa'; ctx.fillRect(0, 0, 64, 64);
    setOut(`drew on 64×64 offscreen canvas (${c.width}×${c.height})`);
  }
  return (
    <div>
      <button onClick={go} className={btn}>Render off-main</button>
      <Out>{out}</Out>
    </div>
  );
}

function WasmDemo() {
  const [out, setOut] = useState('—');
  async function go() {
    if (!('WebAssembly' in window)) return setOut('unsupported');
    // tiny wasm: a function `add(i32, i32) -> i32`. Hand-built bytes.
    const bytes = new Uint8Array([
      0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
      0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,
      0x03,0x02,0x01,0x00,
      0x07,0x07,0x01,0x03,0x61,0x64,0x64,0x00,0x00,
      0x0a,0x09,0x01,0x07,0x00,0x20,0x00,0x20,0x01,0x6a,0x0b,
    ]);
    const { instance } = await WebAssembly.instantiate(bytes);
    const add = (instance.exports.add as (a: number, b: number) => number);
    setOut(`add(40, 2) = ${add(40, 2)}`);
  }
  return (
    <div>
      <button onClick={go} className={btn}>Run wasm</button>
      <Out>{out}</Out>
    </div>
  );
}

function SABDemo() {
  const iso = (window as Window & { crossOriginIsolated?: boolean }).crossOriginIsolated;
  if (!('SharedArrayBuffer' in window)) return <Out tone="err">unsupported</Out>;
  if (!iso) return <Out tone="err">crossOriginIsolated is false — set COOP/COEP headers to enable.</Out>;
  return <Out tone="ok">crossOriginIsolated; SharedArrayBuffer available.</Out>;
}

// ────────────────────── registry ──────────────────────

/** Inline demo component by capability id. If undefined and the capability has
 *  a `demo` route on it, that route is rendered as a "Open demo →" link. */
export const INLINE_DEMOS: Record<string, () => React.JSX.Element> = {
  // Install & PWA
  'service-worker': ServiceWorkerDemo,
  'related-apps': RelatedAppsDemo,
  'launch-queue': LaunchQueueDemo,
  // Notifications
  'notifications': NotificationsDemo,
  'badging': BadgingDemo,
  'vibration': VibrationDemo,
  // Background & lifecycle
  'wake-lock': WakeLockDemo,
  'idle-detection': IdleDemo,
  'bg-sync': BgSyncDemo,
  'bg-fetch': BgFetchDemo,
  'page-lifecycle': PageLifecycleDemo,
  // Storage & files
  'cache-storage': CacheStorageDemo,
  'storage-quota': StorageEstimateDemo,
  'persistent-storage': PersistentStorageDemo,
  'fs-access': FSAccessDemo,
  'opfs': OPFSDemo,
  // Networking
  'fetch': FetchDemo,
  'webtransport': WebTransportDemo,
  'network-info': NetworkInfoDemo,
  'beacon': BeaconDemo,
  // Hardware
  'bluetooth': BluetoothDemo,
  'usb': USBDemo,
  'serial': SerialDemo,
  'hid': HIDDemo,
  'nfc': NFCDemo,
  // Sensors
  'geolocation': GeolocationDemo,
  'motion': MotionDemo,
  'orientation': OrientationDemo,
  'ambient-light': AmbientLightDemo,
  'battery': BatteryDemo,
  // Media
  'getusermedia': CameraDemo,
  'screen-capture': ScreenCaptureDemo,
  'media-recorder': MediaRecorderDemo,
  'webrtc': WebRTCDemo,
  'pip': PiPDemo,
  'webcodecs': WebCodecsDemo,
  // Input & UX
  'web-share': ShareDemo,
  'clipboard': ClipboardDemo,
  'gamepad': GamepadDemo,
  'speech-rec': SpeechRecDemo,
  'speech-syn': SpeechSynDemo,
  'contacts': ContactsDemo,
  'eyedropper': EyeDropperDemo,
  // Identity & payments
  'webauthn': WebAuthnDemo,
  'webotp': WebOTPDemo,
  'cred-mgmt': CredMgmtDemo,
  'payment-request': PaymentDemo,
  // Graphics & compute
  'webgl': () => <WebGLDemo version={1} />,
  'webgl2': () => <WebGLDemo version={2} />,
  'webgpu': WebGPUDemo,
  'offscreen': OffscreenDemo,
  'wasm': WasmDemo,
  'sab': SABDemo,
};

// ────────────────────── link card (used by route demos) ──────────────────────

export function RouteDemoLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200 text-xs font-medium">
      {label} →
    </Link>
  );
}

