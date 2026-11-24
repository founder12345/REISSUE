import Link from 'next/link';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Empty,Notice,type Params } from '../ui';
export const dynamic='force-dynamic';
export default async function Collections({searchParams}:{searchParams:Promise<Params>}){
  const [user,params]=await Promise.all([viewer(),searchParams]);
  const {rows}=await db.query<{id:string;title:string;description:string;name:string;published:boolean;size:number}>(`SELECT c.id,c.title,c.description,c.published,p.name,count(i.product_id)::int AS size
  FROM collections c JOIN profiles p ON p.id=c.user_id LEFT JOIN collection_items i ON i.collection_id=c.id
  WHERE c.published OR c.user_id=$1 GROUP BY c.id,p.id ORDER BY c.id DESC LIMIT 100`,[user?.id??null]);
  return <div className="wrap page"><h1>Collections</h1><Notice params={params}/><p className="intro">Personal archives curated by the REISSUE community.</p>
    {rows.length?<div className="list-grid">{rows.map(c=><Link className="panel" key={c.id} href={'/collections/'+c.id}><p className="kicker">{c.published?'PUBLIC COLLECTION':'PRIVATE COLLECTION'}</p><h3>{c.title}</h3><p>Curated by {c.name} · {c.size} entries</p><p>{c.description.slice(0,140)}</p></Link>)}</div>:<Empty>Public collections will appear here once members publish them.</Empty>}
    <section id="new" className="panel stack"><h2>Create a collection</h2><Action name="collection" back="/collections"><label>Title<input name="title" maxLength={100} required/></label><label>Description<textarea name="description" maxLength={2000}/></label><label className="check"><input name="enabled" type="checkbox" value="true"/> Publish publicly</label><button>Create collection</button></Action></section>
  </div>;
}
