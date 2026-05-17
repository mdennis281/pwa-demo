import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const connectionEvents = pgTable('connection_events', {
  id: serial('id').primaryKey(),
  socketId: text('socket_id').notNull(),
  kind: text('kind').notNull(),
  userAgent: text('user_agent'),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
});
