import { Pool, type PoolClient } from 'pg';
const shared = globalThis as typeof globalThis & { archivePool?: Pool };
export const db = shared.archivePool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  statement_timeout: 8000,
  idleTimeoutMillis: 10000,
});
if (process.env.NODE_ENV !== 'production') shared.archivePool = db;

export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const value = await run(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
