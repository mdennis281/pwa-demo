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

export async function sendTest(title?: string, body?: string): Promise<{ sent: number; failed: number; total: number }> {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) throw new Error(`server returned ${res.status}`);
  return res.json();
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
