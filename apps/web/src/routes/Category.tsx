import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CAPABILITIES, CATEGORIES, slugifyCategory, type Capability, type Category, type Support } from '../lib/capabilities';
import { INLINE_DEMOS } from '../lib/demos';
import { useCapabilityStatuses } from '../lib/useCapabilityStatuses';
import { useHashScrollHighlight } from '../components/DemoSidebar';

/** Standalone routes that aren't tied to a single capability check.
 *  Kept in sync with Home.tsx — both files surface these. */
const STANDALONE_DEMOS: Array<{ to: string; title: string; blurb: string; category: Category }> = [
  {
    to: '/game',
    title: 'Tower Climb',
    blurb: '3D multiplayer climb. three.js + react-three-fiber, socket.io for realtime sync.',
    category: 'Graphics & compute',
  },
  {
    to: '/speech-echo',
    title: 'Speech Echo Loop',
    blurb: 'Speak into the mic — live transcription on the left, TTS readback on the right. Pick any installed voice.',
    category: 'Input & UX',
  },
];

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
  const demoCount = caps.filter((c) => INLINE_DEMOS[c.id] || c.demo).length;

  const visible = caps.filter((c) => {
    if (filter === 'supported') return statuses[c.id] === 'supported' || statuses[c.id] === 'partial';
    if (filter === 'with-demo') return !!INLINE_DEMOS[c.id] || !!c.demo;
    return true;
  });

  // Find prev/next category for footer nav
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
        Live feature detection. Each tile runs an actual demo of the capability against this browser — try them.
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

      {STANDALONE_DEMOS.filter((d) => d.category === category).map((d) => (
        <Link
          key={d.to}
          to={d.to}
          className="block mb-4 bg-gradient-to-br from-brand-600/20 to-slate-900 hover:from-brand-500/30 border border-brand-500/40 hover:border-brand-400 rounded-lg p-4 transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-300 text-xs">★</span>
            <div className="font-semibold text-brand-100 group-hover:text-white">{d.title}</div>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">Featured</span>
          </div>
          <div className="text-xs text-slate-400 leading-snug">{d.blurb}</div>
          <div className="mt-2 text-xs text-brand-300 group-hover:text-brand-200">Play now →</div>
        </Link>
      ))}

      {visible.length === 0 ? (
        <div className="text-sm text-slate-500 italic border border-dashed border-slate-800 rounded-lg p-6 text-center">
          Nothing matches this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((cap) => (
            <FeatureCard key={cap.id} cap={cap} status={statuses[cap.id] ?? 'unknown'} />
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

function FeatureCard({ cap, status }: { cap: Capability; status: Support }) {
  const Demo = INLINE_DEMOS[cap.id];
  const unsupported = status === 'unsupported';
  return (
    <section
      id={cap.id}
      className={`scroll-mt-4 transition-shadow bg-slate-900 border rounded-lg ${
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
            <a
              href={`#${cap.id}`}
              className="font-medium truncate hover:text-brand-200 transition"
              title="Direct link to this demo"
            >
              {cap.name}
            </a>
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
