import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { db } from '@/lib/db';
import { limit } from '@/lib/auth';
import { hashOpaque, token } from '@/lib/account-tokens';
import { google, googleCallback, googleConfigured, googleFlowCookie, transientOptions } from '@/lib/google';
import { siteOrigin } from '@/lib/site';

export async function GET(request:Request){
  if(!googleConfigured())return NextResponse.redirect(new URL('/account?error=Google+sign-in+is+unavailable.',siteOrigin()),303);
  const ip=process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] : undefined;
  if(!await limit('oauth:'+ (ip??'local'),30,600))return new NextResponse('Try again later',{status:429});
  try{
    const config=await google();
    const jar=await cookies();
    const previous=jar.get(googleFlowCookie)?.value;
    if(previous)await db.query('DELETE FROM oauth_flows WHERE token_hash=$1',[hashOpaque(previous)]);
    const value=token(), state=oidc.randomState(), nonce=oidc.randomNonce(), verifier=oidc.randomPKCECodeVerifier();
    await db.query("INSERT INTO oauth_flows(token_hash,state,nonce,verifier,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')",
      [hashOpaque(value),state,nonce,verifier]);
    jar.set(googleFlowCookie,value,transientOptions());
    const destination=oidc.buildAuthorizationUrl(config,{redirect_uri:googleCallback().href,scope:'openid email profile',state,nonce,
      code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'});
    return NextResponse.redirect(destination,303);
  }catch{
    return NextResponse.redirect(new URL('/account?error=Google+sign-in+is+temporarily+unavailable.',siteOrigin()),303);
  }
}
