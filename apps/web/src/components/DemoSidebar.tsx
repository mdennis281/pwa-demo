import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { CAPABILITIES, CATEGORIES, slugifyCategory, type Capability, type Category, type Support } from '../lib/capabilities';
import { INLINE_DEMOS } from '../lib/demos';
import { useCapabilityStatuses } from '../lib/useCapabilityStatuses';

/** Standalone demos that aren't a single capability check. Surfaced inside
 *  their category in the sidebar with a star indicator. Everything else
 *  (push, status, worker, manifest, indexed-db) is reachable via its
 *  capability row — keeping the star reserved for the only demo that
 *  isn't a per-capability page. */
const STANDALONE: Array<{ to: string; title: string; category: Category }> = [
  { to: '/',     title: 'Overview',   category: 'Install & PWA' },
  { to: '/game', title: 'Tower Climb', category: 'Graphics & compute' },
];

const DOT: Record<Support, string> = {
  supported: 'bg-emerald-400',
  partial: 'bg-amber-400',
  unsupported: 'bg-rose-500/70',
  unknown: 'bg-slate-600',
};

/** Pick the best destination URL for a feature row. */
function destinationFor(cap: Capability): string {
  if (cap.demo) return cap.demo;
  return `/category/${slugifyCategory(cap.category)}#${cap.id}`;
}

export default function DemoSidebar() {
  const statuses = useCapabilityStatuses();
  const [query, setQuery] = useState('');
  const location = useLocation();

  // Track which categories are expanded. Default behavior:
  //   - if URL matches /category/:cat, that one is expanded
  //   - if URL matches a standalone demo route, that demo's category is expanded
  //   - otherwise the current path's category (if any) is expanded
  //   - while searching, every category with a match is expanded
  const activeCategory: Category | null = useMemo(() => {
    if (location.pathname.startsWith('/category/')) {
      const slug = location.pathname.replace('/category/', '');
      for (const c of CATEGORIES) if (slugifyCategory(c) === slug) return c;
    }
    const sd = STANDALONE.find((d) => d.to === location.pathname && d.to !== '/');
    if (sd) return sd.category;
    // Auto-expand the category that owns a capability-demo route (e.g. /push
    // belongs to Notifications). Without this, removing those routes from
    // STANDALONE would mean their sidebar parent no longer opens automatically.
    const cap = CAPABILITIES.find((c) => c.demo === location.pathname);
    if (cap) return cap.category;
    return null;
  }, [location.pathname]);

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  function toggle(cat: Category) {
    setOpenOverrides((m) => ({ ...m, [cat]: !(m[cat] ?? cat === activeCategory) }));
  }

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  // Per-category filtered feature list
  const filteredByCat = useMemo(() => {
    const m = new Map<Category, Capability[]>();
    for (const cat of CATEGORIES) m.set(cat, []);
    for (const cap of CAPABILITIES) {
      if (!isSearching || cap.name.toLowerCase().includes(q) || cap.description.toLowerCase().includes(q)) {
        m.get(cap.category)!.push(cap);
      }
    }
    return m;
  }, [q, isSearching]);

  const filteredStandalone = useMemo(() =>
    isSearching
      ? STANDALONE.filter((d) => d.title.toLowerCase().includes(q))
      : STANDALONE,
    [q, isSearching],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search features…"
          className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 focus:outline-none rounded-md pl-7 pr-7 py-1.5 text-sm placeholder-slate-600"
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">⌕</span>
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-1 text-sm">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `block px-2 py-1.5 rounded-md transition ${
              isActive ? 'bg-brand-600/30 text-brand-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          Overview
        </NavLink>

        {CATEGORIES.map((cat) => {
          const caps = filteredByCat.get(cat)!;
          const standalone = filteredStandalone.filter((d) => d.category === cat && d.to !== '/');
          if (isSearching && caps.length === 0 && standalone.length === 0) return null;

          const all = CAPABILITIES.filter((c) => c.category === cat);
          const supported = all.filter((c) => statuses[c.id] === 'supported').length;
          const partial = all.filter((c) => statuses[c.id] === 'partial').length;
          const pct = all.length === 0 ? 0 : Math.round(((supported + partial) / all.length) * 100);
          const pctColor = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : pct > 0 ? 'text-rose-400' : 'text-slate-600';
          const override = openOverrides[cat];
          const open = isSearching ? true : (override ?? cat === activeCategory);

          return (
            <div key={cat}>
              <button
                onClick={() => toggle(cat)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-slate-200 hover:bg-slate-800 transition"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-slate-500 transition-transform inline-block w-3 ${open ? 'rotate-90' : ''}`}>▸</span>
                  <span className="truncate text-xs uppercase tracking-wider text-slate-300">{cat}</span>
                </span>
                <span className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${pctColor}`}>
                  {pct}%
                </span>
              </button>

              {open && (
                <ul className="mt-0.5 mb-2 ml-3 border-l border-slate-800 pl-2 space-y-0.5">
                  {standalone.map((d) => (
                    <li key={d.to}>
                      <FeatureRow to={d.to} label={d.title} featured highlight={q} />
                    </li>
                  ))}
                  {caps.map((cap) => (
                    <li key={cap.id}>
                      <FeatureRow
                        to={destinationFor(cap)}
                        label={cap.name}
                        status={statuses[cap.id] ?? 'unknown'}
                        hasDemo={!!INLINE_DEMOS[cap.id] || !!cap.demo}
                        highlight={q}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function FeatureRow({
  to, label, status, hasDemo = true, featured = false, highlight,
}: {
  to: string;
  label: string;
  status?: Support;
  hasDemo?: boolean;
  featured?: boolean;
  highlight?: string;
}) {
  const location = useLocation();
  // If `to` includes a hash, require both path and hash to match exactly.
  // Otherwise just match the path (so caps with a dedicated demo route also
  // highlight when you're on that route).
  const [path, hash] = to.split('#');
  const isActive = hash
    ? location.pathname === path && location.hash === `#${hash}`
    : location.pathname === path;

  return (
    <NavLink
      to={to}
      className={() =>
        `flex items-center gap-2 px-2 py-1 rounded text-xs transition ${
          isActive ? 'bg-brand-600/25 text-brand-100' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
        }`
      }
    >
      {featured ? (
        <span className="text-amber-300 text-[10px] shrink-0" title="Standalone demo page">★</span>
      ) : (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
            status ? DOT[status] : 'bg-slate-600'
          } ${!hasDemo && status === 'supported' ? 'opacity-50' : ''}`}
        />
      )}
      <span className={`truncate ${!hasDemo && !featured ? 'text-slate-500' : ''}`}>
        {highlight ? <Highlighted text={label} q={highlight} /> : label}
      </span>
    </NavLink>
  );
}

function Highlighted({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-brand-500/30 text-brand-100 px-0.5 rounded">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Side-effect hook: scroll a hash-targeted element into view + highlight it briefly. */
export function useHashScrollHighlight() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-2', 'ring-brand-400', 'ring-offset-2', 'ring-offset-slate-950');
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-brand-400', 'ring-offset-2', 'ring-offset-slate-950');
    }, 1800);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash]);
}
