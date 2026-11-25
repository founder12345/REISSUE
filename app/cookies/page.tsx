import Link from 'next/link';
import { consent } from '@/lib/consent';
import { Action,Notice,type Params } from '../ui';

export default async function Cookies({searchParams}:{searchParams:Promise<Params>}){
  const state=await consent();
  return <div className="wrap page legal-page"><h1>Cookie settings</h1><Notice params={await searchParams}/>
    <section className="panel stack"><h2>Your preferences</h2><p>Essential cookies keep you signed in, protect account flows and remember your choice.</p>
    {state.available?<Action name="cookie-consent" back="/cookies">
      <label className="check"><input type="checkbox" name="enabled" value="true" defaultChecked={state.analytics}/> Allow optional archive analytics</label>
      <button>Save cookie preferences</button>
    </Action>:<p>This environment uses essential cookies only.</p>}
    {state.analytics&&<Action name="cookie-consent" back="/cookies"><button className="secondary">Withdraw analytics consent</button></Action>}
    </section>
    <h2>Cookie notice</h2><dl>
      <dt>reissue_session</dt><dd>Essential sign-in session, up to 30 days.</dd>
      <dt>reissue_google_flow</dt><dd>Essential Google sign-in protection, up to 10 minutes.</dd>
      <dt>reissue_onboarding</dt><dd>Essential Google profile setup, up to 10 minutes.</dd>
      <dt>reissue_consent</dt><dd>Remembers your choice for up to 180 days. You can change it here at any time.</dd>
    </dl><p>Optional analytics use server-side search and campaign events. An opaque search reference can connect a search, campaign visit and new support for up to one hour. When signed in, the account and search pages can record one activity date per UTC day. REISSUE uses no analytics SDK, advertising pixel or marketing cookies.</p><p><Link href="/privacy">Privacy information</Link></p>
  </div>;
}
