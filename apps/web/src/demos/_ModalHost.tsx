import { Suspense, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DEMOS } from './_registry';
import { useFavorites } from './_favorites';
import { StarButton } from './_StarButton';

/**
 * Renders the current modal demo, driven by the `?demo=<id>` query param.
 * Mounted once near the root (in Layout) — every component that wants to
 * open a modal demo just navigates the URL to include `?demo=<id>`. ESC
 * key and backdrop click clear the param and dismiss the modal.
 *
 * Modals are deep-linkable: pasting a `?demo=vibration` URL opens that
 * modal on top of whatever route the user is on (Home, Category, etc.).
 */
export default function ModalHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const openId = params.get('demo');

  const demo = openId ? DEMOS.find((d) => d.id === openId && d.type === 'modal') : null;

  const close = useCallback(() => {
    const next = new URLSearchParams(location.search);
    next.delete('demo');
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  // ESC to close
  useEffect(() => {
    if (!demo) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [demo, close]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (!demo) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [demo]);

  const { isFavorite, toggle } = useFavorites();

  if (!demo) return null;
  const Body = demo.component;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={demo.title}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-4 py-3 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-100 truncate">{demo.title}</div>
            <div className="text-xs text-slate-500 leading-snug">{demo.blurb}</div>
          </div>
          <StarButton
            on={isFavorite(demo.id)}
            onClick={() => toggle(demo.id)}
            aria-label={isFavorite(demo.id) ? 'Remove from favorites' : 'Add to favorites'}
          />
          <button
            onClick={close}
            className="shrink-0 text-slate-400 hover:text-slate-100 px-2 py-1 rounded transition"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Suspense fallback={<div className="text-xs text-slate-500">loading…</div>}>
            <Body />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
