import { useCallback, useEffect, useState } from 'react';
import { DemoPage } from '../_DemoPage';
import { Btn } from '../_shared/ui';
import { readHistory, clearHistory, SW_HISTORY_MAX, type SwVersionRecord } from '../../lib/swHistoryDb';
import { querySwInfo } from '../../lib/swLifecycle';
import { applyUpdate, checkForUpdate } from '../../lib/pwa';

/* ═══════════════════════════════════════════════════════════════════════════
 * Service Worker Lifecycle
 *
 * Correlates the version the page bundle was built at (__APP_VERSION__) with
 * the version the *active* SW reports over postMessage, the caches that SW owns
 * and their on-disk size, the install/wait/activate timing of the current
 * version, and the full history of every SW version this device has installed
 * (persisted to the `sw-history` IndexedDB store by sw.ts + lib/swLifecycle.ts).
 * ═══════════════════════════════════════════════════════════════════════════ */

const PAGE_VERSION = __APP_VERSION__;
const PAGE_BUILD_TIME = __BUILD_TIME__;

type CacheInfo = { name: string; bucket: string; version: string | null; count: number; bytes: number };

type Snapshot = {
  supported: boolean;
  scope?: string;
  updateViaCache?: string;
  controllerState?: string;
  installingState?: string;
  waitingState?: string;
  activeState?: string;
  activeVersion?: string | null;
  waitingVersion?: string | null;
};

/* ── formatting ──────────────────────────────────────────────────────────── */

