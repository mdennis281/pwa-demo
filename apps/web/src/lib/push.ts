export async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.ready;
  if (!reg) throw new Error('Service worker not ready');
  return reg;
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/vapid-public-key');
  if (!res.ok) throw new Error('failed to fetch VAPID public key');
  const j = (await res.json()) as { publicKey: string };
  return j.publicKey;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

export async function subscribe(): Promise<PushSubscription> {
  const reg = await getRegistration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const publicKey = await fetchVapidPublicKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub),
  });
  return sub;
}

export async function unsubscribe(): Promise<boolean> {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  return sub.unsubscribe();
}

/** Best-effort re-register so the server's in-memory sub map doesn't get
 *  out of sync after a process restart. Both /test and /test/delayed call
 *  this so the test path is self-healing. */
async function reaffirmSubscription(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub),
  }).catch(() => {
    /* /test or /test/delayed will surface the real error if there is one */
  });
}

export async function sendTest(title?: string, body?: string): Promise<{ sent: number; failed: number; total: number }> {
  await reaffirmSubscription();
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(`server returned ${res.status}${detail?.error ? ` — ${detail.error}` : ''}`);
  }
  return res.json();
}

export type ScheduledTest = {
  ok: true;
  scheduled: true;
  delaySeconds: number;
  firesAt: number;
  total: number;
};

/** Ask the server to fire a push N seconds from now. Returns immediately so
 *  the user can close the tab — the whole point is that web push reaches
 *  the OS via the push provider even when no client is connected. */
export async function scheduleDelayedTest(
  delaySeconds: number,
  title?: string,
  body?: string,
): Promise<ScheduledTest> {
  await reaffirmSubscription();
  const res = await fetch('/api/push/test/delayed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ delaySeconds, title, body }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(`server returned ${res.status}${detail?.error ? ` — ${detail.error}` : ''}`);
  }
  return res.json();
}

export type PushEvent =
  | { type: 'push:received'; title: string; body: string; url: string; at: number }
  | { type: 'push:shown'; at: number }
  | { type: 'push:error'; message: string; at: number };

/** Subscribe to SW → page debug messages. The Push UI uses this to render
 *  an audit trail so a missing OS notification can be triaged into "didn't
 *  reach SW" vs. "reached SW but OS suppressed it". Returns unsubscribe. */
export function onPushEvent(fn: (e: PushEvent) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }
  const handler = (ev: MessageEvent) => {
    const data = ev.data as PushEvent | undefined;
    if (data && typeof data.type === 'string' && data.type.startsWith('push:')) fn(data);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
