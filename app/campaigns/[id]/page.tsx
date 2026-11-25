import { validFlow,visitCampaign } from '@/lib/discovery-events';
import { consent } from '@/lib/consent';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Empty,Notice,ProductVisual,first,type Params } from '../../ui';
import { Share } from '../../share';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;
  if(!/^[1-9]\d{0,17}$/.test(id))return {title:'Campaign unavailable',robots:{index:false}};
  const {rows:[campaign]}=await db.query<{title:string;description:string;demo:boolean}>(`SELECT c.title,c.description,p.demo FROM campaigns c JOIN products p ON p.id=c.product_id WHERE c.id=$1 AND p.deleted_at IS NULL AND c.status NOT IN ('Under moderation','Archived')`,[id]);
  if(!campaign)return {title:'Campaign unavailable',robots:{index:false}};
  const description=campaign.description.slice(0,240);
  return {title:campaign.title,description,alternates:{canonical:'/campaigns/'+id},openGraph:{title:campaign.title,description,images:[{url:'/campaigns/'+id+'/card',width:1200,height:630,alt:'Share card for '+campaign.title}]},robots:{index:!campaign.demo,follow:true}};
}

export default async function Campaign({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(!/^[1-9]\d{0,17}$/.test(id))notFound();
  const {rows}=await db.query<{id:string;title:string;description:string;target:number;status:string;rejected_at:Date|null;rejection_reason:string|null;author_id:string;product_id:string;slug:string;name:string;demo:boolean;category_slug:string;image:string|null;image_alt:string|null;currency:string|null;colours:string[];details:Record<string,string|number|null>;supporters:number}>(`SELECT c.*,p.slug,p.name,p.demo,p.currency,p.colours,k.slug AS category_slug,i.path AS image,i.alt AS image_alt,
    (SELECT count(*)::int FROM campaign_supporters WHERE campaign_id=c.id) supporters
    FROM campaigns c JOIN products p ON p.id=c.product_id JOIN categories k ON k.id=p.category_id
    LEFT JOIN LATERAL (SELECT path,alt FROM product_images WHERE product_id=p.id ORDER BY id LIMIT 1) i ON true WHERE c.id=$1 AND p.deleted_at IS NULL`,[id]);
  const c=rows[0];
  if(!c||((c.status==='Under moderation'||c.rejected_at)&&(!user||(user.id!==c.author_id&&user.role!=='admin'))))notFound();
  const path='/campaigns/'+id;
  const flow=validFlow(first(query.flow));
  if(!c.demo&&c.status!=='Under moderation'&&!c.rejected_at)await visitCampaign(id,flow);
  const [support,follow,updates,comments,prices,saved]=await Promise.all([
    user?db.query('SELECT 1 FROM campaign_supporters WHERE campaign_id=$1 AND user_id=$2',[id,user.id]):null,
    user?db.query('SELECT 1 FROM campaign_follows WHERE campaign_id=$1 AND user_id=$2',[id,user.id]):null,
    db.query<{id:string;body:string;official:boolean;date:string}>("SELECT id,body,official,to_char(created_at,'YYYY-MM-DD') date FROM campaign_updates WHERE campaign_id=$1 ORDER BY id DESC LIMIT 50",[id]),
    db.query<{id:string;body:string;name:string|null}>('SELECT c.id,c.body,p.name FROM campaign_comments c LEFT JOIN profiles p ON p.id=c.user_id WHERE campaign_id=$1 AND deleted_at IS NULL ORDER BY c.id DESC LIMIT 50',[id]),
    db.query<{band:string;count:number}>(`SELECT floor(price/25)*25 AS band,count(*)::int AS count FROM campaign_supporters WHERE campaign_id=$1 AND price IS NOT NULL GROUP BY band HAVING count(*)>=5 ORDER BY band`,[id]),
    user?db.query('SELECT 1 FROM saved_campaigns WHERE campaign_id=$1 AND user_id=$2',[id,user.id]):null,
  ]);
  if(first(query.from)==='search'&&(await consent()).analytics)await db.query("INSERT INTO search_events(kind) VALUES('campaign')");
  const milestones=[...new Set([Math.ceil(c.target/4),Math.ceil(c.target/2),c.target])];
  const open=['Gathering interest','Ready for brand outreach','Brand contacted','Under brand review','Brand approved'].includes(c.status);
  return <div className="wrap page"><Link className="text-link" href={'/products/'+c.slug}>View archive product</Link><Notice params={query}/>
    <section className="detail-grid"><ProductVisual product={c} featured/><div className="stack">
      <p className="kicker">{c.demo?'DEMO CAMPAIGN · ':''}{c.rejected_at?'REJECTED':c.status.toUpperCase()}</p><h1>{c.title}</h1><p className="intro">{c.description}</p>{c.rejection_reason&&<p className="notice">Moderation decision · {c.rejection_reason}</p>}
      <progress value={Math.min(c.supporters,c.target)} max={c.target} aria-label="Progress toward interest target"/><p><strong>{c.supporters}</strong> of {c.target} interested</p>
      {c.details.specifications&&<p>Desired specifications — {c.details.specifications}</p>}{c.details.variants&&<p>Preferred variants — {c.details.variants}</p>}
      {c.details.suggestedPrice!=null&&<p>Suggested price — {c.currency??'USD'} {c.details.suggestedPrice}</p>}
      <div className="actions">
        {open&&!support?.rowCount&&<a className="button" href="#interest-form">Join this comeback</a>}
        {support?.rowCount?<Action name="interest" back={path} id={id} enabled={false}><button className="secondary">Withdraw interest</button></Action>:null}
        {!['Under moderation','Archived'].includes(c.status)&&!c.rejected_at&&<Action name="save-campaign" back={path} id={id} enabled={!saved?.rowCount}><button className="secondary">{saved?.rowCount?'Remove saved campaign':'Save campaign'}</button></Action>}
        {c.status!=='Under moderation'&&!c.rejected_at&&<Action name="follow-campaign" back={path} id={id} enabled={!follow?.rowCount}><button className="secondary">{follow?.rowCount?'Unfollow campaign':'Follow campaign'}</button></Action>}<Share/>
        {!['Under moderation','Archived'].includes(c.status)&&!c.rejected_at&&<a className="button secondary" href={path+'/card'} download="reissue-campaign.png">Download share card</a>}
      </div></div></section>
    {open&&!support?.rowCount&&<section className="panel stack" id="interest-form"><h2>Register interest</h2><p>Interest is non-binding. You can register without giving price or variant preferences.</p>
      <Action name="interest" back={flow?path+'?'+new URLSearchParams({flow}):path} id={id} enabled fields={flow?{flow}:undefined}>
        <div className="split"><label>Preferred price in {c.currency??'USD'} (or range minimum)<input name="price" type="number" min="0" step=".01"/></label><label>Range maximum ({c.currency??'USD'})<input name="priceMax" type="number" min="0" step=".01"/></label><label>Quantity<input name="quantity" type="number" min="1" max="100"/></label><label>Size or variant<input name="variant" maxLength={100}/></label>{c.colours.length>0&&<label>Preferred colour<select name="colour"><option value="">No preference</option>{c.colours.map(colour=><option key={colour}>{colour}</option>)}</select></label>}<label>Country code<input name="country" aria-describedby="country-help" maxLength={2}/><small id="country-help">Two letters, such as FR or US.</small></label><label>Likelihood of purchase<select name="likelihood"><option value="">Prefer not to say</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}{n===1?' — Unlikely':n===5?' — Very likely':''}</option>)}</select></label></div><button>Register interest</button>
      </Action></section>}
    <section className="panel stack"><h2>Campaign milestones</h2><ul className="demand-list">{milestones.map(value=><li key={value}><span>{value} supporters</span><strong>{c.supporters>=value?'Reached':'Upcoming'}</strong></li>)}</ul></section>
    <section className="split"><div><h2>Campaign updates</h2>{updates.rows.length?updates.rows.map(u=><article className="panel" key={u.id}><small>{u.date}{u.official?' · Verified brand update':''}</small><p>{u.body}</p></article>):<Empty>Campaign milestones and updates will appear here.</Empty>}</div>
    <div><h2>Price preferences</h2>{prices.rows.length?<ul>{prices.rows.map(p=><li key={p.band}>{c.currency??'USD'} {p.band}–{Number(p.band)+24.99} · {p.count} responses</li>)}</ul>:<Empty>Price bands appear once at least five supporters select the same band.</Empty>}</div></section>
    {c.status!=='Under moderation'&&!c.rejected_at&&<section className="stack"><h2>Community discussion</h2>
      {!['Archived','Completed'].includes(c.status)&&<Action name="comment" back={path} id={id}><label>Comment<textarea name="body" maxLength={2000} required/></label><button>Post comment</button></Action>}
      {comments.rows.map(m=><article className="panel" key={m.id}><strong>{m.name??'Former member'}</strong><p>{m.body}</p><details><summary>Report comment</summary><Action name="report" back={path} id={id} fields={{comment:m.id}}><label>Reason<textarea name="body" required maxLength={1000}/></label><button>Send report</button></Action></details></article>)}
      <details><summary>Report campaign</summary><Action name="report" back={path} id={id}><label>Reason<textarea name="body" required maxLength={1000}/></label><button>Send report</button></Action></details>
    </section>}
  </div>;
}
