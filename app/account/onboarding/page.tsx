import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { onboardingCookie } from '@/lib/google';
import { hashOpaque } from '@/lib/account-tokens';
import { termsVersion } from '@/lib/policies';
import { Action,Notice,type Params } from '../../ui';

export default async function Onboarding({searchParams}:{searchParams:Promise<Params>}){
  const value=(await cookies()).get(onboardingCookie)?.value;
  if(!value)redirect('/account');
  const {rows:[user]}=await db.query<{name:string}>('SELECT name FROM oauth_onboarding WHERE token_hash=$1 AND expires_at>now()',[hashOpaque(value)]);
  if(!user)redirect('/account?error=The+onboarding+link+expired.');
  return <div className="wrap page legal-page"><h1>Make REISSUE yours</h1><Notice params={await searchParams}/><section className="panel">
    <Action name="google-onboard" back="/account/onboarding">
      <label>Public display name<input name="name" required minLength={2} maxLength={70} defaultValue={user.name}/></label>
      <label>Username<input name="username" required pattern="[a-zA-Z0-9_]{3,24}" maxLength={24} autoComplete="username"/></label>
      <input type="hidden" name="termsVersion" value={termsVersion()}/>
      <label className="check"><input name="terms" type="checkbox" value="yes" required/> <span>I accept the <Link href="/terms" target="_blank">Terms of Service</Link>.</span></label>
      <button>Finish profile</button>
    </Action></section></div>;
}
