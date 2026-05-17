import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { onInstallAvailability, promptInstall, getDisplayMode } from '../lib/install';
import ConnectionBadge from './ConnectionBadge';

const NAV = [
  { to: '/',         label: 'Home' },
  { to: '/worker',   label: 'Web Worker' },
  { to: '/status',   label: 'Status' },
  { to: '/push',     label: 'Push' },
  { to: '/manifest', label: 'Manifest' },
];

export default function Layout() {
  const [installable, setInstallable] = useState(false);
  const [displayMode, setDisplayMode] = useState(getDisplayMode());

  useEffect(() => onInstallAvailability(setInstallable), []);

  useEffect(() => {
    const id = window.setInterval(() => setDisplayMode(getDisplayMode()), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 md:min-h-screen bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <div>
            <div className="font-semibold leading-tight">PWA Demo</div>
            <div className="text-xs text-slate-500">{displayMode}</div>
          </div>
        </div>

        <nav className="flex md:flex-col flex-row flex-wrap gap-1 text-sm">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md transition ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
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

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
