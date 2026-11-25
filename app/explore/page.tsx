import { consent } from '@/lib/consent';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { search } from '@/lib/search';
import { viewer } from '@/lib/auth';
import { foldQuery } from '@/lib/ranking';
import { Action,Empty,Notice,ProductGrid,first,queryParams,type Params } from '../ui';

export const dynamic='force-dynamic';
const filters=[
  ['category','Category'],['subcategory','Subcategory'],['brand','Brand'],['year','Release year'],['ended','Discontinuation year'],
  ['decade','Decade'],['colour','Colour'],['material','Material'],['country','Country of origin'],['currency','Currency'],['availability','Availability'],
  ['verification','Verification'],['status','Campaign status'],
] as const;
const archiveFacets = unstable_cache(async () => (db.query<{kind:string;value:string;label:string}>(`
    SELECT 'category' kind,slug value,name label FROM categories UNION ALL SELECT 'brand',slug,name FROM brands
    UNION ALL SELECT DISTINCT f.kind,f.value,f.value FROM products p
    CROSS JOIN LATERAL (VALUES ('subcategory',p.subcategory),('year',p.release_year::text),('ended',p.discontinued_year::text),
      ('decade',(p.release_year/10*10)::text),('country',p.country),('currency',p.currency::text),('availability',p.availability),('verification',p.verification)) f(kind,value)
    WHERE p.deleted_at IS NULL AND f.value IS NOT NULL UNION ALL
    SELECT DISTINCT 'colour',unnest(colours),unnest(colours) FROM products WHERE deleted_at IS NULL UNION ALL
    SELECT DISTINCT 'material',unnest(materials),unnest(materials) FROM products WHERE deleted_at IS NULL UNION ALL
    SELECT DISTINCT 'status',status,status FROM campaigns WHERE status<>'Under moderation' ORDER BY kind,label`)).then(result=>result.rows), ['archive-facets-v1'], {revalidate:60});
export default async function Explore({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams;
  const url=queryParams(params);
  const q=first(params.q)?.slice(0,120)??'';
  const [result,options,user]=await Promise.all([
    search(url),
    archiveFacets(),
    viewer(),
  ]);
  const folded=foldQuery(q);
  if(folded&&!params.cursor){
    const safe=!/@|https?:|\d[\d\s-]{7,}\d/i.test(folded);
    await Promise.all([
      user?.search_history ? db.query(`INSERT INTO search_history(user_id,query) VALUES($1,$2) ON CONFLICT(user_id,query) DO UPDATE SET used_at=now()`,[user.id,folded]):null,
      (await consent()).analytics&&safe ? db.query("INSERT INTO search_events(kind,query,result_count) VALUES('search',$1,$2)",[folded,result.total]):null,
    ]);
  }
  const next=new URLSearchParams(url);
  if(result.next)next.set('cursor',result.next);
  next.delete('notice');next.delete('error');
  return <div className="wrap page">
    <Notice params={params}/><p className="kicker">THE PRODUCT ARCHIVE</p><h1>Explore</h1>
    {q&&<div className="account-links"><Action name="save-search" back={'/explore?'+new URLSearchParams({q})} enabled fields={{query:q}}><button className="secondary">Save this search</button></Action></div>}
    <div className="search-layout">
      <form action="/explore" className="filters panel"><label>Search<input name="q" defaultValue={q} placeholder="Brand, model or product" maxLength={120}/></label>
        <label>Sort by<select name="sort" defaultValue={first(params.sort)??''}><option value="">Relevance</option><option value="newest">Recently added</option><option value="oldest">Earliest release</option><option value="demand">Most requested</option></select></label>
        <details className="filter-drawer"><summary>Catalogue filters</summary>
          {filters.map(([key,label])=>{
            const values=options.filter(x=>x.kind===key);
            return values.length?<fieldset key={key}><legend>{label}</legend><div className="filter-values">{values.map(v=><label className="check" key={v.value}><input type="checkbox" name={key} value={v.value} defaultChecked={url.getAll(key).includes(v.value)}/>{v.label}</label>)}</div></fieldset>:null;
          })}
          {([['minPrice','Minimum original price'],['maxPrice','Maximum original price'],['minDemand','Minimum registered interest']] as const).map(([key,label])=><label key={key}>{label}<input type="number" name={key} min="0" step={key==='minDemand'?'1':'.01'} defaultValue={first(params[key])}/></label>)}
        </details>
        <button>Apply search and filters</button><Link href={q?'/explore?'+new URLSearchParams({q}):'/explore'}>Clear filters</Link>
      </form>
      <section><h2 className="results-count">{result.total} {result.total===1?'product':'products'}{q?' for “'+q+'”':''}</h2>
        {result.products.length?<ProductGrid products={result.products} q={q}/>:<Empty>No archive records match. Try fewer filters or <Link href={'/submit?'+new URLSearchParams({name:q})}>request an addition to the archive</Link>.</Empty>}
        {result.next&&<Link className="button secondary" href={'/explore?'+next}>Next page</Link>}
      </section>
    </div>
  </div>;
}
