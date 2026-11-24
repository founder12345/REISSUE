import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, transaction } from '@/lib/db';
import { endSession, limit, matchesPassword, passwordHash, startSession, viewer } from '@/lib/auth';
import { editProduct, insertProduct, mergeProduct, previewImport, record } from '@/lib/ingestion';
import type { PoolClient } from 'pg';

const statuses=['Gathering interest','Under moderation','Ready for brand outreach','Brand contacted','Under brand review','Brand approved','Brand declined','Completed','Archived'] as const;
const allowedInterest = ['Gathering interest','Ready for brand outreach','Brand contacted','Under brand review','Brand approved'];
class ActionError extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ActionError(message);
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
  const origin=process.env.APP_ORIGIN ?? request.nextUrl.origin;
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
    if(action==='sign-in' || action==='register') {
      const email=z.email().max(254).parse(field('email').toLowerCase());
      const password=z.string().min(action==='register'?12:1).max(128).parse(form.get('password'));
      const ip=(process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] : null) ?? 'local';
      check(await limit('auth:'+ip,60,600) && await limit('auth:'+email,12,600),'Please wait before trying again.');
      if(action==='sign-in') {
        const {rows}=await db.query<{id:string;password_hash:string}>('SELECT id,password_hash FROM profiles WHERE email=$1 AND disabled_at IS NULL',[email]);
        check(await matchesPassword(password,rows[0]?.password_hash),'Email or password did not match.');
        await startSession(rows[0].id);
      } else {
        const {rows}=await db.query<{id:string}>('INSERT INTO profiles(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,text('name',70,2),await passwordHash(password)]);
        await startSession(rows[0].id);
      }
      return go(field('resume')||'/account');
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
      return go(path,'notice',message);
    }
    const user=await viewer();
    if (!user) return go('/account?'+new URLSearchParams({resume:safe.slice(0,300)}),'notice','Sign in or create an account to continue.');
    check(await limit('write:'+user.id,50,60) && (action!=='comment'||await limit('comment:'+user.id,8,60)),'Please wait before trying again.');
    const isAdmin=user.role==='admin';
    if(action==='sign-out') {await endSession();return go('/');}
    if(action==='delete-account') {
      const {rows}=await db.query<{password_hash:string}>('SELECT password_hash FROM profiles WHERE id=$1',[user.id]);
      check(await matchesPassword(z.string().min(1).max(128).parse(form.get('password')),rows[0]?.password_hash),'Password did not match.');
      await transaction(async client=>{
        await client.query('DELETE FROM launch_inquiries WHERE email=$1',[user.email]);
        await client.query('DELETE FROM profiles WHERE id=$1',[user.id]);
      });
      await endSession();
      return go('/','notice','Your account was deleted.');
    }
    if(action==='profile') {
      await transaction(async client=>{
        await client.query('UPDATE profiles SET name=$2,search_history=$3 WHERE id=$1',[user.id,text('name',70,2),toggle]);
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
      await db.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[user.id]);
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
    } else if(action==='submit-product') {
      const setting=await db.query<{value:boolean}>("SELECT value FROM platform_settings WHERE key='submissions_open'");
      check(setting.rows[0]?.value!==false,'Catalogue submissions are paused.');
      const data=record.parse(Object.fromEntries(form));
      await db.query('INSERT INTO product_submissions(user_id,data) VALUES($1,$2)',[user.id,JSON.stringify(data)]);
      return go('/submit','notice','Product submitted for review.');
    } else if(action==='correction') {
      await db.query('INSERT INTO correction_requests(product_id,user_id,suggestion) SELECT id,$2,$3 FROM products WHERE id=$1 AND deleted_at IS NULL',[id(),user.id,text('body')]);
    } else if(action==='campaign-create') {
      const {rows}=await db.query<{id:string}>(`INSERT INTO campaigns(product_id,author_id,title,description,details,target)
       SELECT id,$2,$3,$4,$5,$6 FROM products WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
      [id(),user.id,text('title',140),text('body',5000,12),JSON.stringify({specifications:text('specs',1500,0),variants:text('variants',500,0),suggestedPrice:optionalNumber('price',1000000)}),optionalNumber('target',100000,true,1)??100]);
      check(rows[0],'Archive product unavailable.');
      return go('/campaigns/'+rows[0].id);
    } else if(action==='claim-brand') {
      await db.query('INSERT INTO brand_ownership_requests(brand_id,user_id,evidence) VALUES($1,$2,$3)',[id(),user.id,text('body',4000,20)]);
    } else if(action==='import-preview' || action==='import-commit') {
      const brand=field('brand') ? id('brand') : null;
      await transaction(async client=>{
        const membership=brand ? (await client.query<{slug:string}>('SELECT b.slug FROM brand_members m JOIN brands b ON b.id=m.brand_id WHERE m.brand_id=$1 AND m.user_id=$2 FOR SHARE OF m',[brand,user.id])).rows[0] : null;
        check(isAdmin || membership,'Catalogue access denied.');
        if(action==='import-preview') {
          let preview;
          try {preview=previewImport(text('data',55000),field('format'));} catch {throw new ActionError('Provide valid CSV or a JSON array of 1 to 100 catalogue records.');}
          const {rows}=await client.query<{slug:string;valid:boolean;duplicate:boolean}>(`
            SELECT r.slug,b.id IS NOT NULL AND c.id IS NOT NULL AS valid,
              EXISTS(SELECT 1 FROM products p WHERE p.slug=r.slug OR (p.brand_id=b.id
                AND archive_fold(p.name)=archive_fold(r.name)
                AND archive_fold(coalesce(p.model,''))=archive_fold(coalesce(r.model,'')))) AS duplicate
            FROM jsonb_to_recordset($1::jsonb) r(slug text,brand text,category text,name text,model text)
            LEFT JOIN brands b ON b.slug=r.brand LEFT JOIN categories c ON c.slug=r.category`,[JSON.stringify(preview.data)]);
          for(const r of preview.data){
            if(membership && !isAdmin && r.brand!==membership.slug)preview.errors.push('Brand mismatch: '+r.slug);
          }
          for(const row of rows){
            if(!row.valid)preview.errors.push('Unknown category or brand: '+row.slug);
            if(row.duplicate)preview.errors.push('Already in archive: '+row.slug);
          }
          await client.query('INSERT INTO import_jobs(user_id,brand_id,data,errors) VALUES($1,$2,$3,$4)',[user.id,brand,JSON.stringify(preview.data),JSON.stringify(preview.errors)]);
        } else {
          const job=id();
          const {rows}=await client.query<{data:unknown[];errors:string[];status:string}>('SELECT data,errors,status FROM import_jobs WHERE id=$1 AND user_id=$2 AND brand_id IS NOT DISTINCT FROM $3::bigint FOR UPDATE',[job,user.id,brand]);
          const item=rows[0];
          check(item?.status==='preview' && item.errors.length===0 && item.data.length,'Import is unavailable or contains errors.');
          for(const row of item.data) {
            const data=record.parse(row);
            check(isAdmin || data.brand===membership?.slug,'Brand mismatch.');
            await insertProduct(client,data);
          }
          await client.query("UPDATE import_jobs SET status='committed' WHERE id=$1",[job]);
          await audit(client,user.id,action,job,{records:item.data.length});
        }
      });
    } else if(['interest','follow-campaign','comment','report','publish-update','campaign-status'].includes(action)) {
      const campaign=id();
      await transaction(async client=>{
        const {rows}=await client.query<{brand_id:string;status:string}>(`SELECT p.brand_id,c.status FROM campaigns c JOIN products p ON p.id=c.product_id WHERE c.id=$1 AND p.deleted_at IS NULL FOR UPDATE OF c`,[campaign]);
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
          await client.query(`INSERT INTO campaign_supporters(campaign_id,user_id,price,quantity,variant,country,likelihood) VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(campaign_id,user_id) DO UPDATE SET price=excluded.price,quantity=excluded.quantity,variant=excluded.variant,country=excluded.country,likelihood=excluded.likelihood`,
          [campaign,user.id,optionalNumber('price',1000000),optionalNumber('quantity',100,true,1),text('variant',100,0)||null,country.toUpperCase()||null,optionalNumber('likelihood',5,true,1)]);
        } else if(action==='follow-campaign') {
          await client.query(toggle?'INSERT INTO campaign_follows(campaign_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING':'DELETE FROM campaign_follows WHERE campaign_id=$1 AND user_id=$2',[campaign,user.id]);
        } else if(action==='comment') {
          check(!['Archived','Completed'].includes(entry.status),'Discussion is closed.');
          await client.query('INSERT INTO campaign_comments(campaign_id,user_id,body) VALUES($1,$2,$3)',[campaign,user.id,text('body',2000)]);
        } else if(field('comment')) {
          await client.query('INSERT INTO moderation_reports(comment_id,user_id,reason) SELECT id,$2,$3 FROM campaign_comments WHERE id=$1 AND campaign_id=$4 AND deleted_at IS NULL',[id('comment'),user.id,text('body',1000),campaign]);
        } else await client.query('INSERT INTO moderation_reports(campaign_id,user_id,reason) VALUES($1,$2,$3)',[campaign,user.id,text('body',1000)]);
      });
    } else if(action.startsWith('admin-')) {
      check(isAdmin,'Administrator access required.');
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
        if(action==='admin-inquiry-reviewed') {
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
          await client.query('UPDATE products SET deleted_at=CASE WHEN $2 THEN NULL ELSE now() END WHERE id=$1',[target,toggle]);
        } else if(action==='admin-verify-product') {
          const evidence=text('body',1000,8);
          check((await client.query(`UPDATE products SET verification=$2 WHERE id=$1 AND NOT demo AND EXISTS(SELECT 1 FROM product_sources WHERE product_id=$1)`,[target,toggle?'verified':'unverified'])).rowCount,'A non-demo catalogue entry with a source is required.');
          await audit(client,user.id,action,target,{evidence,verified:toggle});
          return;
        } else throw new ActionError('Unknown action.');
        await audit(client,user.id,action,target,{approved:toggle});
      });
    } else throw new ActionError('Unknown action.');
    return go(safe,'notice','Changes saved.');
  } catch(error) {
    if(error instanceof ActionError) return go(safe,'error',error.message);
    if(error instanceof z.ZodError) return go(safe,'error','Check the submitted fields and try again.');
    if((error as {code?:string}).code==='23505') return go(safe,'error','A matching record already exists.');
    console.error('Mutation failed',action,(error as {code?:string}).code ?? 'unexpected');
    return go(safe,'error','The change could not be saved.');
  }
}
