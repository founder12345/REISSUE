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
  const [campaigns,aggregates,products]=await Promise.all([
    brandCampaigns(id,user.id),
    db.query<{kind:string;value:string;count:number}>(`WITH preferences AS (
      SELECT s.*,coalesce(p.currency,'USD') AS currency,p.demo FROM campaign_supporters s
      JOIN campaigns c ON c.id=s.campaign_id JOIN products p ON p.id=c.product_id
      JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
      WHERE p.brand_id=$1 AND p.deleted_at IS NULL AND NOT p.demo AND c.status<>'Under moderation'
    )
    SELECT 'Month' kind,to_char(date_trunc('month',created_at),'YYYY-MM') value,count(*)::int FROM preferences WHERE created_at>=now()-interval '12 months' GROUP BY 2
    UNION ALL SELECT 'Country',country,count(*)::int FROM preferences WHERE country IS NOT NULL GROUP BY country HAVING count(*)>=5
    UNION ALL SELECT 'Variant',variant,count(*)::int FROM preferences WHERE variant IS NOT NULL AND variant<>'' GROUP BY variant HAVING count(*)>=5
    UNION ALL SELECT 'Price band',currency||' '||(floor(price/25)*25)::text,count(*)::int FROM preferences WHERE price IS NOT NULL GROUP BY 2 HAVING count(*)>=5 ORDER BY kind,value`,[id,user.id]),
    db.query<Product>(`${catalogue} WHERE p.brand_id=$1 AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 40`,[id]),
  ]);
  const total=campaigns.filter(c=>!c.demo).reduce((sum,c)=>sum+c.supporters,0);
  return <div className="wrap page"><Link className="text-link" href="/brands">Brand directory</Link><h1>{brand.name} demand dashboard</h1><Notice params={query}/>
    <p className="intro"><strong>{total}</strong> registered interests across real campaigns. Stated interest is non-binding and does not forecast guaranteed revenue.</p>
    <p><a href={back+'/export'}>Download aggregate campaign CSV</a></p>
    <section className="stack"><h2>Demand breakdown</h2>{aggregates.rows.length?<div className="table-scroll"><table><thead><tr><th>Metric</th><th>Group</th><th>Responses</th></tr></thead><tbody>
      {aggregates.rows.map(r=><tr key={r.kind+r.value}><td>{r.kind}</td><td>{r.value}</td><td>{r.count}</td></tr>)}</tbody></table></div>:<Empty>Price, geography and variant groups are displayed once five or more responses share a group.</Empty>}</section>
    <section className="stack"><h2>Campaign review</h2>{campaigns.length?campaigns.map(c=><article className="panel stack" key={c.id}><h3><Link href={'/campaigns/'+c.id}>{c.title}</Link></h3><p>{c.demo?'Demo campaign · ':''}{c.status} · {c.supporters} of {c.target} interested</p>
      <details><summary>Publish an official update</summary><Action name="publish-update" back={back} id={c.id}><label>Update<textarea name="body" maxLength={3000} required/></label><button>Publish update</button></Action></details>
      {!['Archived','Completed'].includes(c.status)&&<details><summary>Respond to campaign</summary><Action name="campaign-status" back={back} id={c.id}><label>Decision<select name="status"><option>Under brand review</option><option>Brand approved</option><option>Brand declined</option></select></label><label>Public explanation and evidence<textarea name="body" maxLength={3000} required/></label><button>Publish response</button></Action></details>}
    </article>):<Empty>Published campaigns for this brand will appear here.</Empty>}</section>
    <section><header className="section-head"><h2>Brand catalogue</h2></header>{products.rows.length?<ProductGrid products={products.rows}/>:<Empty>Import historical records to build your brand archive.</Empty>}</section>
    <ImportPanel user={user.id} brand={id} back={back}/>
  </div>;
}
