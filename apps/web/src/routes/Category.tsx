import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CAPABILITIES, CATEGORIES, type Capability, type Category, type Support } from '../lib/capabilities';
import { INLINE_DEMOS } from '../lib/demos';

const STATUS_DOT: Record<Support, string> = {
  supported: 'bg-emerald-400',
  partial: 'bg-amber-400',
  unsupported: 'bg-rose-500',
  unknown: 'bg-slate-500',
};
const STATUS_LABEL: Record<Support, string> = {
  supported: 'supported',
  partial: 'partial',
  unsupported: 'unsupported',
  unknown: 'checking',
};

function categoryFromSlug(slug: string): Category | null {
  for (const c of CATEGORIES) if (slugify(c) === slug) return c;
  return null;
}

function slugify(c: string): string {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export { slugify };

export default function CategoryPage() {
  const { cat } = useParams<{ cat: string }>();
  const category = cat ? categoryFromSlug(cat) : null;

  const caps = useMemo(
    () => (category ? CAPABILITIES.filter((c) => c.category === category) : []),
    [category],
  );

  const [statuses, setStatuses] = useState<Record<string, Support>>(() =>
    Object.fromEntries(caps.map((c) => [c.id, c.check()])),
  );

  useEffect(() => {
    setStatuses(Object.fromEntries(caps.map((c) => [c.id, c.check()])));
    let cancelled = false;
    (async () => {
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.ready.catch(() => null)
        : null;
      const updates: Record<string, Support> = {};
      for (const cap of caps) {
        if (cap.refine) {
          try { updates[cap.id] = await cap.refine(reg); }
          catch { updates[cap.id] = 'unknown'; }
        }
      }
      if (!cancelled) setStatuses((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [caps]);

  if (!category) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Unknown category</h1>
        <p className="text-slate-400 mb-4">No category named <code>{cat}</code>.</p>
        <Link to="/" className="text-brand-300 hover:text-brand-200">← Back to overview</Link>
      </div>
    );
  }

  const counts = caps.reduce(
    (acc, c) => { acc[statuses[c.id] ?? 'unknown']++; return acc; },
    { supported: 0, partial: 0, unsupported: 0, unknown: 0 } as Record<Support, number>,
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-2 text-xs">
        <Link to="/" className="text-slate-400 hover:text-slate-200">← Overview</Link>
      </div>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h1 className="text-3xl font-bold">{category}</h1>
        <div className="text-sm text-slate-400 font-mono">
          {counts.supported}/{caps.length} supported{counts.partial ? ` · ${counts.partial} partial` : ''}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Live feature detection. Each tile runs an actual demo of the capability against this browser — try them.
      </p>

      <div className="space-y-3">
        {caps.map((cap) => (
          <FeatureCard key={cap.id} cap={cap} status={statuses[cap.id] ?? 'unknown'} />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ cap, status }: { cap: Capability; status: Support }) {
  const Demo = INLINE_DEMOS[cap.id];
  const unsupported = status === 'unsupported';
  return (
    <section
      className={`bg-slate-900 border rounded-lg ${
        status === 'supported' ? 'border-emerald-500/30'
        : status === 'partial' ? 'border-amber-500/40'
        : status === 'unsupported' ? 'border-rose-500/30'
        : 'border-slate-800'
      }`}
    >
      <header className="flex items-start gap-2 px-4 py-3 border-b border-slate-800/60">
        <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium truncate">{cap.name}</div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-snug mt-0.5">{cap.description}</div>
        </div>
      </header>

      <div className="px-4 py-3">
        {cap.demo ? (
          <Link
            to={cap.demo}
            className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200 text-sm font-medium"
          >
            Open full demo →
          </Link>
        ) : Demo ? (
          unsupported ? (
            <div className="text-xs text-slate-500 italic">
              demo unavailable — this browser doesn't expose the API
            </div>
          ) : (
            <Demo />
          )
        ) : (
          <div className="text-xs text-slate-500 italic">no interactive demo yet</div>
        )}

        {cap.ref && (
          <div className="mt-2">
            <a href={cap.ref} target="_blank" rel="noreferrer" className="text-[11px] text-slate-500 hover:text-slate-300">
              MDN reference ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
