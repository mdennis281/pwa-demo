import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CAPABILITIES, CATEGORIES, slugifyCategory, type Capability, type Category, type Support } from '../lib/capabilities';
import { useCapabilityStatuses } from '../lib/useCapabilityStatuses';
import { useHashScrollHighlight } from '../components/DemoSidebar';
import { demosForCapability } from '../demos/_registry';
import { useFavorites } from '../demos/_favorites';
import { OpenDemoLink } from '../demos/_OpenDemo';
import { StarButton } from '../demos/_StarButton';
import type { DemoSpec } from '../demos/_types';

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
  for (const c of CATEGORIES) if (slugifyCategory(c) === slug) return c;
  return null;
}

type FilterMode = 'all' | 'supported' | 'with-demo';

export default function CategoryPage() {
  const { cat } = useParams<{ cat: string }>();
  const category = cat ? categoryFromSlug(cat) : null;
  const statuses = useCapabilityStatuses();
  const [filter, setFilter] = useState<FilterMode>('all');
  useHashScrollHighlight();

  const caps = useMemo(
    () => (category ? CAPABILITIES.filter((c) => c.category === category) : []),
    [category],
  );

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
  const demoCount = caps.filter((c) => demosForCapability(c.id).length > 0).length;

  const visible = caps.filter((c) => {
    if (filter === 'supported') return statuses[c.id] === 'supported' || statuses[c.id] === 'partial';
    if (filter === 'with-demo') return demosForCapability(c.id).length > 0;
    return true;
  });

  const idx = CATEGORIES.indexOf(category);
  const prev = idx > 0 ? CATEGORIES[idx - 1] : null;
  const next = idx < CATEGORIES.length - 1 ? CATEGORIES[idx + 1] : null;

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
      <p className="text-sm text-slate-500 mb-4">
        Each capability is feature-detected. The chips below each row open the demo that exercises it —
        modal demos open in an overlay; page demos open a new view.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All <span className="opacity-60">· {caps.length}</span>
        </Chip>
        <Chip active={filter === 'supported'} onClick={() => setFilter('supported')} tone="emerald">
          Supported <span className="opacity-60">· {counts.supported + counts.partial}</span>
        </Chip>
        <Chip active={filter === 'with-demo'} onClick={() => setFilter('with-demo')} tone="brand">
          Has demo <span className="opacity-60">· {demoCount}</span>
        </Chip>
      </div>

      {visible.length === 0 ? (
        <div className="text-sm text-slate-500 italic border border-dashed border-slate-800 rounded-lg p-6 text-center">
          Nothing matches this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((cap) => (
            <CapabilityRow key={cap.id} cap={cap} status={statuses[cap.id] ?? 'unknown'} />
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
        {prev ? (
          <Link to={`/category/${slugifyCategory(prev)}`} className="text-slate-400 hover:text-brand-200">
            ← {prev}
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/category/${slugifyCategory(next)}`} className="text-slate-400 hover:text-brand-200 ml-auto">
            {next} →
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}

function CapabilityRow({ cap, status }: { cap: Capability; status: Support }) {
  const demos = demosForCapability(cap.id);
  return (
    <section
      id={cap.id}
      className={`scroll-mt-4 bg-slate-900 border rounded-lg px-4 py-3 ${
        status === 'supported' ? 'border-emerald-500/30'
        : status === 'partial' ? 'border-amber-500/40'
        : status === 'unsupported' ? 'border-rose-500/30'
        : 'border-slate-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <a href={`#${cap.id}`} className="font-medium truncate hover:text-brand-200 transition" title="Direct link">
              {cap.name}
            </a>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
              {STATUS_LABEL[status]}
            </span>
          </div>
          <div className="text-xs text-slate-400 leading-snug mt-0.5">{cap.description}</div>

          {demos.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {demos.map((d) => (
                <DemoChip key={d.id} demo={d} disabled={status === 'unsupported' && d.type === 'modal'} />
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-slate-600 italic">no interactive demo</div>
          )}

          {cap.ref && (
            <a href={cap.ref} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[10px] text-slate-500 hover:text-slate-300">
              MDN reference ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function DemoChip({ demo, disabled }: { demo: DemoSpec; disabled?: boolean }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(demo.id);

  if (disabled) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-slate-800 bg-slate-900/40 text-slate-600 opacity-60"
        title="API unsupported in this browser"
      >
        {demo.title}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center group">
      <OpenDemoLink
        demo={demo}
        className="inline-flex items-center px-2 py-1 rounded-l text-[11px] border border-slate-700 bg-slate-950/60 text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition"
      >
        {demo.title}
      </OpenDemoLink>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(demo.id); }}
        aria-label={fav ? 'Remove favorite' : 'Add favorite'}
        title={fav ? 'Remove favorite' : 'Add favorite'}
        className={`inline-flex items-center justify-center w-6 h-[26px] rounded-r border border-l-0 border-slate-700 bg-slate-950/60 hover:bg-slate-800 transition text-[11px] ${
          fav ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'
        }`}
      >
        {fav ? '★' : '☆'}
      </button>
    </span>
  );
}

function Chip({
  active, onClick, children, tone = 'slate',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'brand';
}) {
  const activeCls = {
    slate: 'bg-slate-200 text-slate-900',
    emerald: 'bg-emerald-500 text-slate-950',
    brand: 'bg-brand-500 text-slate-950',
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
        active ? `${activeCls} border-transparent` : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
