import { useSyncExternalStore } from 'react';

/**
 * Shared state for the titlebar-takeover demo (demos/install-pwa/wco-takeover).
 *
 * This module is deliberately the one place a demo reaches outside its own
 * box. The demo flips switches here; <WcoTitlebar> — which lives in the root
 * Layout, nowhere near any demo — re-renders off them. That IS the demo:
 * under Window Controls Overlay the titlebar strip is just more of your page,
 * so a feature anywhere in the app can own it the way a native app owns its
 * own window chrome.
 *
 * State is in-memory only. Reload and you get the plain titlebar back — a
 * demo that permanently rebrands the app would be a bug, not a feature.
 */

export type WcoAlertTone = 'info' | 'warn' | 'ok';

export type WcoAlert = {
  id: number;
  tone: WcoAlertTone;
  title: string;
  detail: string;
};

/** The three effects, one per button in the demo. They stack. */
export type WcoEffect = 'controls' | 'rainbow' | 'duck';

export type WcoTakeoverState = {
  /** Drop the app title; render an alert bell + settings gear instead. */
  controls: boolean;
  /** Sweep an animated rainbow across the strip background. */
  rainbow: boolean;
  /** Send a duck waddling across behind the chrome. */
  duck: boolean;
  /** Fake notification feed sitting behind the bell. */
  alerts: WcoAlert[];
  unread: number;
};

const EMPTY: WcoTakeoverState = {
  controls: false,
  rainbow: false,
  duck: false,
  alerts: [],
  unread: 0,
};

/**
 * Canned notifications. The first SEED_COUNT land the moment the bell
 * appears; the rest trickle in on a timer so the badge visibly ticks up
 * while you're looking at it — a static "3" reads as a decoration, a
 * counter that moves reads as a real app.
 */
const ALERT_FEED: Omit<WcoAlert, 'id'>[] = [
  { tone: 'warn', title: 'Storage quota at 82%', detail: 'OPFS sandbox is filling up' },
  { tone: 'info', title: '3 clients connected', detail: '2 phones · 1 desktop on this origin' },
  { tone: 'ok', title: 'Service worker activated', detail: 'New version live, stale caches pruned' },
  { tone: 'warn', title: 'Background sync queued', detail: '4 requests waiting to flush' },
  { tone: 'info', title: 'Push subscription renewed', detail: 'VAPID key rotated cleanly' },
  { tone: 'ok', title: 'Passkey registered', detail: 'New credential bound to this device' },
];
const SEED_COUNT = 3;
const TRICKLE_MS = 9000;

let state: WcoTakeoverState = EMPTY;
const listeners = new Set<() => void>();

let feedCursor = 0;
let nextId = 0;
let trickleTimer: number | undefined;

function emit(): void {
  for (const l of listeners) l();
}

function set(patch: Partial<WcoTakeoverState>): void {
  state = { ...state, ...patch };
  emit();
}

/** Appends the next canned alert. Returns false once the feed is exhausted. */
function pushAlert(): boolean {
  if (feedCursor >= ALERT_FEED.length) return false;
  const alert: WcoAlert = { id: ++nextId, ...ALERT_FEED[feedCursor++] };
  set({ alerts: [alert, ...state.alerts], unread: state.unread + 1 });
  return true;
}

function startTrickle(): void {
  stopTrickle();
  trickleTimer = window.setInterval(() => {
    if (!pushAlert()) stopTrickle();
  }, TRICKLE_MS);
}

function stopTrickle(): void {
  if (trickleTimer === undefined) return;
  window.clearInterval(trickleTimer);
  trickleTimer = undefined;
}

function setControls(on: boolean): void {
  if (on === state.controls) return;
  if (!on) {
    stopTrickle();
    set({ controls: false });
    return;
  }
  // Seed on first switch-on only; toggling off and back on resumes the same
  // feed rather than dumping three more copies into it.
  if (feedCursor === 0) for (let i = 0; i < SEED_COUNT; i++) pushAlert();
  set({ controls: true });
  startTrickle();
}

export function setWcoEffect(effect: WcoEffect, on: boolean): void {
  if (effect === 'controls') return setControls(on);
  if (state[effect] === on) return;
  set({ [effect]: on });
}

export function toggleWcoEffect(effect: WcoEffect): void {
  setWcoEffect(effect, !state[effect]);
}

/** Hands the strip back: every effect off, alert feed rewound. */
export function resetWcoTakeover(): void {
  stopTrickle();
  feedCursor = 0;
  if (state === EMPTY) return;
  state = EMPTY;
  emit();
}

export function markWcoAlertsRead(): void {
  if (state.unread === 0) return;
  set({ unread: 0 });
}

export function dismissWcoAlert(id: number): void {
  const alerts = state.alerts.filter((a) => a.id !== id);
  if (alerts.length === state.alerts.length) return;
  set({ alerts, unread: Math.min(state.unread, alerts.length) });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): WcoTakeoverState {
  return state;
}

/** React binding for the takeover state. */
export function useWcoTakeover(): WcoTakeoverState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
