import Link from 'next/link';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Empty,Notice,type Params } from '../ui';
export const dynamic='force-dynamic';
export default async function Brands({searchParams}:{searchParams:Promise<Params>}){
  const [user,params]=await Promise.all([viewer(),searchParams]);
  const {rows}=await db.query<{id:string;slug:string;name:string;member:boolean;claim:string|null}>(`SELECT b.id,b.slug,b.name,
    EXISTS(SELECT 1 FROM brand_members m WHERE m.brand_id=b.id AND m.user_id=$1) member,
    (SELECT status FROM brand_ownership_requests r WHERE r.brand_id=b.id AND r.user_id=$1 ORDER BY r.id DESC LIMIT 1) claim
    FROM brands b ORDER BY b.name LIMIT 300`,[user?.id??null]);
  return <div className="wrap page"><p className="kicker">FOR ORIGINAL MANUFACTURERS</p><h1>See what your customers want back.</h1><p className="intro">Verified brand representatives can review aggregate demand, contribute historical product records and respond to comeback campaigns.</p><Notice params={params}/><p><Link className="button" href="/founding-partners">Apply to the founding brand programme</Link></p>
    {!user&&<p><Link href="/account">Create an account or sign in</Link> to request access.</p>}
    <section><header className="section-head"><h2>Brand directory</h2></header>{rows.length?<div className="list-grid">{rows.map(b=><article className="panel stack" key={b.id}>
      <h3>{b.name}</h3><Link className="text-link" href={'/archive/brands/'+b.slug}>Explore products</Link>
      {b.member?<Link className="button" href={'/brands/'+b.id}>Open brand dashboard</Link>:user&&b.claim!=='pending'?<details><summary>Request brand access</summary>
      <Action name="claim-brand" back="/brands" id={b.id}><label>Ownership evidence<textarea name="body" minLength={20} maxLength={4000} required/></label><button>Submit verification</button></Action></details>:b.claim==='pending'?<small>Verification pending</small>:null}
    </article>)}</div>:<Empty>Brand profiles will appear as the catalogue grows.</Empty>}</section>
  </div>;
}
