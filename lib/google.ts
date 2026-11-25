import * as oidc from 'openid-client';
import { cookies } from 'next/headers';
import { db } from './db';
import { hashOpaque, token } from './account-tokens';
import { siteOrigin } from './site';

export const googleFlowCookie='reissue_google_flow';
export const onboardingCookie='reissue_onboarding';
export const googleConfigured=()=>Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET
  && (process.env.VERCEL_ENV!=='preview'||process.env.GOOGLE_PREVIEW_ENABLED==='true'));
export const googleCallback=()=>new URL('/api/auth/google/callback',siteOrigin());
export const transientOptions=()=>({httpOnly:true,secure:siteOrigin().protocol==='https:',sameSite:'lax' as const,path:'/',maxAge:600});
let discovery:Promise<oidc.Configuration>|undefined;
export async function google(){
  if(!googleConfigured())throw Error('Google sign-in is unavailable');
  discovery??=oidc.discovery(new URL('https://accounts.google.com'),process.env.GOOGLE_CLIENT_ID!,process.env.GOOGLE_CLIENT_SECRET!).then(config=>{
    oidc.enableNonRepudiationChecks(config);
    return config;
  }).catch(error=>{discovery=undefined;throw error;});
  return discovery;
}
export async function takeGoogleFlow(){
  const jar=await cookies();
  const cookie=jar.get(googleFlowCookie)?.value;
  jar.delete(googleFlowCookie);
  if(!cookie)return null;
  const {rows:[flow]}=await db.query<{state:string;nonce:string;verifier:string}>(`DELETE FROM oauth_flows WHERE token_hash=$1 AND expires_at>now()
    RETURNING state,nonce,verifier`,[hashOpaque(cookie)]);
  return flow??null;
}
export async function stageGoogleProfile(subject:string,email:string,name:string){
  const value=token();
  await db.query("INSERT INTO oauth_onboarding(token_hash,subject,email,name,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",[hashOpaque(value),subject,email,name]);
  (await cookies()).set(onboardingCookie,value,transientOptions());
}
