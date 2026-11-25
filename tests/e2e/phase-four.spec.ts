import { expect,test } from '@playwright/test';
import { Pool } from 'pg';
import { action,register } from './helpers';

test('catalogue jobs resume, roll back staged records, and publish only when complete',async({page,request})=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  try{
    await action(page.request,{action:'sign-in',email:process.env.TEST_ADMIN_EMAIL??'',password:process.env.TEST_ADMIN_PASSWORD??''});
    const prefix='batch-'+Date.now().toString(36);
    const source='https://example.test/'+prefix;
    expect(await action(page.request,{action:'register-catalogue-source',returnTo:'/admin/sources',name:'Disposable licence fixture',kind:'licensed_dataset',
      source,permission:'Synthetic test fixture for the isolated database.',restrictions:'Never use as catalogue evidence.',retrieved:'2026-01-01'})).toContain('Catalogue source registered.');
    const sourceId=(await pool.query('SELECT id FROM catalogue_sources WHERE source_url=$1',[source])).rows[0].id;
    const rows=Array.from({length:21},(_,index)=>({Slug:prefix+'-'+index,Name:'Disposable import '+prefix+' '+index,Brand:'Sony',Category:'Audio',
      Description:'Synthetic catalogue test record for the isolated database.',Source:source,variants:['Black'],release_year:1989,availability:'discontinued'}));
    const preview=async()=>{
      const location=await action(page.request,{action:'import-preview',returnTo:'/admin',format:'json',rights:'yes',sourceId,data:JSON.stringify(rows)});
      expect(location).toContain('Changes saved.');
      return (await pool.query("SELECT id,errors FROM import_jobs WHERE source_id=$1 ORDER BY id DESC LIMIT 1",[sourceId])).rows[0];
    };
    const first=await preview();
    expect(first.errors).toEqual([]);
    expect(await action(page.request,{action:'import-commit',returnTo:'/admin',id:first.id})).toContain('Batch staged.');
    expect((await request.get('/products/'+prefix+'-0')).status()).toBe(404);
    expect(await action(page.request,{action:'import-rollback',returnTo:'/admin',id:first.id})).toContain('Changes saved.');
    expect(Number((await pool.query('SELECT count(*) FROM products WHERE slug LIKE $1',[prefix+'-%'])).rows[0].count)).toBe(0);
    const second=await preview();
    expect(second.errors).toEqual([]);
    await action(page.request,{action:'import-commit',returnTo:'/admin',id:second.id});
    expect(await action(page.request,{action:'import-commit',returnTo:'/admin',id:second.id})).toContain('Changes saved.');
    await page.goto('/products/'+prefix+'-0');
    await expect(page.getByText(/Lifecycle unconfirmed/)).toBeVisible();
    const product=(await pool.query('SELECT id FROM products WHERE slug=$1',[prefix+'-0'])).rows[0].id;
    expect(await action(page.request,{action:'review-product-evidence',returnTo:'/admin',id:product,verification:'historical',
      lifecycle:'discontinued',source,discontinued:'1990-01-01',body:'Recorded test-only evidence in the disposable catalogue.'})).toContain('Evidence decision saved.');
    await page.reload();
    await expect(page.getByText(/Confirmed discontinued/)).toBeVisible();
    const response=await request.get('/api/suggest',{params:{q:'discontinued '+prefix+' from 1989'}});
    expect((await response.json()).items.some((item:{href:string})=>item.href==='/products/'+prefix+'-0')).toBeTruthy();
    const updatedSource=source+'/supplement';
    expect(await action(page.request,{action:'import-preview',returnTo:'/admin',format:'json',rights:'yes',sourceId,mode:'sources',
      data:JSON.stringify([{...rows[0],Source:updatedSource}])})).toContain('Changes saved.');
    const evidenceJob=(await pool.query("SELECT id FROM import_jobs WHERE source_id=$1 AND mode='sources' ORDER BY id DESC LIMIT 1",[sourceId])).rows[0].id;
    expect(await action(page.request,{action:'import-commit',returnTo:'/admin',id:evidenceJob})).toContain('Changes saved.');
    expect((await pool.query('SELECT 1 FROM product_sources WHERE product_id=$1 AND url=$2',[product,updatedSource])).rowCount).toBe(1);
    const brand=await request.get('/archive/brands/sony');
    expect(await brand.text()).toContain('http://localhost:3210/archive/brands/sony');
    expect((await request.get('/admin/sources')).status()).toBe(404);
    expect((await request.get('/admin/intelligence')).status()).toBe(404);
  }finally{await pool.end();}
});

