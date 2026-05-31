import { boolean, index, integer, pgTable, real, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const connectionEvents = pgTable('connection_events', {
  id: serial('id').primaryKey(),
  socketId: text('socket_id').notNull(),
  kind: text('kind').notNull(),
  userAgent: text('user_agent'),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
});

/** One row per session-best on the Official Tower Climb server. We write
 *  whenever a player leaves/disconnects from the official lobby with a
 *  recorded max_height > 0. Cross-session leaderboard queries take the
 *  highest score per (display_name, character) pair. */
export const towerHighScores = pgTable(
  'tower_high_scores',
  {
    id: serial('id').primaryKey(),
    displayName: text('display_name').notNull(),
    character: integer('character').notNull(),
    maxHeight: real('max_height').notNull(),
    sessionMs: integer('session_ms').notNull(),
    achievedAt: timestamp('achieved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Hot read path is "top N by max_height desc". A descending index keeps
    // ORDER BY ... DESC LIMIT N cheap as the table grows.
    byMaxHeight: index('tower_high_scores_max_height_idx').on(t.maxHeight),
  }),
);

/** Singleton (id = 1) row holding the admin-editable, fleet-wide config for the
 *  always-on dedicated ("Official") Tower Climb servers: whether they run, how
 *  many, and the per-server player cap. Read once on boot to materialize the
 *  dedicated lobbies, then rewritten whenever an admin applies changes from the
 *  server-browser admin menu. Survives restarts; the live lobbies don't. */
export const serverConfig = pgTable('server_config', {
  id: integer('id').primaryKey(), // always 1 — there is exactly one config row
  dedicatedEnabled: boolean('dedicated_enabled').notNull().default(true),
  dedicatedCount: integer('dedicated_count').notNull().default(1),
  dedicatedPlayerCap: integer('dedicated_player_cap').notNull().default(25),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
