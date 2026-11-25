import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { db } from './db';
import { sendMail } from './mail';
import { siteOrigin } from './site';

export const token = () => randomBytes(32).toString('base64url');
export const hashOpaque = (value:string) => createHash('sha256').update(value).digest('hex');
export const tokenField = z.string().regex(/^[a-zA-Z0-9_-]{43}$/);
export const usernameField = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/);
type Purpose = 'verify'|'reset';

export async function sendAccountLink(userId:string,email:string,purpose:Purpose){
  const value=token(), hash=hashOpaque(value);
  await db.query(`INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at)
    VALUES($1,$2,$3,now()+$4::int*interval '1 minute')`,[hash,userId,purpose,purpose==='verify'?60:20]);
  const link=new URL('/account/access',siteOrigin());
  link.searchParams.set('purpose',purpose);
  link.searchParams.set('token',value);
  try{
    await sendMail(email,purpose==='verify'?'Verify your REISSUE email':'Reset your REISSUE password',
      purpose==='verify'?'Open the link and enter the password you chose when you registered. This link expires in one hour.':'Open the link to choose a new password. This link expires in 20 minutes.',link);
  }catch(error){
    await db.query('DELETE FROM account_tokens WHERE token_hash=$1',[hash]);
    throw error;
  }
}

export async function lockAccountToken(client:PoolClient,value:string,purpose:Purpose){
  const {rows:[profile]}=await client.query<{id:string;password_hash:string|null;email_verified_at:Date|null}>(`SELECT p.id,p.password_hash,p.email_verified_at
    FROM account_tokens t JOIN profiles p ON p.id=t.user_id
    WHERE t.token_hash=$1 AND t.purpose=$2 AND t.expires_at>now() AND p.disabled_at IS NULL
    FOR UPDATE OF p`,[hashOpaque(value),purpose]);
  if(!profile)return null;
  const valid=await client.query('SELECT 1 FROM account_tokens WHERE token_hash=$1 AND expires_at>now()',[hashOpaque(value)]);
  return valid.rowCount?profile:null;
}
