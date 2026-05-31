import { useEffect, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function BgSyncDemo() {
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
    } catch (e) {
      setOut((e as Error).message);
    }
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
    const id = window.setInterval(pollQueue, 2000);
    pollQueue();
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Btn onClick={registerSync}>Register sync</Btn>
        <Btn variant="ghost" onClick={pollQueue}>Refresh</Btn>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            submit while offline{fakeOffline ? ' — offline' : ''}:
          </div>
          <Btn variant="ghost" onClick={() => setFakeOffline((v) => !v)}>
            {fakeOffline ? 'Go online' : 'Go offline'}
          </Btn>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitItem()}
            placeholder="message"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
          />
          <Btn onClick={submitItem}>Submit</Btn>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="text-xs bg-slate-800/40 border border-slate-700 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
          <div className="text-slate-400 font-mono text-[10px]">queue ({queue.length}):</div>
          {queue.map((item) => (
            <div
              key={item.id}
              className={`font-mono text-[10px] ${item.synced ? 'text-emerald-300' : 'text-amber-300'}`}
            >
              {item.synced ? '✓' : '◴'} {item.msg} · {new Date(item.at).toLocaleTimeString()}
            </div>
          ))}
        </div>
      )}

      <Out>{out}</Out>
      {lastSync && <Out tone="ok">last sync: {lastSync}</Out>}
      <div className="text-xs text-slate-500">
        toggle offline mode, submit items, then go back online to flush the queue
      </div>
    </div>
  );
}
