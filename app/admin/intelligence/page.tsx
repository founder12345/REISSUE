import Link from 'next/link';
import { notFound } from 'next/navigation';
import { viewer } from '@/lib/auth';
import { db } from '@/lib/db';
import { Empty } from '../../ui';

const percent=(numerator:number,denominator:number)=>denominator?((100*numerator/denominator).toFixed(1)+'%'):'Insufficient data';
export default async function BusinessMetrics(){
  const user=await viewer();
  if(user?.role!=='admin')notFound();
  const [inventory,activity,search,failures,pilots]=await Promise.all([
    db.query<{registered:number;products:number;verified:number;campaigns:number;published:number;supporters:number;intent:number;applications:number;brands:number}>(`
      WITH eligible AS (SELECT c.id,c.status FROM campaigns c JOIN products p ON p.id=c.product_id WHERE NOT p.demo AND p.deleted_at IS NULL)
      SELECT
        (SELECT count(*)::int FROM profiles WHERE role='member' AND disabled_at IS NULL AND email_verified_at IS NOT NULL) registered,
        (SELECT count(*)::int FROM products WHERE NOT demo AND deleted_at IS NULL) products,
        (SELECT count(*)::int FROM products WHERE NOT demo AND deleted_at IS NULL AND verification='verified') verified,
        (SELECT count(*)::int FROM eligible) campaigns,
        (SELECT count(*)::int FROM eligible WHERE status NOT IN ('Under moderation','Archived')) published,
        (SELECT count(DISTINCT s.user_id)::int FROM campaign_supporters s JOIN eligible e ON e.id=s.campaign_id WHERE e.status NOT IN ('Under moderation','Archived')) supporters,
        (SELECT count(*)::int FROM campaign_supporters s JOIN eligible e ON e.id=s.campaign_id WHERE e.status NOT IN ('Under moderation','Archived') AND s.likelihood>=4) intent,
        (SELECT count(*)::int FROM launch_inquiries WHERE kind='brand') applications,
        (SELECT count(DISTINCT m.brand_id)::int FROM brand_members m JOIN profiles p ON p.id=m.user_id WHERE p.disabled_at IS NULL) brands`),
    db.query<{active:number;returners:number;cohort:number;retained:number}>(`
      WITH active AS (SELECT a.user_id,count(*) days FROM member_activity_days a JOIN profiles p ON p.id=a.user_id AND p.role='member'
        WHERE observed_on >= (now() AT TIME ZONE 'UTC')::date - 29 GROUP BY a.user_id),
      cohort AS (SELECT p.id,(p.created_at AT TIME ZONE 'UTC')::date joined FROM profiles p WHERE p.role='member'
        AND (p.created_at AT TIME ZONE 'UTC')::date BETWEEN (now() AT TIME ZONE 'UTC')::date-89 AND (now() AT TIME ZONE 'UTC')::date-60),
      measured AS (SELECT c.* FROM cohort c WHERE EXISTS(SELECT 1 FROM member_activity_days a WHERE a.user_id=c.id AND a.observed_on BETWEEN c.joined AND c.joined+6))
      SELECT (SELECT count(*)::int FROM active) active,(SELECT count(*)::int FROM active WHERE days>=2) returners,
        (SELECT count(*)::int FROM measured) cohort,
        (SELECT count(*)::int FROM measured m WHERE EXISTS(SELECT 1 FROM member_activity_days a WHERE a.user_id=m.id AND a.observed_on BETWEEN m.joined+30 AND m.joined+59)) retained`),
    db.query<{searches:number;found:number;empty:number;traced:number;visited:number;supported:number}>(`SELECT count(*)::int searches,
      count(*) FILTER(WHERE result_count>0)::int found,count(*) FILTER(WHERE result_count=0)::int empty,
      count(journey_id)::int traced,count(journey_viewed_at)::int visited,count(journey_supported_at)::int supported
      FROM search_events WHERE kind='search' AND created_at>=now()-interval '30 days'`),
    db.query<{query:string;count:number}>(`SELECT query,count(*)::int FROM search_events WHERE
      kind='search' AND result_count=0 AND query IS NOT NULL AND created_at>=now()-interval '30 days'
      GROUP BY query HAVING count(*)>=5 ORDER BY count(*) DESC,query LIMIT 15`),
    db.query<{brand:string;title:string;stage:string;contact_preference:string;notes:string}>(`SELECT b.name brand,c.title,x.stage,x.contact_preference,x.notes FROM brand_pilots x
      JOIN brands b ON b.id=x.brand_id JOIN campaigns c ON c.id=x.campaign_id ORDER BY x.updated_at DESC LIMIT 30`),
  ]);
  const counts=inventory.rows[0], members=activity.rows[0], funnel=search.rows[0];
  const values=[
    ['Verified registered members',counts.registered],['Observed active members, last 30 UTC days',members.active],
    ['Observed returning members, two or more UTC days',members.returners],['Observed cohort retention, days 30–59',members.cohort>=5?percent(members.retained,members.cohort):'Insufficient data'],
    ['Live catalogue records',counts.products],['Verified products',counts.verified],['Campaigns created',counts.campaigns],
    ['Published campaigns',counts.published],['Unique supporters across published campaigns',counts.supporters],
    ['High-intent support responses (4–5 of 5)',counts.intent],['Brand applications',counts.applications],['Brands with a verified representative',counts.brands],
    ['Consented searches, last 30 days',funnel.searches],['Searches with results',percent(funnel.found,funnel.searches)],['Searches with no results',funnel.empty],
    ['Observed search to campaign',percent(funnel.visited,funnel.traced)],['Observed campaign to support',percent(funnel.supported,funnel.visited)],
  ];
  return <div className="wrap page"><Link className="text-link" href="/admin">Archive moderation</Link><h1>Business metrics</h1>
    <p className="intro">{process.env.VERCEL_ENV==='production'?'Production database':'Internal or preview database'}. Activity and funnel metrics reflect only consented navigation. Stated intent is non-binding.</p>
    <section className="panel"><dl className="metric-list">{values.map(([label,value])=><div className="metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className="stack"><h2>Recurring searches without matches</h2>{failures.rows.length?<ul className="demand-list">{failures.rows.map(r=><li key={r.query}><span>{r.query}</span><strong>{r.count}</strong></li>)}</ul>:<Empty>Queries appear after at least five consented no-result searches.</Empty>}</section>
    <section className="stack"><h2>Private brand pilots</h2>{pilots.rows.length?pilots.rows.map((p,i)=><article key={i} className="panel"><h3>{p.title}</h3><p>{p.brand} · {p.stage} · Contact preference: {p.contact_preference}</p><p>{p.notes}</p></article>):<Empty>No private pilot details have been saved.</Empty>}</section>
  </div>;
}
