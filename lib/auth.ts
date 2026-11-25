import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db,transaction } from './db';
import { configuredOrigin } from './site';
const derive = promisify(scrypt);
const cookieName = 'reissue_session';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const ttl = 60*60*24*30;
export type Viewer = {id:string; name:string; email:string; role:'member'|'admin'; search_history:boolean;username:string|null;has_avatar:boolean;authenticated_at:Date|null;has_password:boolean};
export async function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password,salt,64) as Buffer;
  return salt+':'+key.toString('hex');
}
export async function matchesPassword(password: string, stored?: string|null) {
  if(stored && !/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(stored))return false;
  const expected = stored ?? '00000000000000000000000000000000:'+ '0'.repeat(128);
  return timingSafeEqual(Buffer.from(await passwordHash(password,expected.split(':')[0])),Buffer.from(expected)) && Boolean(stored);
}
export async function viewer() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const {rows} = await db.query<Viewer>('SELECT p.id,p.name,p.email,p.role,p.search_history,p.username,p.avatar_bytes IS NOT NULL AS has_avatar,s.authenticated_at,p.password_hash IS NOT NULL AS has_password FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND p.disabled_at IS NULL AND (NOT p.verification_required OR p.email_verified_at IS NOT NULL)',[hash(token)]);
  return rows[0] ?? null;
}
export async function startSession(id: string, expectedPasswordHash?:string|null) {
  const jar=await cookies();
  const previous=jar.get(cookieName)?.value;
  const token=randomBytes(32).toString('base64url');
  const issued=await transaction(async client=>{
    const {rows:[profile]}=await client.query<{password_hash:string|null}>(`SELECT password_hash FROM profiles WHERE id=$1
      AND disabled_at IS NULL AND (NOT verification_required OR email_verified_at IS NOT NULL) FOR UPDATE`,[id]);
    if(!profile||(expectedPasswordHash!==undefined&&expectedPasswordHash!==profile.password_hash))return false;
    if(previous)await client.query('DELETE FROM sessions WHERE token_hash=$1',[hash(previous)]);
    await client.query("INSERT INTO sessions(token_hash,user_id,expires_at,authenticated_at) VALUES($1,$2,now()+($3::int*interval '1 second'),now())",[hash(token),id,ttl]);
    return true;
  });
  if(!issued)return false;
  jar.set(cookieName,token,{httpOnly:true,sameSite:'lax',secure:configuredOrigin()?.startsWith('https:') ?? process.env.NODE_ENV==='production',path:'/',maxAge:ttl});
  return true;
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
