import { useEffect, useState } from 'react';
import type { ClientInfo } from '@pwa-demo/shared';
import { getSocket } from '../lib/socket';

export default function Status() {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [selfId, setSelfId] = useState<string | undefined>();

  useEffect(() => {
    const s = getSocket();
    setSelfId(s.id);
    s.emit('status:join');

    const onUpdate = (list: ClientInfo[]) => setClients(list);
    const onConnect = () => {
      setSelfId(s.id);
      s.emit('status:join');
    };
    s.on('clients:update', onUpdate);
    s.on('connect', onConnect);

    const ping = window.setInterval(() => s.emit('ping:probe', Date.now()), 5000);

    return () => {
      s.emit('status:leave');
      s.off('clients:update', onUpdate);
      s.off('connect', onConnect);
      window.clearInterval(ping);
    };
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Live clients</h1>
      <p className="text-slate-400 mb-6">
        Real-time list of every websocket-connected client. Open this page in another tab or device — it should appear here.
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-400">
            <tr>
              <th className="text-left px-4 py-2">id</th>
              <th className="text-left px-4 py-2">user agent</th>
              <th className="text-right px-4 py-2">connected</th>
              <th className="text-right px-4 py-2">ping</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-slate-600 text-center">no clients connected yet</td></tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className={`border-t border-slate-800 ${c.id === selfId ? 'bg-brand-600/10' : ''}`}>
                <td className="px-4 py-2 font-mono text-xs">{c.id.slice(0, 8)}{c.id === selfId && <span className="ml-1 text-brand-400">(you)</span>}</td>
                <td className="px-4 py-2 text-slate-400 truncate max-w-md">{shortUA(c.userAgent)}</td>
                <td className="px-4 py-2 text-right text-slate-400">{since(c.connectedAt)}</td>
                <td className="px-4 py-2 text-right font-mono">{c.lastPingMs == null ? '—' : `${c.lastPingMs} ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        total: <span className="text-slate-300">{clients.length}</span>
      </p>
    </div>
  );
}

function shortUA(ua: string): string {
  const m = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/g);
  if (m) return m.join(' · ');
  return ua.slice(0, 60);
}

function since(t: number): string {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
