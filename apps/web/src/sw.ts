/// <reference lib="WebWorker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname !== '/api/push/test',
  new StaleWhileRevalidate({
    cacheName: 'api',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ request }) => ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

self.addEventListener('push', (event) => {
  const data = event.data ? safeJson(event.data) : {};
  const title = (data.title as string | undefined) ?? 'PWA Demo';
  const body = (data.body as string | undefined) ?? '';
  const url = (data.url as string | undefined) ?? '/';
  // Run both branches under waitUntil so the SW stays alive long enough for
  // both the OS notification AND the client broadcast to complete.
  event.waitUntil((async () => {
    // Step 1: broadcast to any open clients FIRST so the page log can prove
    // the SW received the push, even if the OS swallows the notification
    // (Focus Assist, system DND, per-app blocks). This is the single most
    // useful debug signal when "server says sent=1 but I see nothing".
    await broadcastToClients({ type: 'push:received', title, body, url, at: Date.now() });
    // Step 2: show the notification. requireInteraction keeps it visible
    // until the user dismisses it — without that flag, notifications
    // auto-fade in ~5s on most platforms and are trivially missed during
    // demos. The per-event tag prevents Chrome from collapsing rapid
    // testing sends into a single popup.
    try {
      await self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: `push-${Date.now()}`,
        timestamp: Date.now(),
        requireInteraction: true,
        data: { url },
      } as NotificationOptions);
      await broadcastToClients({ type: 'push:shown', at: Date.now() });
    } catch (err) {
      // showNotification can throw on platforms that have permission revoked
      // mid-session, or when the SW lost activation. Telling the page lets
      // the user see *why* the notification didn't appear.
      await broadcastToClients({
        type: 'push:error',
        message: (err as Error).message ?? String(err),
        at: Date.now(),
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const found = all.find((c) => c.url.includes(url));
      if (found) {
        await found.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('periodicsync', ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'pbs-demo') {
    event.waitUntil(
      (async () => {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open('pwa-demo', 1);
            req.onupgradeneeded = () => {
              req.result.createObjectStore('pbs-sync');
              req.result.createObjectStore('pbs-queue', { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          // Record the sync time
          const txSync = db.transaction('pbs-sync', 'readwrite');
          await new Promise<void>((resolve) => {
            txSync.objectStore('pbs-sync').put({ lastSync: Date.now() }, 'pbs-demo');
            resolve();
          });

          // Mark all unsynced queue items as synced
          const txQueue = db.transaction('pbs-queue', 'readwrite');
          const items = await new Promise<any[]>((resolve, reject) => {
            const req = txQueue.objectStore('pbs-queue').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });

          for (const item of items) {
            if (!item.synced) {
              await new Promise<void>((resolve, reject) => {
                const req = txQueue.objectStore('pbs-queue').put({ ...item, synced: true });
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
              });
            }
          }
        } catch (_err) {
          // best effort
        }
      })(),
    );
  }
}) as EventListener);


function safeJson(d: PushMessageData): Record<string, unknown> {
  try { return d.json(); } catch { return { body: d.text() }; }
}

/** Fan out a debug event to every open client window so the Push page can
 *  render an in-page audit trail (received → shown). Fails silently — the
 *  notification path is the real product; this is purely diagnostic. */
async function broadcastToClients(message: Record<string, unknown>): Promise<void> {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage(message);
  } catch {
    /* best effort */
  }
}
