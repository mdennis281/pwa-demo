/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { recordVersion } from './lib/swHistoryDb';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Bumped on every build (UTC calendar build number, see vite.config.ts).
// Runtime caches are stamped with it so the new version's `activate` can
// delete the previous version's caches — "invalidate the old SW" literally.
const VERSION = __APP_VERSION__;
const RUNTIME_CACHES = {
  api: `api-${VERSION}`,
  assets: `assets-${VERSION}`,
};

// Precache the entire built app (every JS chunk, CSS, HTML, icon, the tiny
// demo video). That means every route and every demo whose logic is local —
// graphics, workers, storage, sensors, the games' rendering — runs fully
// offline once installed. cleanupOutdatedCaches() drops precache entries left
// behind by previous builds so storage doesn't grow without bound.
//
// EXCLUDE manifest.webmanifest from precaching. The server serves it per-Host
// (apps/server/src/pwaManifest.ts) so yesweb.app / pwa.dipduo.com / localhost
// each get their own PWA name + tinted icons. If it were precached, the SW
// would serve one env's cached copy for every host and Chrome would reset each
// install's identity back to a generic "YesWeb". Dropping it here removes it
// from both the precache download and the precache route, so the browser's
// manifest fetch falls through to the network (only needed online anyway, at
// install/identity-update time). vite-plugin-pwa force-injects this entry
// regardless of the build-time globPatterns, so the filter must live here.
precacheAndRoute(
  self.__WB_MANIFEST.filter((e) =>
    typeof e === 'string' ? true : e.url !== 'manifest.webmanifest',
  ),
);
cleanupOutdatedCaches();

// SPA navigation fallback: serve the precached index.html shell for ALL
// navigations — not just previously-visited URLs — so a cold offline load of
// e.g. /d/tower-climb works (React Router renders the route client-side from
// the precached JS). /api and /socket.io are server-handled and must never be
// answered with the HTML shell.
const navigationHandler = createHandlerBoundToURL('index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//, /^\/socket\.io\//],
  }),
);

// API: stale-while-revalidate so cached responses paint instantly offline and
// refresh in the background when online. (push/test is excluded — it must
// always hit the server.)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname !== '/api/push/test',
  new StaleWhileRevalidate({
    cacheName: RUNTIME_CACHES.api,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ request }) => ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: RUNTIME_CACHES.assets,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// ── Versioning / lifecycle ────────────────────────────────────────────────
// Record this version's install moment to the sw-history IndexedDB store the
// moment the `install` event fires. This is the authoritative timeline source
// for the SW Lifecycle demo: the running SW knows its own compiled VERSION, so
// attribution is always correct, and it's captured even when no tab is open to
// watch the registration's statechange stream. The page layers finer
// install→waiting→activate splits on top (lib/swLifecycle.ts).
self.addEventListener('install', (event) => {
  const at = Date.now();
  event.waitUntil(
    recordVersion({
      version: VERSION,
      buildTime: __BUILD_TIME__,
      scope: self.registration.scope,
      installAt: at,
      lastInstallAt: at,
      installCount: 1,
      firstSeenAt: at,
    }),
  );
});

// When a new version activates, purge runtime caches that don't belong to it
// (workbox's own precache is handled by cleanupOutdatedCaches above), then
// claim open clients so this freshly-installed SW controls them immediately —
// no "waiting" worker stuck behind open tabs. skipWaiting is triggered from
// the page (lib/pwa.ts → SKIP_WAITING message) right before it reloads.
// We bracket the cache purge with timestamps so the demo can show how long
// `activate` actually took.
self.addEventListener('activate', (event) => {
  const at = Date.now();
  event.waitUntil(
    (async () => {
      const keep = new Set<string>(Object.values(RUNTIME_CACHES));
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith('workbox-precache') && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      await recordVersion({ version: VERSION, activateAt: at, activateDoneAt: Date.now() });
    })(),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? safeJson(event.data) : {};
  const title = (data.title as string | undefined) ?? 'YesWeb';
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
  // Lets the page ask ANY worker (active OR waiting) for its compiled version
  // over a MessageChannel. The waiting worker is the *new* build, so the demo
  // can show "active 2026.05.31.a vs waiting 2026.05.31.b" during an update —
  // the literal version skew between the running bundle and the next SW.
  if (event.data?.type === 'SW_INFO') {
    event.ports[0]?.postMessage({
      version: VERSION,
      buildTime: __BUILD_TIME__,
      scope: self.registration.scope,
      runtimeCaches: Object.values(RUNTIME_CACHES),
    });
  }
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
