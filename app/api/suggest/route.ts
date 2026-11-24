import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { limit, viewer } from '@/lib/auth';
import { search } from '@/lib/search';
import { foldQuery } from '@/lib/ranking';

export async function GET(request:NextRequest){
  const q=foldQuery(request.nextUrl.searchParams.get('q')??'');
  const ip=process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] : null;
  if(ip && !await limit('suggest:'+ip,100,60))return NextResponse.json({error:'Too many requests'},{status:429,headers:{'Retry-After':'60'}});
  const items:{label:string;href:string;kind:string}[]=[];
  if(!q){
    const user=await viewer();
    const recent=user?.search_history?(await db.query<{query:string}>('SELECT query FROM search_history WHERE user_id=$1 ORDER BY used_at DESC LIMIT 5',[user.id])).rows:[];
    const popular=recent.length?[]:(await db.query<{query:string}>(`SELECT query FROM search_events WHERE kind='search' AND query IS NOT NULL AND created_at>now()-interval '30 days' GROUP BY query HAVING count(*)>=5 ORDER BY count(*) DESC,query LIMIT 5`)).rows;
    for(const row of [...recent,...popular])items.push({label:row.query,href:'/explore?q='+encodeURIComponent(row.query),kind:recent.length?'Recent':'Popular'});
    return NextResponse.json({items,total:0},{headers:{'Cache-Control':'private, no-store'}});
  }
  const [result,facets,campaigns]=await Promise.all([
    search(new URLSearchParams({q})),
    db.query<{name:string;slug:string;kind:string}>(`SELECT * FROM (
      SELECT name,slug,'Brand' AS kind FROM brands WHERE strpos(archive_fold(name),$1)>0 OR EXISTS(SELECT 1 FROM unnest(aliases) a WHERE strpos(archive_fold(a),$1)>0)
      UNION ALL SELECT name,slug,'Category' AS kind FROM categories WHERE strpos(archive_fold(name),$1)>0
    ) matches ORDER BY name LIMIT 5`,[q]),
    db.query<{id:string;title:string}>(`SELECT c.id,c.title FROM campaigns c JOIN products p ON p.id=c.product_id WHERE p.deleted_at IS NULL AND c.status NOT IN ('Under moderation','Archived') AND strpos(archive_fold(c.title),$1)>0 ORDER BY c.id DESC LIMIT 3`,[q]),
  ]);
  for(const p of result.products.slice(0,5))items.push({label:p.name,href:'/products/'+p.slug,kind:'Product'});
  for(const f of facets.rows)items.push({label:f.name,href:'/explore?'+new URLSearchParams({[f.kind.toLowerCase()]:f.slug}),kind:f.kind});
  for(const c of campaigns.rows)items.push({label:c.title,href:'/campaigns/'+c.id,kind:'Campaign'});
  return NextResponse.json({items,total:result.total},{headers:{'Cache-Control':'private, no-store'}});
}
