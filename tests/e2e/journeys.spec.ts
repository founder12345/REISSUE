import { expect,test,type APIRequestContext,type Browser } from '@playwright/test';
import { Pool } from 'pg';

const origin='http://localhost:3210';
const nonce=Date.now().toString(36);
const password='Comeback-archive-2026!';
const member='member-'+nonce+'@example.test';
const brandEmail='brand-'+nonce+'@example.test';
const admin=process.env.TEST_ADMIN_EMAIL;
const adminPassword=process.env.TEST_ADMIN_PASSWORD;

async function action(request:APIRequestContext,form:Record<string,string>) {
  const response=await request.post('/api/action',{form:{returnTo:'/account',...form},headers:{origin},maxRedirects:0});
  expect(response.status()).toBe(303);
  return decodeURIComponent(response.headers().location.replaceAll('+',' '));
}
async function register(request:APIRequestContext,email:string,name:string){
  const location=await action(request,{action:'register',email,name,password});
  expect(location).toBe(origin+'/account');
}
async function moderator(browser:Browser){
  if(!admin||!adminPassword)throw Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to an administrator on the disposable test database.');
  const context=await browser.newContext();
  const location=await action(context.request,{action:'sign-in',email:admin,password:adminPassword});
  expect(location).toBe(origin+'/account');
  return context;
}

test('search handles exact references, accents, typos, phrases, aliases and combined facets',async({page,request})=>{
  const searches=[
    ['A1238','iPod Classic'],['OlymPÜS','Olympus XA'],['walman','Walkman TPS-L2'],
    ['"iPod Classic"','iPod Classic'],['old navy arcteryx jacket','Alpha SV archive sample'],['camera','Olympus XA'],
  ];
  for(const [query,name] of searches){
    const res=await request.get('/api/suggest',{params:{q:query}});
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).items[0]?.label,query).toBe(name);
  }
  await page.goto('/explore?q=ipod&category=technology&brand=apple&decade=2000&colour=Silver');
  await expect(page.getByText('1 product for')).toBeVisible();
  await page.goto('/explore?q=ipod&category=photography');
  await expect(page.getByText('0 products for')).toBeVisible();
});
test('cursor pagination returns stable distinct records for an unchanged catalogue',async({page})=>{
  if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL to the disposable test database.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const prefix='pagination-'+nonce;
  try{
    await pool.query(`INSERT INTO products(slug,name,brand_id,category_id,description,demo)
      SELECT $1||'-'||n,$1||' Record '||n,b.id,c.id,'Pagination fixture',true
      FROM generate_series(1,20) n CROSS JOIN brands b CROSS JOIN categories c WHERE b.slug='sony' AND c.slug='audio'`,[prefix]);
    await page.goto('/explore?q='+prefix);
    const first=await page.locator('.product-card').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
    expect(first.length).toBe(18);
    await page.getByRole('link',{name:'Next page'}).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(page.locator('.product-card')).toHaveCount(2);
    const second=await page.locator('.product-card').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
    expect(second).toHaveLength(2);
    expect(second.every(link=>!first.includes(link))).toBe(true);
  }finally{
    await pool.query("DELETE FROM products WHERE slug LIKE $1 AND demo",[prefix+'-%']);
    await pool.end();
  }
});

