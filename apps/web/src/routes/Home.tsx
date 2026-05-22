import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CAPABILITIES, CATEGORIES, type Capability, type Category, type Support } from '../lib/capabilities';
import { INLINE_DEMOS } from '../lib/demos';
import { slugify } from './Category';

/** Standalone routes that aren't tied to a single capability check.
 *  Each one is offered as a featured demo at the top of its category. */
const STANDALONE_DEMOS: Array<{ to: string; title: string; blurb: string; category: Category }> = [
  { to: '/game',       title: 'Tower (multiplayer)', blurb: '3D climbing game over socket.io.',                      category: 'Graphics & compute' },
  { to: '/worker',     title: 'Web Worker bench',   blurb: 'Heavy compute on/off the main thread, side-by-side.',  category: 'Graphics & compute' },
  { to: '/indexed-db', title: 'IndexedDB bench',    blurb: 'Memory vs LocalStorage vs IndexedDB on 5 query types.', category: 'Storage & files' },
  { to: '/status',     title: 'Live status',        blurb: 'Realtime list of connected clients (socket.io).',       category: 'Networking' },
  { to: '/push',       title: 'Web Push',           blurb: 'Subscribe to push and receive a notification.',         category: 'Notifications' },
  { to: '/manifest',   title: 'Install playground', blurb: 'Manifest, install state, display mode in real time.',   category: 'Install & PWA' },
];

export default function Home() {
  const [statuses, setStatuses] = useState<Record<string, Support>>(() =>
    Object.fromEntries(CAPABILITIES.map((c) => [c.id, c.check()])),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.ready.catch(() => null)
        : null;
      const updates: Record<string, Support> = {};
      for (const cap of CAPABILITIES) {
        if (cap.refine) {
          try { updates[cap.id] = await cap.refine(reg); }
          catch { updates[cap.id] = 'unknown'; }
        }
      }
      if (!cancelled) setStatuses((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => {
    const c: Record<Support, number> = { supported: 0, partial: 0, unsupported: 0, unknown: 0 };
    for (const cap of CAPABILITIES) c[statuses[cap.id]]++;
    return c;
  }, [statuses]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">PWA Demo</h1>
      <p className="text-slate-400 mb-1">
        Every web platform capability we cover, grouped by category. Each tile counts what this
        browser actually supports — click in to try a live demo of each.
      </p>
      <div className="text-xs text-slate-500 mb-8 font-mono truncate">{navigator.userAgent}</div>

      <Summary totals={totals} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat} category={cat} statuses={statuses} />
        ))}
      </div>

      <div className="mt-12 text-xs text-slate-500">
        Tip: install the app from your browser (Chrome: address bar install icon) to unlock OS integration.
      </div>
    </div>
  );
}

function Summary({ totals }: { totals: Record<Support, number> }) {
  const all = CAPABILITIES.length;
  const pct = Math.round((totals.supported / all) * 100);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center gap-4">
      <div>
        <div className="text-3xl font-bold">{totals.supported}<span className="text-slate-600 text-xl">/{all}</span></div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">features supported · {pct}%</div>
      </div>
      <div className="h-12 w-px bg-slate-800 hidden sm:block" />
      <div className="flex gap-4 text-xs">
        <Pip count={totals.supported} label="supported" dot="bg-emerald-400" />
        {totals.partial > 0 && <Pip count={totals.partial} label="partial" dot="bg-amber-400" />}
        <Pip count={totals.unsupported} label="unsupported" dot="bg-rose-500" />
        {totals.unknown > 0 && <Pip count={totals.unknown} label="checking" dot="bg-slate-500" />}
      </div>
    </div>
  );
}

function Pip({ count, label, dot }: { count: number; label: string; dot: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span className="font-mono text-slate-200">{count}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

function CategoryCard({ category, statuses }: { category: Category; statuses: Record<string, Support> }) {
  const caps = CAPABILITIES.filter((c) => c.category === category);
  const counts = caps.reduce(
    (acc, c) => { acc[statuses[c.id] ?? 'unknown']++; return acc; },
    { supported: 0, partial: 0, unsupported: 0, unknown: 0 } as Record<Support, number>,
  );
  const standalone = STANDALONE_DEMOS.filter((d) => d.category === category);
  const inlineDemos = caps.filter((c) => INLINE_DEMOS[c.id]);

  return (
    <Link
      to={`/category/${slugify(category)}`}
      className="block bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg p-4 transition group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold">{category}</div>
        <div className="text-xs font-mono shrink-0">
          <span className="text-emerald-300">{counts.supported}</span>
          <span className="text-slate-600">/{caps.length}</span>
          {counts.partial > 0 && <span className="text-amber-300 ml-1">+{counts.partial}</span>}
        </div>
      </div>

      <SupportBar caps={caps} statuses={statuses} />

      {standalone.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Featured demo{standalone.length > 1 ? 's' : ''}</div>
          <ul className="space-y-1">
            {standalone.map((d) => (
              <li key={d.to} className="text-xs">
                <span className="text-brand-300 font-medium">{d.title}</span>
                <span className="text-slate-500"> — {d.blurb}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          Interactive demos · {inlineDemos.length}
        </div>
        <div className="flex flex-wrap gap-1">
          {caps.slice(0, 10).map((c) => (
            <Chip key={c.id} cap={c} status={statuses[c.id] ?? 'unknown'} hasDemo={!!INLINE_DEMOS[c.id] || !!c.demo} />
          ))}
          {caps.length > 10 && (
            <span className="text-[10px] text-slate-500 self-center">+{caps.length - 10} more</span>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 group-hover:text-slate-300 transition">
        Explore {category.toLowerCase()} →
      </div>
    </Link>
  );
}

function SupportBar({ caps, statuses }: { caps: Capability[]; statuses: Record<string, Support> }) {
  return (
    <div className="flex h-1.5 rounded overflow-hidden bg-slate-800">
      {caps.map((c) => {
        const s = statuses[c.id] ?? 'unknown';
        const cls =
          s === 'supported' ? 'bg-emerald-400'
          : s === 'partial' ? 'bg-amber-400'
          : s === 'unsupported' ? 'bg-rose-500'
          : 'bg-slate-600';
        return <div key={c.id} className={`flex-1 ${cls}`} title={`${c.name}: ${s}`} />;
      })}
    </div>
  );
}

function Chip({ cap, status, hasDemo }: { cap: Capability; status: Support; hasDemo: boolean }) {
  const dot =
    status === 'supported' ? 'bg-emerald-400'
    : status === 'partial' ? 'bg-amber-400'
    : status === 'unsupported' ? 'bg-rose-500'
    : 'bg-slate-500';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
        hasDemo ? 'border-slate-700 bg-slate-950/60' : 'border-slate-800 bg-slate-900/40 opacity-60'
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-slate-300">{cap.name}</span>
    </span>
  );
}
