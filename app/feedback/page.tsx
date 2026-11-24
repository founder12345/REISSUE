import type { Metadata } from 'next';
import { Action,Notice,type Params } from '../ui';
export const metadata:Metadata={title:'Feedback'};
export default async function Feedback({searchParams}:{searchParams:Promise<Params>}){
  return <div className="wrap page legal-page"><h1>Send feedback</h1><p className="intro">Tell us what you were trying to do and where you got stuck.</p><Notice params={await searchParams}/>
    <div className="panel"><Action name="feedback" back="/feedback">
      <label>Your feedback<textarea name="body" minLength={10} maxLength={2400} required/></label>
      <label>Email for a reply (optional)<input name="email" type="email" maxLength={254} autoComplete="email"/></label>
      <div hidden><label>Leave this field empty<input name="contact_confirm" tabIndex={-1} autoComplete="off"/></label></div>
      <button>Send feedback</button>
    </Action></div>
  </div>;
}