test('brand intelligence uses eligible unique supporters, suppresses low samples, and protects reports',async({page,browser,request})=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const key=Date.now().toString(36);
  const brand=await browser.newContext();
  const participant=await browser.newContext();
  try{
    const email='metrics-'+key+'@example.test';
    await register(brand.request,email,'Metrics test representative');
    const {rows:[metadata]}=await pool.query<{brand:string;member:string}>(`SELECT b.id brand,p.id member FROM brands b CROSS JOIN profiles p WHERE b.slug='olympus' AND p.email=$1`,[email]);
    await pool.query('INSERT INTO brand_members(brand_id,user_id) VALUES($1,$2)',[metadata.brand,metadata.member]);
    const {rows:[product]}=await pool.query<{id:string}>(`INSERT INTO products(slug,name,brand_id,category_id,description,verification,verification_level,colours)
      SELECT $1,$2,$3,id,'Synthetic test record confined to the test database.','verified','historical',ARRAY['Black'] FROM categories WHERE slug='photography' RETURNING id`,
    ['opportunity-'+key,'Disposable opportunity '+key,metadata.brand]);
    const {rows:[campaign]}=await pool.query<{id:string}>(`INSERT INTO campaigns(product_id,title,description,status,target)
      VALUES($1,$2,'A disposable analytics fixture.','Gathering interest',50) RETURNING id`,[product.id,'Opportunity '+key]);
    const {rows:[small]}=await pool.query<{id:string}>(`INSERT INTO campaigns(product_id,title,description,status)
      VALUES($1,$2,'A historical test fixture.','Completed') RETURNING id`,[product.id,'Small cohort '+key]);
    await pool.query(`WITH fixtures AS (
      INSERT INTO profiles(email,name) SELECT 'support-'||i||'-'||$1||'@example.test','Disposable supporter' FROM generate_series(1,5) i RETURNING id
    ) INSERT INTO campaign_supporters(campaign_id,user_id,price,price_max,likelihood,country,preferred_colour)
      SELECT $2,id,100,125,5,'FR','Black' FROM fixtures`,[key,campaign.id]);
    await pool.query('INSERT INTO campaign_supporters(campaign_id,user_id,likelihood) SELECT $1,user_id,4 FROM campaign_supporters WHERE campaign_id=$2 LIMIT 2',[small.id,campaign.id]);
    const dashboard=await brand.newPage();
    await dashboard.goto('/brands/'+metadata.brand);
    await expect(dashboard.getByText(/7 registered interests from 5 unique supporters/)).toBeVisible();
    const opportunity=dashboard.getByRole('row').filter({hasText:'Disposable opportunity '+key});
    await expect(opportunity).toContainText('50 / 100');
    await expect(dashboard.getByRole('row').filter({hasText:'Small cohort'})).toHaveCount(0);
    expect((await request.get('/brands/'+metadata.brand+'/export')).status()).toBe(404);
    const report=await brand.request.get('/brands/'+metadata.brand+'/export');
    expect(await report.text()).toMatch(/"Opportunity score"/);
    const location=await action(brand.request,{action:'brand-pilot-save',returnTo:'/brands/'+metadata.brand,brand:metadata.brand,id:campaign.id,
      stage:'feasibility',contactPreference:'portal',body:'Private notes for the feasibility pilot'});
    expect(location).toContain('Pilot details saved.');
    await action(page.request,{action:'sign-in',email:process.env.TEST_ADMIN_EMAIL??'',password:process.env.TEST_ADMIN_PASSWORD??''});
    await page.goto('/admin/intelligence');
    await expect(page.getByText('Private notes for the feasibility pilot')).toBeVisible();
    const png=await request.get('/campaigns/'+campaign.id+'/card');
    expect(png.headers()['content-type']).toContain('image/png');
    expect((await png.body()).length).toBeGreaterThan(1000);
    await register(participant.request,'journey-'+key+'@example.test','Observed campaign supporter');
    const memberPage=await participant.newPage();
    await action(participant.request,{action:'cookie-consent',returnTo:'/cookies',enabled:'true'});
    await memberPage.goto('/explore?q='+encodeURIComponent('Disposable opportunity '+key));
    await memberPage.getByRole('link',{name:new RegExp('Disposable opportunity '+key)}).click();
    await memberPage.getByRole('link',{name:'Bring it back'}).click();
    await expect(memberPage).toHaveURL(/flow=/);
    const flow=new URL(memberPage.url()).searchParams.get('flow');
    await memberPage.getByRole('button',{name:'Register interest'}).click();
    await expect(memberPage.getByRole('button',{name:'Withdraw interest'})).toBeVisible();
    const {rows:[observation]}=await pool.query('SELECT journey_campaign_id,journey_viewed_at,journey_supported_at FROM search_events WHERE journey_id=$1',[flow]);
    expect(observation.journey_campaign_id).toBe(campaign.id);
    expect(observation.journey_viewed_at).toBeTruthy();
    expect(observation.journey_supported_at).toBeTruthy();
  }finally{await participant.close();await brand.close();await pool.end();}
});
