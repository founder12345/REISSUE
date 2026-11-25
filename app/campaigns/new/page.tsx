import Link from 'next/link';
import { redirect } from 'next/navigation';
import { viewer } from '@/lib/auth';
import { asActor, db } from '@/lib/db';
import { Empty } from '../../ui';

export default async function NewCampaign(){
  const user=await viewer();
  if(!user)redirect('/account?resume=%2Fcampaigns%2Fnew');
  const [drafts,submissions]=await Promise.all([
    asActor(user.id,client=>client.query<{id:string;name:string;title:string}>(`SELECT d.id,p.name,d.title FROM campaign_drafts d JOIN products p ON p.id=d.product_id
      WHERE user_id=$1 AND submitted_campaign_id IS NULL AND p.deleted_at IS NULL ORDER BY updated_at DESC`,[user.id])),
    db.query<{name:string;slug:string;status:string}>(`SELECT data->>'name' AS name,data->>'slug' AS slug,status FROM product_submissions WHERE user_id=$1 ORDER BY id DESC LIMIT 50`,[user.id]),
  ]);
  return <div className="wrap page legal-page"><p className="kicker">STEP 1 OF 4</p><h1>Start a comeback</h1><p>Find a catalogue product to begin. Its archive page will show an existing active campaign when one is available.</p>
    <div className="actions"><Link className="button" href="/explore">Find a product</Link><Link className="button secondary" href="/submit">Submit a missing product</Link></div>
    <h2>Your campaign drafts</h2>{drafts.rows.length?<ul>{drafts.rows.map(d=><li key={d.id}><Link className="text-link" href={'/campaigns/new/'+d.id}>{d.title||d.name}</Link></li>)}</ul>:<Empty>No saved drafts yet.</Empty>}
    {submissions.rows.length>0&&<><h2>Your catalogue submissions</h2><ul>{submissions.rows.map((p,i)=><li key={p.slug+i}>{p.status==='approved'?<Link href={'/products/'+p.slug}>{p.name}</Link>:p.name} · {p.status}</li>)}</ul></>}
  </div>;
}
