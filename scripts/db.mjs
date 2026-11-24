import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { scryptSync, randomBytes } from 'node:crypto';
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL or copy .env.example to .env.local.");
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const db = await pool.connect();
try {
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(627964310)');
  if (process.argv[2] === 'migrate') {
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const {rows:[schema]} = await db.query(`SELECT to_regprocedure('archive_fold(text)') IS NOT NULL AS has_foundation,
      EXISTS(SELECT 1 FROM schema_migrations WHERE filename='001-foundation.sql') AS tracked`);
    if (schema.has_foundation && !schema.tracked) {
      throw new Error('Found an existing REISSUE schema without a foundation migration record. Compare it against db/001-foundation.sql and reconcile the history before rerunning migrations.');
    }
    for (const file of (await readdir('db')).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      if ((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount) continue;
      await db.query(await readFile('db/'+file,'utf8'));
      await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[file]);
      console.log('Applied',file);
    }
  } else if (process.argv[2] === 'seed') {
    await db.query(await readFile('db/demo.sql','utf8'));
  } else if (process.argv[2] === 'admin') {
    const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password=process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12 || password.length > 128) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12–128 characters).');
    const salt=randomBytes(16).toString('hex');
    await db.query("INSERT INTO profiles(email,name,password_hash,role) VALUES($1,'Archive administrator',$2,'admin')",[email,salt+':'+scryptSync(password,salt,64).toString('hex')]);
  } else throw new Error('Use migrate, seed or admin.');
  await db.query('COMMIT');
} catch(error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  db.release();
  await pool.end();
}
