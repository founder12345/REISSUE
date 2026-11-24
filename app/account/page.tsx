import Link from 'next/link';
import { viewer } from '@/lib/auth';
import { db } from '@/lib/db';
import { catalogue,type Product } from '@/lib/search';
import { Action,Empty,Notice,ProductGrid,first,type Params } from '../ui';
export const dynamic='force-dynamic';
export default async function Account({searchParams}:{searchParams:Promise<Params>}){
  const [user,params]=await Promise.all([viewer(),searchParams]);
  const path='/account';
  const resume=first(params.resume)?.slice(0,300)??'';
  const authBack=resume?path+'?'+new URLSearchParams({resume}):path;
  if(!user)return <div className="wrap page"><h1>Your account</h1><Notice params={params}/><div className="split">
    <section className="panel stack"><h2>Sign in</h2><Action name="sign-in" back={authBack} fields={{resume}}><label>Email<input type="email" name="email" autoComplete="email" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" required/></label><button>Sign in</button></Action></section>
    <section className="panel stack"><h2>Create an account</h2><Action name="register" back={authBack} fields={{resume}}><label>Public display name<input name="name" autoComplete="nickname" minLength={2} maxLength={70} required/></label><label>Email<input type="email" name="email" autoComplete="email" required/></label><label>Password (at least 12 characters)<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><button>Create account</button></Action></section>
  </div></div>;
  const [saved,alerts,collections,follows,brands]=await Promise.all([
    db.query<Product>(`${catalogue} JOIN saved_products s ON s.product_id=p.id WHERE s.user_id=$1 AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 100`,[user.id]),
    db.query<{id:string;campaign_id:string;title:string;body:string;read_at:string|null}>('SELECT u.id,u.campaign_id,c.title,u.body,n.read_at FROM notifications n JOIN campaign_updates u ON u.id=n.update_id JOIN campaigns c ON c.id=u.campaign_id JOIN products p ON p.id=c.product_id WHERE n.user_id=$1 AND p.deleted_at IS NULL AND c.status<>\'Under moderation\' ORDER BY u.id DESC LIMIT 40',[user.id]),
    db.query<{id:string;title:string;published:boolean}>('SELECT id,title,published FROM collections WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[user.id]),
    db.query<{id:string;title:string}>('SELECT c.id,c.title FROM campaign_follows f JOIN campaigns c ON c.id=f.campaign_id JOIN products p ON p.id=c.product_id WHERE f.user_id=$1 AND p.deleted_at IS NULL AND c.status<>\'Under moderation\' ORDER BY c.id DESC LIMIT 50',[user.id]),
    db.query<{slug:string;name:string}>('SELECT b.slug,b.name FROM brand_follows f JOIN brands b ON b.id=f.brand_id WHERE f.user_id=$1 ORDER BY b.name LIMIT 50',[user.id]),
  ]);
  return <div className="wrap page"><h1>{user.name}</h1><Notice params={params}/>
    <div className="actions"><Action name="sign-out" back={path}><button className="secondary">Sign out</button></Action><Link className="button secondary" href="/brands">Brand portal</Link>{user.role==='admin'&&<Link className="button secondary" href="/admin">Moderation</Link>}</div>
    <section id="saved"><header className="section-head"><h2>Saved products</h2></header>{saved.rows.length?<ProductGrid products={saved.rows}/>:<Empty>Products you save will appear here.</Empty>}</section>
    <section className="stack"><h2>Campaign notifications</h2>{alerts.rows.length?alerts.rows.map(n=><article className="panel" key={n.id}><Link className="text-link" href={'/campaigns/'+n.campaign_id}>{n.title}</Link>{!n.read_at&&<small> · Unread</small>}<p>{n.body}</p></article>):<Empty>Updates from campaigns you follow or support will appear here.</Empty>}
      {alerts.rows.some(n=>!n.read_at)&&<Action name="mark-read" back={path}><button className="secondary">Mark all as read</button></Action>}</section>
    <div className="split"><section className="panel stack"><h2>Your collections</h2>{collections.rows.map(c=><Link className="text-link" key={c.id} href={'/collections/'+c.id}>{c.title} · {c.published?'Public':'Private'}</Link>)}<Link className="button secondary" href="/collections#new">Create a collection</Link></section>
    <section className="panel stack"><h2>Following</h2>{follows.rows.map(c=><Link className="text-link" key={c.id} href={'/campaigns/'+c.id}>{c.title}</Link>)}{brands.rows.map(b=><Link className="text-link" key={b.slug} href={'/explore?brand='+b.slug}>{b.name}</Link>)}{!follows.rows.length&&!brands.rows.length&&<p>Follow campaigns and brands to revisit them here.</p>}</section></div>
    <div className="split"><section className="panel stack"><h2>Profile settings</h2><Action name="profile" back={path}><label>Display name<input name="name" minLength={2} maxLength={70} defaultValue={user.name} required/></label><label className="check"><input type="checkbox" name="enabled" value="true" defaultChecked={user.search_history}/> Save search history on this account</label><button>Save settings</button></Action></section>
    <section className="panel stack"><h2>Delete account</h2><p>Deletion removes your account, saved products, collections and interest registrations.</p><Action name="delete-account" back={path}><label>Confirm your password<input name="password" type="password" autoComplete="current-password" required/></label><button className="secondary">Permanently delete account</button></Action></section></div>
  </div>;
}
