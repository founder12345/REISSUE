import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { catalogue,type Product } from '@/lib/search';
import { Action,Empty,Notice,ProductGrid,ProductVisual,first,type Params } from '../../ui';
import { Share } from '../../share';
export const dynamic='force-dynamic';
const find=async (slug:string)=>(await db.query<Product>(`${catalogue} WHERE p.slug=$1 AND p.deleted_at IS NULL`,[slug])).rows[0];
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const p=await find(slug);
  return p?{title:p.name,description:p.description,robots:{index:!p.demo&&p.verification==='verified',follow:true}}:{title:'Product unavailable'};
}
export default async function ProductPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Params>}){
  const [{slug},query,user]=await Promise.all([params,searchParams,viewer()]);
  const p=await find(slug);
  if(!p)notFound();
  const path='/products/'+p.slug;
  const [sources,specs,images,related,saves,collections,following]=await Promise.all([
    db.query<{url:string;label:string}>('SELECT url,label FROM product_sources WHERE product_id=$1 ORDER BY label',[p.id]),
    db.query<{name:string;value:string}>('SELECT name,value FROM product_attributes WHERE product_id=$1 ORDER BY name',[p.id]),
    db.query<{path:string;alt:string;attribution:string}>('SELECT path,alt,attribution FROM product_images WHERE product_id=$1 ORDER BY id',[p.id]),
    db.query<Product>(`${catalogue} WHERE p.deleted_at IS NULL AND p.id<>$1 AND (p.category_id=(SELECT category_id FROM products WHERE id=$1) OR p.brand_id=$2 OR p.colours && $3::text[] OR p.materials && $4::text[]) ORDER BY (p.brand_id=$2) DESC,(p.category_id=(SELECT category_id FROM products WHERE id=$1)) DESC,p.id DESC LIMIT 4`,[p.id,p.brand_id,p.colours,p.materials]),
    user?db.query('SELECT 1 FROM saved_products WHERE user_id=$1 AND product_id=$2',[user.id,p.id]):null,
    user?db.query<{id:string;title:string;included:boolean}>('SELECT c.id,c.title,EXISTS(SELECT 1 FROM collection_items i WHERE i.collection_id=c.id AND product_id=$2) included FROM collections c WHERE user_id=$1 ORDER BY c.id DESC LIMIT 40',[user.id,p.id]):null,
    user?db.query('SELECT 1 FROM brand_follows WHERE user_id=$1 AND brand_id=$2',[user.id,p.brand_id]):null,
  ]);
  if(first(query.from)==='search'&&process.env.SEARCH_ANALYTICS==='true')await db.query("INSERT INTO search_events(kind) VALUES('product')");
  return <div className="wrap page"><Link className="text-link" href="/explore">Explore the archive</Link><Notice params={query}/>
    <section className="detail-grid"><div><ProductVisual product={p}/>
      {images.rows.length>0&&<div className="stack">{images.rows.map((img,i)=>img.path.startsWith('/')&&!img.path.startsWith('//')?<figure key={img.path}>
        {i>0&&<Image src={img.path} width={650} height={480} alt={img.alt}/>}<figcaption className="small">{img.attribution}</figcaption>
      </figure>:null)}</div>}
    </div><div className="stack">
      <p className="kicker">{p.brand} · {p.category}</p><h1>{p.name}</h1><p className="intro">{p.description}</p>
      <p>{p.demo?'Demo catalogue entry · ':''}{p.verification==='verified'?'Verified catalogue entry':'Unverified catalogue entry'} · {p.availability==='discontinued'?'Discontinued':'Current availability unknown'}</p>
      <dl>{Object.entries({'Release year':p.release_year,'Discontinuation year':p.discontinued_year,'Original retail price':p.retail_price&&p.currency?p.currency+' '+p.retail_price:null,Model:p.model,Reference:p.reference_number,SKU:p.sku,Colours:p.colours.join(', '),Materials:p.materials.join(', '),'Country of origin':p.country,...Object.fromEntries(specs.rows.map(s=>[s.name,s.value]))}).filter(([,v])=>v).map(([k,v])=><div className="contents" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="actions">
        {p.campaign_id?<Link className="button" href={'/campaigns/'+p.campaign_id+(first(query.from)==='search'?'?from=search':'')}>Bring it back</Link>:<a className="button" href="#start-campaign">Bring it back</a>}
        <Action name="save" back={path} id={p.id} enabled={!saves?.rowCount}><button className="secondary">{saves?.rowCount?'Remove from saved':'Save product'}</button></Action>
        <Share/>
      </div>
      {p.campaign_id&&<p>{p.demand} registered {p.demand===1?'supporter':'supporters'}</p>}
      <Action name="follow-brand" back={path} id={p.brand_id} enabled={!following?.rowCount}><button className="secondary">{following?.rowCount?'Unfollow':'Follow'} {p.brand}</button></Action>
    </div></section>
    <section className="split"><div><h2>Product history</h2><p>{p.history??'A documented history has yet to be added.'}</p><h3>Sources</h3>{sources.rows.length?<ul>{sources.rows.map(s=><li key={s.url}><a className="text-link" href={s.url} rel="noreferrer">{s.label}</a></li>)}</ul>:<p>Source references have yet to be added.</p>}</div>
      <div className="panel stack"><details><summary>Suggest a correction</summary><Action name="correction" back={path} id={p.id}><label>Correction and supporting evidence<textarea name="body" required maxLength={3000}/></label><button>Send correction</button></Action></details>
      {collections?.rows.map(c=><Action name="collection-item" back={path} key={c.id} id={c.id} enabled={!c.included} fields={{product:p.id}}><button className="secondary">{c.included?'Remove from ':'Add to '}{c.title}</button></Action>)}
      </div></section>
    {!p.campaign_id&&<section id="start-campaign" className="panel stack"><h2>Start a comeback campaign</h2><p>New campaigns go through moderation before they can gather interest.</p>
      <Action name="campaign-create" back={path} id={p.id}><label>Campaign title<input name="title" defaultValue={'Bring back '+p.name} maxLength={140} required/></label><label>Why should it come back?<textarea name="body" minLength={12} maxLength={5000} required/></label>
      <div className="split"><label>Desired specifications<input name="specs"/></label><label>Preferred variants<input name="variants"/></label><label>Suggested price in {p.currency??'USD'}<input name="price" type="number" min="0" step=".01"/></label><label>Interest target<input name="target" type="number" min="1" max="100000" defaultValue="100"/></label></div><button>Submit campaign for review</button></Action></section>}
    <section><header className="section-head"><h2>Related archival products</h2></header>{related.rows.length?<ProductGrid products={related.rows}/>:<Empty>Related records will appear as the archive grows.</Empty>}</section>
  </div>;
}