function fmtMs(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function fmtBytes(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtTime(epoch: number | undefined): string {
  if (epoch == null) return '—';
  return new Date(epoch).toLocaleString();
}

function fmtRelative(epoch: number | undefined): string {
  if (epoch == null) return '—';
  const s = (Date.now() - epoch) / 1000;
  if (s < 0) return 'just now';
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

/* ── lifecycle phase math ────────────────────────────────────────────────── */

type Phases =
  | { source: 'page'; install: number; waiting: number; activate: number; total: number }
  | { source: 'sw'; installWait: number; activate?: number; total: number }
  | { source: 'none' };

/**
 * Prefer the fine page-observed split (installing→installed→activating→
 * activated). Fall back to the SW's own install/activate event bracket, which
 * can only separate "install + wait" from "activate". Same wall clock (one
 * device), so cross-source subtraction is sound.
 */
function phasesFor(rec: SwVersionRecord | undefined): Phases {
  if (!rec) return { source: 'none' };
  const { installingAt, installedAt, activatingAt, activatedAt, controlledAt } = rec;
  if (installingAt != null && installedAt != null && activatingAt != null && activatedAt != null) {
    return {
      source: 'page',
      install: installedAt - installingAt,
      waiting: activatingAt - installedAt,
      activate: activatedAt - activatingAt,
      total: (controlledAt ?? activatedAt) - installingAt,
    };
  }
  if (rec.installAt != null && rec.activateAt != null) {
    return {
      source: 'sw',
      installWait: rec.activateAt - rec.installAt,
      activate: rec.activateDoneAt != null ? rec.activateDoneAt - rec.activateAt : undefined,
      total: (rec.activateDoneAt ?? rec.activateAt) - rec.installAt,
    };
  }
  return { source: 'none' };
}

/** One-line phase breakdown for the history table. */
function phaseDetail(p: Phases): string {
  if (p.source === 'page') return `install ${fmtMs(p.install)} · wait ${fmtMs(p.waiting)} · activate ${fmtMs(p.activate)}`;
  if (p.source === 'sw') return `install+wait ${fmtMs(p.installWait)} · activate ${fmtMs(p.activate)}`;
  return '—';
}

/* ── caches ──────────────────────────────────────────────────────────────── */

function classifyCache(name: string): { bucket: string; version: string | null } {
  if (name.startsWith('workbox-precache')) return { bucket: 'precache', version: null };
  const m = /^(api|assets)-(.+)$/.exec(name);
  if (m) return { bucket: m[1], version: m[2] };
  return { bucket: 'other', version: null };
}

async function readCaches(): Promise<CacheInfo[]> {
  if (!('caches' in window)) return [];
  const names = await caches.keys();
  const infos: CacheInfo[] = [];
  for (const name of names) {
    const cache = await caches.open(name);
    const reqs = await cache.keys();
    let bytes = 0;
    // Read bodies STRICTLY ONE AT A TIME. Reading them concurrently — even a
    // small pool — keeps several response bodies in flight at once; under that
    // memory pressure the browser aborts some reads, which surfaced here as a
    // total that was a random fraction of the real size and changed every run.
    // Awaiting each blob() before starting the next keeps a single body in
    // memory at a time, so every entry is counted and the number is stable.
    // blob().size gives the decoded body length (can be disk-backed, so it
    // doesn't pin a large ArrayBuffer in the JS heap). The cache is local —
    // this stays well under a second even for the full precache.
    for (const req of reqs) {
      const res = await cache.match(req);
      if (!res) continue;
      try {
        bytes += (await res.blob()).size;
      } catch {
        // Unreadable (e.g. opaque cross-origin) body — fall back to the
        // declared length so it still contributes something to the total.
        const len = Number(res.headers.get('content-length'));
        if (Number.isFinite(len)) bytes += len;
      }
    }
    infos.push({ name, ...classifyCache(name), count: reqs.length, bytes });
  }
  // precache first, then runtime, then by name
  const order: Record<string, number> = { precache: 0, assets: 1, api: 2, other: 3 };
  return infos.sort((a, b) => (order[a.bucket] - order[b.bucket]) || a.name.localeCompare(b.name));
}

/* ── small UI atoms ──────────────────────────────────────────────────────── */

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800 last:border-b-0 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono text-right break-all">{children}</span>
    </div>
  );
}

const PHASE_COLOR: Record<string, string> = {
  install: 'bg-brand-500',
  waiting: 'bg-amber-500',
  activate: 'bg-emerald-500',
  'install+wait': 'bg-brand-500',
};

/** Proportional horizontal timeline of the lifecycle phases. */
function TimelineBar({ phases }: { phases: Phases }) {
  if (phases.source === 'none') {
    return <div className="text-sm text-slate-500">No lifecycle timing recorded for this version yet.</div>;
  }
  const segs =
    phases.source === 'page'
      ? [
          { key: 'install', ms: phases.install },
          { key: 'waiting', ms: phases.waiting },
          { key: 'activate', ms: phases.activate },
        ]
      : [
          { key: 'install+wait', ms: phases.installWait },
          { key: 'activate', ms: phases.activate ?? 0 },
        ];
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md border border-slate-800">
        {segs.map((s) => (
          <div
            key={s.key}
            className={`${PHASE_COLOR[s.key]} min-w-[3px]`}
            style={{ flexGrow: Math.max(s.ms, 0.001) }}
            title={`${s.key}: ${fmtMs(s.ms)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-slate-300">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${PHASE_COLOR[s.key]}`} />
            <span className="capitalize">{s.key}</span>
            <span className="font-mono text-slate-400">{fmtMs(s.ms)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <span className="text-slate-500">total</span>
          <span className="font-mono">{fmtMs(phases.total)}</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {phases.source === 'page'
          ? 'Measured client-side from the registration statechange stream.'
          : 'Derived from the SW’s own install / activate events (no tab was open to observe the finer split).'}
      </p>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */

export default function ServiceWorkerDemo() {
  const [snap, setSnap] = useState<Snapshot>({ supported: true });
  const [cacheList, setCacheList] = useState<CacheInfo[] | null>(null);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [history, setHistory] = useState<SwVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'update' | 'caches'>(null);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setSnap({ supported: false });
      setLoading(false);
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const controller = navigator.serviceWorker.controller;
    const [activeVersion, waitingVersion] = await Promise.all([
      querySwInfo(controller ?? reg?.active),
      reg?.waiting ? querySwInfo(reg.waiting) : Promise.resolve(null),
    ]);
    setSnap({
      supported: true,
      scope: reg?.scope,
      updateViaCache: reg?.updateViaCache,
      controllerState: controller?.state,
      installingState: reg?.installing?.state,
      waitingState: reg?.waiting?.state,
      activeState: reg?.active?.state,
      activeVersion: activeVersion?.version ?? null,
      waitingVersion: waitingVersion?.version ?? null,
    });
    setHistory(await readHistory());
    setLoading(false);
  }, []);

  const refreshCaches = useCallback(async () => {
    setBusy('caches');
    try {
      const [list, est] = await Promise.all([
        readCaches(),
        navigator.storage?.estimate?.() ?? Promise.resolve(null),
      ]);
      setCacheList(list);
      setEstimate(est ? { usage: est.usage, quota: est.quota } : null);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshCaches();
  }, [refresh, refreshCaches]);

  async function onCheckUpdate() {
    setBusy('update');
    try {
      await checkForUpdate();
      // Give a freshly-found worker a beat to reach "installing" before re-reading.
      await new Promise((r) => setTimeout(r, 600));
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onClearHistory() {
    await clearHistory(snap.activeVersion ?? PAGE_VERSION);
    await refresh();
  }

  if (!snap.supported) {
    return (
      <DemoPage id="service-worker" title="Service Worker Lifecycle" blurb="Service workers are unsupported in this browser.">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-rose-300">
          <code className="font-mono">serviceWorker</code> is not available — the rest of this demo needs it.
        </div>
      </DemoPage>
    );
  }

  const inSync = snap.activeVersion != null && snap.activeVersion === PAGE_VERSION;
  const hasUpdate = snap.waitingVersion != null && snap.waitingVersion !== snap.activeVersion;
  const activeRec =
    history.find((h) => h.version === snap.activeVersion) ??
    history.find((h) => h.version === PAGE_VERSION);
  const activePhases = phasesFor(activeRec);
  const totalCacheBytes = cacheList?.reduce((sum, c) => sum + c.bytes, 0);

  return (
    <DemoPage
      id="service-worker"
      title="Service Worker Lifecycle"
      blurb="Version correlation, caches, install/activate timing, and the full history of every SW this device has run."
      maxWidth="5xl"
    >
      {/* ── Version correlation ───────────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-400">Version correlation</h2>
          <div className="flex items-center gap-2">
            {hasUpdate ? (
              <Pill tone="warn">update waiting · {snap.waitingVersion}</Pill>
            ) : inSync ? (
              <Pill tone="ok">page &amp; SW in sync</Pill>
            ) : snap.activeVersion ? (
              <Pill tone="warn">version skew</Pill>
            ) : (
              <Pill tone="muted">no controller</Pill>
            )}
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <Field label="page bundle">{PAGE_VERSION}</Field>
          <Field label="active SW reports">{snap.activeVersion ?? '—'}</Field>
          <Field label="page built">{fmtTime(Date.parse(PAGE_BUILD_TIME) || undefined)}</Field>
          <Field label="waiting SW">{snap.waitingVersion ?? 'none'}</Field>
          <Field label="scope">{snap.scope ?? '—'}</Field>
          <Field label="updateViaCache">{snap.updateViaCache ?? '—'}</Field>
          <Field label="controller">{snap.controllerState ?? 'none'}</Field>
          <Field label="active / waiting / installing">
            {[snap.activeState, snap.waitingState, snap.installingState].map((s) => s ?? '—').join(' / ')}
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={onCheckUpdate} disabled={busy === 'update'}>
            {busy === 'update' ? 'Checking…' : 'Check for update'}
          </Btn>
          {hasUpdate && (
            <Btn variant="ghost" onClick={() => applyUpdate()}>
              Apply update &amp; reload
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => void refresh()}>
            Refresh
          </Btn>
        </div>
      </section>

      {/* ── Lifecycle timing (active version) ─────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-1 text-sm font-medium text-slate-400">
          Lifecycle timing — {activeRec?.version ?? snap.activeVersion ?? PAGE_VERSION}
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          How long the current worker spent installing (precaching the app), waiting behind the old worker, and activating.
        </p>
        <TimelineBar phases={activePhases} />
        {activeRec && (
          <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <Field label="install event">{fmtTime(activeRec.installAt)}</Field>
            <Field label="activate event">{fmtTime(activeRec.activateAt)}</Field>
            <Field label="took control">{fmtTime(activeRec.controlledAt)}</Field>
            <Field label="installs of this version">{String(activeRec.installCount ?? 1)}</Field>
          </div>
        )}
      </section>

      {/* ── Caches ────────────────────────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-slate-400">Caches owned by the service worker</h2>
          <Btn variant="ghost" onClick={() => void refreshCaches()} disabled={busy === 'caches'}>
            {busy === 'caches' ? 'Measuring…' : 'Re-measure'}
          </Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500">
                <th className="px-3 py-2">Cache</th>
                <th className="px-3 py-2">Bucket</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2 text-right">Entries</th>
                <th className="px-3 py-2 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {cacheList == null ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    measuring…
                  </td>
                </tr>
              ) : cacheList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    no caches
                  </td>
                </tr>
              ) : (
                cacheList.map((c) => {
                  const isCurrent = c.version != null && c.version === (snap.activeVersion ?? PAGE_VERSION);
                  return (
                    <tr key={c.name} className="border-t border-slate-800">
                      <td className="px-3 py-2 font-mono text-slate-200 break-all">{c.name}</td>
                      <td className="px-3 py-2">
                        <Pill tone={c.bucket === 'precache' ? 'muted' : isCurrent ? 'ok' : 'warn'}>{c.bucket}</Pill>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{c.version ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{c.count}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtBytes(c.bytes)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {cacheList && cacheList.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700 text-slate-200">
                  <td className="px-3 py-2 font-medium" colSpan={3}>
                    Cache Storage total
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {cacheList.reduce((n, c) => n + c.count, 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtBytes(totalCacheBytes)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {estimate && (
          <p className="mt-3 text-xs text-slate-500">
            Origin storage estimate: <span className="font-mono text-slate-300">{fmtBytes(estimate.usage)}</span> used of{' '}
            <span className="font-mono text-slate-300">{fmtBytes(estimate.quota)}</span> quota (all storage, not just caches).
          </p>
        )}
      </section>

      {/* ── Version history ───────────────────────────────────────────────── */}
      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-slate-400">Version history</h2>
            <p className="text-xs text-slate-500">
              The {SW_HISTORY_MAX} most recent SW builds this device has installed, persisted to the{' '}
              <span className="font-mono">sw-history</span> IndexedDB store (oldest pruned past {SW_HISTORY_MAX}).
            </p>
          </div>
          {history.length > 0 && (
            <Btn variant="ghost" onClick={() => void onClearHistory()}>
              Clear history
            </Btn>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500">
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Built</th>
                <th className="px-3 py-2">Installed</th>
                <th className="px-3 py-2 text-right">To control</th>
                <th className="px-3 py-2">Phase breakdown</th>
                <th className="px-3 py-2 text-right">Installs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    loading…
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    no versions recorded yet
                  </td>
                </tr>
              ) : (
                history.map((rec) => {
                  const p = phasesFor(rec);
                  const isActive = rec.version === snap.activeVersion;
                  const isWaiting = rec.version === snap.waitingVersion && !isActive;
                  return (
                    <tr key={rec.version} className={`border-t border-slate-800 ${isActive ? 'bg-emerald-500/5' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{rec.version}</span>
                          {isActive && <Pill tone="ok">active</Pill>}
                          {isWaiting && <Pill tone="warn">waiting</Pill>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400" title={rec.buildTime ?? ''}>
                        {rec.buildTime ? new Date(rec.buildTime).toLocaleDateString() : '—'}
                      </td>
                      <td
                        className="px-3 py-2 text-slate-300"
                        title={fmtTime(rec.installAt ?? rec.firstSeenAt)}
                      >
                        {fmtRelative(rec.installAt ?? rec.firstSeenAt)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {p.source === 'none' ? '—' : fmtMs(p.total)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{phaseDetail(p)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{rec.installCount ?? 1}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DemoPage>
  );
}
