import Link from 'next/link';
import { db } from '@/lib/db';
import { Empty } from '../ui';
export const dynamic='force-dynamic';
export default async function Campaigns(){
  const {rows}=await db.query<{id:string;title:string;description:string;status:string;demo:boolean;supporters:number}>(`SELECT c.id,c.title,c.description,c.status,p.demo,count(s.user_id)::int AS supporters
    FROM campaigns c JOIN products p ON p.id=c.product_id LEFT JOIN campaign_supporters s ON s.campaign_id=c.id
    WHERE p.deleted_at IS NULL AND c.status NOT IN ('Under moderation','Archived') GROUP BY c.id,p.id ORDER BY supporters DESC,c.id DESC LIMIT 100`);
  return <div className="wrap page"><h1>Comeback campaigns</h1><p className="intro">Register your interest in a product revival. Brands can use the response to understand community demand.</p><p><Link href="/explore">Find a product to bring back</Link> · <Link href="/submit">Submit a missing product</Link></p>
    {rows.length?<div className="list-grid">{rows.map(c=><Link className="panel" key={c.id} href={'/campaigns/'+c.id}>{c.demo&&<p className="kicker">DEMO CAMPAIGN</p>}<h3>{c.title}</h3><p>{c.status} · {c.supporters} interested</p><p>{c.description.slice(0,140)}</p></Link>)}</div>:<Empty>Published campaigns will appear here.</Empty>}
  </div>;
}
