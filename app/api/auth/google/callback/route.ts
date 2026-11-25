import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as oidc from 'openid-client';
import { db } from '@/lib/db';
import { startSession } from '@/lib/auth';
import { google, googleCallback, stageGoogleProfile, takeGoogleFlow } from '@/lib/google';
import { registrationOpen } from '@/lib/policies';
import { siteOrigin } from '@/lib/site';

export async function GET(request:Request){
  const failure=()=>NextResponse.redirect(new URL('/account?error=Google+sign-in+could+not+be+completed.',siteOrigin()),303);
  try{
    const flow=await takeGoogleFlow();
    if(!flow)return failure();
    const callback=googleCallback();
    callback.search=new URL(request.url).search;
    const result=await oidc.authorizationCodeGrant(await google(),callback,{
      expectedState:flow.state,expectedNonce:flow.nonce,pkceCodeVerifier:flow.verifier,idTokenExpected:true,
    });
    const claims=result.claims();
    if(!claims||claims.email_verified!==true)return failure();
    const email=z.email().max(254).parse(typeof claims.email==='string'?claims.email.toLowerCase():claims.email);
    const subject=z.string().min(1).max(255).parse(claims.sub);
    const {rows:[existing]}=await db.query<{id:string;disabled_at:Date|null}>(`SELECT p.id,p.disabled_at FROM oauth_identities i
      JOIN profiles p ON p.id=i.user_id WHERE i.provider='google' AND i.subject=$1`,[subject]);
    if(existing){
      if(existing.disabled_at)return failure();
      if(!await startSession(existing.id))return failure();
      return NextResponse.redirect(new URL('/account',siteOrigin()),303);
    }
    if(!registrationOpen()||(await db.query('SELECT 1 FROM profiles WHERE email=$1',[email])).rowCount)return failure();
    await stageGoogleProfile(subject,email,typeof claims.name==='string'?claims.name.trim().slice(0,70):'');
    return NextResponse.redirect(new URL('/account/onboarding',siteOrigin()),303);
  }catch{return failure();}
}
