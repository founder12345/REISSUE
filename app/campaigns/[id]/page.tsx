import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Empty,Notice,ProductVisual,first,type Params } from '../../ui';
import { Share } from '../../share';
export const dynamic='force-dynamic';
export default async function Campaign({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(!/^[1-9]\d{0,17}$/.test(id))notFound();
  const {rows}=await db.query<{id:string;title:string;description:string;target:number;status:string;author_id:string;product_id:string;slug:string;name:string;demo:boolean;category_slug:string;image:string|null;image_alt:string|null;currency:string|null;details:Record<string,string|number|null>;supporters:number}>(`SELECT c.*,p.slug,p.name,p.demo,p.currency,k.slug AS category_slug,i.path AS image,i.alt AS image_alt,
    (SELECT count(*)::int FROM campaign_supporters WHERE campaign_id=c.id) supporters
    FROM campaigns c JOIN products p ON p.id=c.product_id JOIN categories k ON k.id=p.category_id
    LEFT JOIN LATERAL (SELECT path,alt FROM product_images WHERE product_id=p.id ORDER BY id LIMIT 1) i ON true WHERE c.id=$1 AND p.deleted_at IS NULL`,[id]);
  const c=rows[0];
  if(!c||(c.status==='Under moderation'&&(!user||(user.id!==c.author_id&&user.role!=='admin'))))notFound();
  const path='/campaigns/'+id;
  const [support,follow,updates,comments,prices]=await Promise.all([
    user?db.query('SELECT 1 FROM campaign_supporters WHERE campaign_id=$1 AND user_id=$2',[id,user.id]):null,
    user?db.query('SELECT 1 FROM campaign_follows WHERE campaign_id=$1 AND user_id=$2',[id,user.id]):null,
    db.query<{id:string;body:string;official:boolean;date:string}>("SELECT id,body,official,to_char(created_at,'YYYY-MM-DD') date FROM campaign_updates WHERE campaign_id=$1 ORDER BY id DESC LIMIT 50",[id]),
    db.query<{id:string;body:string;name:string|null}>('SELECT c.id,c.body,p.name FROM campaign_comments c LEFT JOIN profiles p ON p.id=c.user_id WHERE campaign_id=$1 AND deleted_at IS NULL ORDER BY c.id DESC LIMIT 50',[id]),
    db.query<{band:string;count:number}>(`SELECT floor(price/25)*25 AS band,count(*)::int AS count FROM campaign_supporters WHERE campaign_id=$1 AND price IS NOT NULL GROUP BY band HAVING count(*)>=5 ORDER BY band`,[id]),
  ]);
  if(first(query.from)==='search'&&process.env.SEARCH_ANALYTICS==='true')await db.query("INSERT INTO search_events(kind) VALUES('campaign')");
  const open=['Gathering interest','Ready for brand outreach','Brand contacted','Under brand review','Brand approved'].includes(c.status);
  return <div className="wrap page"><Link className="text-link" href={'/products/'+c.slug}>View archive product</Link><Notice params={query}/>
    <section className="detail-grid"><ProductVisual product={c}/><div className="stack">
      <p className="kicker">{c.demo?'DEMO CAMPAIGN · ':''}{c.status.toUpperCase()}</p><h1>{c.title}</h1><p className="intro">{c.description}</p>
      <progress value={Math.min(c.supporters,c.target)} max={c.target} aria-label="Progress toward interest target"/><p><strong>{c.supporters}</strong> of {c.target} interested</p>
      {c.details.specifications&&<p>Desired specifications — {c.details.specifications}</p>}{c.details.variants&&<p>Preferred variants — {c.details.variants}</p>}
      {c.details.suggestedPrice!=null&&<p>Suggested price — {c.currency??'USD'} {c.details.suggestedPrice}</p>}
      <div className="actions">
        {support?.rowCount?<Action name="interest" back={path} id={id} enabled={false}><button className="secondary">Withdraw interest</button></Action>:null}
        {c.status!=='Under moderation'&&<Action name="follow-campaign" back={path} id={id} enabled={!follow?.rowCount}><button className="secondary">{follow?.rowCount?'Unfollow campaign':'Follow campaign'}</button></Action>}<Share/>
      </div></div></section>
    {open&&!support?.rowCount&&<section className="panel stack"><h2>Register interest</h2><p>Interest is non-binding. There is no order, deposit or payment.</p>
      <Action name="interest" back={path} id={id} enabled>
        <div className="split"><label>Preferred price in {c.currency??'USD'}<input name="price" type="number" min="0" step=".01"/></label><label>Quantity<input name="quantity" type="number" min="1" max="100"/></label><label>Size or variant<input name="variant" maxLength={100}/></label><label>Country code<input name="country" aria-describedby="country-help" maxLength={2}/><small id="country-help">Two letters, such as FR or US.</small></label><label>Likelihood of purchase<select name="likelihood"><option value="">Prefer not to say</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}{n===1?' — Unlikely':n===5?' — Very likely':''}</option>)}</select></label></div><button>Register interest</button>
      </Action></section>}
    <section className="split"><div><h2>Campaign updates</h2>{updates.rows.length?updates.rows.map(u=><article className="panel" key={u.id}><small>{u.date}{u.official?' · Verified brand update':''}</small><p>{u.body}</p></article>):<Empty>Campaign milestones and updates will appear here.</Empty>}</div>
    <div><h2>Price preferences</h2>{prices.rows.length?<ul>{prices.rows.map(p=><li key={p.band}>{c.currency??'USD'} {p.band}–{Number(p.band)+24.99} · {p.count} responses</li>)}</ul>:<Empty>Price bands appear once at least five supporters select the same band.</Empty>}</div></section>
    {c.status!=='Under moderation'&&<section className="stack"><h2>Community discussion</h2>
      {!['Archived','Completed'].includes(c.status)&&<Action name="comment" back={path} id={id}><label>Comment<textarea name="body" maxLength={2000} required/></label><button>Post comment</button></Action>}
      {comments.rows.map(m=><article className="panel" key={m.id}><strong>{m.name??'Former member'}</strong><p>{m.body}</p><details><summary>Report comment</summary><Action name="report" back={path} id={id} fields={{comment:m.id}}><label>Reason<textarea name="body" required maxLength={1000}/></label><button>Send report</button></Action></details></article>)}
      <details><summary>Report campaign</summary><Action name="report" back={path} id={id}><label>Reason<textarea name="body" required maxLength={1000}/></label><button>Send report</button></Action></details>
    </section>}
  </div>;
}
