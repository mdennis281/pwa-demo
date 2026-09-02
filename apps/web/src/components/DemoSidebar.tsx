import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { CAPABILITIES, CATEGORIES, slugifyCategory, type Capability, type Category, type Support } from '../lib/capabilities';
import { useCapabilityStatuses } from '../lib/useCapabilityStatuses';

/**
 * Sidebar is pure navigation. It does NOT open demos.
 *
 *   - Each capability row navigates to its category page anchored at the
 *     capability id: /category/<slug>#<cap-id>. Demos are opened from the
 *     chip(s) under each capability row on that page.
 *   - No favorites here either — the Home page is the quick-access surface
 *     for those. Keeping the sidebar single-purpose (nav).
 */

const DOT: Record<Support, string> = {
  supported: 'bg-emerald-400',
  partial: 'bg-amber-400',
  unsupported: 'bg-rose-500/70',
  unknown: 'bg-slate-600',
};

// Continuous support-percentage scale: red → orange → yellow → lime → emerald.
// Interpolates through Tailwind-flavored stops so the path stays vibrant (no
// muddy olive midpoint) and 100% lands on the site's emerald green. Each stop
// is a [pct, [r, g, b]] anchor; values between stops blend linearly.
const PCT_STOPS: Array<[number, [number, number, number]]> = [
  [0, [0xef, 0x44, 0x44]], // red-500
  [25, [0xf9, 0x73, 0x16]], // orange-500
  [50, [0xfb, 0xbf, 0x24]], // amber-400
  [75, [0xa3, 0xe6, 0x35]], // lime-400
  [100, [0x34, 0xd3, 0x99]], // emerald-400 (site theme green)
];

function pctColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  let lo = PCT_STOPS[0];
  let hi = PCT_STOPS[PCT_STOPS.length - 1];
  for (let i = 0; i < PCT_STOPS.length - 1; i++) {
    if (p >= PCT_STOPS[i][0] && p <= PCT_STOPS[i + 1][0]) {
      lo = PCT_STOPS[i];
      hi = PCT_STOPS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const t = span === 0 ? 0 : (p - lo[0]) / span;
  const ch = (i: number) =>
    Math.round(lo[1][i] + (hi[1][i] - lo[1][i]) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

export default function DemoSidebar() {
  const statuses = useCapabilityStatuses();
  const [query, setQuery] = useState('');
  const location = useLocation();

  const activeCategory: Category | null = useMemo(() => {
    if (location.pathname.startsWith('/category/')) {
      const slug = location.pathname.replace('/category/', '');
      for (const c of CATEGORIES) if (slugifyCategory(c) === slug) return c;
    }
    return null;
  }, [location.pathname]);

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  function toggleCat(cat: Category) {
    setOpenOverrides((m) => ({ ...m, [cat]: !(m[cat] ?? cat === activeCategory) }));
  }

  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
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

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-1 text-sm">
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
          if (isSearching && caps.length === 0) return null;

          const all = CAPABILITIES.filter((c) => c.category === cat);
          const supported = all.filter((c) => statuses[c.id] === 'supported').length;
          const partial = all.filter((c) => statuses[c.id] === 'partial').length;
          const pct = all.length === 0 ? 0 : Math.round(((supported + partial) / all.length) * 100);
          const override = openOverrides[cat];
          const open = isSearching ? true : (override ?? cat === activeCategory);

          return (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-slate-200 hover:bg-slate-800 transition"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-slate-500 transition-transform inline-block w-3 ${open ? 'rotate-90' : ''}`}>▸</span>
                  <span className="truncate text-xs uppercase tracking-wider text-slate-300">{cat}</span>
                </span>
                <span
                  className="shrink-0 font-mono text-xs font-semibold tabular-nums"
                  style={{ color: pctColor(pct) }}
                >
                  {pct}%
                </span>
              </button>

              {open && (
                <Link
                  to={`/category/${slugifyCategory(cat)}`}
                  className="ml-7 mt-0.5 inline-block px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-brand-200 hover:bg-slate-800/70 transition"
                >
                  Open category →
                </Link>
              )}

              {open && (
                <ul className="mt-0.5 mb-2 ml-3 border-l border-slate-800 pl-2 space-y-0.5">
                  {caps.map((cap) => (
                    <li key={cap.id}>
                      <CapabilityNavRow
                        cap={cap}
                        status={statuses[cap.id] ?? 'unknown'}
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

/** A capability link — navigates to the category page anchored at this cap.
 *  Does NOT open demos. The user opens demos from the chip(s) on the
 *  category page after landing. */
function CapabilityNavRow({
  cap, status, highlight,
}: {
  cap: Capability; status: Support; highlight: string;
}) {
  const location = useLocation();
  const to = `/category/${slugifyCategory(cap.category)}#${cap.id}`;
  const [path, hash] = to.split('#');
  const isActive = location.pathname === path && location.hash === `#${hash}`;
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition ${
        isActive ? 'bg-brand-600/25 text-brand-100' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${DOT[status]}`} />
      <span className="truncate">
        {highlight ? <Highlighted text={cap.name} q={highlight} /> : cap.name}
      </span>
    </Link>
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

/** Side-effect hook: scroll a hash-targeted element into view + pulse it once.
 *  Used by Category for in-page anchored capability sections. */
export function useHashScrollHighlight() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const anim = el.animate(
      [
        { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' },
        { boxShadow: '0 0 0 6px rgba(56, 189, 248, 0.55)', offset: 0.35 },
        { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' },
      ],
      { duration: 900, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    );
    return () => anim.cancel();
  }, [location.pathname, location.hash]);
}
