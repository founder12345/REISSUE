import Link from 'next/link';
import { consent } from '@/lib/consent';
import { Action } from './ui';
export async function CookieBanner(){
  const state=await consent();
  if(!state.available||state.decided)return null;
  return <aside className="cookie-banner panel" aria-label="Cookie choices">
    <div><h2>Cookie choices</h2><p>Allow optional archive analytics to help us understand how search is used.</p></div>
    <div className="actions">
      <Action name="cookie-consent" back="/"><button className="secondary">Reject all</button></Action>
      <Action name="cookie-consent" back="/" enabled><button className="secondary">Accept all</button></Action>
      <Link className="button secondary" href="/cookies">Customize preferences</Link>
    </div>
  </aside>;
}
