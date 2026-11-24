import { db } from '@/lib/db';
import { siteOrigin } from '@/lib/site';
import { sitemapPageSize } from '@/lib/sitemap';
export async function GET(_:Request,{params}:{params:Promise<{batch:string}>}){
  const {batch}=await params;
  if(!/^\d{1,11}\.xml$/.test(batch))return new Response('Not found',{status:404});
  const page=Number(batch.slice(0,-4));
  const {rows}=await db.query<{slug:string}>(`SELECT slug FROM products WHERE NOT demo AND verification='verified' AND deleted_at IS NULL AND id>$1 AND id<=$2 ORDER BY id`,[page*sitemapPageSize,(page+1)*sitemapPageSize]);
  if(page&&!rows.length)return new Response('Not found',{status:404});
  const paths=rows.map(row=>'/products/'+encodeURIComponent(row.slug));
  if(!page)paths.unshift('/','/explore','/campaigns','/collections','/brands','/founding-partners');
  const links=paths.map(path=>`<url><loc>${new URL(path,siteOrigin()).href.replaceAll('&','&amp;')}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${links}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}
