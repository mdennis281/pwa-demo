import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { onInstallAvailability, promptInstall, getDisplayMode } from '../lib/install';
import ConnectionBadge from './ConnectionBadge';
import DemoSidebar from './DemoSidebar';
import ModalHost from '../demos/_ModalHost';

export default function Layout() {
  const [installable, setInstallable] = useState(false);
  const [displayMode, setDisplayMode] = useState(getDisplayMode());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => onInstallAvailability(setInstallable), []);

  useEffect(() => {
    const id = window.setInterval(() => setDisplayMode(getDisplayMode()), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-900 md:bg-transparent">
      {/* Mobile top bar — pt-safe pushes content below the notch/rounded
          corner in PWA mode (viewport-fit=cover); the slate-900 bg fills
          the safe area so it doesn't look like a gap. */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.svg" alt="" className="w-7 h-7" />
          <div>
            <div className="font-semibold leading-tight text-sm">YesWeb</div>
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
        className={`${
          mobileOpen ? 'flex' : 'hidden'
        } md:flex md:w-72 md:min-h-screen md:sticky md:top-0 md:max-h-screen bg-slate-900 border-r border-slate-800 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] md:pb-4 md:pl-4 md:pr-4 flex-col gap-3`}
      >
        <Link to="/" className="hidden md:flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <div>
            <div className="font-semibold leading-tight">YesWeb</div>
            <div className="text-xs text-slate-500">{displayMode}</div>
          </div>
        </Link>

        <div className="flex-1 min-h-0" onClick={() => setMobileOpen(false)}>
          <DemoSidebar />
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <ConnectionBadge />
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
    </div>
  );
}
