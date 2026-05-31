import { checkForUpdate, usePwa } from '../lib/pwa';

/**
 * Sidebar-footer badge showing the running version and SW state. Sits next to
 * the connection badge. Clicking it forces an update check (the periodic poll
 * in lib/pwa.ts does this automatically every 60s too).
 */
export default function VersionBadge() {
  const { version, buildTime, offlineReady, needRefresh, updating, lastChecked } = usePwa();
  const shortVersion = `v${version}`;

  let label: string;
  let dotClass: string;
  let textClass: string;
  if (updating) {
    label = 'updating…';
    dotClass = 'bg-amber-400 animate-pulse';
    textClass = 'text-amber-400';
  } else if (needRefresh) {
    label = 'update ready';
    dotClass = 'bg-brand-400';
    textClass = 'text-brand-400';
  } else if (offlineReady) {
    label = 'offline-ready';
    dotClass = 'bg-emerald-400';
    textClass = 'text-emerald-400';
  } else {
    label = 'up to date';
    dotClass = 'bg-emerald-400';
    textClass = 'text-emerald-400';
  }

  const title = [
    `version ${version}`,
    `built ${formatBuildTime(buildTime)}`,
    lastChecked ? `checked ${formatRelative(lastChecked)}` : 'not yet checked',
    'click to check for updates',
  ].join('\n');

  return (
    <button
      type="button"
      onClick={() => void checkForUpdate()}
      title={title}
      className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 transition text-xs"
    >
      <div className="flex items-center justify-between gap-2 text-slate-400">
        <span className="font-mono">{shortVersion}</span>
        <span className={textClass}>
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${dotClass}`} />
          {label}
        </span>
      </div>
    </button>
  );
}

function formatBuildTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatRelative(ms: number): string {
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
