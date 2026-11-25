import { ConfirmButton } from '../confirm-button';
import Link from 'next/link';
import Image from 'next/image';
import { googleConfigured } from '@/lib/google';
import { mailConfigured } from '@/lib/mail';
import { registrationOpen,termsVersion } from '@/lib/policies';
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
    <section className="panel stack"><h2>Sign in</h2><Action name="sign-in" back={authBack} fields={{resume}}><label>Email<input type="email" name="email" autoComplete="email" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" required/></label><button>Sign in</button></Action>
    <div className="account-links"><Link href="/account/access">Forgot password?</Link><Link href="/account/access?purpose=verify">Resend verification</Link></div>
    {googleConfigured()&&<a className="button secondary" href="/api/auth/google">Continue with Google</a>}</section>
    <section className="panel stack"><h2>Create an account</h2>{registrationOpen()&&mailConfigured()?<Action name="register" back={authBack} fields={{resume}}><label>Public display name<input name="name" autoComplete="nickname" minLength={2} maxLength={70} required/></label><label>Email<input type="email" name="email" autoComplete="email" required/></label><label>Password (at least 12 characters)<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label><label>Username<input name="username" minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" autoComplete="username" required/></label>
    <input type="hidden" name="termsVersion" value={termsVersion()}/>
    <label className="check"><input name="terms" type="checkbox" value="yes" required/> <span>I accept the <Link href="/terms" target="_blank">Terms of Service</Link>.</span></label>
    <button>Create account</button></Action>:<p>New email accounts are currently unavailable.</p>}</section>
  </div></div>;
  const [saved,alerts,collections,follows,brands,searches,campaigns,services,savedCampaigns]=await Promise.all([
    db.query<Product>(`${catalogue} JOIN saved_products s ON s.product_id=p.id WHERE s.user_id=$1 AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 100`,[user.id]),
    db.query<{id:string;campaign_id:string;title:string;body:string;read_at:string|null}>('SELECT u.id,u.campaign_id,c.title,u.body,n.read_at FROM notifications n JOIN campaign_updates u ON u.id=n.update_id JOIN campaigns c ON c.id=u.campaign_id JOIN products p ON p.id=c.product_id WHERE n.user_id=$1 AND p.deleted_at IS NULL AND c.status<>\'Under moderation\' ORDER BY u.id DESC LIMIT 40',[user.id]),
    db.query<{id:string;title:string;published:boolean}>('SELECT id,title,published FROM collections WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[user.id]),
    db.query<{id:string;title:string}>('SELECT c.id,c.title FROM campaign_follows f JOIN campaigns c ON c.id=f.campaign_id JOIN products p ON p.id=c.product_id WHERE f.user_id=$1 AND p.deleted_at IS NULL AND c.status<>\'Under moderation\' ORDER BY c.id DESC LIMIT 50',[user.id]),
    db.query<{slug:string;name:string}>('SELECT b.slug,b.name FROM brand_follows f JOIN brands b ON b.id=f.brand_id WHERE f.user_id=$1 ORDER BY b.name LIMIT 50',[user.id]),
    db.query<{query:string}>('SELECT query FROM saved_searches WHERE user_id=$1 ORDER BY saved_at DESC',[user.id]),
    db.query<{id:string;title:string;status:string;created:boolean}>(`SELECT c.id,c.title,CASE WHEN c.rejected_at IS NOT NULL THEN 'Rejected' ELSE c.status END AS status,c.author_id=$1 AS created
      FROM campaigns c JOIN products p ON p.id=c.product_id WHERE p.deleted_at IS NULL AND
      (c.author_id=$1 OR (c.status<>'Under moderation' AND c.rejected_at IS NULL AND EXISTS(SELECT 1 FROM campaign_supporters s WHERE s.campaign_id=c.id AND s.user_id=$1)))
      ORDER BY c.id DESC LIMIT 100`,[user.id]),
    db.query<{id:string;body:string;path:string;read_at:string|null}>('SELECT id,body,path,read_at FROM service_notices WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[user.id]),
    db.query<{id:string;title:string}>(`SELECT c.id,c.title FROM saved_campaigns s JOIN campaigns c ON c.id=s.campaign_id JOIN products p ON p.id=c.product_id
      WHERE s.user_id=$1 AND p.deleted_at IS NULL AND c.status NOT IN ('Under moderation','Archived') AND c.rejected_at IS NULL ORDER BY c.id DESC`,[user.id]),
  ]);
  return <div className="wrap page"><div className="actions">{user.has_avatar?<Image className="avatar" src="/api/avatar" width={48} height={48} alt="" unoptimized/>:<span className="avatar" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</span>}
      <div><h1>{user.name}</h1>{user.username&&<p>@{user.username}</p>}</div></div><Notice params={params}/>
    <div className="actions"><Action name="sign-out" back={path}><button className="secondary">Sign out</button></Action><Link className="button secondary" href="/brands">Brand portal</Link>{user.role==='admin'&&<Link className="button secondary" href="/admin">Moderation</Link>}</div>
    <div className="split">
      <section className="panel stack"><h2>Campaigns created</h2>{campaigns.rows.filter(c=>c.created).map(c=><Link key={c.id} href={'/campaigns/'+c.id}>{c.title} · {c.status}</Link>)}
      {!campaigns.rows.some(c=>c.created)&&<Empty>No submitted campaigns yet.</Empty>}<Link className="text-link" href="/campaigns/new">Start a campaign or view drafts</Link></section>
      <section className="panel stack"><h2>Campaigns supported</h2>{campaigns.rows.filter(c=>!c.created).map(c=><Link key={c.id} href={'/campaigns/'+c.id}>{c.title} · {c.status}</Link>)}{!campaigns.rows.some(c=>!c.created)&&<Empty>No campaigns supported yet.</Empty>}</section>
    </div>
    <section id="saved"><header className="section-head"><h2>Saved products</h2></header>{saved.rows.length?<ProductGrid products={saved.rows}/>:<Empty>Products you save will appear here.</Empty>}</section>
    <section className="stack"><h2>Saved campaigns</h2>{savedCampaigns.rows.length?savedCampaigns.rows.map(item=><div className="actions" key={item.id}><Link className="text-link" href={'/campaigns/'+item.id}>{item.title}</Link>
      <Action name="save-campaign" back={path} id={item.id}><button className="secondary">Remove saved campaign</button></Action></div>):<Empty>No saved campaigns yet.</Empty>}</section>
    <section className="stack"><h2>Saved searches</h2>{searches.rows.length?searches.rows.map(item=><div className="actions" key={item.query}><Link className="text-link" href={'/explore?'+new URLSearchParams({q:item.query})}>{item.query}</Link>
      <Action name="save-search" back={path} fields={{query:item.query}}><button className="secondary">Remove search</button></Action></div>):<Empty>No saved searches yet.</Empty>}</section>
    <section className="stack"><h2>Notifications</h2>{services.rows.map(item=><article className="panel" key={item.id}><Link className="text-link" href={item.path}>{item.body}</Link>{!item.read_at&&<small> · Unread</small>}</article>)}{alerts.rows.length?alerts.rows.map(n=><article className="panel" key={n.id}><Link className="text-link" href={'/campaigns/'+n.campaign_id}>{n.title}</Link>{!n.read_at&&<small> · Unread</small>}<p>{n.body}</p></article>):!services.rows.length&&<Empty>Updates from campaigns you follow or support will appear here.</Empty>}
      {[...alerts.rows,...services.rows].some(n=>!n.read_at)&&<Action name="mark-read" back={path}><button className="secondary">Mark all as read</button></Action>}</section>
    <div className="split"><section className="panel stack"><h2>Your collections</h2>{collections.rows.map(c=><Link className="text-link" key={c.id} href={'/collections/'+c.id}>{c.title} · {c.published?'Public':'Private'}</Link>)}<Link className="button secondary" href="/collections#new">Create a collection</Link></section>
    <section className="panel stack"><h2>Following</h2>{follows.rows.map(c=><Link className="text-link" key={c.id} href={'/campaigns/'+c.id}>{c.title}</Link>)}{brands.rows.map(b=><Link className="text-link" key={b.slug} href={'/explore?brand='+b.slug}>{b.name}</Link>)}{!follows.rows.length&&!brands.rows.length&&<p>Follow campaigns and brands to revisit them here.</p>}</section></div>
    <div className="split"><section className="panel stack" id="profile"><h2>Profile settings</h2><Action name="profile" back={path}><label>Display name<input name="name" minLength={2} maxLength={70} defaultValue={user.name} required/></label><label>Username<input name="username" maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" defaultValue={user.username??undefined}/></label><label className="check"><input type="checkbox" name="enabled" value="true" defaultChecked={user.search_history}/> Save search history on this account</label><button>Save settings</button></Action>
    <form className="action" action="/api/avatar" method="post" encType="multipart/form-data"><label>Profile picture (up to 2 MB)<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required/></label><button className="secondary">Upload picture</button></form>
    {user.has_avatar&&<Action name="avatar-remove" back={path}><button className="secondary">Remove picture</button></Action>}</section>
    <section className="panel stack" id="privacy"><h2>Privacy and security</h2><p>Signed in as {user.email}</p><div className="account-links"><a href="/account/export">Download my data</a><Link href="/rights">Privacy requests</Link><Link href="/cookies">Cookie settings</Link>{user.has_password&&<Link href="/account/access">Reset password</Link>}</div><h3>Delete account</h3><p>Deletion removes your account, saved products, collections and interest registrations.</p><Action name="delete-account" back={path}>{user.has_password?<label>Confirm your password<input name="password" type="password" autoComplete="current-password" required/></label>:<label>Type DELETE after signing in again with Google<input name="confirmation" required pattern="DELETE"/></label>}<ConfirmButton message="Permanently delete your account and saved data?">Permanently delete account</ConfirmButton></Action></section></div>
  </div>;
}
