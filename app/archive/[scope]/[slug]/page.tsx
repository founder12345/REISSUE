import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { search } from '@/lib/search';
import { Empty,ProductGrid,first,type Params } from '../../../ui';

const find=cache(async (scope:string,slug:string)=>{
  if(!['brands','categories'].includes(scope)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;
  const foreignKey=scope==='brands'?'brand_id':'category_id';
  const {rows:[entry]}=await db.query<{name:string;verified:boolean}>(`SELECT d.name,EXISTS(SELECT 1 FROM products p
    WHERE p.${foreignKey}=d.id AND p.verification='verified' AND NOT p.demo AND p.deleted_at IS NULL) verified
    FROM ${scope} d WHERE d.slug=$1`,[slug]);
  return entry??null;
});
type ArchiveParams={scope:string;slug:string};
export async function generateMetadata({params,searchParams}:{params:Promise<ArchiveParams>;searchParams:Promise<Params>}):Promise<Metadata>{
  const [{scope,slug},query]=await Promise.all([params,searchParams]);
  const entry=await find(scope,slug);
  if(!entry)return {title:'Archive unavailable',robots:{index:false}};
  const title=entry.name+' archive';
  const description='Explore archival products and comeback campaigns in the '+entry.name+' archive.';
  return {title,description,alternates:{canonical:'/archive/'+scope+'/'+slug},
    robots:{index:entry.verified&&!query.cursor,follow:true},openGraph:{title,description,images:['/social.webp']}};
}

export default async function DimensionArchive({params,searchParams}:{params:Promise<ArchiveParams>;searchParams:Promise<Params>}){
  const [{scope,slug},query]=await Promise.all([params,searchParams]);
  const entry=await find(scope,slug);
  if(!entry)notFound();
  const facet=scope==='brands'?'brand':'category';
  const url=new URLSearchParams({[facet]:slug});
  const cursor=first(query.cursor);
  if(cursor)url.set('cursor',cursor);
  const result=await search(url);
  const path='/archive/'+scope+'/'+slug;
  return <div className="wrap page"><Link className="text-link" href={scope==='brands'?'/brands':'/explore'}>{scope==='brands'?'Brand directory':'Explore the archive'}</Link>
    <p className="kicker">{scope==='brands'?'BRAND ARCHIVE':'CATEGORY ARCHIVE'}</p><h1>{entry.name}</h1>
    <p className="intro">Explore the catalogue records and discover products the community would like to see again.</p>
    <div className="actions"><Link className="button secondary" href={'/explore?'+new URLSearchParams({[facet]:slug})}>Search and filter this archive</Link></div>
    <section><header className="section-head"><h2>Catalogue records</h2><p>{result.total} {result.total===1?'record':'records'}</p></header>
      {result.products.length?<ProductGrid products={result.products}/>:<Empty>This archive has no records yet. <Link href="/submit">Suggest a product</Link>.</Empty>}
      {result.next&&<Link className="button secondary" href={path+'?'+new URLSearchParams({cursor:result.next})}>Next page</Link>}
    </section>
  </div>;
}
