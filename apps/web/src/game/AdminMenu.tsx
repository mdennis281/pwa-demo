import { useEffect, useRef, useState } from 'react';
import type { LobbyState, AdminResult } from '@pwa-demo/shared';
import { getSocket } from '../lib/socket';

export default function AdminMenu({
  open,
  lobby,
  selfId,
  snapPings,
  onClose,
}: {
  open: boolean;
  lobby: LobbyState;
  selfId: string;
  /** ping per player id from latest snapshot */
  snapPings: Record<string, number | null>;
  onClose: () => void;
}) {
  const [serverName, setServerName] = useState(lobby.name);
  const [playerCap, setPlayerCap] = useState(lobby.maxPlayers);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const nameRef = useRef(lobby.name);

  // Sync when lobby name/cap changes externally
  useEffect(() => {
    setServerName(lobby.name);
    nameRef.current = lobby.name;
  }, [lobby.name]);
  useEffect(() => { setPlayerCap(lobby.maxPlayers); }, [lobby.maxPlayers]);

  if (!open) return null;

  function doAction(payload: { type: 'kick'; targetId: string } | { type: 'pause'; paused: boolean } | { type: 'config'; maxPlayers?: number; name?: string }) {
    getSocket().emit('admin:action', payload, (res: AdminResult) => {
      if (!res.ok) setMsg(`Error: ${res.error}`);
    });
  }

  function handleSaveConfig() {
    setSaving(true);
    getSocket().emit(
      'admin:action',
      { type: 'config', maxPlayers: playerCap, name: serverName.trim() || lobby.name },
      (res: AdminResult) => {
        setSaving(false);
        setMsg(res.ok ? 'Settings saved.' : `Error: ${res.error}`);
        setTimeout(() => setMsg(null), 2500);
      },
    );
  }

  function handleKick(targetId: string) {
    doAction({ type: 'kick', targetId });
  }

  function handlePause() {
    doAction({ type: 'pause', paused: !lobby.paused });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-950 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-base">Admin Panel</h2>
            <p className="text-slate-500 text-xs mt-0.5">Ctrl+A to toggle</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none px-1"
            aria-label="Close admin panel"
          >
            ×
          </button>
        </div>

        {/* pause / play */}
        <section className="space-y-2">
          <h3 className="text-slate-400 text-[10px] uppercase tracking-wider">game control</h3>
          <button
            type="button"
            onClick={handlePause}
            className={`w-full py-2 rounded-lg text-sm font-medium transition ${
              lobby.paused
                ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
            }`}
          >
            {lobby.paused ? '▶ Resume game' : '⏸ Pause game'}
          </button>
        </section>

        {/* server settings */}
        <section className="space-y-3">
          <h3 className="text-slate-400 text-[10px] uppercase tracking-wider">server settings</h3>
          <label className="block">
            <span className="text-xs text-slate-400">server name</span>
            <input
              type="text"
              value={serverName}
              maxLength={40}
              onChange={(e) => setServerName(e.target.value)}
              className="mt-1 block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">player cap (1–16)</span>
            <input
              type="number"
              min={1}
              max={16}
              value={playerCap}
              onChange={(e) => setPlayerCap(Number(e.target.value))}
              className="mt-1 block w-28 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
          {msg && <p className="text-xs text-slate-400">{msg}</p>}
        </section>

        {/* player list */}
        <section className="space-y-2">
          <h3 className="text-slate-400 text-[10px] uppercase tracking-wider">
            connected players ({lobby.players.length})
          </h3>
          <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
            {lobby.players.map((p) => {
              const ping = snapPings[p.id];
              const isSelf = p.id === selfId;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 bg-slate-900/50 text-sm"
                >
                  <div className="min-w-0">
                    <span className={isSelf ? 'text-brand-400' : 'text-slate-200'}>
                      {p.isHost && <span className="text-amber-400 mr-1">★</span>}
                      {p.displayName}
                    </span>
                    {isSelf && <span className="text-slate-500 text-xs ml-1">(you)</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PingBadge ping={ping ?? null} />
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleKick(p.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs px-2 py-0.5 rounded border border-rose-500/30 hover:border-rose-400/50 transition"
                      >
                        kick
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function PingBadge({ ping }: { ping: number | null }) {
  if (ping === null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const color =
    ping < 80 ? 'text-emerald-400' : ping < 150 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`font-mono text-xs tabular-nums ${color}`}>{ping}ms</span>;
}
