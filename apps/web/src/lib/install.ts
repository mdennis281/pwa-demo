type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

// Sticky flag set when this browser observes an install. Survives across
// reloads in the same origin. Backs the cross-tab "is the PWA installed?"
// check on browsers without navigator.getInstalledRelatedApps().
const INSTALLED_FLAG_KEY = 'pwa-install-observed';

function setInstalledFlag(): void {
  try {
    window.localStorage.setItem(INSTALLED_FLAG_KEY, '1');
  } catch {
    /* private mode, quota, disabled storage — fine, just no fallback signal */
  }
}

function readInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    setInstalledFlag();
    listeners.forEach((fn) => fn(false));
  });
}

export function canInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  listeners.forEach((fn) => fn(false));
  return choice.outcome;
}

export function onInstallAvailability(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  fn(canInstall());
  return () => listeners.delete(fn);
}

export function getDisplayMode(): string {
  if (typeof window === 'undefined') return 'unknown';
  const modes = ['window-controls-overlay', 'tabbed', 'standalone', 'minimal-ui', 'fullscreen'];
  for (const m of modes) {
    if (window.matchMedia(`(display-mode: ${m})`).matches) return m;
  }
  return 'browser';
}

/** True if the page is running as an installed PWA (any standalone-ish
 *  display mode, or iOS Safari's legacy navigator.standalone). */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const mode = getDisplayMode();
  if (mode !== 'browser' && mode !== 'unknown') return true;
  // iOS Safari predates display-mode media queries — it sets this flag
  // when launched from a home-screen shortcut.
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return navStandalone === true;
}

/** Subscribe to installed-state changes. Listens to display-mode media
 *  queries (covers a user popping the app out into its own window) and the
 *  appinstalled event (covers a fresh install). Returns an unsubscribe. */
export function onInstalledChange(fn: (installed: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const modes = ['standalone', 'fullscreen', 'window-controls-overlay', 'tabbed', 'minimal-ui'];
  const mqls = modes.map((m) => window.matchMedia(`(display-mode: ${m})`));
  const tick = () => fn(isInstalled());
  for (const mql of mqls) mql.addEventListener('change', tick);
  window.addEventListener('appinstalled', tick);
  return () => {
    for (const mql of mqls) mql.removeEventListener('change', tick);
    window.removeEventListener('appinstalled', tick);
  };
}

export type InstallFamily =
  | 'chromium-desktop'
  | 'chromium-android'
  | 'edge-desktop'
  | 'samsung-android'
  | 'firefox-desktop'
  | 'firefox-android'
  | 'safari-ios'
  | 'safari-macos'
  | 'other';

export type InstallContext = {
  family: InstallFamily;
  /** Human label for the active browser, e.g. "Chrome on Android". */
  label: string;
  /** Numbered steps for adding the site to the home screen / dock. */
  steps: string[];
  /** True when the browser is known not to support installing this page as
   *  a standalone PWA at all (currently: Firefox on desktop). The UI should
   *  still render guidance, but framed as "use a different browser". */
  unsupported?: boolean;
};

/** Infer the user's browser well enough to give actionable install steps.
 *  Best-effort: UA strings lie, but the cost of a wrong guess is just
 *  showing a slightly-off bulleted list, not breaking anything. */
export function detectInstallContext(): InstallContext {
  if (typeof navigator === 'undefined') {
    return { family: 'other', label: 'this browser', steps: GENERIC_STEPS };
  }
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  // iPadOS in "Request Desktop Website" mode masquerades as Mac. Touch points
  // on a Mac UA is the reliable tell.
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  const isIOS = /iPhone|iPod/i.test(ua) || isIPad;

  // On iOS every browser is WebKit under the hood; install path is identical
  // regardless of which app icon the user tapped. Detect first.
  if (isIOS) {
    return {
      family: 'safari-ios',
      label: isIPad ? 'Safari on iPadOS' : 'Safari on iOS',
      steps: [
        'Tap the Share button (the square with an up-arrow) in the toolbar.',
        'Scroll down and choose "Add to Home Screen".',
        'Confirm the name, then tap "Add" in the top-right.',
      ],
    };
  }

  if (/SamsungBrowser/i.test(ua)) {
    return {
      family: 'samsung-android',
      label: 'Samsung Internet',
      steps: [
        'Tap the menu (☰) at the bottom of the browser.',
        'Choose "Add page to" → "Home screen".',
        'Tap "Add" to confirm.',
      ],
    };
  }

  if (/FxiOS/i.test(ua)) {
    // Firefox on iOS is WebKit too — same as Safari iOS — but we already
    // returned above. Defensive branch.
    return {
      family: 'safari-ios',
      label: 'Firefox on iOS',
      steps: [
        'Tap the Share button.',
        'Choose "Add to Home Screen".',
      ],
    };
  }

  if (/Firefox/i.test(ua)) {
    if (isAndroid) {
      return {
        family: 'firefox-android',
        label: 'Firefox on Android',
        steps: [
          'Tap the menu (⋮) in the toolbar.',
          'Choose "Install" (or "Add to Home screen" on older versions).',
          'Confirm "Add" / "Install".',
        ],
      };
    }
    return {
      family: 'firefox-desktop',
      label: 'Firefox on desktop',
      unsupported: true,
      steps: [
        'Firefox on desktop does not support installing websites as standalone apps.',
        'To install this PWA, open it in Chrome, Edge, Brave, or Opera and look for the install icon in the address bar.',
      ],
    };
  }

  // Edge ships its own UA token. Catch it before generic Chromium so the
  // wording matches the actual menu labels in Edge.
  if (/Edg\//.test(ua)) {
    return {
      family: 'edge-desktop',
      label: 'Microsoft Edge',
      steps: [
        'Click the install icon (a monitor with a down-arrow) on the right of the address bar.',
        'Or open the menu (•••) → "Apps" → "Install this site as an app".',
        'Confirm "Install".',
      ],
    };
  }

  if (/Chrome|Chromium|CriOS|Brave|OPR\//i.test(ua)) {
    if (isAndroid) {
      return {
        family: 'chromium-android',
        label: 'Chrome on Android',
        steps: [
          'Tap the menu (⋮) in the toolbar.',
          'Choose "Install app" (or "Add to Home screen").',
          'Confirm "Install".',
        ],
      };
    }
    return {
      family: 'chromium-desktop',
      label: 'Chrome on desktop',
      steps: [
        'Click the install icon (⊕ or a monitor with a down-arrow) on the right of the address bar.',
        'Or open the menu (⋮) → "Install PWA Demo…".',
        'Confirm "Install".',
      ],
    };
  }

  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) {
    return {
      family: 'safari-macos',
      label: 'Safari on macOS',
      steps: [
        'Open the File menu in the Safari menu bar.',
        'Choose "Add to Dock…" (requires Safari 17+ on macOS Sonoma or newer).',
        'Confirm the name and click "Add".',
      ],
    };
  }

  return { family: 'other', label: 'this browser', steps: GENERIC_STEPS };
}

