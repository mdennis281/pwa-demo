import { useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BgFetchDemo() {
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
      const bgManager = (reg as ServiceWorkerRegistration & {
        backgroundFetch?: {
          fetch: (
            id: string,
            urls: string[],
            opts: { icons: Array<{ src: string; sizes: string; type: string }>; title: string },
          ) => Promise<{ id: string }>;
        };
      }).backgroundFetch;

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
        <select
          value={mb}
          onChange={(e) => setMb(Number(e.target.value))}
          disabled={!!fetchId}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
        >
          <option value={1}>1 MB</option>
          <option value={5}>5 MB</option>
          <option value={10}>10 MB</option>
        </select>
        <Btn onClick={start} disabled={!!fetchId}>Start download</Btn>
      </div>
      {fetchId && <div className="text-xs text-slate-400">fetch id: {fetchId}</div>}
      {progress > 0 && (
        <div className="w-full bg-slate-800 rounded overflow-hidden">
          <div className="bg-brand-500 h-2 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="text-xs text-slate-400">{progress}%</div>
      )}
      <Out>{status}</Out>
    </div>
  );
}
