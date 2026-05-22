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

function WCODemo() {
  const wco = (navigator as Navigator & { windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect: () => DOMRect } }).windowControlsOverlay;
  if (!wco) return <Out tone="err">unsupported</Out>;
  const r = wco.getTitlebarAreaRect?.();
  return <Out>visible: {String(wco.visible)} · titlebar: {r ? `${r.width.toFixed(0)}×${r.height.toFixed(0)}` : '—'}</Out>;
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
  async function go() {
    const reg = await navigator.serviceWorker?.ready;
    const r = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
    if (!r?.sync) return setOut('unsupported (SW + SyncManager required)');
    try { await r.sync.register('demo-sync'); setOut('sync registered (tag: demo-sync)'); }
    catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={go} className={btn}>Register sync</button>
      <Out>{out}</Out>
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
        src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4" />
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

function WebAuthnDemo() {
  const [out, setOut] = useState('—');
  async function check() {
    const W = window as Window & { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } };
    if (!W.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return setOut('unsupported');
    const ok = await W.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    setOut(`platform authenticator available: ${ok}`);
  }
  return (
    <div>
      <button onClick={check} className={btn}>Check platform authenticator</button>
      <Out>{out}</Out>
    </div>
  );
}

function PaymentDemo() {
  const [out, setOut] = useState('—');
  async function check() {
    if (!('PaymentRequest' in window)) return setOut('unsupported');
    try {
      const pr = new PaymentRequest(
        [{ supportedMethods: 'basic-card' }],
        { total: { label: 'Demo', amount: { currency: 'USD', value: '0.00' } } },
      );
      const canMake = await pr.canMakePayment();
      setOut(`canMakePayment(basic-card): ${canMake}`);
    } catch (e) { setOut((e as Error).message); }
  }
  return (
    <div>
      <button onClick={check} className={btn}>Probe</button>
      <Out>{out}</Out>
    </div>
  );
}

function CredMgmtDemo() {
  return <Out>navigator.credentials present. Try `navigator.credentials.get(...)` to read a stored credential.</Out>;
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
  'wco': WCODemo,
  'launch-queue': LaunchQueueDemo,
  // Notifications
  'notifications': NotificationsDemo,
  'badging': BadgingDemo,
  'vibration': VibrationDemo,
  // Background & lifecycle
  'wake-lock': WakeLockDemo,
  'idle-detection': IdleDemo,
  'bg-sync': BgSyncDemo,
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

