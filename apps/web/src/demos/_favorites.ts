import { useEffect, useSyncExternalStore } from 'react';

/**
 * Favorites store. IndexedDB so it survives across sessions and across
 * subdomains-per-PWA-install. Schema:
 *
 *   db   `pwa-demo-prefs`  (version 1)
 *   store `favorites`      keyPath: 'id'   record: { id, addedAt }
 *
 * The store is a thin singleton: in-memory `Set<string>` mirrors the DB and
 * is what React renders from. Mutations write through to IDB and notify
 * subscribers. Cross-tab sync is best-effort via a BroadcastChannel.
 */

const DB_NAME = 'pwa-demo-prefs';
const DB_VERSION = 1;
const STORE = 'favorites';

type Listener = () => void;

class FavoritesStore {
  private favorites = new Set<string>();
  private listeners = new Set<Listener>();
  private ready: Promise<void>;
  private channel: BroadcastChannel | null = null;

  constructor() {
    // emit() after load so subscribers attached pre-load (the very first
    // React render) see the persisted set on the next tick.
    this.ready = this.load().then(() => this.emit());
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('pwa-demo:favorites');
      this.channel.onmessage = (e) => {
        if (e.data?.type === 'sync') this.load().then(() => this.emit());
      };
    }
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async load(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE, 'readonly');
      const ids = await new Promise<string[]>((resolve, reject) => {
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve((req.result as string[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      this.favorites = new Set(ids);
    } catch {
      // IDB unavailable (private mode etc.) — degrade silently.
    }
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  // useSyncExternalStore requires a stable snapshot identity. The Set
  // identity is replaced on every mutation so a `===` check is enough.
  getSnapshot = (): ReadonlySet<string> => this.favorites;

  has(id: string): boolean {
    return this.favorites.has(id);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private broadcast() {
    this.channel?.postMessage({ type: 'sync' });
  }

  async toggle(id: string): Promise<void> {
    await this.ready;
    const next = new Set(this.favorites);
    const adding = !next.has(id);
    if (adding) next.add(id);
    else next.delete(id);
    this.favorites = next;
    this.emit();
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (adding) store.put({ id, addedAt: Date.now() });
      else store.delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.broadcast();
    } catch {
      // best effort
    }
  }

  async clear(): Promise<void> {
    this.favorites = new Set();
    this.emit();
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.broadcast();
    } catch {
      // best effort
    }
  }
}

const store = new FavoritesStore();

/** Returns the live Set of favorite demo ids, plus mutators. */
export function useFavorites(): {
  favorites: ReadonlySet<string>;
  toggle: (id: string) => void;
  isFavorite: (id: string) => boolean;
} {
  const favorites = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  // The first render returns whatever is in memory at construction time.
  // We don't trigger a re-render after the async load explicitly — it's
  // emitted via this.emit() once load() resolves.
  useEffect(() => {
    // no-op: subscription handled by useSyncExternalStore
  }, []);
  return {
    favorites,
    toggle: (id) => { void store.toggle(id); },
    isFavorite: (id) => favorites.has(id),
  };
}

/** Imperative helper for non-component code. */
export const favoritesStore = {
  toggle: (id: string) => store.toggle(id),
  has: (id: string) => store.has(id),
};
