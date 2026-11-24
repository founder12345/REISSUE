import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site';

export const dynamic="force-dynamic";

export default function robots():MetadataRoute.Robots {
  if(process.env.VERCEL_ENV==='preview')return {rules:{userAgent:'*',disallow:'/'}};
  return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/admin','/account','/brands/']},sitemap:new URL('/sitemap.xml',siteOrigin()).href};
}
