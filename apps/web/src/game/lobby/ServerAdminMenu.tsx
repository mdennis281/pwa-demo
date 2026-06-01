import { useEffect, useState } from 'react';
import { DEFAULT_SERVER_CONFIG, type AuthStatus, type ServerConfig } from '@pwa-demo/shared';
import { clearLeaderboard, elevateAdmin, getServerConfig, getSocket, hasAdminToken, logoutAdmin, setServerConfig } from '../../lib/socket';

/**
 * Server-browser admin menu — the fleet-level counterpart to the in-game
 * [`AdminMenu`](../AdminMenu.tsx). Opened from the shield icon in the lobby
 * browser header. Two states, driven by whether the socket is an elevated
 * admin (probed via `admin:get-config`, so it's correct regardless of
 * auth:status timing):
 *
 *  - **not elevated** → a token field that calls `admin:elevate` (token is
 *    persisted to localStorage by the socket lib, so it survives reloads).
 *  - **elevated** → controls for the always-on dedicated servers: master
 *    on/off, how many run, and the per-server player cap. Applying persists to
 *    the `server_config` DB table and reconciles the live fleet server-side.
 */

type Mode = 'loading' | 'need-token' | 'ready';

export default function ServerAdminMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('loading');

  // Decide need-token vs ready whenever the panel opens. The probe (admin:get-
  // config) is the source of truth, but on a fresh connection the socket lib's
  // auto-replay of a stored token (admin:elevate) can still be in flight — so
  // if we hold a token but aren't authorized *yet*, stay 'loading' and let
  // auth:status (or a short fallback) resolve it, rather than flashing the
  // token form at an already-elevated admin.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMode('loading');

    const probe = () =>
      getServerConfig().then((res) => {
        if (cancelled) return;
        if (res.ok) setMode('ready');
        else if (!hasAdminToken()) setMode('need-token');
        // else: stored token, not authorized yet — wait it out.
      });

    void probe();

    const s = getSocket();
    const onAuth = (st: AuthStatus) => {
      if (st.isAdmin) void probe();
      else if (!cancelled && !hasAdminToken()) setMode('need-token');
    };
    s.on('auth:status', onAuth);

    // Fallback: by now any auto-elevation has settled (or the stored token was
    // rejected and cleared) — take the server's answer as final either way.
    const t = window.setTimeout(() => {
      void getServerConfig().then((res) => {
        if (!cancelled) setMode(res.ok ? 'ready' : 'need-token');
      });
    }, 1200);

    return () => { cancelled = true; s.off('auth:status', onAuth); window.clearTimeout(t); };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-950 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-amber-300" /> Server Admin
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">dedicated server fleet controls</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-lg leading-none px-1"
            aria-label="Close server admin"
          >
            ×
          </button>
        </div>

        {mode === 'loading' && <p className="text-slate-500 text-sm py-4 text-center">checking…</p>}
        {mode === 'need-token' && <ElevateForm onElevated={() => setMode('ready')} />}
        {mode === 'ready' && <DedicatedControls onLoggedOut={() => setMode('need-token')} />}
      </div>
    </div>
  );
}

// ─── elevation ────────────────────────────────────────────────────────────

function ElevateForm({ onElevated }: { onElevated: () => void }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleElevate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    const res = await elevateAdmin(trimmed);
    setBusy(false);
    if (res.ok) {
      setToken('');
      onElevated();
    } else {
      setErr(res.error);
    }
  }

  return (
    <form onSubmit={handleElevate} className="space-y-3">
      <p className="text-slate-400 text-xs">
        Enter the admin token to manage the dedicated servers. It's remembered on
        this device so you stay elevated across sessions.
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => { setToken(e.target.value); if (err) setErr(null); }}
        placeholder="ADMIN_TOKEN"
        autoComplete="off"
        autoFocus
        className="block w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
      />
      <button
        type="submit"
        disabled={!token.trim() || busy}
        className="w-full py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition"
      >
        {busy ? 'verifying…' : 'Elevate'}
      </button>
      {err && <p className="text-rose-400 text-xs">{err}</p>}
    </form>
  );
}

