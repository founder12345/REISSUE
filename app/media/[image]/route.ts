import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getImage } from '@/lib/storage';
export async function GET(_:Request,{params}:{params:Promise<{image:string}>}){
  const {image}=await params;
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(image))return new NextResponse('Not found',{status:404});
  const {rows}=await db.query<{object_key:string}>(`SELECT i.object_key FROM product_images i JOIN products p ON p.id=i.product_id
    WHERE i.object_key=$1 AND p.deleted_at IS NULL`,['products/'+image+'.webp']);
  if(!rows[0])return new NextResponse('Not found',{status:404});
  try{
    const body=await getImage(rows[0].object_key);
    return body?new NextResponse(body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=300'}}):new NextResponse('Not found',{status:404});
  }catch{return new NextResponse('Image unavailable',{status:502});}
}
