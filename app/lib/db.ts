// app/lib/db.ts
import { neon } from '@neondatabase/serverless';

// Cache the client across invocations (Edge-friendly)
let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to your Vercel project/environment.');
  }
  if (!_sql) _sql = neon(url);
  return _sql;
}
