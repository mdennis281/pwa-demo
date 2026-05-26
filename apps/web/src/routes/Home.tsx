import { useMemo } from 'react';
import { Link } from 'react-router';
import { CAPABILITIES, CATEGORIES, slugifyCategory, type Capability, type Category, type Support } from '../lib/capabilities';
import { useCapabilityStatuses } from '../lib/useCapabilityStatuses';
import InstallPrompt from '../components/InstallPrompt';
import { DEMOS, demosForCapability, demosForCategory } from '../demos/_registry';
import { useFavorites } from '../demos/_favorites';
import { OpenDemoLink } from '../demos/_OpenDemo';
import { StarButton } from '../demos/_StarButton';

export default function Home() {
  const statuses = useCapabilityStatuses();
  const { favorites, toggle } = useFavorites();

  const totals = useMemo(() => {
    const c: Record<Support, number> = { supported: 0, partial: 0, unsupported: 0, unknown: 0 };
    for (const cap of CAPABILITIES) c[statuses[cap.id]]++;
    return c;
  }, [statuses]);

  const favoriteDemos = useMemo(
    () => DEMOS.filter((d) => favorites.has(d.id)),
    [favorites],
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">PWA Demo</h1>
      <p className="text-slate-400 mb-1">
        Every web platform capability we cover, grouped by category. Each tile counts what this
        browser actually supports — click in to try a live demo of each.
      </p>
      <div className="text-xs text-slate-500 mb-8 font-mono truncate">{navigator.userAgent}</div>

      <Summary totals={totals} />

      <InstallPrompt />

      {favoriteDemos.length > 0 && (
        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-2">★ Favorites</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteDemos.map((d) => (
              <FavoriteCard key={d.id} demo={d} onUnfavorite={() => toggle(d.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat} category={cat} statuses={statuses} />
        ))}
      </div>
    </div>
  );
}

function FavoriteCard({ demo, onUnfavorite }: { demo: (typeof DEMOS)[number]; onUnfavorite: () => void }) {
  return (
    <div className="relative">
      <OpenDemoLink
        demo={demo}
        className="block bg-gradient-to-br from-amber-500/10 to-slate-900 hover:from-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 rounded-lg p-4 transition group"
      >
        <div className="flex items-start gap-2 mb-1">
          <div className="font-semibold text-slate-100 group-hover:text-white truncate">{demo.title}</div>
        </div>
        <div className="text-xs text-slate-400 leading-snug line-clamp-2">{demo.blurb}</div>
        <div className="mt-2 text-xs text-brand-300 group-hover:text-brand-200">Open →</div>
      </OpenDemoLink>
      <div className="absolute top-2 right-2">
        <StarButton on size="sm" onClick={onUnfavorite} />
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
  const demos = demosForCategory(category);
  const demosWithCap = caps.filter((c) => demosForCapability(c.id).length > 0).length;

  return (
    <Link
      to={`/category/${slugifyCategory(category)}`}
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

      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          {demos.length} demo{demos.length === 1 ? '' : 's'} · {demosWithCap}/{caps.length} caps covered
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 group-hover:text-slate-300 transition">
        Explore {category.toLowerCase()} →
      </div>
    </Link>
  );
}

function SupportBar({ caps, statuses }: { caps: Capability[]; statuses: Record<string, Support> }) {
  const buckets = caps.reduce(
    (acc, c) => { acc[statuses[c.id] ?? 'unknown']++; return acc; },
    { supported: 0, partial: 0, unsupported: 0, unknown: 0 } as Record<Support, number>,
  );
  const total = caps.length || 1;
  const seg = (n: number, cls: string, label: string) =>
    n > 0 ? <div key={cls} className={cls} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${label}`} /> : null;
  return (
    <div className="flex h-2 rounded overflow-hidden bg-slate-800">
      {seg(buckets.supported,   'bg-emerald-400', 'supported')}
      {seg(buckets.partial,     'bg-amber-400',   'partial')}
      {seg(buckets.unsupported, 'bg-rose-500',    'unsupported')}
      {seg(buckets.unknown,     'bg-slate-600',   'checking')}
    </div>
  );
}
