/**
 * Persistent log of every service-worker version this device has installed.
 *
 * Written from TWO sides and merged in place, keyed by version string:
 *   - the SW itself (sw.ts) records its own `install` / `activate` event
 *     timestamps — authoritative, correctly attributed (the running SW knows
 *     its own compiled VERSION), and captured even when no tab is watching.
 *   - the page (lib/swLifecycle.ts) observes the registration `statechange`
 *     stream and fills in the finer installing→installed→activating→activated
 *     splits that the SW can't see about itself.
 *
 * Deliberately a SEPARATE database from the app's `pwa-demo` IDB (used by the
 * periodic-sync demo): a standalone store means a single fixed schema version
 * and no upgrade races between unrelated features. This module is imported by
 * both the window and the service-worker bundle, so it must stay pure IDB —
 * no DOM, no `navigator`. `indexedDB` is a global in both scopes.
 */

export const SW_HISTORY_DB = 'sw-history';
export const SW_HISTORY_STORE = 'versions';
export const SW_HISTORY_DB_VERSION = 1;

export type SwVersionRecord = {
  /** App/SW version string, e.g. "2026.05.31.50421" — the keyPath. */
  version: string;
  /** ISO build timestamp this version was cut at. */
  buildTime?: string;
  /** Registration scope the SW controls. */
  scope?: string;

  // ── SW-recorded event timestamps (ms epoch) — always present ──
  /** `install` event fired (first time this version installed). */
  installAt?: number;
  /** `install` event fired most recently (repeat installs of same version). */
  lastInstallAt?: number;
  /** `activate` event fired. */
  activateAt?: number;
  /** `activate` waitUntil (cache purge + clients.claim) finished. */
  activateDoneAt?: number;
  /** How many times this version's `install` event has fired. */
  installCount?: number;

  // ── Page-observed lifecycle (ms epoch) — present only if a tab watched ──
  installingAt?: number;
  installedAt?: number;
  activatingAt?: number;
  activatedAt?: number;
  /** controllerchange — this version took control of the page. */
  controlledAt?: number;

  /** First moment any writer saw this version. */
  firstSeenAt?: number;
};

/** Fields where the FIRST value wins (monotonic milestones — never clobber). */
const FIRST_WINS: (keyof SwVersionRecord)[] = [
  'installAt',
  'activateAt',
  'activateDoneAt',
  'installingAt',
  'installedAt',
  'activatingAt',
  'activatedAt',
  'controlledAt',
  'firstSeenAt',
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_HISTORY_DB, SW_HISTORY_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SW_HISTORY_STORE)) {
        req.result.createObjectStore(SW_HISTORY_STORE, { keyPath: 'version' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function merge(existing: SwVersionRecord, patch: Partial<SwVersionRecord>): SwVersionRecord {
  const out: SwVersionRecord = { ...existing };
  for (const [k, v] of Object.entries(patch) as [keyof SwVersionRecord, unknown][]) {
    if (v === undefined) continue;
    if (k === 'installCount') {
      out.installCount = (existing.installCount ?? 0) + (v as number);
    } else if (FIRST_WINS.includes(k) && existing[k] != null) {
      // keep the earlier milestone
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Upsert one version's record, merging the patch into whatever is stored.
 * Read-modify-write happens inside a single readwrite transaction, so
 * concurrent writes from the SW and the page can't lose each other's fields.
 * Best-effort: resolves quietly on any IDB failure (private mode, eviction).
 */
export async function recordVersion(
  patch: Partial<SwVersionRecord> & { version: string },
): Promise<void> {
  let db: IDBDatabase | undefined;
  try {
    db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(SW_HISTORY_STORE, 'readwrite');
      const store = tx.objectStore(SW_HISTORY_STORE);
      const getReq = store.get(patch.version);
      getReq.onsuccess = () => {
        const existing = (getReq.result as SwVersionRecord | undefined) ?? {
          version: patch.version,
        };
        store.put(merge(existing, patch));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* best effort — history is diagnostic, never load-bearing */
  } finally {
    db?.close();
  }
}

/** All recorded versions, newest install first. Empty array on any failure. */
export async function readHistory(): Promise<SwVersionRecord[]> {
  let db: IDBDatabase | undefined;
  try {
    db = await openDb();
    const rows = await new Promise<SwVersionRecord[]>((resolve, reject) => {
      const tx = db!.transaction(SW_HISTORY_STORE, 'readonly');
      const req = tx.objectStore(SW_HISTORY_STORE).getAll();
      req.onsuccess = () => resolve((req.result as SwVersionRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return rows.sort(
      (a, b) =>
        (b.installAt ?? b.firstSeenAt ?? 0) - (a.installAt ?? a.firstSeenAt ?? 0),
    );
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

/** Wipe the history store (keeps the current version's record). */
export async function clearHistory(keepVersion?: string): Promise<void> {
  let db: IDBDatabase | undefined;
  try {
    db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(SW_HISTORY_STORE, 'readwrite');
      const store = tx.objectStore(SW_HISTORY_STORE);
      const keyReq = store.getAllKeys();
      keyReq.onsuccess = () => {
        for (const key of keyReq.result as string[]) {
          if (key !== keepVersion) store.delete(key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best effort */
  } finally {
    db?.close();
  }
}
