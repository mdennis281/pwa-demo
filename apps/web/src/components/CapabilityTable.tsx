import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CATEGORIES, CAPABILITIES, type Capability, type Support } from '../lib/capabilities';

type Filter = 'all' | Support;

const STATUS_LABEL: Record<Support, string> = {
  supported: 'supported',
  partial: 'partial',
  unsupported: 'unsupported',
  unknown: 'checking',
};

const STATUS_DOT: Record<Support, string> = {
  supported: 'bg-emerald-400',
  partial: 'bg-amber-400',
  unsupported: 'bg-rose-500',
  unknown: 'bg-slate-500',
};

const STATUS_BORDER: Record<Support, string> = {
  supported: 'border-emerald-500/30',
  partial: 'border-amber-500/40',
  unsupported: 'border-rose-500/30',
  unknown: 'border-slate-700',
};

export default function CapabilityTable() {
  const [statuses, setStatuses] = useState<Record<string, Support>>(() =>
    Object.fromEntries(CAPABILITIES.map((c) => [c.id, c.check()])),
  );
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.ready.catch(() => null)
        : null;
      const updates: Record<string, Support> = {};
      for (const cap of CAPABILITIES) {
        if (cap.refine) {
          try {
            updates[cap.id] = await cap.refine(reg);
          } catch {
            updates[cap.id] = 'unknown';
          }
        }
      }
      if (!cancelled) setStatuses((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Support, number> = { supported: 0, partial: 0, unsupported: 0, unknown: 0 };
    for (const cap of CAPABILITIES) c[statuses[cap.id]]++;
    return c;
  }, [statuses]);

  const visible = filter === 'all' ? CAPABILITIES : CAPABILITIES.filter((c) => statuses[c.id] === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <FilterChip current={filter} value="all"         label="All"          count={CAPABILITIES.length} onSelect={setFilter} />
        <FilterChip current={filter} value="supported"   label="Supported"    count={counts.supported}    onSelect={setFilter} tone="emerald" />
        <FilterChip current={filter} value="partial"     label="Partial"      count={counts.partial}      onSelect={setFilter} tone="amber" />
        <FilterChip current={filter} value="unsupported" label="Unsupported"  count={counts.unsupported}  onSelect={setFilter} tone="rose" />
        {counts.unknown > 0 && (
          <FilterChip current={filter} value="unknown"   label="Checking"     count={counts.unknown}      onSelect={setFilter} tone="slate" />
        )}
      </div>

      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const caps = visible.filter((c) => c.category === cat);
          if (caps.length === 0) return null;
          return (
            <section key={cat}>
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">{cat}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {caps.map((cap) => (
                  <Tile key={cap.id} cap={cap} status={statuses[cap.id]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Tile({ cap, status }: { cap: Capability; status: Support }) {
  const body = (
    <div className={`bg-slate-900 border ${STATUS_BORDER[status]} rounded-lg px-3 py-2.5 h-full transition hover:bg-slate-800/80`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm truncate">{cap.name}</div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">{STATUS_LABEL[status]}</span>
          </div>
          <div className="text-xs text-slate-400 leading-snug mt-0.5">{cap.description}</div>
        </div>
      </div>
    </div>
  );
  return cap.demo ? <Link to={cap.demo} className="block focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg">{body}</Link> : body;
}

function FilterChip({
  current, value, label, count, onSelect, tone = 'brand',
}: {
  current: Filter;
  value: Filter;
  label: string;
  count: number;
  onSelect: (v: Filter) => void;
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const active = current === value;
  const toneCls = {
    brand:   'bg-brand-500 text-slate-950',
    emerald: 'bg-emerald-500 text-slate-950',
    amber:   'bg-amber-400 text-slate-950',
    rose:    'bg-rose-500 text-white',
    slate:   'bg-slate-600 text-white',
  }[tone];
  return (
    <button
      onClick={() => onSelect(value)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
        active ? toneCls : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
      }`}
    >
      {label} <span className="opacity-70">· {count}</span>
    </button>
  );
}
