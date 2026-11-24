import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { discovery } from '@/lib/search';
import { Empty,Notice,ProductGrid,type Params } from './ui';

export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Params>}){
  const [rediscovered,requested,momentum,recent,categories,collections,params]=await Promise.all([
    discovery('verified'),discovery('requested'),discovery('momentum'),discovery('recent'),
    db.query<{slug:string;name:string}>('SELECT slug,name FROM categories ORDER BY name'),
    db.query<{id:string;title:string;name:string}>('SELECT c.id,c.title,p.name FROM collections c JOIN profiles p ON p.id=c.user_id WHERE c.published ORDER BY c.id DESC LIMIT 4'),searchParams,
  ]);
  return <>
    <div className="wrap"><Notice params={params}/></div>
    <section className="hero wrap">
      <div className="hero-copy">
        <div className="kicker"><span/> THE DISCONTINUED DESIGN ARCHIVE</div>
        <h1>Good things deserve<br className="desktop-break"/> a <em>second life.</em></h1>
        <p>Discover discontinued favourites, rally a community and bring them back.</p>
        <form action="/explore" className="hero-search"><label className="sr-only" htmlFor="home-search">Search the archive</label><input id="home-search" name="q" maxLength={120} placeholder="Find something you wish still existed..."/><button>Search</button></form>
        <Link className="text-link" href="/explore">Browse the archive</Link>
      </div>
      <figure className="hero-image"><Image src="/archive-hero.webp" alt="Illustrative still life of an archival cassette player and headphones" fill priority sizes="(max-width: 800px) 100vw, 50vw"/><figcaption>Archive illustration · Portable audio</figcaption></figure>
    </section>
    <div className="wrap home-sections">
      <section><header className="section-head"><h2>Recently rediscovered</h2><Link href="/explore">View archive</Link></header>{rediscovered.length?<ProductGrid products={rediscovered}/>:<Empty>Verified discoveries will appear here as the archive grows.</Empty>}</section>
      <section><header className="section-head"><h2>Explore by category</h2></header><div className="chips">{categories.rows.map(c=><Link href={'/explore?category='+c.slug} key={c.slug}>{c.name}</Link>)}</div></section>
      <section><header className="section-head"><h2>Most requested comebacks</h2><Link href="/campaigns">View campaigns</Link></header>{requested.length?<ProductGrid products={requested}/>:<Empty>Be the first to register interest in a comeback.</Empty>}</section>
      <section><header className="section-head"><h2>Products gaining momentum</h2></header>{momentum.length?<ProductGrid products={momentum}/>:<Empty>New interest over the last seven days will appear here.</Empty>}</section>
      <section><header className="section-head"><h2>Community collections</h2><Link href="/collections">View collections</Link></header>{collections.rows.length?<div className="list-grid">{collections.rows.map(c=><Link className="panel" key={c.id} href={'/collections/'+c.id}><h3>{c.title}</h3><p>Curated by {c.name}</p></Link>)}</div>:<Empty>Public collections from archive members will appear here.</Empty>}</section>
      <section><header className="section-head"><h2>Recently added to the archive</h2><Link href="/submit">Submit a product</Link></header>{recent.length?<ProductGrid products={recent}/>:<Empty>The archive is waiting for its first catalogue entry.</Empty>}</section>
      <section className="forest-panel"><div><h2>How REISSUE works</h2><p>Find an archival product and register interest in its return. Brands can review community demand and respond directly.</p></div><Link className="button light" href="/brands">For brands</Link></section>
    </div>
  </>;
}
