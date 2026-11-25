import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { discovery } from '@/lib/search';
import { Empty,Notice,ProductGrid,type Params } from './ui';

export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Params>}){
  const [verified,editorial,requested,momentum,recent,categories,popular,collections,params]=await Promise.all([
    discovery('verified'),discovery('editorial'),discovery('requested'),discovery('momentum'),discovery('recent'),
    db.query<{slug:string;name:string}>(`SELECT slug,name FROM categories ORDER BY CASE slug WHEN 'fashion' THEN 1 WHEN 'outdoor' THEN 2 WHEN 'watches' THEN 3 WHEN 'design-objects' THEN 4 ELSE 5 END,name`),
    db.query<{slug:string;name:string;supporters:number}>(`SELECT k.slug,k.name,count(DISTINCT s.user_id)::int supporters
      FROM campaign_supporters s JOIN campaigns c ON c.id=s.campaign_id JOIN products p ON p.id=c.product_id JOIN categories k ON k.id=p.category_id
      WHERE p.deleted_at IS NULL AND NOT p.demo AND c.rejected_at IS NULL AND c.status NOT IN ('Under moderation','Archived')
      GROUP BY k.id HAVING count(DISTINCT s.user_id)>=5 ORDER BY supporters DESC,k.name LIMIT 6`),
    db.query<{id:string;title:string;name:string}>('SELECT c.id,c.title,p.name FROM collections c JOIN profiles p ON p.id=c.user_id WHERE c.published ORDER BY c.id DESC LIMIT 4'),searchParams,
  ]);
  return <>
    <div className="wrap"><Notice params={params}/></div>
    <section className="hero wrap">
      <div className="hero-copy">
        <div className="kicker"><span/> THE PRODUCT ARCHIVE</div>
        <h1>Find what you miss.<br className="desktop-break"/> <em>Bring it back.</em></h1>
        <p>Explore products worth remembering and show brands what you’d like to see return.</p>
        <form action="/explore" className="hero-search"><label className="sr-only" htmlFor="home-search">Search the archive</label><input id="home-search" name="q" maxLength={120} placeholder="Try a brand, model or reference"/><button>Search</button></form>
        <div className="hero-links"><Link prefetch={false} className="text-link" href="/explore">Browse the archive</Link><Link prefetch={false} className="text-link" href="/campaigns">Explore comebacks</Link></div>
      </div>
      <figure className="hero-image"><Image src="/archive/walkman-tps-l2.webp" alt="Blue and silver Sony Walkman TPS-L2" fill loading="eager" fetchPriority="high" sizes="(max-width: 800px) 100vw, 50vw"/>
        <figcaption><strong>Sony Walkman TPS-L2</strong><span><a href="https://commons.wikimedia.org/wiki/File:Walkman_TPS-L2.jpg">Anna Gerdén</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a></span></figcaption></figure>
    </section>
    <div className="wrap home-sections">
      <section><header className="section-head"><h2>{verified.length?'Recently verified':'Editorial archive selection'}</h2><Link prefetch={false} href="/explore">View archive</Link></header>{verified.length||editorial.length?<ProductGrid products={verified.length?verified:editorial}/>:<Empty>Verified records will appear here as the archive grows.</Empty>}</section>
      <section><header className="section-head"><h2>Explore by category</h2></header><div className="chips">{categories.rows.map(c=><Link prefetch={false} href={'/archive/categories/'+c.slug} key={c.slug}>{c.name}</Link>)}</div></section>
      {popular.rows.length>0&&<section><header className="section-head"><h2>Categories with the most interest</h2></header><div className="chips">
        {popular.rows.map(c=><Link prefetch={false} key={c.slug} href={'/archive/categories/'+c.slug}>{c.name}</Link>)}
      </div></section>}
      <section><header className="section-head"><h2>Most requested comebacks</h2><Link prefetch={false} href="/campaigns">View campaigns</Link></header>{requested.length?<ProductGrid products={requested}/>:<Empty>Be the first to register interest in a comeback.</Empty>}</section>
      <section><header className="section-head"><h2>Emerging campaigns</h2></header>{momentum.length?<ProductGrid products={momentum}/>:<Empty>New interest over the last seven days will appear here.</Empty>}</section>
      <section><header className="section-head"><h2>Community collections</h2><Link prefetch={false} href="/collections">View collections</Link></header>{collections.rows.length?<div className="list-grid">{collections.rows.map(c=><Link prefetch={false} className="panel" key={c.id} href={'/collections/'+c.id}><h3>{c.title}</h3><p>Curated by {c.name}</p></Link>)}</div>:<Empty>Public collections from archive members will appear here.</Empty>}</section>
      <section><header className="section-head"><h2>Recently added to the archive</h2><Link prefetch={false} href="/submit">Submit a product</Link></header>{recent.length?<ProductGrid products={recent}/>:<Empty>The archive is waiting for its first catalogue entry.</Empty>}</section>
      <section className="forest-panel"><div><h2>How REISSUE works</h2><p>Find an archival product and register interest in its return. Brands can review community demand and respond directly.</p></div><Link prefetch={false} className="button light" href="/brands">For brands</Link></section>
    </div>
  </>;
}
