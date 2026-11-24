import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { catalogue,type Product } from '@/lib/search';
import { Action,Empty,Notice,ProductGrid,ProductVisual,type Params } from '../../ui';
import { Share } from '../../share';
export const dynamic='force-dynamic';
export default async function Collection({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(!/^[1-9]\d{0,17}$/.test(id))notFound();
  const {rows}=await db.query<{id:string;title:string;description:string;published:boolean;user_id:string;name:string}>('SELECT c.*,p.name FROM collections c JOIN profiles p ON p.id=c.user_id WHERE c.id=$1 AND (c.published OR c.user_id=$2)',[id,user?.id??null]);
  const c=rows[0];
  if(!c)notFound();
  const products=(await db.query<Product>(`${catalogue} JOIN collection_items i ON i.product_id=p.id JOIN collections cl ON cl.id=i.collection_id WHERE i.collection_id=$1 AND (cl.published OR cl.user_id=$2) AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 100`,[id,user?.id??null])).rows;
  const back='/collections/'+id;
  return <div className="wrap page"><header className="detail-grid"><div><p className="kicker">{c.published?'PUBLIC COLLECTION':'PRIVATE COLLECTION'}</p><h1>{c.title}</h1><p>Curated by {c.name}</p><p className="intro">{c.description}</p></div>{products[0]&&<ProductVisual product={products[0]}/>}</header><Notice params={query}/>
    <div className="actions">{c.published&&<Share/>}{user?.id===c.user_id&&<Action name="collection-visibility" back={back} id={id} enabled={!c.published}><button>{c.published?'Make private':'Publish collection'}</button></Action>}</div>
    <section>{products.length?<ProductGrid products={products}/>:<Empty>This collection is empty. <Link href="/explore">Find products in the archive</Link>.</Empty>}</section>
  </div>;
}
