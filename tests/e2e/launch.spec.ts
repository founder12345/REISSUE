import { test,expect } from '@playwright/test';

test('public launch routes offer disclosure, feedback and a working archive request',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/founding-partners');
  await expect(page.getByRole('heading',{name:'Your archive has a future.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const company='Disposable QA application '+Date.now();
  await page.getByLabel('Brand name').fill(company);
  await page.getByLabel('Brand website').fill('https://example.com');
  await page.getByLabel('Work email').fill('demo-'+Date.now()+'@example.test');
  await page.getByLabel('What would you like to explore?').fill('We would like to discuss preserving a collection of historical manuals.');
  await page.getByRole('button',{name:'Send application'}).click();
  await expect(page.getByText('Application received.')).toBeVisible();
  await page.goto('/feedback');
  await page.getByLabel('Your feedback').fill('The archive is easy to browse on mobile.');
  await page.getByRole('button',{name:'Send feedback'}).click();
  await expect(page.getByText('Feedback received.')).toBeVisible();
  for(const path of ['/privacy','/terms']){
    await page.goto(path);
    await expect(page.getByText('DRAFT · REQUIRES LEGAL REVIEW BEFORE LAUNCH')).toBeVisible();
  }
  await page.goto('/explore?q=zzzzzyyyyy');
  await page.getByRole('link',{name:'request an addition to the archive'}).click();
  await expect(page.getByLabel('Product name')).toHaveValue('zzzzzyyyyy');
  expect((await request.get('/missing-page')).status()).toBe(404);
  expect((await request.get('/admin')).status()).toBe(404);
  await page.request.post('/api/action',{
    headers:{origin:'http://localhost:3210'},
    form:{action:'sign-in',email:process.env.TEST_ADMIN_EMAIL??'',password:process.env.TEST_ADMIN_PASSWORD??''},
  });
  await page.goto('/admin');
  const application=page.locator('details').filter({has:page.getByText(company,{exact:true})});
  await application.locator('summary').click();
  await application.getByRole('button',{name:'Mark reviewed'}).click();
  await expect(application).toHaveCount(0);
});
test('SEO exposes public routes and omits demo catalogue records',async({request})=>{
  const robots=await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap: http://localhost:3210/sitemap.xml');
  const index=await request.get('/sitemap.xml');
  expect(await index.text()).toContain('/sitemap/0.xml');
  const batch=await request.get('/sitemap/0.xml');
  const xml=await batch.text();
  expect(xml).toContain('/founding-partners');
  expect(xml).not.toContain('/products/ipod-classic');
  const product=await request.get('/products/ipod-classic');
  expect(await product.text()).toMatch(/<meta name="robots" content="noindex/);
});
