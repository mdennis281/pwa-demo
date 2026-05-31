import { sql } from 'drizzle-orm';
import type { ServerConfig } from '@pwa-demo/shared';
import { getDb } from './client.js';

/** Mirror of `DEFAULT_SERVER_CONFIG` in packages/shared. Duplicated because the
 *  shared package is consumed as raw TS source — a value import would crash the
 *  compiled Node server trying to require a `.ts` file (see the shared README). */
const DEFAULT_SERVER_CONFIG: ServerConfig = {
  dedicatedEnabled: true,
  dedicatedCount: 1,
  dedicatedPlayerCap: 25,
};

// Bounds. Servers are real in-memory lobbies (one snapshot fan-out each), so
// the count is kept modest; the player cap is generous ("as many as the heart
// desires") but still bounded to avoid a typo melting the tick loop.
const MIN_COUNT = 1;
const MAX_COUNT = 50;
const MIN_CAP = 1;
const MAX_CAP = 1000;

/** Process-wide source of truth at runtime. Seeded from the DB on boot
 *  (`loadServerConfig`) and kept in sync on every write. Reads never touch the
 *  DB — reconcile/quick-join run against this cache, so the feature works fully
 *  even when Postgres is unavailable (it just doesn't survive a restart). */
let cache: ServerConfig = { ...DEFAULT_SERVER_CONFIG };

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  const n = Math.floor(v);
  return n < min ? min : n > max ? max : n;
}

function clampConfig(c: ServerConfig): ServerConfig {
  return {
    dedicatedEnabled: !!c.dedicatedEnabled,
    dedicatedCount: clamp(c.dedicatedCount, MIN_COUNT, MAX_COUNT),
    dedicatedPlayerCap: clamp(c.dedicatedPlayerCap, MIN_CAP, MAX_CAP),
  };
}

/** The current in-memory config. Always defined (defaults until loaded). */
export function getServerConfig(): ServerConfig {
  return cache;
}

/** Create the `server_config` table and seed its singleton row. Idempotent;
 *  uses CREATE TABLE IF NOT EXISTS so boot succeeds whether or not the operator
 *  has run `db:push`. No-op (returns false) when the DB is unavailable. */
export async function ensureServerConfigTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS server_config (
        id                    INTEGER PRIMARY KEY,
        dedicated_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
        dedicated_count       INTEGER NOT NULL DEFAULT 1,
        dedicated_player_cap  INTEGER NOT NULL DEFAULT 25,
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`INSERT INTO server_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    return true;
  } catch (e) {
    console.warn('[db] server_config init failed:', (e as Error).message);
    return false;
  }
}

/** Load the persisted config into the cache. Returns the cache either way, so
 *  the caller always gets a usable config (defaults when there's no DB). */
export async function loadServerConfig(): Promise<ServerConfig> {
  const db = getDb();
  if (!db) return cache;
  try {
    const rows = await db.execute<{
      dedicated_enabled: boolean;
      dedicated_count: number;
      dedicated_player_cap: number;
    }>(sql`
      SELECT dedicated_enabled, dedicated_count, dedicated_player_cap
      FROM server_config WHERE id = 1
    `);
    const r = rows.rows[0];
    if (r) {
      cache = clampConfig({
        dedicatedEnabled: r.dedicated_enabled,
        dedicatedCount: Number(r.dedicated_count),
        dedicatedPlayerCap: Number(r.dedicated_player_cap),
      });
    }
    return cache;
  } catch (e) {
    console.warn('[db] server_config read failed:', (e as Error).message);
    return cache;
  }
}

/** Merge `patch` into the config, clamp it, update the cache, and best-effort
 *  persist to the DB. Returns the clamped result. The cache is updated even if
 *  the DB write fails, so the change still takes effect this process lifetime. */
export async function saveServerConfig(patch: Partial<ServerConfig>): Promise<ServerConfig> {
  cache = clampConfig({ ...cache, ...patch });
  const db = getDb();
  if (db) {
    try {
      await db.execute(sql`
        INSERT INTO server_config (id, dedicated_enabled, dedicated_count, dedicated_player_cap, updated_at)
        VALUES (1, ${cache.dedicatedEnabled}, ${cache.dedicatedCount}, ${cache.dedicatedPlayerCap}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          dedicated_enabled    = EXCLUDED.dedicated_enabled,
          dedicated_count      = EXCLUDED.dedicated_count,
          dedicated_player_cap = EXCLUDED.dedicated_player_cap,
          updated_at           = NOW()
      `);
    } catch (e) {
      console.warn('[db] server_config write failed:', (e as Error).message);
    }
  }
  return cache;
}
