import type { Metadata } from 'next';
import Link from 'next/link';
import { Action,Notice,type Params } from '../ui';

export const metadata:Metadata={title:'Founding brand programme',description:'Apply to explore archival products and community demand with REISSUE.',alternates:{canonical:'/founding-partners'}};
export default async function FoundingPartners({searchParams}:{searchParams:Promise<Params>}){
  return <div className="wrap page"><Notice params={await searchParams}/><div className="partner-layout">
    <div className="partner-intro"><p className="kicker">FOUNDING BRAND PROGRAMME</p><h1>Your archive has a future.</h1>
      <p>Apply to explore which products your customers want back and what they would look for in a revival.</p>
      <ul><li>See which archival designs attract the most interest.</li><li>Review what supporters say about colours, sizes and price.</li><li>Respond on your terms and contribute verified catalogue records.</li></ul>
      <Link href="/brands">Already have a brand profile? Find it in the directory.</Link>
    </div>
    <section className="panel application"><h2>Apply to join</h2><Action name="brand-inquiry" back="/founding-partners">
      <label>Brand name<input name="company" required maxLength={120} autoComplete="organization"/></label>
      <label>Brand website<input name="website" type="url" required maxLength={500} placeholder="https://"/></label>
      <label>Work email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
      <label>What would you like to explore?<textarea name="body" minLength={15} maxLength={2400} required/></label>
      <div hidden><label>Leave this field empty<input name="contact_confirm" tabIndex={-1} autoComplete="off"/></label></div>
      <p className="small">We use these details to review and respond to your application. <Link href="/privacy">Privacy draft</Link></p>
      <button>Send application</button>
    </Action></section>
  </div></div>;
}