// ─── dedicated-server controls ──────────────────────────────────────────────

function DedicatedControls({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [config, setConfig] = useState<ServerConfig>(DEFAULT_SERVER_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getServerConfig().then((res) => {
      if (cancelled) return;
      if (res.ok) setConfig(res.config);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleApply() {
    setSaving(true);
    setMsg(null);
    const res = await setServerConfig(config);
    setSaving(false);
    if (res.ok) {
      setConfig(res.config); // reflect server-side clamping
      setMsg('Applied.');
      setTimeout(() => setMsg(null), 2500);
    } else {
      setMsg(`Error: ${res.error}`);
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    onLoggedOut();
  }

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-slate-400 text-[10px] uppercase tracking-wider">dedicated servers</h3>

        <Toggle
          label="Run dedicated servers"
          help="Master switch. Off = Quick Play is unavailable, no Official Servers."
          checked={config.dedicatedEnabled}
          onChange={(v) => setConfig((c) => ({ ...c, dedicatedEnabled: v }))}
        />

        <div className={config.dedicatedEnabled ? '' : 'opacity-40 pointer-events-none'}>
          <label className="block">
            <span className="text-xs text-slate-400">servers running (1–50)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={config.dedicatedCount}
              disabled={!config.dedicatedEnabled}
              onChange={(e) => setConfig((c) => ({ ...c, dedicatedCount: Number(e.target.value) }))}
              className="mt-1 block w-28 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-slate-400">players per server (1–1000)</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={config.dedicatedPlayerCap}
            onChange={(e) => setConfig((c) => ({ ...c, dedicatedPlayerCap: Number(e.target.value) }))}
            className="mt-1 block w-28 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-slate-500"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleApply}
            disabled={saving || !loaded}
            className="px-4 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Applying…' : 'Apply'}
          </button>
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
        </div>
      </section>

      <DangerZone />

      <section className="border-t border-slate-800 pt-3 flex items-center justify-between">
        <span className="text-emerald-300 text-[11px]">★ admin (this device)</span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-0.5 rounded border border-rose-500/30 hover:border-rose-400/50 transition"
        >
          exit admin
        </button>
      </section>
    </>
  );
}

// ─── danger zone ────────────────────────────────────────────────────────────

/** Irreversible, fleet-wide actions. Currently just "clear leaderboard", which
 *  truncates the persistent `tower_high_scores` table. Guarded by a two-step
 *  arm/confirm so a stray click can't wipe it — the first click arms, a second
 *  (within the window) commits, and the result auto-clears the armed state. */
function DangerZone() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClear() {
    if (!armed) {
      setArmed(true);
      setMsg(null);
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await clearLeaderboard();
    setBusy(false);
    setArmed(false);
    if (res.ok) {
      setMsg('Leaderboard cleared.');
      setTimeout(() => setMsg(null), 2500);
    } else {
      setMsg(`Error: ${res.error}`);
    }
  }

  return (
    <section className="border-t border-slate-800 pt-3 space-y-2">
      <h3 className="text-rose-400/80 text-[10px] uppercase tracking-wider">danger zone</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleClear}
          disabled={busy}
          className="px-4 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Clearing…' : armed ? 'Confirm — wipe all scores?' : 'Clear leaderboard'}
        </button>
        {armed && !busy && (
          <button
            type="button"
            onClick={() => { setArmed(false); setMsg(null); }}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
          >
            cancel
          </button>
        )}
        {msg && <span className="text-xs text-slate-400">{msg}</span>}
      </div>
      <p className="text-slate-500 text-xs">
        Permanently deletes every saved high score. This can't be undone.
      </p>
    </section>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────────

function Toggle({
  label, help, checked, onChange,
}: {
  label: string; help?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-10 h-5 rounded-full transition relative shrink-0 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <div className="min-w-0">
        <div className="font-medium text-slate-100 text-sm">{label}</div>
        {help && <div className="text-xs text-slate-400">{help}</div>}
      </div>
    </label>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
