import { useEffect, useState } from 'react';
import { canInstall, getDisplayMode, onInstallAvailability, promptInstall } from '../../lib/install';
import { DemoPage } from '../_DemoPage';
import { Row } from '../_shared/ui';

type RelatedApp = { id?: string; platform?: string; url?: string };

export default function ManifestDemo() {
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installable, setInstallable] = useState(canInstall());
  const [displayMode, setDisplayMode] = useState(getDisplayMode());
  const [related, setRelated] = useState<RelatedApp[] | null>(null);
  const [swState, setSwState] = useState<string>('checking…');

  useEffect(() => {
    fetch('/manifest.webmanifest')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setManifest)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => onInstallAvailability(setInstallable), []);

  useEffect(() => {
    const id = window.setInterval(() => setDisplayMode(getDisplayMode()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<RelatedApp[]> };
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav.getInstalledRelatedApps().then(setRelated).catch(() => setRelated([]));
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwState('unsupported');
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        setSwState('not registered');
        return;
      }
      const active = reg.active?.state ?? 'unknown';
      const scope = reg.scope;
      setSwState(`${active} · scope ${scope}`);
    });
  }, []);

  return (
    <DemoPage
      id="manifest"
      title="Manifest playground"
      blurb="Inspect install state and the parsed manifest the browser picked up."
    >
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 text-sm space-y-1">
        <Row label="display-mode (resolved)"     value={displayMode} />
        <Row label="install prompt available"    value={installable ? 'yes' : 'no'} />
        <Row label="service worker"              value={swState} />
        <Row label="getInstalledRelatedApps()"   value={related == null ? 'unsupported' : `${related.length} matches`} />
        <Row label="standalone media match"      value={String(window.matchMedia('(display-mode: standalone)').matches)} />
      </div>

      {installable && (
        <button
          onClick={() => promptInstall()}
          className="mb-6 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-slate-950 font-medium text-sm"
        >
          Install this PWA
        </button>
      )}

      <h2 className="text-sm font-medium text-slate-400 mb-2">manifest.webmanifest</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
        {error && <div className="text-rose-400 text-sm">failed to fetch: {error}</div>}
        {manifest && (
          <pre className="text-xs overflow-x-auto font-mono">{JSON.stringify(manifest, null, 2)}</pre>
        )}
        {!manifest && !error && <div className="text-slate-500 text-sm">loading…</div>}
      </div>
    </DemoPage>
  );
}
