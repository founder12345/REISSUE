import { validFlow } from '@/lib/discovery-events';
import { consent } from '@/lib/consent';
import { lifecycleStatus,saveEvidence,verificationLevel } from '@/lib/verification';
import { CatalogueError,continueCatalogue,queueCatalogue } from '@/lib/catalogue-jobs';
import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { hashOpaque,lockAccountToken,sendAccountLink,tokenField,usernameField } from '@/lib/account-tokens';
import { onboardingCookie } from '@/lib/google';
import { mailConfigured,sendMail } from '@/lib/mail';
import { consentCookie,consentLifetime,consentVersion,optionalAnalytics,registrationOpen,termsVersion } from '@/lib/policies';
import { configuredOrigin,siteOrigin } from '@/lib/site';
import { asActor, db, transaction } from '@/lib/db';
import { endSession, limit, matchesPassword, passwordHash, startSession, viewer } from '@/lib/auth';
import { editProduct, insertProduct, mergeProduct, record } from '@/lib/ingestion';
import type { PoolClient } from 'pg';

const statuses=['Gathering interest','Under moderation','Ready for brand outreach','Brand contacted','Under brand review','Brand approved','Brand declined','Completed','Archived'] as const;
const allowedInterest = ['Gathering interest','Ready for brand outreach','Brand contacted','Under brand review','Brand approved'];
class ActionError extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ActionError(message);
}
function notifyByEmail(userId:string,subject:string,body:string,path:string){
  if(!mailConfigured())return;
  after(async ()=>{
    try{
      const {rows:[recipient]}=await db.query<{email:string}>('SELECT email FROM profiles WHERE id=$1 AND email_verified_at IS NOT NULL AND disabled_at IS NULL',[userId]);
      if(recipient)await sendMail(recipient.email,subject,body,new URL(path,siteOrigin()));
    }catch{console.error('Service notification delivery failed');}
  });
}
async function audit(client:PoolClient, actor:string, action:string,target:string,details:object={}) {
  await client.query('INSERT INTO audit_logs(actor_id,action,target,details) VALUES($1,$2,$3,$4)',[actor,action,target,JSON.stringify(details)]);
}
async function updateCampaign(client:PoolClient,id:string,actor:string,body:string,official:boolean) {
  const {rows}=await client.query<{id:string}>('INSERT INTO campaign_updates(campaign_id,author_id,body,official) VALUES($1,$2,$3,$4) RETURNING id',[id,actor,body,official]);
  await client.query(`INSERT INTO notifications(user_id,update_id)
    SELECT user_id,$2::bigint FROM campaign_follows WHERE campaign_id=$1
    UNION SELECT user_id,$2::bigint FROM campaign_supporters WHERE campaign_id=$1 ON CONFLICT DO NOTHING`,[id,rows[0].id]);
}

