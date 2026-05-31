import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { onInstallAvailability, promptInstall, getDisplayMode } from '../lib/install';
import ConnectionBadge from './ConnectionBadge';
import DemoSidebar from './DemoSidebar';
import PwaUpdater from './PwaUpdater';
import VersionBadge from './VersionBadge';
import ModalHost from '../demos/_ModalHost';
import { pwaEnv, envLogoFilter } from '../lib/env';

export default function Layout() {
  const [installable, setInstallable] = useState(false);
  const [displayMode, setDisplayMode] = useState(getDisplayMode());
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(0);
  const location = useLocation();

  useEffect(() => onInstallAvailability(setInstallable), []);

  useEffect(() => {
    const id = window.setInterval(() => setDisplayMode(getDisplayMode()), 2000);
    return () => window.clearInterval(id);
  }, []);

  // Measure the sticky mobile header so the open menu can dock flush beneath
  // it as a fixed overlay (independent of page scroll). Re-measures on resize
  // and orientation change since the safe-area inset can shift the height.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close the mobile menu whenever the route changes (covers any navigation
  // path, including in-page anchors from the sidebar).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  // Lock background scroll while the full-height mobile overlay is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 md:bg-transparent">
      {/* Mobile top bar — pt-safe pushes content below the notch/rounded
          corner in PWA mode (viewport-fit=cover); the slate-900 bg fills
          the safe area so it doesn't look like a gap. */}
      <header ref={headerRef} className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.svg" alt="" className="w-7 h-7" style={{ filter: envLogoFilter }} />
          <div>
            <div className="font-semibold leading-tight text-sm">{pwaEnv.name}</div>
            <div className="text-[10px] text-slate-500">{displayMode}</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sm"
          aria-expanded={mobileOpen}
          aria-controls="demo-sidebar"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        id="demo-sidebar"
        style={mobileOpen ? { top: headerH } : undefined}
        className={`${
          mobileOpen ? 'fixed inset-x-0 bottom-0 z-20 flex' : 'hidden'
        } md:static md:inset-auto md:z-auto md:flex md:w-72 md:min-h-screen md:sticky md:top-0 md:max-h-screen bg-slate-900 border-r border-slate-800 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] md:pb-4 md:pl-4 md:pr-4 flex-col gap-3`}
      >
        <Link to="/" className="hidden md:flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.svg" alt="" className="w-8 h-8" style={{ filter: envLogoFilter }} />
          <div>
            <div className="font-semibold leading-tight">{pwaEnv.name}</div>
            <div className="text-xs text-slate-500">{displayMode}</div>
          </div>
        </Link>

        <div className="flex-1 min-h-0">
          <DemoSidebar />
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <ConnectionBadge />
          <VersionBadge />
          {installable && (
            <button
              onClick={() => promptInstall()}
              className="px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-medium text-sm"
            >
              Install app
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-slate-950 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <Outlet />
      </main>

      <ModalHost />
      <PwaUpdater />
    </div>
  );
}
