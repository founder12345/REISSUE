import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { z } from 'zod';
import { viewer } from '@/lib/auth';
import { asActor, db } from '@/lib/db';
import { Action,Notice,first,type Params } from '../../../ui';
export default async function Draft({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(!z.uuid().safeParse(id).success)notFound();
  if(!user)redirect('/account?resume='+encodeURIComponent('/campaigns/new/'+id));
  const {rows:[d]}=await asActor(user.id,client=>client.query<{slug:string;name:string;brand:string;category:string;model:string|null;release_year:number|null;summary:string;title:string;proposal:string;variants:string;context:string;target_price:string|null;currency:string|null;submitted_campaign_id:string|null;product_id:string}>(`SELECT d.*,p.slug,p.name,p.model,p.release_year,p.description summary,p.currency,b.name brand,c.name category
    FROM campaign_drafts d JOIN products p ON p.id=d.product_id JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
    WHERE d.id=$1 AND d.user_id=$2 AND p.deleted_at IS NULL`,[id,user.id]));
  if(!d)notFound();
  if(d.submitted_campaign_id)redirect('/campaigns/'+d.submitted_campaign_id);
  const back='/campaigns/new/'+id;
  const step=first(query.step);
  const review=step==='review';
  const productInfo=step==='product';
  const {rows:sources}=await db.query<{url:string;label:string}>('SELECT url,label FROM product_sources WHERE product_id=$1 ORDER BY label',[d.product_id]);
  return <div className="wrap page legal-page"><Link className="text-link" href="/campaigns/new">Your drafts</Link><p className="kicker">STEP {productInfo?'2':review?'4':'3'} OF 4</p>
    <h1>{productInfo?'Review the catalogue record':review?'Review your campaign':'Write your proposal'}</h1><Notice params={query}/>
    <section className="panel stack"><h2>{d.name}</h2><p>{d.brand} · {d.category}{d.model?' · '+d.model:''}{d.release_year?' · '+d.release_year:''}</p><p>{d.summary}</p>
    <Link className="text-link" href={'/products/'+d.slug}>View product record and authorised imagery</Link>{sources.map(s=><a className="text-link" key={s.url} href={s.url}>{s.label}</a>)}</section>
    {productInfo?<Link className="button" href={back}>Continue to proposal</Link>:review?<section className="panel stack"><h2>{d.title||'Untitled campaign'}</h2><p>{d.proposal}</p>{d.variants&&<p>Variants · {d.variants}</p>}{d.target_price&&<p>Target price · {d.currency??'USD'} {d.target_price}</p>}{d.context&&<p>{d.context}</p>}
      <Link className="text-link" href={back}>Edit proposal</Link>
      <Action name="campaign-draft-submit" back={back+'?step=review'} id={id}>
        <label className="check"><input name="accurate" value="yes" type="checkbox" required/> The information is accurate to the best of my knowledge.</label>
        <label className="check"><input name="rights" value="yes" type="checkbox" required/> I have permission to share the content I contributed.</label>
        <label className="check"><input name="independent" value="yes" type="checkbox" required/> This campaign does not imply official brand authorisation.</label>
        <label className="check"><input name="nonbinding" value="yes" type="checkbox" required/> Campaign support is non-binding and does not constitute a purchase.</label>
        <button>Submit for moderation</button>
      </Action></section>:<section className="panel"><Action name="campaign-draft-save" back={back} id={id}>
      <label>Campaign title<input name="title" maxLength={140} defaultValue={d.title}/></label>
      <label>Why should it come back?<textarea name="body" maxLength={5000} defaultValue={d.proposal}/></label>
      <label>Desired variants<input name="variants" maxLength={500} defaultValue={d.variants}/></label>
      <label>Optional target price ({d.currency??'USD'})<input name="price" type="number" min="0" max="1000000" step=".01" defaultValue={d.target_price??undefined}/></label>
      <label>Additional context<textarea name="context" maxLength={1500} defaultValue={d.context}/></label>
      <div className="actions"><button className="secondary" name="next" value="save">Save draft</button><button name="next" value="review">Save and review</button></div>
    </Action></section>}
  </div>;
}