test('consumer discovery, interest, saved products, brand verification and official update',async({page,browser})=>{
  await page.goto('/account');
  const registration=page.getByRole('heading',{name:'Create an account'}).locator('..');
  await registration.getByLabel('Public display name').fill('Archive member');
  await registration.getByLabel('Email').fill(member);
  await registration.getByLabel('Password (at least 12 characters)').fill(password);
  await registration.getByRole('button',{name:'Create account'}).click();
  await expect(page.getByRole('heading',{name:'Archive member'})).toBeVisible();
  await page.goto('/');
  await page.getByRole('textbox',{name:'Search the archive'}).filter({visible:true}).fill('iPod');
  await page.locator('.hero-search').getByRole('button',{name:'Search'}).click();
  await page.getByRole('link',{name:/Apple.*iPod Classic/}).click();
  await page.getByRole('button',{name:'Save product'}).click();
  await expect(page.getByRole('button',{name:'Remove from saved'})).toBeVisible();
  await page.getByRole('link',{name:'Bring it back'}).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+/);
  const campaignId=page.url().match(/campaigns\/(\d+)/)?.[1]??'';
  await page.getByLabel('Preferred price in USD').fill('150');
  await page.getByRole('button',{name:'Register interest'}).click();
  await expect(page.getByRole('button',{name:'Withdraw interest'})).toBeVisible();
  await action(page.request,{action:'interest',id:campaignId,enabled:'true',price:'155'});
  await expect(page.getByText('1 of 100 interested')).toBeVisible();

  await page.reload();
  const brand=await browser.newContext();
  const owner=await brand.newPage();
  await register(brand.request,brandEmail,'Brand archivist');
  await owner.goto('/brands');
  const apple=owner.locator('article').filter({has:owner.getByRole('heading',{name:'Apple',exact:true})});
  await apple.getByText('Request brand access').click();
  await apple.getByLabel('Ownership evidence').fill('Test evidence for an independently reviewed representative.');
  await apple.getByRole('button',{name:'Submit verification'}).click();
  await expect(apple.getByText('Verification pending')).toBeVisible();
  expect(await action(brand.request,{action:'publish-update',id:campaignId,body:'Unverified message'})).toContain('access denied');
  expect((await brand.request.get('/admin')).status()).toBe(404);

  const mod=await moderator(browser);
  const moderation=await mod.newPage();
  await moderation.goto('/admin');
  const claim=moderation.locator('article').filter({hasText:'Submitted by Brand archivist'});
  await claim.getByRole('button',{name:'Verify and grant access'}).click();
  await expect(claim).toHaveCount(0);
  await owner.reload();
  await apple.getByRole('link',{name:'Open brand dashboard'}).click();
  await expect(owner.getByRole('heading',{name:'Apple demand dashboard'})).toBeVisible();
  const review=owner.locator('article').filter({has:owner.getByRole('heading',{name:'Bring back the iPod Classic'})});
  await review.getByText('Publish an official update').click();
  await review.getByLabel('Update',{exact:true}).fill('We are reviewing the archive request.');
  await review.getByRole('button',{name:'Publish update'}).click();
  await expect(owner.getByRole('status')).toHaveText('Changes saved.');
  await page.goto('/account');
  await expect(page.getByText('We are reviewing the archive request.')).toBeVisible();
  await expect(page.getByRole('link',{name:/Apple.*iPod Classic/})).toBeVisible();
  await page.goto('/campaigns/'+campaignId);
  await page.getByRole('button',{name:'Withdraw interest'}).click();
  await expect(page.getByRole('button',{name:'Register interest'})).toBeVisible();
  await expect(page.getByText('0 of 100 interested')).toBeVisible();
  await brand.close();
  await mod.close();
});

test('collection isolation, import preview/commit, submission, campaign creation and account deletion',async({browser})=>{
  const one=await browser.newContext();
  const two=await browser.newContext();
  await register(one.request,'curator-'+nonce+'@example.test','Private curator');
  await register(two.request,'reader-'+nonce+'@example.test','Another reader');
  const path=await action(one.request,{action:'collection',title:'Private library'});
  expect(path).toMatch(/\/collections\/\d+$/);
  const id=path.split('/').at(-1)??'';
  expect((await two.request.get(path)).status()).toBe(404);
  expect(await action(two.request,{action:'collection-visibility',id,enabled:'true'})).toContain('access denied');
  await action(one.request,{action:'collection-visibility',id,enabled:'true'});
  expect((await two.request.get(path)).status()).toBe(200);
  const mod=await moderator(browser);
  const slug='archive-'+nonce;
  expect(await action(mod.request,{action:'import-preview',returnTo:'/admin',format:'csv',data:'slug,name,brand,category,description\n'+slug+',Import fixture '+nonce+',sony,audio,An archival fixture'})).toContain('Changes saved');
  const adminPage=await mod.newPage();
  await adminPage.goto('/admin');
  const preview=adminPage.locator('details').filter({hasText:'Import fixture '+nonce});
  await preview.locator('summary').click();
  await preview.getByRole('button',{name:'Commit validated records'}).click();
  expect((await one.request.get('/products/'+slug)).status()).toBe(200);
  const page=await one.newPage();
  await page.goto('/products/'+slug);
  await page.getByLabel('Why should it come back?').fill('There is a place in the archive for this product.');
  await page.getByRole('button',{name:'Submit campaign for review'}).click();
  await expect(page.getByText('UNDER MODERATION')).toBeVisible();
  expect((await two.request.get(page.url())).status()).toBe(404);
  expect(await action(one.request,{action:'submit-product',returnTo:'/submit',slug:'submitted-'+nonce,name:'Submitted archive '+nonce,brand:'sony',category:'audio',description:'Documented audio fixture'})).toContain('Product submitted for review');
  expect(await action(one.request,{action:'submit-product',returnTo:'/submit',slug:'INVALID',name:'X'})).toContain('Check the submitted fields');
  const invalidOrigin=await one.request.post('/api/action',{headers:{origin:'https://example.com'},form:{action:'sign-out'}});
  expect(invalidOrigin.status()).toBe(403);
  expect(await action(one.request,{action:'delete-account',password})).toContain('Your account was deleted');
  expect((await two.request.get(path)).status()).toBe(404);
  await one.close();await two.close();await mod.close();
});

test('mobile navigation and keyboard autocomplete',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link',{name:'For brands'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Search',exact:true}).filter({hasText:'⌕'}).click();
  const query=page.getByRole('combobox',{name:'Search the archive'});
  await query.fill('A1238');
  await expect(page.getByRole('option',{name:/iPod Classic/})).toBeVisible();
  await query.press('ArrowDown');
  await query.press('Enter');
  await expect(page).toHaveURL(/\/products\/ipod-classic/);
  await expect(page.getByRole('heading',{name:'iPod Classic',exact:true,level:1})).toBeVisible();
});