const GENERIC_STEPS = [
  'Look for an install icon on the right side of the address bar.',
  'If you don\'t see one, open the browser menu and look for "Install", "Add to Home screen", or "Add to Dock".',
];

type RelatedApp = { id?: string; platform?: string; url?: string };

/** Best-effort "is this PWA installed somewhere on this device?" — asked
 *  while the user is viewing the site in a normal browser tab.
 *
 *  Order of evidence:
 *    1. If we're *already running* as the installed PWA, this returns false
 *       (the caller wants "elsewhere", not "here").
 *    2. navigator.getInstalledRelatedApps() — authoritative on Chromium
 *       desktop + Android. Requires `related_applications: [{platform:'webapp',
 *       url:'/manifest.webmanifest'}]` in the manifest, which we declare.
 *    3. Sticky localStorage flag we set when `appinstalled` fired earlier in
 *       this browser/origin — covers browsers without the API (Safari, Firefox).
 *
 *  False negatives are expected (e.g. installed in a different browser on the
 *  same device, or installed before we shipped the flag) — fail safe by
 *  showing the Install CTA in those cases. */
export async function detectInstalledElsewhere(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isInstalled()) return false;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
  };
  if (typeof nav.getInstalledRelatedApps === 'function') {
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (apps.some((a) => a.platform === 'webapp')) return true;
      // Authoritative "no" on Chromium — but a stale localStorage flag from
      // before an uninstall would lie. Trust the API where available.
      return false;
    } catch {
      /* fall through to flag */
    }
  }
  return readInstalledFlag();
}

/** Attempt to hand off to the installed PWA via the custom protocol declared
 *  in the manifest (`web+pwademo`). On Chromium with the protocol handler
 *  registered, this launches the installed app at /?proto=open. On browsers
 *  that don't know the scheme, it's a silent no-op — the caller should keep
 *  fallback guidance visible so the user can still get there manually.
 *
 *  Returns false synchronously if we can tell the attempt won't work (no
 *  window), so the UI can skip the optimistic transition. */
export function openInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  // Setting location to a custom scheme either launches the registered
  // handler or no-ops; it does NOT replace the current document, so the
  // user stays put if nothing claims the scheme.
  window.location.href = 'web+pwademo:open';
  return true;
}
