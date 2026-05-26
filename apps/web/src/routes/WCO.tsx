/**
 * Window Controls Overlay demo.
 *
 * WCO is a desktop-PWA feature where the app paints into the titlebar area
 * that the OS would normally reserve for window chrome. The browser still
 * draws the close/min/max buttons (or traffic lights) on top, but the rest
 * of that strip belongs to you. The page explains what's happening, shows
 * live geometry, and lets the user feel the difference via a draggable
 * fake titlebar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

type WCO = {
  visible: boolean;
  getTitlebarAreaRect: () => DOMRect;
  addEventListener: (t: string, h: () => void) => void;
  removeEventListener: (t: string, h: () => void) => void;
};

function getWCO(): WCO | null {
  return (navigator as Navigator & { windowControlsOverlay?: WCO }).windowControlsOverlay ?? null;
}

type State = {
  apiAvailable: boolean;
  visible: boolean;
  rect: DOMRect | null;
  winW: number;
  winH: number;
  geomEvents: number;
  displayMode: DisplayMode;
  isSecureContext: boolean;
};

type ManifestProbe =
  | { status: 'loading' }
  | { status: 'ok'; url: string; displayOverride: string[] | null; raw: string }
  | { status: 'error'; error: string };

// Order matters: more-specific modes first, so currentDisplayMode() returns
// the most informative match. 'browser' is the fallback when nothing else hit.
const DISPLAY_MODES = [
  'window-controls-overlay',
  'fullscreen',
  'standalone',
  'minimal-ui',
  'browser',
] as const;
type DisplayMode = typeof DISPLAY_MODES[number];

function currentDisplayMode(): DisplayMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'browser';
  for (const m of DISPLAY_MODES) {
    if (window.matchMedia(`(display-mode: ${m})`).matches) return m;
  }
  return 'browser';
}

export default function WCOPage() {
  const wco = useMemo(getWCO, []);
  const [s, setS] = useState<State>(() => ({
    apiAvailable: !!wco,
    visible: wco?.visible ?? false,
    rect: wco?.getTitlebarAreaRect?.() ?? null,
    winW: typeof window !== 'undefined' ? window.innerWidth : 0,
    winH: typeof window !== 'undefined' ? window.innerHeight : 0,
    geomEvents: 0,
    displayMode: currentDisplayMode(),
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
  }));

  // One-shot fetch of the actually-served manifest. If WCO is missing from
  // display_override here, the deployed build is stale — autodeploy hasn't
  // picked up the latest commit. If it IS present, the cause is environmental
  // (secure context, install-time state, etc.).
  const [manifest, setManifest] = useState<ManifestProbe>({ status: 'loading' });
  useEffect(() => {
    // Find the manifest URL the browser used. Falls back to /manifest.webmanifest.
    const linkEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const url = linkEl?.href ?? '/manifest.webmanifest';
    fetch(url, { cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        try {
          const json = JSON.parse(text) as { display_override?: string[] };
          setManifest({
            status: 'ok',
            url,
            displayOverride: Array.isArray(json.display_override) ? json.display_override : null,
            raw: text,
          });
        } catch (e) {
          setManifest({ status: 'error', error: `parse: ${(e as Error).message}` });
        }
      })
      .catch((e) => setManifest({ status: 'error', error: String((e as Error).message) }));
  }, []);

  useEffect(() => {
    function update(fromGeom: boolean) {
      setS((prev) => ({
        ...prev,
        visible: wco?.visible ?? false,
        rect: wco?.getTitlebarAreaRect?.() ?? null,
        winW: window.innerWidth,
        winH: window.innerHeight,
        geomEvents: fromGeom ? prev.geomEvents + 1 : prev.geomEvents,
        displayMode: currentDisplayMode(),
      }));
    }
    const onGeom = () => update(true);
    const onResize = () => update(false);
    wco?.addEventListener('geometrychange', onGeom);
    window.addEventListener('resize', onResize);
    // Listen for display-mode flips too (e.g. OS-level fullscreen toggle).
    const modeListeners = DISPLAY_MODES.map((m) => {
      const mq = window.matchMedia(`(display-mode: ${m})`);
      const h = () => update(false);
      mq.addEventListener('change', h);
      return { mq, h };
    });
    return () => {
      wco?.removeEventListener('geometrychange', onGeom);
      window.removeEventListener('resize', onResize);
      modeListeners.forEach(({ mq, h }) => mq.removeEventListener('change', h));
    };
  }, [wco]);

  const supported = s.apiAvailable;
  const active = supported && s.visible;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="text-xs">
          <Link to="/" className="text-slate-400 hover:text-slate-200">← Overview</Link>
        </div>
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Window Controls Overlay</h1>
          <StatusPill supported={supported} active={active} />
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          When an installed desktop PWA opts into WCO, the operating system stops
          reserving the whole top strip for its titlebar — your page content
          extends up there, and the browser draws just the close/minimize/maximize
          buttons (or macOS traffic lights) overlaid on top. The result: the app
          looks less like a browser tab and more like a native window.
        </p>
      </header>

      {/* before/after diagram */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Diagram
          label="Without WCO (default)"
          tone="slate"
          renderBand={() => (
            <rect x={0} y={0} width={300} height={28} fill="#1e293b" stroke="#475569" />
          )}
          caption="The OS reserves the full top strip. Your content starts below it."
        />
        <Diagram
          label="With WCO"
          tone="brand"
          renderBand={() => (
            <>
              {/* available titlebar area belongs to the app */}
              <rect x={0} y={0} width={220} height={28} fill="#0ea5e955" />
              <text x={8} y={18} fontSize={10} fill="#bae6fd" fontFamily="monospace">
                your app paints here
              </text>
              {/* OS controls overlay on the right */}
              <rect x={220} y={0} width={80} height={28} fill="#1e293b" stroke="#475569" />
              <circle cx={244} cy={14} r={4} fill="#475569" />
              <circle cx={262} cy={14} r={4} fill="#475569" />
              <circle cx={280} cy={14} r={4} fill="#475569" />
            </>
          )}
          caption="The app gets the open span; the browser draws controls on top."
        />
      </section>

      {/* live state */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-slate-400">Live state</h2>
        {!supported ? (
          <p className="text-rose-300 text-sm">
            <code className="bg-slate-950 px-1.5 py-0.5 rounded">navigator.windowControlsOverlay</code> isn't
            exposed here. WCO is desktop-only and requires Chrome/Edge 105+.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm font-mono">
            <Stat label="visible" value={String(s.visible)} highlight={s.visible ? 'text-emerald-300' : 'text-slate-500'} />
            <Stat
              label="display-mode"
              value={s.displayMode}
              highlight={s.displayMode === 'window-controls-overlay' ? 'text-emerald-300' : 'text-amber-300'}
            />
            <Stat
              label="secure context"
              value={String(s.isSecureContext)}
              highlight={s.isSecureContext ? 'text-emerald-300' : 'text-rose-300'}
            />
            <Stat label="window" value={`${s.winW} × ${s.winH}`} />
            <Stat label="titlebar rect" value={s.rect ? `${s.rect.width.toFixed(0)} × ${s.rect.height.toFixed(0)}` : '—'} />
            <Stat label="geom events" value={String(s.geomEvents)} />
          </div>
        )}
        {supported && !s.visible && (
          <Diagnostic
            mode={s.displayMode}
            isSecureContext={s.isSecureContext}
            manifest={manifest}
          />
        )}
        {manifest.status === 'ok' && (
          <div className="border-t border-slate-800 pt-3 mt-1 text-xs space-y-1">
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">served manifest</div>
            <div className="font-mono text-slate-400">
              <span className="text-slate-500">url:</span> {manifest.url}
            </div>
            <div className="font-mono">
              <span className="text-slate-500">display_override:</span>{' '}
              {manifest.displayOverride
                ? (
                  <span className={
                    manifest.displayOverride.includes('window-controls-overlay')
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }>
                    [{manifest.displayOverride.map((m) => `"${m}"`).join(', ')}]
                  </span>
                )
                : <span className="text-rose-300">missing</span>
              }
            </div>
          </div>
        )}
        {manifest.status === 'error' && (
          <p className="text-rose-300 text-xs">
            couldn't fetch manifest: {manifest.error}
          </p>
        )}
      </section>

      {/* schematic of the current window with the titlebar rect highlighted */}
      {supported && (
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-slate-400">Schematic</h2>
          <p className="text-slate-500 text-xs">
            Live, to-scale diagram of this window. The highlighted strip is the available titlebar area —
            where your app UI can paint. Resize the window to see <code className="bg-slate-950 px-1 rounded">geometrychange</code> fire.
          </p>
          <WindowSchematic winW={s.winW} winH={s.winH} rect={s.rect} active={active} />
        </section>
      )}

      {/* draggable playground (only meaningful when active) */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-slate-400">Drag-region playground</h2>
        <p className="text-slate-500 text-xs leading-relaxed">
          When WCO is active you lose the normal "grab the titlebar to move the window" affordance —
          you have to declare which parts of <em>your</em> UI are draggable, with the non-standard but
          widely supported <code className="bg-slate-950 px-1 rounded">-webkit-app-region</code> CSS property.
          Drag the bar below to test (only works in an installed PWA window).
        </p>
        <DraggableBar enabled={active} />
        {!active && (
          <p className="text-slate-500 text-[11px] italic">
            The bar above has <code className="bg-slate-950 px-1 rounded">app-region: drag</code> set but it
            has no effect outside the WCO window. The button inside it has{' '}
            <code className="bg-slate-950 px-1 rounded">app-region: no-drag</code> so it'd stay clickable
            even when the surrounding strip is draggable.
          </p>
        )}
      </section>

      {/* how to enable */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-slate-400">How to turn it on</h2>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1.5">
          <li>
            Use a Chromium browser on desktop (Chrome / Edge / Brave). Firefox and Safari don't ship WCO yet.
          </li>
          <li>
            The manifest must include{' '}
            <code className="bg-slate-950 px-1.5 py-0.5 rounded text-xs">display_override: ["window-controls-overlay"]</code>.{' '}
            <span className="text-emerald-400">(Already set for this app.)</span>
          </li>
          <li>
            Install the PWA — from the URL bar's install icon, or{' '}
            <Link to="/manifest" className="text-brand-300 hover:text-brand-200">the install demo</Link>.
            Then launch it from the OS app launcher, not as a tab.
          </li>
          <li>
            Inside the installed window, this page should report <code className="bg-slate-950 px-1 rounded">visible: true</code>{' '}
            and the schematic above will show the live titlebar rect.
          </li>
        </ol>
      </section>

      {/* a short code reference */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
        <h2 className="text-sm uppercase tracking-wider text-slate-400">Reference</h2>
        <pre className="bg-slate-950 border border-slate-800 rounded p-3 overflow-x-auto text-xs text-slate-300 leading-relaxed">{`// CSS — push content below the overlay strip when WCO is active.
.titlebar-area {
  padding-top: env(titlebar-area-height, 0);
}

// Make a region draggable (works in WCO-enabled PWA windows).
.app-titlebar {
  -webkit-app-region: drag;
}
.app-titlebar button {
  -webkit-app-region: no-drag;
}

// JS — react to the OS reshaping the overlay (e.g. fullscreen toggle).
navigator.windowControlsOverlay.addEventListener('geometrychange', () => {
  const r = navigator.windowControlsOverlay.getTitlebarAreaRect();
  // r.x / r.y / r.width / r.height — the area free of OS controls
});`}</pre>
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-slate-500 hover:text-slate-300"
        >
          MDN reference ↗
        </a>
      </section>
    </div>
  );
}

// ─── building blocks ──────────────────────────────────────────────────────

/** Picks the right "why isn't WCO active" explanation by checking the most
 *  specific signals first (manifest contents, secure-context) before falling
 *  back to display-mode heuristics. */
function Diagnostic({
  mode,
  isSecureContext,
  manifest,
}: {
  mode: DisplayMode;
  isSecureContext: boolean;
  manifest: ManifestProbe;
}) {
  // 1. Hard blocker — manifest on the deployed server doesn't have WCO in its
  // display_override at all. Autodeploy hasn't picked up the change.
  if (manifest.status === 'ok' && manifest.displayOverride && !manifest.displayOverride.includes('window-controls-overlay')) {
    return (
      <div className="text-rose-300 text-xs leading-relaxed space-y-2">
        <p>
          <strong>The deployed manifest is missing <code className="bg-slate-950 px-1 rounded">window-controls-overlay</code> from <code className="bg-slate-950 px-1 rounded">display_override</code>.</strong>{' '}
          The build on the server hasn't picked up the new manifest yet. Trigger an autodeploy:
        </p>
        <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-[11px] overflow-x-auto">python -m deploy autodeploy trigger</pre>
        <p>
          Then reload this page (still in the browser tab) and confirm{' '}
          <code className="bg-slate-950 px-1 rounded">display_override</code> below now lists
          <code className="bg-slate-950 px-1 rounded">window-controls-overlay</code>. Only then uninstall &amp; reinstall.
        </p>
      </div>
    );
  }
  // 2. Manifest declared no display_override at all — same fix as above.
  if (manifest.status === 'ok' && !manifest.displayOverride) {
    return (
      <p className="text-rose-300 text-xs leading-relaxed">
        The deployed manifest has no <code className="bg-slate-950 px-1 rounded">display_override</code> field
        at all. The build is stale — run <code className="bg-slate-950 px-1 rounded">python -m deploy autodeploy trigger</code>
        on the server.
      </p>
    );
  }
  // 3. Insecure context — WCO needs HTTPS (or localhost). LAN HTTP installs
  // succeed but Chromium silently drops powerful display modes.
  if (!isSecureContext) {
    return (
      <div className="text-rose-300 text-xs leading-relaxed space-y-2">
        <p>
          <strong>Not a secure context.</strong> You're served over plain HTTP. Chromium will let you install
          a PWA from <code className="bg-slate-950 px-1 rounded">.local</code> mDNS names, but it silently
          strips <code className="bg-slate-950 px-1 rounded">window-controls-overlay</code> from the override
          list because WCO requires <code className="bg-slate-950 px-1 rounded">window.isSecureContext === true</code>.
        </p>
        <p>
          <strong>Fix options:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Terminate HTTPS at nginx with a self-signed cert + accept the warning</li>
          <li>Hit the dev server on <code className="bg-slate-950 px-1 rounded">localhost</code> directly (localhost is treated as secure regardless of HTTP)</li>
          <li>For testing only: add this origin to <code className="bg-slate-950 px-1 rounded">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> on each browser</li>
        </ul>
      </div>
    );
  }
  // 4. Plain browser tab.
  if (mode === 'browser') {
    return (
      <p className="text-amber-300 text-xs leading-relaxed">
        You're in a browser tab. WCO only applies to installed PWA windows —{' '}
        <Link to="/manifest" className="underline">install the app</Link> and reopen it from your OS app
        launcher.
      </p>
    );
  }
  // 5. Installed but display-mode is standalone. By this point the manifest IS
  // serving WCO and we ARE in a secure context — so the cause is most likely
  // install-time staleness.
  if (mode === 'standalone' || mode === 'minimal-ui') {
    return (
      <div className="text-amber-300 text-xs leading-relaxed space-y-2">
        <p>
          You're in an installed PWA (<code className="bg-slate-950 px-1 rounded">{mode}</code>), the manifest
          declares WCO, and you're in a secure context — so Chrome should be picking WCO. It isn't, which
          usually means the install snapshotted an older manifest. Try:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Uninstall from <code className="bg-slate-950 px-1 rounded">⋮ → Uninstall</code></li>
          <li>In a browser tab, clear site data: <code className="bg-slate-950 px-1 rounded">⋯ → DevTools → Application → Clear storage → Clear site data</code></li>
          <li>Hard-reload the tab and reinstall</li>
        </ul>
      </div>
    );
  }
  // 6. Fullscreen.
  if (mode === 'fullscreen') {
    return (
      <p className="text-amber-300 text-xs leading-relaxed">
        Fullscreen mode hides the titlebar entirely, so WCO has nothing to overlay. Exit fullscreen to see it.
      </p>
    );
  }
  // 7. WCO display-mode but visible: false — usually a too-narrow window.
  return (
    <p className="text-amber-300 text-xs leading-relaxed">
      display-mode reports <code className="bg-slate-950 px-1 rounded">window-controls-overlay</code> but the
      overlay isn't visible — this usually means the window is too narrow for the OS to draw controls. Resize wider.
    </p>
  );
}

function StatusPill({ supported, active }: { supported: boolean; active: boolean }) {
  if (!supported) {
    return (
      <span className="text-xs font-mono px-2 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
        unsupported
      </span>
    );
  }
  if (active) {
    return (
      <span className="text-xs font-mono px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        active
      </span>
    );
  }
  return (
    <span className="text-xs font-mono px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
      api present, inactive
    </span>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded px-3 py-2">
      <div className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`tabular-nums ${highlight ?? 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

function Diagram({
  label,
  tone,
  renderBand,
  caption,
}: {
  label: string;
  tone: 'slate' | 'brand';
  renderBand: () => React.ReactNode;
  caption: string;
}) {
  const border = tone === 'brand' ? 'border-brand-500/40' : 'border-slate-700';
  return (
    <div className={`bg-slate-950 border ${border} rounded-lg p-3 space-y-2`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <svg viewBox="0 0 300 180" className="w-full h-auto">
        {/* window outline */}
        <rect x={0} y={0} width={300} height={180} fill="#0b1220" stroke="#334155" />
        {/* titlebar band overlay */}
        {renderBand()}
        {/* mock app content below */}
        <rect x={12} y={42} width={120} height={8} fill="#1e293b" />
        <rect x={12} y={56} width={200} height={8} fill="#1e293b" />
        <rect x={12} y={70} width={160} height={8} fill="#1e293b" />
        <rect x={12} y={100} width={276} height={64} fill="#0f172a" stroke="#1e293b" />
      </svg>
      <p className="text-slate-500 text-xs leading-snug">{caption}</p>
    </div>
  );
}

function WindowSchematic({
  winW,
  winH,
  rect,
  active,
}: {
  winW: number;
  winH: number;
  rect: DOMRect | null;
  active: boolean;
}) {
  // Scale the window into a 600-wide SVG, preserving aspect ratio.
  const targetW = 600;
  const scale = targetW / Math.max(winW, 1);
  const w = targetW;
  const h = Math.max(60, winH * scale);
  const r = rect && { x: rect.x * scale, y: rect.y * scale, w: rect.width * scale, h: Math.max(rect.height * scale, 4) };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxHeight: 320 }}>
        <rect x={0} y={0} width={w} height={h} fill="#0b1220" stroke="#475569" />
        {/* highlight the titlebar rect when WCO is active */}
        {active && r && (
          <>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#0ea5e955" stroke="#38bdf8" />
            <text x={r.x + 8} y={r.y + r.h / 2 + 4} fontSize={11} fill="#bae6fd" fontFamily="monospace">
              app titlebar area · {Math.round(rect!.width)}×{Math.round(rect!.height)}
            </text>
          </>
        )}
        {/* If not active, just draw a placeholder strip representing the browser-owned title strip */}
        {!active && (
          <rect x={0} y={0} width={w} height={28} fill="#1e293b" stroke="#475569" />
        )}
      </svg>
      <p className="text-slate-500 text-[11px] mt-2">
        scaled 1:{Math.round(1 / scale)} from {winW}×{winH}
      </p>
    </div>
  );
}

function DraggableBar({ enabled }: { enabled: boolean }) {
  // The `app-region` CSS property is non-standard but widely-implemented in
  // Chromium PWAs. TypeScript's CSSProperties doesn't know about it, hence
  // the cast — the value is otherwise a normal string.
  const dragStyle = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties;
  return (
    <div
      style={dragStyle}
      className={`flex items-center justify-between gap-3 px-4 py-2 rounded-md border ${
        enabled
          ? 'bg-brand-500/15 border-brand-500/40 text-brand-100'
          : 'bg-slate-950 border-slate-800 text-slate-400'
      }`}
    >
      <span className="text-xs font-mono select-none">
        {enabled ? '↕ drag-region active — drag to move window' : '↕ drag-region (inactive)'}
      </span>
      <button
        type="button"
        style={noDragStyle}
        onClick={() => alert('Clicked — buttons inside drag regions need app-region: no-drag.')}
        className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
      >
        no-drag button
      </button>
    </div>
  );
}
