import Link from 'next/link';
import { Action,Notice,type Params } from '../ui';

export default async function ReportContent({searchParams}:{searchParams:Promise<Params>}){
  return <div className="wrap page legal-page"><h1>Report content</h1><Notice params={await searchParams}/>
    <p>Report suspected unlawful content or an intellectual property concern. Give the exact location and explain why it should be reviewed. To appeal a decision on your own account, use <Link href="/rights">your requests</Link>.</p>
    <section className="panel"><Action name="content-complaint" back="/report-content">
      <label>Content URL<input name="target" type="url" required maxLength={1200}/></label>
      <label>Contact email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
      <label>Reason and supporting information<textarea name="body" minLength={20} maxLength={3000} required/></label>
      <label className="check"><input name="goodFaith" value="yes" type="checkbox" required/> I believe the information in this report is accurate in good faith.</label>
      <div hidden><label>Leave blank<input name="contact_confirm" tabIndex={-1} autoComplete="off"/></label></div>
      <button>Send report</button>
    </Action></section>
  </div>;
}
