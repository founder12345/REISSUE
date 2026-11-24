import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Empty,Notice,type Params } from '../ui';
import { CatalogueFields } from '../catalogue-fields';
import { ImportPanel } from '../import-panel';
export const dynamic='force-dynamic';
const back='/admin';
export default async function Admin({searchParams}:{searchParams:Promise<Params>}){
  const [user,params]=await Promise.all([viewer(),searchParams]);
  if(user?.role!=='admin')notFound();
  const [claims,submissions,campaigns,corrections,reports,products,analytics,zero,audit,users,synonyms,settings,inquiries]=await Promise.all([
    db.query<{id:string;brand:string;name:string;evidence:string}>(`SELECT r.id,b.name brand,p.name,r.evidence FROM brand_ownership_requests r JOIN brands b ON b.id=r.brand_id JOIN profiles p ON p.id=r.user_id WHERE r.status='pending' ORDER BY r.id LIMIT 50`),
    db.query<{id:string;data:Record<string,unknown>}>(`SELECT id,data FROM product_submissions WHERE status='pending' ORDER BY id LIMIT 50`),
    db.query<{id:string;title:string;status:string;}>(`SELECT c.id,c.title,c.status FROM campaigns c JOIN products p ON p.id=c.product_id WHERE p.deleted_at IS NULL ORDER BY (c.status='Under moderation') DESC,c.id DESC LIMIT 50`),
    db.query<{id:string;slug:string;name:string;suggestion:string}>(`SELECT r.id,p.slug,p.name,r.suggestion FROM correction_requests r JOIN products p ON p.id=r.product_id WHERE r.status='pending' ORDER BY r.id LIMIT 50`),
    db.query<{id:string;campaign_id:string;comment_id:string|null;reason:string;comment:string|null}>(`SELECT r.id,coalesce(r.campaign_id,c.campaign_id) campaign_id,r.comment_id,r.reason,c.body comment FROM moderation_reports r LEFT JOIN campaign_comments c ON c.id=r.comment_id WHERE r.status='pending' ORDER BY r.id LIMIT 50`),
    db.query<{id:string;slug:string;name:string;deleted_at:string|null;verification:string;demo:boolean}>('SELECT id,slug,name,deleted_at,verification,demo FROM products ORDER BY id DESC LIMIT 80'),
    db.query<{kind:string;total:string}>(`SELECT kind,count(*) total FROM search_events WHERE created_at>now()-interval '30 days' GROUP BY kind ORDER BY kind`),
    db.query<{query:string;total:string}>(`SELECT query,count(*) total FROM search_events WHERE kind='search' AND result_count=0 AND created_at>now()-interval '30 days' GROUP BY query HAVING count(*)>=3 ORDER BY count(*) DESC LIMIT 20`),
    db.query<{id:string;action:string;target:string;name:string|null;date:string}>("SELECT a.id,a.action,a.target,p.name,to_char(a.created_at,'YYYY-MM-DD HH24:MI') date FROM audit_logs a LEFT JOIN profiles p ON p.id=a.actor_id ORDER BY a.id DESC LIMIT 50"),
    db.query<{id:string;name:string;role:string;disabled_at:string|null}>('SELECT id,name,role,disabled_at FROM profiles ORDER BY created_at DESC LIMIT 50'),
    db.query<{term:string;replacement:string}>('SELECT term,replacement FROM search_synonyms ORDER BY term LIMIT 100'),
    db.query<{value:boolean}>("SELECT value FROM platform_settings WHERE key='submissions_open'"),
    db.query<{id:string;kind:string;email:string|null;company:string|null;website:string|null;body:string}>('SELECT id,kind,email,company,website,body FROM launch_inquiries WHERE reviewed_at IS NULL ORDER BY id LIMIT 100'),
  ]);
  return <div className="wrap page"><h1>Archive moderation</h1><Notice params={params}/>
    <section className="stack"><h2>Applications and feedback</h2>{inquiries.rows.length?inquiries.rows.map(item=><details className="panel" key={item.id}><summary>{item.company??'Community feedback'}</summary><p>{item.email}</p><p>{item.website}</p><p>{item.body}</p><Action name="admin-inquiry-reviewed" back={back} id={item.id}><button>Mark reviewed</button></Action></details>):<Empty>No new applications or feedback.</Empty>}</section>
    <section className="stack"><h2>Brand verification</h2>{claims.rows.length?claims.rows.map(c=><article className="panel stack" key={c.id}><h3>{c.brand}</h3><p>Submitted by {c.name}</p><p>{c.evidence}</p><div className="actions">
      <Action name="admin-claim" back={back} id={c.id} enabled><button>Verify and grant access</button></Action><Action name="admin-claim" back={back} id={c.id} enabled={false}><button className="secondary">Decline claim</button></Action>
    </div></article>):<Empty>No pending brand claims.</Empty>}</section>
    <section className="stack"><h2>Product submissions</h2>{submissions.rows.length?submissions.rows.map(s=><details className="panel" key={s.id}><summary>{String(s.data.name??'Catalogue submission')}</summary><pre>{JSON.stringify(s.data,null,2)}</pre><div className="actions">
      <Action name="admin-submission" back={back} id={s.id} enabled><button>Approve product</button></Action><Action name="admin-submission" back={back} id={s.id} enabled={false}><button className="secondary">Decline submission</button></Action>
    </div></details>):<Empty>No pending submissions.</Empty>}</section>
    <section className="stack"><h2>Campaign moderation</h2>{campaigns.rows.length?campaigns.rows.map(c=><details className="panel" key={c.id}><summary>{c.title} · {c.status}</summary><p><Link href={'/campaigns/'+c.id}>Review campaign page</Link></p>
      <Action name="campaign-status" back={back} id={c.id}><label>New status<select name="status" defaultValue={c.status}>{['Gathering interest','Under moderation','Ready for brand outreach','Brand contacted','Under brand review','Brand approved','Brand declined','Completed','Archived'].map(status=><option key={status}>{status}</option>)}</select></label><label>Public explanation and supporting evidence<textarea name="body" required maxLength={3000}/></label><button>Update campaign status</button></Action>
    </details>):<Empty>No campaigns to review.</Empty>}</section>
    <div className="split"><section className="stack"><h2>Correction requests</h2>{corrections.rows.length?corrections.rows.map(r=><article className="panel" key={r.id}><Link className="text-link" href={'/products/'+r.slug}>{r.name}</Link><p>{r.suggestion}</p><Action name="admin-correction" back={back} id={r.id}><button>Mark resolved</button></Action></article>):<Empty>No pending corrections.</Empty>}</section>
    <section className="stack"><h2>Reports</h2>{reports.rows.length?reports.rows.map(r=><article className="panel stack" key={r.id}><Link className="text-link" href={'/campaigns/'+r.campaign_id}>Campaign {r.campaign_id}</Link><p>{r.reason}</p>{r.comment&&<blockquote>{r.comment}</blockquote>}<div className="actions">
      <Action name="admin-report" back={back} id={r.id} enabled={false}><button className="secondary">Resolve report</button></Action>
      {r.comment_id&&<Action name="admin-report" back={back} id={r.id} enabled><button>Hide comment</button></Action>}
    </div></article>):<Empty>No pending reports.</Empty>}</section></div>
    <section className="stack"><h2>Catalogue management</h2><details className="panel"><summary>Enter a product manually</summary><Action name="admin-entry" back={back}><CatalogueFields/><button>Add catalogue entry</button></Action></details>
      {products.rows.map(p=><details className="panel" key={p.id}><summary>{p.name} · {p.deleted_at?'Hidden':p.demo?'Demo':p.verification}</summary><div className="stack">
        {!p.deleted_at&&<Link className="text-link" href={'/products/'+p.slug}>View product</Link>}<Link className="text-link" href={'/admin/products/'+p.id}>Edit or merge product</Link>
        <Action name="admin-product-visibility" back={back} id={p.id} enabled={Boolean(p.deleted_at)}><button className="secondary">{p.deleted_at?'Restore product':'Hide product'}</button></Action>
        {!p.demo&&<Action name="admin-verify-product" back={back} id={p.id} enabled={p.verification!=='verified'}><label>Evidence reviewed<textarea name="body" minLength={8} maxLength={1000} required/></label><button>{p.verification==='verified'?'Remove verification':'Verify source'}</button></Action>}
      </div></details>)}</section>
    <ImportPanel user={user.id} back={back}/>
    <div className="split">{(['category','brand'] as const).map(kind=><section className="panel stack" key={kind}><h2>Manage {kind==='brand'?'brands':'categories'}</h2><Action name={'admin-'+kind} back={back}><label>Name<input name="title" required maxLength={100}/></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label><button>Save {kind}</button></Action></section>)}</div>
    <div className="split"><section className="panel stack"><h2>Search synonyms</h2><Action name="admin-synonym" back={back} enabled><label>Search term<input name="term" pattern="[A-Za-z0-9]+" required/></label><label>Replacement phrase<input name="body" maxLength={100} required/></label><button>Save synonym</button></Action>
      {synonyms.rows.map(s=><Action key={s.term} name="admin-synonym" back={back} fields={{term:s.term}} enabled={false}><small>{s.term} → {s.replacement}</small><button className="secondary">Remove {s.term}</button></Action>)}</section>
    <section className="panel stack"><h2>Search activity</h2><p>Past 30 days</p>{analytics.rows.length?analytics.rows.map(r=><p key={r.kind}>{r.kind} · {r.total} events</p>):<Empty>No aggregate search activity.</Empty>}
      {zero.rows.length>0&&<><h3>Queries with no results</h3>{zero.rows.map(r=><p key={r.query}>{r.query} · {r.total} searches</p>)}</>}</section></div>
    <section className="panel stack"><h2>Platform settings</h2><p>Community submissions are {settings.rows[0]?.value?'open':'paused'}.</p><Action name="admin-submissions-setting" back={back} enabled={!settings.rows[0]?.value}><button>{settings.rows[0]?.value?'Pause submissions':'Reopen submissions'}</button></Action></section>
    <div className="split"><section className="panel stack"><h2>Recent users</h2>{users.rows.map(u=><div key={u.id}><p>{u.name} · {u.role}{u.disabled_at?' · Suspended':''}</p>{u.role==='member'&&<Action name="admin-suspend" back={back} id={u.id} enabled={!u.disabled_at}><button className="secondary">{u.disabled_at?'Reinstate':'Suspend'}</button></Action>}</div>)}</section>
    <section className="panel stack"><h2>Audit log</h2>{audit.rows.length?audit.rows.map(a=><p key={a.id}>{a.date} · {a.name??'Former member'} · {a.action} · {a.target}</p>):<Empty>No sensitive actions have been recorded.</Empty>}</section></div>
  </div>;
}