export async function POST(request:NextRequest) {
  const origin=configuredOrigin() ?? request.nextUrl.origin;
  if (request.headers.get('origin')!==origin) return new NextResponse('Invalid request origin',{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new NextResponse('Unsupported form format',{status:415});
  const reader=request.body?.getReader();
  const decoder=new TextDecoder();
  let raw='', size=0;
  if(reader) {
    for(;;) {
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>260000){await reader.cancel();return new NextResponse('Request too large',{status:413});}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
  }
  const form=new URLSearchParams(raw);
  const field=(key:string)=>form.get(key)?.trim() ?? '';
  const action=field('action');
  const back=field('returnTo');
  const go=(path:string,key?:string,message?:string)=>{
    let destination=new URL('/',origin);
    try {
      const candidate=new URL(path,origin);
      if(path.startsWith('/') && candidate.origin===destination.origin)destination=candidate;
    } catch {}
    if(key && message) destination.searchParams.set(key,message);
    return NextResponse.redirect(destination,303);
  };
  const safe=back || '/';
  const text=(key:string,max=3000,min=1)=>z.string().min(min).max(max).parse(field(key));
  const id=(key='id')=>z.string().regex(/^[1-9]\d{0,17}$/).parse(field(key));
  const optionalNumber=(key:string,maximum:number,integer=false,minimum=0)=>{
    if(!field(key)) return null;
    const schema=z.coerce.number().min(minimum).max(maximum);
    return (integer ? schema.int() : schema).parse(field(key));
  };
  const toggle=field('enabled')==='true';
  try {
    const ip=(process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] : null) ?? 'local';
    if(action==='cookie-consent'){
      const jar=await cookies();
      const enabled=toggle&&optionalAnalytics();
      jar.set(consentCookie,consentVersion+'.'+(enabled?'analytics':'necessary'),{
        httpOnly:true,sameSite:'lax',secure:origin.startsWith('https://'),path:'/',maxAge:consentLifetime,
      });
      return safe==='/cookies'?go('/cookies','notice','Cookie preferences saved.'):go(safe);
    }
    const acceptTerms=()=>{
      check(field('terms')==='yes'&&field('termsVersion')===termsVersion(),'Review and accept the current Terms of Service.');
    };
    if(['sign-in','register','forgot-password','resend-verification'].includes(action)){
      const email=z.email().max(254).parse(field('email').toLowerCase());
      const login=action==='sign-in';
      check(await limit('auth:'+ip,60,600)&&await limit('auth:'+action+':'+email,login?12:4,600),'Please wait before trying again.');
      if(login){
        const {rows:[profile]}=await db.query<{id:string;password_hash:string|null;allowed:boolean}>(`SELECT id,password_hash,
          (NOT verification_required OR email_verified_at IS NOT NULL) AS allowed FROM profiles WHERE email=$1 AND disabled_at IS NULL`,[email]);
        check(await matchesPassword(z.string().min(1).max(128).parse(form.get('password')),profile?.password_hash),'Email or password did not match.');
        check(profile?.allowed,'Verify your email before signing in.');
        check(await startSession(profile.id,profile.password_hash),'Sign-in could not be completed. Try again.');
        return go(field('resume')||'/account');
      }
      check(mailConfigured(),'Account email is temporarily unavailable.');
      if(action==='register'){
        check(registrationOpen(),'Registration is currently closed.');
        acceptTerms();
        const username=usernameField.parse(field('username'));
        const password=await passwordHash(z.string().min(12).max(128).parse(form.get('password')));
        const profile=await transaction(async client=>{
          await client.query(`DELETE FROM profiles WHERE email=$1 AND verification_required AND email_verified_at IS NULL
            AND created_at<now()-interval '2 days'`,[email]);
          const {rows:[row]}=await client.query<{id:string}>(`INSERT INTO profiles(email,name,password_hash,username)
            VALUES($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id`,[email,text('name',70,2),password,username]);
          if(row)await client.query('INSERT INTO terms_acceptances(user_id,version) VALUES($1,$2)',[row.id,termsVersion()]);
          return row;
        });
        if(profile)after(()=>sendAccountLink(profile.id,email,'verify').catch(()=>console.error('Verification email delivery failed')));
        return go('/account/access?purpose=verify','notice','Check your email for the verification link. You can request another link here.');
      }
      const purpose=action==='resend-verification'?'verify':'reset';
      const {rows:[profile]}=await db.query<{id:string}>(`SELECT id FROM profiles WHERE email=$1 AND disabled_at IS NULL
        AND password_hash IS NOT NULL AND (${purpose==='verify'?'email_verified_at IS NULL':'(NOT verification_required OR email_verified_at IS NOT NULL)'})`,[email]);
      if(profile)after(()=>sendAccountLink(profile.id,email,purpose).catch(()=>console.error('Account link delivery failed')));
      return go('/account/access?purpose='+purpose,'notice','If an eligible account exists, we sent a link.');
    }
    if(action==='verify-email'||action==='reset-password'){
      check(await limit('account-link:'+ip,48,600),'Please wait before trying again.');
      const value=tokenField.parse(field('token'));
      const verify=action==='verify-email';
      const password=z.string().min(verify?1:12).max(128).parse(form.get('password'));
      const restore='/account/access?'+new URLSearchParams({purpose:verify?'verify':'reset',token:value});
      const account=await transaction(async client=>{
        const profile=await lockAccountToken(client,value,verify?'verify':'reset');
        if(!profile||!profile.password_hash)return null;
        if(verify){
          if(profile.email_verified_at||!await matchesPassword(password,profile.password_hash))return null;
          await client.query('UPDATE profiles SET email_verified_at=now() WHERE id=$1',[profile.id]);
        } else {
          await client.query('UPDATE profiles SET password_hash=$2,email_verified_at=coalesce(email_verified_at,now()) WHERE id=$1',[profile.id,await passwordHash(password)]);
          await client.query('DELETE FROM sessions WHERE user_id=$1',[profile.id]);
        }
        await client.query('DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2',[profile.id,verify?'verify':'reset']);
        if(!verify)await client.query("DELETE FROM account_tokens WHERE user_id=$1 AND purpose='verify'",[profile.id]);
        return {id:profile.id,passwordHash:profile.password_hash};
      });
      if(!account)return go(restore,'error','The link or password could not be verified. You can request a fresh link.');
      if(verify)await startSession(account.id,account.passwordHash);
      return go('/account','notice',verify?'Email verified.':'Password reset. Sign in with your new password.');
    }
    if(action==='google-onboard'){
      check(registrationOpen(),'Registration is currently closed.');
      acceptTerms();
      const jar=await cookies(), value=jar.get(onboardingCookie)?.value;
      check(value,'Google onboarding expired.');
      const username=usernameField.parse(field('username'));
      const profileId=await transaction(async client=>{
        const {rows:[entry]}=await client.query<{subject:string;email:string}>(`DELETE FROM oauth_onboarding
          WHERE token_hash=$1 AND expires_at>now() RETURNING subject,email`,[hashOpaque(value)]);
        check(entry,'Google onboarding expired.');
        const {rows:[profile]}=await client.query<{id:string}>(`INSERT INTO profiles(email,name,username,email_verified_at)
          VALUES($1,$2,$3,now()) RETURNING id`,[entry.email,text('name',70,2),username]);
        await client.query("INSERT INTO oauth_identities(provider,subject,user_id) VALUES('google',$1,$2)",[entry.subject,profile.id]);
        await client.query('INSERT INTO terms_acceptances(user_id,version) VALUES($1,$2)',[profile.id,termsVersion()]);
        return profile.id;
      });
      jar.delete(onboardingCookie);
      check(await startSession(profileId),'Your profile was created. Sign in again to continue.');
      return go('/account');
    }
    if(action==='brand-inquiry'||action==='feedback') {
      const isBrand=action==='brand-inquiry';
      const path=isBrand?'/founding-partners':'/feedback';
      const message=isBrand?'Application received.':'Feedback received.';
      if(field('contact_confirm'))return go(path,'notice',message);
      const email=(field('email')||isBrand)?z.email().max(254).parse(field('email').toLowerCase()):null;
      const ip=process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] : null;
      check(await limit('inquiry:'+action+':'+(ip??'local'),25,3600),'Please wait before submitting again.');
      if(email)check(await limit('inquiry:'+action+':'+email,5,3600),'Please wait before submitting again.');
      const website=isBrand?z.url({protocol:/^https?$/}).max(500).parse(field('website')):null;
      await db.query('INSERT INTO launch_inquiries(kind,email,company,website,body) VALUES($1,$2,$3,$4,$5)',
        [isBrand?'brand':'feedback',email,isBrand?text('company',120):null,website,text('body',2400,isBrand?15:10)]);
      const applicant=isBrand?await viewer():null;
      if(applicant&&applicant.email===email)notifyByEmail(applicant.id,'Your REISSUE brand application was received','An administrator will review your application.','/brands');
      return go(path,'notice',message);
    }
    if(action==='content-complaint'){
      if(field('contact_confirm'))return go('/report-content','notice','Report received.');
      check(await limit('content-complaint:'+ip,8,3600),'Please wait before trying again.');
      check(field('goodFaith')==='yes','Confirm the good-faith statement.');
      const user=await viewer();
      const email=z.email().max(254).parse(field('email').toLowerCase());
      const target=z.url({protocol:/^https?$/}).max(1200).parse(field('target'));
      await asActor(user?.id??null,client=>client.query(`INSERT INTO rights_cases(user_id,kind,contact,target,statement) VALUES($1,'ip',$2,$3,$4)`,
        [user?.id??null,email,target,text('body',3000,20)]));
      return go('/report-content','notice','Report received.');
    }
    const user=await viewer();
    if (!user) return go('/account?'+new URLSearchParams({resume:safe.slice(0,300)}),'notice','Sign in or create an account to continue.');
    check(await limit('write:'+user.id,50,60) && (action!=='comment'||await limit('comment:'+user.id,8,60)),'Please wait before trying again.');
    const isAdmin=user.role==='admin';
    if(action==='sign-out') {await endSession();return go('/');}
    if(action==='delete-account') {
      const {rows}=await db.query<{password_hash:string}>('SELECT password_hash FROM profiles WHERE id=$1',[user.id]);
      if(user.has_password)check(await matchesPassword(z.string().min(1).max(128).parse(form.get('password')),rows[0]?.password_hash),'Password did not match.');
      else {
        check(field('confirmation')==='DELETE','Confirm that you want to erase your account.');
        check(user.authenticated_at && Date.now()-user.authenticated_at.getTime()<10*60*1000,'Sign out, sign in with Google, then try again within ten minutes.');
      }
      await asActor(user.id,async client=>{
        await client.query("DELETE FROM rights_cases WHERE user_id=$1",[user.id]);
        await client.query('DELETE FROM launch_inquiries WHERE email=$1',[user.email]);
        await client.query('DELETE FROM profiles WHERE id=$1',[user.id]);
      });
      await endSession();
      return go('/','notice','Your account was deleted.');
    }
    if(action==='rights-file'){
      const kind=z.enum(['access','rectification','erasure','portability','restriction','objection','consent','appeal']).parse(field('kind'));
      await asActor(user.id,async client=>{
        await client.query('INSERT INTO rights_cases(user_id,kind,statement) VALUES($1,$2,$3)',[user.id,kind,text('body',3000,10)]);
        await client.query("INSERT INTO service_notices(user_id,body,path) VALUES($1,'Your request was received. Track it in Privacy requests.','/rights')",[user.id]);
      });
      notifyByEmail(user.id,'Your REISSUE request was received','Sign in to track your request.','/rights');
      return go('/rights','notice','Request received.');
    }
    if(action==='admin-rights-review'){
      check(isAdmin,'Administrator access required.');
      const target=z.uuid().parse(field('id'));
      const status=z.enum(['reviewing','closed']).parse(field('status'));
      const recipient=await asActor(user.id,async client=>{
        const {rows:[entry]}=await client.query<{user_id:string|null}>(`UPDATE rights_cases SET status=$2,response=$3,updated_at=now()
          WHERE id=$1 AND status<>'closed' RETURNING user_id`,[target,status,text('body',3000)]);
        check(entry,'Request unavailable.');
        if(entry.user_id)await client.query("INSERT INTO service_notices(user_id,body,path) VALUES($1,'A reviewer updated your request.','/rights')",[entry.user_id]);
        await audit(client,user.id,action,target,{status});
        return entry.user_id;
      });
      if(recipient)notifyByEmail(recipient,'Your REISSUE request was updated','Sign in to read the decision.','/rights');
      return go('/admin','notice','Request updated.');
    }
    if(action==='save-search'){
      const query=text('query',120);
      if(toggle)await db.query('INSERT INTO saved_searches(user_id,query) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,query]);
      else await db.query('DELETE FROM saved_searches WHERE user_id=$1 AND query=$2',[user.id,query]);
      return go(safe,'notice',toggle?'Search saved.':'Saved search removed.');
    }
    if(action==='register-catalogue-source'){
      check(isAdmin,'Administrator access required.');
      const source=z.url({protocol:/^https?$/}).max(1000).parse(field('source'));
      const parsed=new URL(source);
      check(!parsed.username&&!parsed.password,'Source URLs must not contain credentials.');
      await transaction(async client=>{
        const {rows:[entry]}=await client.query<{id:string}>(`INSERT INTO catalogue_sources(name,kind,source_url,permission,restrictions,retrieved_on,registered_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[text('name',140),
          z.enum(['brand','licensed_dataset','authorized_api','historical_catalogue','manual_research']).parse(field('kind')),
          source,text('permission',1800,8),text('restrictions',1800,0),z.iso.date().parse(field('retrieved')),user.id]);
        await audit(client,user.id,action,entry.id);
      });
      return go(safe,'notice','Catalogue source registered.');
    }
    if(action==='review-product-evidence'||action==='brand-confirm-product'){
      const product=id();
      const brandReview=action==='brand-confirm-product';
      check(brandReview||isAdmin,'Administrator access required.');
      const level=brandReview?'brand_confirmed':verificationLevel.exclude(['brand_confirmed']).parse(field('verification'));
      const status=brandReview?'unknown':lifecycleStatus.parse(field('lifecycle'));
      await transaction(async client=>{
        check(await saveEvidence(client,{id:product,actor:user.id,admin:!brandReview&&isAdmin,level,status,
          date:field('discontinued')?z.iso.date().parse(field('discontinued')):null,
          source:z.url({protocol:/^https?$/}).max(1000).parse(field('source')),rationale:text('body',1800,8)}),
          'Use a recorded source and a matching verification role for this visible non-demo product.');
        await audit(client,user.id,action,product,{level});
      });
      return go(safe,'notice','Evidence decision saved.');
    }
    if(action==='brand-pilot-save'){
      const brand=id('brand'),campaign=id();
      await transaction(async client=>{
        check((await client.query(`SELECT 1 FROM brand_members m JOIN products p ON p.brand_id=m.brand_id
          JOIN campaigns c ON c.product_id=p.id WHERE m.brand_id=$1 AND m.user_id=$2 AND c.id=$3
          AND NOT p.demo AND p.deleted_at IS NULL AND c.rejected_at IS NULL AND c.status<>'Under moderation' FOR SHARE OF m,p,c`,[brand,user.id,campaign])).rowCount,
          'This campaign is not available for a brand pilot.');
        await client.query(`INSERT INTO brand_pilots(brand_id,campaign_id,stage,contact_preference,notes) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(brand_id,campaign_id) DO UPDATE SET stage=excluded.stage,contact_preference=excluded.contact_preference,notes=excluded.notes,updated_at=now()`,
          [brand,campaign,z.enum(['exploring','feasibility','closed']).parse(field('stage')),
            z.enum(['portal','email','none']).parse(field('contactPreference')),text('body',2000,0)]);
        await audit(client,user.id,action,campaign,{brand});
      });
      return go(safe,'notice','Pilot details saved.');
    }
    if(action==='avatar-remove'){
      await db.query('UPDATE profiles SET avatar_bytes=NULL WHERE id=$1',[user.id]);
      return go('/account#profile','notice','Profile picture removed.');
    }
    if(action==='profile') {
      await transaction(async client=>{
        await client.query('UPDATE profiles SET name=$2,search_history=$3,username=coalesce($4,username) WHERE id=$1',[user.id,text('name',70,2),toggle,field('username')?usernameField.parse(field('username')):null]);
        if(!toggle) await client.query('DELETE FROM search_history WHERE user_id=$1',[user.id]);
      });
      return go(safe,'notice','Profile updated.');
    }
    if(action==='save' || action==='follow-brand') {
      const product=action==='save';
      const table=product?'saved_products':'brand_follows';
      const column=product?'product_id':'brand_id';
      const target=id();
      await db.query(toggle ? `INSERT INTO ${table}(user_id,${column}) SELECT $1,id FROM ${product?'products WHERE deleted_at IS NULL AND':'brands WHERE'} id=$2 ON CONFLICT DO NOTHING` : `DELETE FROM ${table} WHERE user_id=$1 AND ${column}=$2`,[user.id,target]);
    } else if(action==='mark-read') {
      await transaction(async client=>{
        await client.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[user.id]);
        await client.query('UPDATE service_notices SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[user.id]);
      });
    } else if(action==='collection') {
      const {rows}=await db.query<{id:string}>('INSERT INTO collections(user_id,title,description,published) VALUES($1,$2,$3,$4) RETURNING id',[user.id,text('title',100),text('description',2000,0),toggle]);
      return go('/collections/'+rows[0].id);
    } else if(action==='collection-item' || action==='collection-visibility') {
      const collection=id();
      await transaction(async client=>{
        check((await client.query('SELECT id FROM collections WHERE id=$1 AND user_id=$2 FOR UPDATE',[collection,user.id])).rowCount,'Collection access denied.');
        if(action==='collection-visibility') await client.query('UPDATE collections SET published=$2 WHERE id=$1',[collection,toggle]);
        else await client.query(toggle?'INSERT INTO collection_items(collection_id,product_id) SELECT $1,id FROM products WHERE id=$2 AND deleted_at IS NULL ON CONFLICT DO NOTHING':'DELETE FROM collection_items WHERE collection_id=$1 AND product_id=$2',[collection,id('product')]);
      });
    } else if(action==='save-campaign'){
      const campaign=id();
      await db.query(toggle?`INSERT INTO saved_campaigns(user_id,campaign_id) SELECT $1,c.id FROM campaigns c JOIN products p ON p.id=c.product_id
        WHERE c.id=$2 AND c.status NOT IN ('Under moderation','Archived') AND c.rejected_at IS NULL AND p.deleted_at IS NULL ON CONFLICT DO NOTHING`
        :'DELETE FROM saved_campaigns WHERE user_id=$1 AND campaign_id=$2',[user.id,campaign]);
      return go(safe,'notice',toggle?'Campaign saved.':'Saved campaign removed.');
    } else if(action==='submit-product') {
      const setting=await db.query<{value:boolean}>("SELECT value FROM platform_settings WHERE key='submissions_open'");
      check(setting.rows[0]?.value!==false,'Catalogue submissions are paused.');
      const data=record.parse(Object.fromEntries(form));
      check(field('rights')==='yes','Confirm that you have permission to share this content.');
      await db.query('INSERT INTO product_submissions(user_id,data,rights_attested_at) VALUES($1,$2,now())',[user.id,JSON.stringify(data)]);
      return go('/submit','notice','Product submitted for review.');
    } else if(action==='correction') {
      await db.query('INSERT INTO correction_requests(product_id,user_id,suggestion) SELECT id,$2,$3 FROM products WHERE id=$1 AND deleted_at IS NULL',[id(),user.id,text('body')]);
    } else if(action==='campaign-draft-start'){
      const product=id();
      const {rows:[record]}=await db.query<{name:string;campaign_id:string|null}>(`SELECT p.name,(SELECT id FROM campaigns WHERE product_id=p.id
        AND rejected_at IS NULL AND status NOT IN ('Archived','Completed','Brand declined','Under moderation') LIMIT 1) campaign_id
        FROM products p WHERE p.id=$1 AND p.deleted_at IS NULL`,[product]);
      check(record,'Archive product unavailable.');
      if(record.campaign_id)return go('/campaigns/'+record.campaign_id);
      const {rows:[draft]}=await asActor(user.id,client=>client.query<{id:string}>("INSERT INTO campaign_drafts(user_id,product_id,title) VALUES($1,$2,$3) RETURNING id",
        [user.id,product,'Bring back '+record.name.slice(0,129)]));
      return go('/campaigns/new/'+draft.id+'?step=product');
    } else if(action==='campaign-draft-save'||action==='campaign-draft-submit'){
      const draftId=z.uuid().parse(field('id'));
      if(action==='campaign-draft-save'){
        const changed=await asActor(user.id,client=>client.query(`UPDATE campaign_drafts SET title=$3,proposal=$4,variants=$5,context=$6,target_price=$7,updated_at=now()
          WHERE id=$1 AND user_id=$2 AND submitted_campaign_id IS NULL`,
          [draftId,user.id,text('title',140,0),text('body',5000,0),text('variants',500,0),text('context',1500,0),optionalNumber('price',1000000)]));
        check(changed.rowCount,'Draft unavailable.');
        return field('next')==='review'?go('/campaigns/new/'+draftId+'?step=review'):go('/campaigns/new/'+draftId,'notice','Draft saved.');
      }
      check(['accurate','rights','independent','nonbinding'].every(key=>field(key)==='yes'),'Confirm all four statements before submitting.');
      const submitted=await asActor(user.id,async client=>{
        const {rows:[draft]}=await client.query<{product_id:string;title:string;proposal:string;variants:string;context:string;target_price:string|null;submitted_campaign_id:string|null}>(`SELECT d.* FROM campaign_drafts d JOIN products p ON p.id=d.product_id
          WHERE d.id=$1 AND d.user_id=$2 AND p.deleted_at IS NULL FOR UPDATE OF d,p`,[draftId,user.id]);
        check(draft,'Draft unavailable.');
        if(draft.submitted_campaign_id)return {id:draft.submitted_campaign_id,created:false};
        check(draft.title.length>=4&&draft.proposal.length>=12,'Add a title and a proposal before submitting.');
        const matching=await client.query("SELECT 1 FROM campaigns WHERE product_id=$1 AND rejected_at IS NULL AND status NOT IN ('Archived','Completed','Brand declined')",[draft.product_id]);
        check(!matching.rowCount,'A campaign for this product is already active or pending review.');
        const {rows:[campaign]}=await client.query<{id:string}>(`INSERT INTO campaigns(product_id,author_id,title,description,details,attestations_at)
          VALUES($1,$2,$3,$4,$5,now()) RETURNING id`,[draft.product_id,user.id,draft.title,draft.proposal,
          JSON.stringify({variants:draft.variants,specifications:draft.context,suggestedPrice:draft.target_price===null?null:Number(draft.target_price)})]);
        await client.query('UPDATE campaign_drafts SET submitted_campaign_id=$2,updated_at=now() WHERE id=$1',[draftId,campaign.id]);
        await client.query("INSERT INTO service_notices(user_id,body,path) VALUES($1,'Your campaign is waiting for moderation.',$2)",[user.id,'/campaigns/'+campaign.id]);
        return {id:campaign.id,created:true};
      });
      if(submitted.created)notifyByEmail(user.id,'Your REISSUE campaign was submitted','Sign in to follow moderation.','/campaigns/'+submitted.id);
      return go('/campaigns/'+submitted.id);
    } else if(action==='claim-brand') {
      await db.query('INSERT INTO brand_ownership_requests(brand_id,user_id,evidence) VALUES($1,$2,$3)',[id(),user.id,text('body',4000,20)]);
    } else if(['import-preview','import-commit','import-rollback'].includes(action)){
      const brand=field('brand')?id('brand'):null;
      const result=await transaction(async client=>{
        const membership=brand?(await client.query<{slug:string}>('SELECT b.slug FROM brand_members m JOIN brands b ON b.id=m.brand_id WHERE m.brand_id=$1 AND m.user_id=$2 FOR SHARE OF m',[brand,user.id])).rows[0]:null;
        check(isAdmin||membership,'Catalogue access denied.');
        const options={user:user.id,brandId:brand,brandSlug:isAdmin?undefined:membership?.slug};
        if(action==='import-preview'){
          check(field('rights')==='yes','Confirm the catalogue reuse permission.');
          const sourceId=field('sourceId')?id('sourceId'):null;
          if(sourceId)check(isAdmin&&(await client.query('SELECT 1 FROM catalogue_sources WHERE id=$1',[sourceId])).rowCount,'Select a registered source.');
          await queueCatalogue(client,{...options,input:text('data',55000),format:z.enum(['csv','json']).parse(field('format')),
            mode:z.enum(['create','sources']).parse(field('mode')||'create'),sourceId});
          return null;
        }
        const job=id();
        const progress=await continueCatalogue(client,{...options,id:job,rollback:action==='import-rollback'});
        await audit(client,user.id,action,job,progress);
        return progress;
      });
      if(result?.status==='retry')return go(safe,'error','Import paused. Review the latest error in the job.');
      if(result?.status==='processing')return go(safe,'notice','Batch staged. Continue the import to publish all records.');
      return go(safe,'notice','Changes saved.');
    } else if(['interest','follow-campaign','comment','report','publish-update','campaign-status'].includes(action)) {
      const campaign=id();
      let publishedAuthor:string|null=null;
      const flow=action==='interest'&&toggle&&await consent().then(c=>c.analytics)?validFlow(field('flow')):undefined;
      await transaction(async client=>{
        const {rows}=await client.query<{brand_id:string;status:string;author_id:string|null;colours:string[];demo:boolean}>(`SELECT p.brand_id,c.status,c.author_id,p.colours,p.demo FROM campaigns c JOIN products p ON p.id=c.product_id WHERE c.id=$1 AND p.deleted_at IS NULL AND c.rejected_at IS NULL FOR UPDATE OF c`,[campaign]);
        const entry=rows[0];
        check(entry,'Campaign unavailable.');
        if(action==='publish-update' || action==='campaign-status') {
          const member=!!(await client.query('SELECT 1 FROM brand_members WHERE brand_id=$1 AND user_id=$2 FOR SHARE',[entry.brand_id,user.id])).rowCount;
          check(isAdmin || member,'Campaign management access denied.');
          const body=text('body');
          if(action==='campaign-status') {
            const status=z.enum(statuses).parse(field('status'));
            check(isAdmin || (['Brand approved','Brand declined','Under brand review'].includes(status) && !['Under moderation','Archived','Completed'].includes(entry.status)),'This status requires a moderator.');
            if(entry.status==='Under moderation' && status!=='Under moderation') {
              check(status==='Gathering interest'||status==='Archived','Pending campaigns must be published or archived first.');
            }
            await client.query('UPDATE campaigns SET status=$2 WHERE id=$1',[campaign,status]);
            if(entry.status==='Under moderation'&&status==='Gathering interest'&&entry.author_id){
              publishedAuthor=entry.author_id;
              await client.query("INSERT INTO service_notices(user_id,body,path) VALUES($1,'Your campaign was published.',$2)",[entry.author_id,'/campaigns/'+campaign]);
            }
            await updateCampaign(client,campaign,user.id,status+' — '+body,member);
          } else {
            check(entry.status!=='Under moderation' || isAdmin,'Campaign is pending moderation.');
            await updateCampaign(client,campaign,user.id,body,member);
          }
          await audit(client,user.id,action,campaign,{status:field('status')||entry.status});
          return;
        }
        check(entry.status!=='Under moderation','Campaign is pending moderation.');
        if(action==='interest') {
          if(!toggle) {await client.query('DELETE FROM campaign_supporters WHERE campaign_id=$1 AND user_id=$2',[campaign,user.id]);return;}
          check(allowedInterest.includes(entry.status),'This campaign is closed for new interest.');
          const country=field('country');
          check(!country || /^[a-z]{2}$/i.test(country),'Use a two-letter country code.');
          const price=optionalNumber('price',1000000), maximum=optionalNumber('priceMax',1000000);
          check(maximum===null||(price!==null&&price<=maximum),'Enter a maximum at least as high as the minimum.');
          const colour=field('colour');
          check(!colour||entry.colours.includes(colour),'Choose a colour from the product record.');
          const returning=flow&&!entry.demo?(await client.query('SELECT 1 FROM campaign_supporters WHERE campaign_id=$1 AND user_id=$2',[campaign,user.id])).rowCount:null;
          await client.query(`INSERT INTO campaign_supporters(campaign_id,user_id,price,quantity,variant,country,likelihood,price_max,preferred_colour) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT(campaign_id,user_id) DO UPDATE SET price=excluded.price,quantity=excluded.quantity,variant=excluded.variant,country=excluded.country,likelihood=excluded.likelihood,price_max=excluded.price_max,preferred_colour=excluded.preferred_colour`,
          [campaign,user.id,price,optionalNumber('quantity',100,true,1),text('variant',100,0)||null,country.toUpperCase()||null,optionalNumber('likelihood',5,true,1),maximum,colour||null]);
          if(flow&&!entry.demo&&!returning)await client.query(`UPDATE search_events SET journey_supported_at=now()
            WHERE journey_id=$1 AND journey_campaign_id=$2 AND journey_viewed_at IS NOT NULL
              AND journey_supported_at IS NULL AND created_at>now()-interval '1 hour'`,[flow,campaign]);
        } else if(action==='follow-campaign') {
          await client.query(toggle?'INSERT INTO campaign_follows(campaign_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING':'DELETE FROM campaign_follows WHERE campaign_id=$1 AND user_id=$2',[campaign,user.id]);
        } else if(action==='comment') {
          check(!['Archived','Completed'].includes(entry.status),'Discussion is closed.');
          await client.query('INSERT INTO campaign_comments(campaign_id,user_id,body) VALUES($1,$2,$3)',[campaign,user.id,text('body',2000)]);
        } else if(field('comment')) {
          await client.query('INSERT INTO moderation_reports(comment_id,user_id,reason) SELECT id,$2,$3 FROM campaign_comments WHERE id=$1 AND campaign_id=$4 AND deleted_at IS NULL',[id('comment'),user.id,text('body',1000),campaign]);
        } else await client.query('INSERT INTO moderation_reports(campaign_id,user_id,reason) VALUES($1,$2,$3)',[campaign,user.id,text('body',1000)]);
      });
      if(publishedAuthor)notifyByEmail(publishedAuthor,'Your REISSUE campaign was published','Your campaign is now open for non-binding interest.','/campaigns/'+campaign);
    } else if(action.startsWith('admin-')) {
      check(isAdmin,'Administrator access required.');
      let rejected:{author:string;id:string}|undefined;
      await transaction(async client=>{
        if(action==='admin-brand' || action==='admin-category' || action==='admin-synonym') {
          if(action==='admin-synonym') {
            const term=z.string().regex(/^[a-z0-9]+$/).max(40).parse(field('term').toLowerCase());
            if(toggle) await client.query('INSERT INTO search_synonyms(term,replacement) VALUES($1,$2) ON CONFLICT(term) DO UPDATE SET replacement=excluded.replacement',[term,text('body',100)]);
            else await client.query('DELETE FROM search_synonyms WHERE term=$1',[term]);
            await audit(client,user.id,action,term);
          } else {
            const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).parse(field('slug'));
            const table=action==='admin-brand'?'brands':'categories';
            await client.query(`INSERT INTO ${table}(slug,name) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=excluded.name`,[slug,text('title',100)]);
            await audit(client,user.id,action,slug);
          }
          return;
        }
        if(action==='admin-entry') {
          const target=await insertProduct(client,record.parse(Object.fromEntries(form)));
          await audit(client,user.id,action,target);
          return;
        }
        if(action==='admin-submissions-setting') {
          await client.query("UPDATE platform_settings SET value=to_jsonb($1::boolean) WHERE key='submissions_open'",[toggle]);
          await audit(client,user.id,action,'submissions_open',{enabled:toggle});
          return;
        }
        if(action==='admin-suspend') {
          const target=z.uuid().parse(field('id'));
          check(target!==user.id,'You cannot suspend your own account.');
          check((await client.query("UPDATE profiles SET disabled_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1 AND role='member'",[target,toggle])).rowCount,'Member account unavailable.');
          if(toggle)await client.query('DELETE FROM sessions WHERE user_id=$1',[target]);
          await audit(client,user.id,action,target,{suspended:toggle});
          return;
        }
        const target=id();
        if(action==='admin-edit-product') {
          check(!(await client.query(`SELECT 1 FROM import_created_products i JOIN import_jobs j ON j.id=i.import_id
            WHERE i.product_id=$1 AND j.status='processing'`,[target])).rowCount,'Finish or roll back the import before editing this record.');
          await editProduct(client,target,record.parse(Object.fromEntries(form)));
          await audit(client,user.id,action,target);
          return;
        }
        if(action==='admin-merge-product') {
          const canonical=id('product');
          check(await mergeProduct(client,target,canonical),'Merge requires two visible records from the same brand and data type and at most one active campaign.');
          await audit(client,user.id,action,target,{canonical});
          return;
        }
        if(action==='admin-campaign-reject'){
          const reason=text('body',1200,8);
          const {rows:[campaign]}=await client.query<{author_id:string|null}>(`UPDATE campaigns SET status='Archived',rejected_at=now(),rejection_reason=$2
            WHERE id=$1 AND status='Under moderation' AND rejected_at IS NULL RETURNING author_id`,[target,reason]);
          check(campaign,'Only a pending campaign can be rejected.');
          if(campaign.author_id){
            rejected={author:campaign.author_id,id:target};
            await client.query("INSERT INTO service_notices(user_id,body,path) VALUES($1,'Your campaign was rejected. Review the decision on the campaign page.',$2)",[campaign.author_id,'/campaigns/'+target]);
          }
        } else if(action==='admin-inquiry-reviewed') {
          check((await client.query('UPDATE launch_inquiries SET reviewed_at=now() WHERE id=$1 AND reviewed_at IS NULL',[target])).rowCount,'Inquiry already reviewed.');
        } else if(action==='admin-claim') {
          const {rows}=await client.query<{brand_id:string;user_id:string}>(`UPDATE brand_ownership_requests SET status=$2 WHERE id=$1 AND status='pending' RETURNING brand_id,user_id`,[target,toggle?'approved':'declined']);
          check(rows[0],'Claim already resolved.');
          if(toggle) await client.query('INSERT INTO brand_members(brand_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[rows[0].brand_id,rows[0].user_id]);
        } else if(action==='admin-submission') {
          const {rows}=await client.query<{data:unknown}>('UPDATE product_submissions SET status=$2 WHERE id=$1 AND status=\'pending\' RETURNING data',[target,toggle?'approved':'declined']);
          check(rows[0],'Submission already resolved.');
          if(toggle) await insertProduct(client,record.parse(rows[0].data));
        } else if(action==='admin-correction') {
          await client.query("UPDATE correction_requests SET status='resolved' WHERE id=$1",[target]);
        } else if(action==='admin-report') {
          const {rows}=await client.query<{comment_id:string|null}>("UPDATE moderation_reports SET status='resolved' WHERE id=$1 AND status='pending' RETURNING comment_id",[target]);
          if(toggle && rows[0]?.comment_id) await client.query('UPDATE campaign_comments SET deleted_at=now() WHERE id=$1',[rows[0].comment_id]);
        } else if(action==='admin-product-visibility') {
          check((await client.query(`UPDATE products p SET deleted_at=CASE WHEN $2 THEN NULL ELSE now() END
            WHERE id=$1 AND merged_into_id IS NULL AND NOT EXISTS(SELECT 1 FROM import_created_products i JOIN import_jobs j ON j.id=i.import_id
              WHERE i.product_id=p.id AND j.status IN ('preview','processing'))`,[target,toggle])).rowCount,'This staged or merged record cannot be restored here.');
        } else throw new ActionError('Unknown action.');
        await audit(client,user.id,action,target,{approved:toggle});
      });
      if(rejected)notifyByEmail(rejected.author,'Your REISSUE campaign was reviewed','Sign in to see the moderation decision.','/campaigns/'+rejected.id);
    } else throw new ActionError('Unknown action.');
    return go(safe,'notice','Changes saved.');
  } catch(error) {
    if(error instanceof ActionError||error instanceof CatalogueError) return go(safe,'error',error.message);
    if(error instanceof z.ZodError) return go(safe,'error','Check the submitted fields and try again.');
    if((error as {code?:string}).code==='23505') return go(safe,'error','A matching record already exists.');
    console.error('Mutation failed',action,(error as {code?:string}).code ?? 'unexpected');
    return go(safe,'error','The change could not be saved.');
  }
}
