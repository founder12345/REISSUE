import { brandOpportunities,reportingThreshold,uniqueBrandSupporters } from '@/lib/intelligence';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { brandCampaigns,brandFor } from '@/lib/brand';
import { catalogue,type Product } from '@/lib/search';
import { Action,Empty,Notice,ProductGrid,type Params } from '../../ui';
import { ImportPanel } from '../../import-panel';
export const dynamic='force-dynamic';
export default async function BrandDashboard({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(!user)notFound();
  const brand=await brandFor(user.id,id);
  if(!brand)notFound();
  const back='/brands/'+id;
  const [campaigns,aggregates,products,opportunities,unique,pilots,evidence]=await Promise.all([
    brandCampaigns(id,user.id),
    db.query<{kind:string;value:string;count:number}>(`WITH preferences AS (
      SELECT s.*,coalesce(p.currency,'USD') AS currency,p.demo FROM campaign_supporters s
      JOIN campaigns c ON c.id=s.campaign_id JOIN products p ON p.id=c.product_id
      JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
      WHERE p.brand_id=$1 AND p.deleted_at IS NULL AND NOT p.demo AND c.rejected_at IS NULL AND c.status<>'Under moderation'
    )
    SELECT 'Month' kind,to_char(date_trunc('month',created_at),'YYYY-MM') value,count(DISTINCT user_id)::int FROM preferences WHERE created_at>=now()-interval '12 months' GROUP BY 2 HAVING count(DISTINCT user_id)>=5
    UNION ALL SELECT 'Country',country,count(DISTINCT user_id)::int FROM preferences WHERE country IS NOT NULL GROUP BY country HAVING count(DISTINCT user_id)>=5
    UNION ALL SELECT 'Variant',variant,count(DISTINCT user_id)::int FROM preferences WHERE variant IS NOT NULL AND variant<>'' GROUP BY variant HAVING count(DISTINCT user_id)>=5
    UNION ALL SELECT 'Colourway',preferred_colour,count(DISTINCT user_id)::int FROM preferences WHERE preferred_colour IS NOT NULL GROUP BY 2 HAVING count(DISTINCT user_id)>=5
    UNION ALL SELECT 'Price midpoint band',currency||' '||(floor(coalesce((price+price_max)/2,price)/25)*25)::text,count(DISTINCT user_id)::int
      FROM preferences WHERE price IS NOT NULL GROUP BY 2 HAVING count(DISTINCT user_id)>=5 ORDER BY kind,value`,[id,user.id]),
    db.query<Product>(`${catalogue} WHERE p.brand_id=$1 AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 40`,[id]),
    brandOpportunities(id,user.id),uniqueBrandSupporters(id,user.id),
    db.query<{campaign_id:string;stage:string;contact_preference:string;notes:string}>(`SELECT x.campaign_id,x.stage,x.contact_preference,x.notes FROM brand_pilots x
      JOIN brand_members m ON m.brand_id=x.brand_id AND m.user_id=$2 WHERE x.brand_id=$1`,[id,user.id]),
    db.query<{id:string;name:string;sources:string[]}>(`SELECT p.id,p.name,array_agg(s.url ORDER BY s.url) sources
      FROM products p JOIN product_sources s ON s.product_id=p.id JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
      WHERE p.brand_id=$1 AND NOT p.demo AND p.deleted_at IS NULL GROUP BY p.id ORDER BY p.id DESC LIMIT 15`,[id,user.id]),
  ]);
  const live=campaigns.filter(c=>!c.demo);
  const total=live.reduce((sum,c)=>sum+c.supporters,0);
  const mostRequested=live.filter(c=>c.supporters>=reportingThreshold).slice(0,5);
  const months=aggregates.rows.filter(row=>row.kind==='Month');
  const preferences=aggregates.rows.filter(row=>row.kind!=='Month');
  return <div className="wrap page"><Link className="text-link" href="/brands">Brand directory</Link><h1>{brand.name} demand dashboard</h1><Notice params={query}/>
    <p className="intro"><strong>{total}</strong> registered interests from <strong>{unique}</strong> unique supporters across live and historical campaigns. Stated interest is non-binding and does not forecast guaranteed revenue.</p>
    <p><a href={back+'/export'}>Download aggregate campaign CSV</a></p>
    <div className="split">
      <section className="panel stack"><h2>Most requested products</h2>{mostRequested.length?<ol className="demand-list">{mostRequested.map(c=><li key={c.id}><Link href={'/campaigns/'+c.id}>{c.product}</Link><strong>{c.supporters}</strong></li>)}</ol>:<Empty>Products will appear here as supporters register interest.</Empty>}</section>
      <section className="panel stack"><h2>Unique supporters by month</h2>{months.length?<ul className="demand-list">{months.map(month=><li key={month.value}><span>{month.value}</span><strong>{month.count}</strong></li>)}</ul>:<Empty>No recorded interest in the past 12 months.</Empty>}</section>
    </div>
    <section className="stack"><h2>Demand breakdown</h2><p>Groups represent distinct supporters and can overlap. Price bands use the midpoint of a stated range and the recorded product currency.</p>{preferences.length?<div className="table-scroll"><table><thead><tr><th>Metric</th><th>Group</th><th>Responses</th></tr></thead><tbody>
      {preferences.map(r=><tr key={r.kind+r.value}><td>{r.kind}</td><td>{r.value}</td><td>{r.count}</td></tr>)}</tbody></table></div>:<Empty>Price, geography and variant groups are displayed once five or more responses share a group.</Empty>}</section>
    <section className="stack"><h2>Revival opportunities</h2><p>Scores summarise recorded interest, recent growth, stated intent, price agreement, and catalogue verification. Campaigns need at least five supporters to appear.</p>
      {opportunities.length?<div className="table-scroll"><table><thead><tr><th>Product</th><th>Status</th><th>Score</th><th>Supporters</th><th>Last 30 days</th><th>High intent</th></tr></thead><tbody>
      {opportunities.map(row=><tr key={row.id}><td><Link className="text-link" href={'/campaigns/'+row.id}>{row.product}</Link></td><td>{row.status}</td><td>{row.score} / 100</td><td>{row.supporters}</td><td>{row.recent??'Suppressed'}</td><td>{row.highIntent??'Suppressed'}</td></tr>)}</tbody></table></div>:<Empty>There is not enough eligible interest to score a comeback yet.</Empty>}</section>
    <section className="stack"><h2>Private pilot workspace</h2>{live.length?live.map(c=>{
      const pilot=pilots.rows.find(p=>p.campaign_id===c.id);
      return <details className="panel" key={c.id}><summary>{c.title}{pilot?' · '+pilot.stage:''}</summary>
      <Action name="brand-pilot-save" back={back} id={c.id} fields={{brand:id}}>
        <label>Pilot stage<select name="stage" defaultValue={pilot?.stage??'exploring'}><option value="exploring">Exploring</option><option value="feasibility">Feasibility review</option><option value="closed">Closed</option></select></label>
        <label>Preferred contact<select name="contactPreference" defaultValue={pilot?.contact_preference??'portal'}><option value="portal">Portal</option><option value="email">Email</option><option value="none">No outreach</option></select></label>
        <label>Private feasibility notes<textarea name="body" defaultValue={pilot?.notes??''} maxLength={2000}/></label><button>Save pilot details</button>
      </Action></details>;
    }):<Empty>Published, non-demo campaigns for your products will appear here.</Empty>}</section>
    <section className="stack"><h2>Campaign review</h2>{campaigns.length?campaigns.map(c=><article className="panel stack" key={c.id}><h3><Link href={'/campaigns/'+c.id}>{c.title}</Link></h3><p>{c.demo?'Demo campaign · ':''}{c.status} · {c.supporters} of {c.target} interested</p>
      <details><summary>Publish an official update</summary><Action name="publish-update" back={back} id={c.id}><label>Update<textarea name="body" maxLength={3000} required/></label><button>Publish update</button></Action></details>
      {!['Archived','Completed'].includes(c.status)&&<details><summary>Respond to campaign</summary><Action name="campaign-status" back={back} id={c.id}><label>Decision<select name="status"><option>Under brand review</option><option>Brand approved</option><option>Brand declined</option></select></label><label>Public explanation and evidence<textarea name="body" maxLength={3000} required/></label><button>Publish response</button></Action></details>}
    </article>):<Empty>Published campaigns for this brand will appear here.</Empty>}</section>
    <section><header className="section-head"><h2>Brand catalogue</h2></header>{products.rows.length?<ProductGrid products={products.rows}/>:<Empty>Import historical records to build your brand archive.</Empty>}</section>
    <section className="stack"><h2>Confirm catalogue records</h2>{evidence.rows.length?evidence.rows.map(p=><details className="panel" key={p.id}><summary>{p.name}</summary>
      <Action name="brand-confirm-product" back={back} id={p.id}><label>Recorded source<select name="source">{p.sources.map(source=><option key={source}>{source}</option>)}</select></label><label>Evidence of brand confirmation<textarea name="body" required minLength={8} maxLength={1800}/></label><button>Confirm product details</button></Action>
    </details>):<Empty>Add a source to a non-demo record to submit brand confirmation.</Empty>}</section>
    <ImportPanel user={user.id} brand={id} back={back}/>
  </div>;
}
