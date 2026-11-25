import { Pool, type PoolClient } from 'pg';
const preview = process.env.VERCEL_ENV === 'preview';
const connectionString = preview ? process.env.PREVIEW_DATABASE_URL : process.env.DATABASE_URL;
if(preview && (!connectionString || connectionString===process.env.DATABASE_URL)){
  throw new Error('Vercel preview requires a separate PREVIEW_DATABASE_URL.');
}
const shared = globalThis as typeof globalThis & { archivePool?: Pool };
export const db = shared.archivePool ?? new Pool({
  connectionString,
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

export async function asActor<T>(id:string|null, run:(client:PoolClient)=>Promise<T>){
  return transaction(async client=>{
    await client.query("SELECT set_config('reissue.actor',$1,true)",[id??'']);
    return run(client);
  });
}
