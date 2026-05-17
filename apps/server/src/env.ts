import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../');
config({ path: path.join(repoRoot, '.env') });

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://pwademo:pwademo@localhost:5432/pwademo'),
  VAPID_PUBLIC_KEY: z.string().min(1, 'run `npm run gen:vapid` at repo root to generate VAPID keys'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'run `npm run gen:vapid` at repo root to generate VAPID keys'),
  VAPID_SUBJECT: z.string().refine(
    (s) => s.startsWith('mailto:') || s.startsWith('https://'),
    'VAPID_SUBJECT must start with mailto: or https://',
  ),
});

export const env = schema.parse(process.env);
