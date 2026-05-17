import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  try {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    pool.on('error', (err) => console.warn('[db] pool error:', err.message));
    dbInstance = drizzle(pool, { schema });
    return dbInstance;
  } catch (e) {
    console.warn('[db] unavailable, continuing without DB:', (e as Error).message);
    return null;
  }
}
