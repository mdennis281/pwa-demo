import { sql } from 'drizzle-orm';
import type { TowerHighScore } from '@pwa-demo/shared';
import { getDb } from './client.js';
import { towerHighScores } from './schema.js';

/** Ensure the `tower_high_scores` table exists. Runs once on server boot.
 *  We use `CREATE TABLE IF NOT EXISTS` so the server starts cleanly whether
 *  the operator has run `npm run db:push` yet or not. Idempotent. */
export async function ensureTowerScoresTable(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tower_high_scores (
        id            SERIAL PRIMARY KEY,
        display_name  TEXT NOT NULL,
        character     INTEGER NOT NULL,
        max_height    REAL NOT NULL,
        session_ms    INTEGER NOT NULL,
        achieved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS tower_high_scores_max_height_idx
        ON tower_high_scores (max_height DESC)
    `);
    return true;
  } catch (e) {
    console.warn('[db] tower_high_scores init failed:', (e as Error).message);
    return false;
  }
}

/** Insert a high score row. Silent no-op when the DB is unavailable so the
 *  game keeps running on dev machines without Postgres. */
export async function recordTowerHighScore(opts: {
  displayName: string;
  character: number;
  maxHeight: number;
  sessionMs: number;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  if (!Number.isFinite(opts.maxHeight) || opts.maxHeight <= 0) return;
  try {
    await db.insert(towerHighScores).values({
      displayName: opts.displayName.slice(0, 40),
      character: opts.character | 0,
      maxHeight: opts.maxHeight,
      sessionMs: Math.max(0, opts.sessionMs | 0),
    });
  } catch (e) {
    console.warn('[db] insert high score failed:', (e as Error).message);
  }
}

/** Top-N leaderboard, deduplicated by (display_name, character). Returns the
 *  player's single best score, not every session they played. */
export async function topTowerHighScores(limit = 10): Promise<TowerHighScore[]> {
  const db = getDb();
  if (!db) return [];
  try {
    // Postgres-native DISTINCT ON gives us "row with max per group" cheaply.
    // Outer ORDER BY then ranks the deduplicated set by best score.
    const rows = await db.execute<{
      display_name: string;
      character: number;
      max_height: number;
      achieved_at: Date;
    }>(sql`
      SELECT display_name, character, max_height, achieved_at
      FROM (
        SELECT DISTINCT ON (display_name, character)
               display_name, character, max_height, achieved_at
        FROM tower_high_scores
        ORDER BY display_name, character, max_height DESC
      ) best
      ORDER BY max_height DESC
      LIMIT ${limit}
    `);
    return rows.rows.map((r) => ({
      displayName: r.display_name,
      character: r.character,
      maxHeight: Number(r.max_height),
      achievedAt: new Date(r.achieved_at).getTime(),
    }));
  } catch (e) {
    console.warn('[db] read leaderboard failed:', (e as Error).message);
    return [];
  }
}

