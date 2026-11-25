import type { Metadata } from 'next';
import { Action,Notice,first,type Params } from '../../ui';
import { tokenField } from '@/lib/account-tokens';
import { mailConfigured } from '@/lib/mail';

export const metadata:Metadata={title:'Account access',robots:{index:false,follow:false},referrer:'origin'};
export default async function AccountAccess({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams;
  const purpose=first(params.purpose)==='verify'?'verify':'reset';
  const parsed=tokenField.safeParse(first(params.token));
  const back='/account/access?purpose='+purpose;
  return <div className="wrap page legal-page"><h1>{purpose==='verify'?'Verify your email':'Recover your account'}</h1><Notice params={params}/>
    <section className="panel">
    {parsed.success?<Action name={purpose==='verify'?'verify-email':'reset-password'} back={back} fields={{token:parsed.data}}>
      <label>{purpose==='verify'?'Your registration password':'New password (12 characters minimum)'}<input name="password" type="password" required minLength={purpose==='verify'?1:12} maxLength={128} autoComplete={purpose==='verify'?'current-password':'new-password'}/></label>
      <button>{purpose==='verify'?'Verify email':'Set new password'}</button>
    </Action>:mailConfigured()?<Action name={purpose==='verify'?'resend-verification':'forgot-password'} back={back}>
      <label>Email<input name="email" type="email" required autoComplete="email"/></label><button>Send account link</button>
    </Action>:<p>Email delivery is currently unavailable.</p>}
    </section>
  </div>;
}
