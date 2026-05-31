import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { trackSwLifecycle } from './swLifecycle';

/**
 * Single source of truth for service-worker state. We register the SW exactly
 * once (via `virtual:pwa-register`) and expose its lifecycle through a tiny
 * subscribe store so the update toast and the footer version badge can both
 * read it without registering twice or fighting over intervals.
 *
 * Update flow (registerType: 'prompt' in vite.config.ts):
 *   1. A new build deploys → its SW installs and parks in "waiting".
 *   2. onNeedRefresh fires → needRefresh = true → <PwaUpdater> shows a toast.
 *   3. The toast counts down, then calls applyUpdate(), which posts
 *      SKIP_WAITING to the waiting SW and reloads on controllerchange.
 */

export type PwaState = {
  /** UTC calendar build number, e.g. "2026.05.31.50421" (see vite.config.ts). */
  version: string;
  /** ISO build timestamp. */
  buildTime: string;
  /** Everything is cached and the app can run offline (fires on first install). */
  offlineReady: boolean;
  /** A newer SW is waiting to take over. */
  needRefresh: boolean;
  /** The user/auto-apply has triggered the swap; a reload is imminent. */
  updating: boolean;
  /** Last time we polled the server for a new SW (ms epoch), or null. */
  lastChecked: number | null;
};

// How often to ask the server "is there a newer service worker?" while a tab
// stays open. 60s keeps long-lived sessions (someone parked on the game) from
// running a stale build for hours after a deploy.
const UPDATE_POLL_MS = 60_000;

let state: PwaState = {
  version: __APP_VERSION__,
  buildTime: __BUILD_TIME__,
  offlineReady: false,
  needRefresh: false,
  updating: false,
  lastChecked: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function set(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  emit();
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let started = false;

/** Register the service worker once. Safe to call repeatedly (no-op after the
 *  first). Call as early as possible — from main.tsx — so caching starts
 *  immediately on first visit. */
export function startPwa(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      set({ needRefresh: true });
    },
    onOfflineReady() {
      set({ offlineReady: true });
    },
    onRegisteredSW(_swScriptUrl, reg) {
      registration = reg;
      set({ lastChecked: Date.now() });
      if (reg) {
        // Observe the install→waiting→activate state machine and log each
        // version to the sw-history store (feeds the SW Lifecycle demo).
        trackSwLifecycle(reg);
        // Poll for a newer SW so open tabs pick up deploys without a manual
        // refresh. registration.update() is a no-op when nothing changed.
        window.setInterval(() => {
          void reg.update().then(() => set({ lastChecked: Date.now() }));
        }, UPDATE_POLL_MS);
      }
    },
    onRegisterError(err) {
      // Registration can fail on unsupported/locked-down browsers — the app
      // still works online, it just won't be offline-capable. Log for the
      // curious; there's nothing actionable for the user.
      console.warn('[pwa] service worker registration failed', err);
    },
  });
}

/** Apply the waiting update: posts SKIP_WAITING then reloads on controllerchange. */
export function applyUpdate(): void {
  if (!updateSW) return;
  set({ updating: true });
  void updateSW(true);
}

/** Force an immediate check for a new SW (used by the footer badge / poll). */
export async function checkForUpdate(): Promise<void> {
  try {
    await registration?.update();
  } finally {
    set({ lastChecked: Date.now() });
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): PwaState {
  return state;
}

/** React binding for the PWA state store. */
export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
