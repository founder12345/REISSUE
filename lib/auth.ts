import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db } from './db';
const derive = promisify(scrypt);
const cookieName = 'reissue_session';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ttl = 60*60*24*30;
export type Viewer = {id:string; name:string; email:string; role:'member'|'admin'; search_history:boolean};
export async function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password,salt,64) as Buffer;
  return salt+':'+key.toString('hex');
}
export async function matchesPassword(password: string, stored?: string) {
  const expected = stored ?? '00000000000000000000000000000000:'+ '0'.repeat(128);
  return timingSafeEqual(Buffer.from(await passwordHash(password,expected.split(':')[0])),Buffer.from(expected)) && Boolean(stored);
}
export async function viewer() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const {rows} = await db.query<Viewer>('SELECT p.id,p.name,p.email,p.role,p.search_history FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND p.disabled_at IS NULL',[hash(token)]);
  return rows[0] ?? null;
}
export async function startSession(id: string) {
  await endSession();
  const token = randomBytes(32).toString('base64url');
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+($3::int*interval '1 second'))",[hash(token),id,ttl]);
  (await cookies()).set(cookieName,token,{httpOnly:true,sameSite:'lax',secure:process.env.APP_ORIGIN?.startsWith('https://') ?? process.env.NODE_ENV==='production',path:'/',maxAge:ttl});
}
export async function endSession() {
  const jar=await cookies();
  const token=jar.get(cookieName)?.value;
  if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(token)]);
  jar.delete(cookieName);
}
export async function limit(key: string, maximum: number, period: number) {
  const {rows}=await db.query<{hits:number}>(`INSERT INTO rate_limits(bucket,hits,expires_at) VALUES($1,1,now()+($2::int*interval '1 second'))
    ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.hits+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<=now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING hits`,[hash(key),period]);
  return rows[0].hits<=maximum;
}
