import { db } from '@/lib/db';
import { siteOrigin } from '@/lib/site';
import { sitemapPages } from '@/lib/sitemap';

export const dynamic="force-dynamic";

export async function GET(){
  const ids=await sitemapPages(db);
  const links=ids.map(id=>`<sitemap><loc>${new URL('/sitemap/'+id+'.xml',siteOrigin()).href.replaceAll('&','&amp;')}</loc></sitemap>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${links}</sitemapindex>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}
