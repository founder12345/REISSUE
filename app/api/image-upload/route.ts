import { randomUUID } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { limit,viewer } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { putImage,removeImage,storageAvailable } from '@/lib/storage';

export async function POST(request:NextRequest){
  const origin=process.env.APP_ORIGIN??request.nextUrl.origin;
  if(request.headers.get('origin')!==origin)return new NextResponse('Invalid request origin',{status:403});
  const user=await viewer();
  if(user?.role!=='admin')return new NextResponse('Not found',{status:404});
  const mediaType=request.headers.get('content-type');
  if(!mediaType?.startsWith('multipart/form-data;'))return new NextResponse('Unsupported format',{status:415});
  if(!await limit('image-upload:'+user.id,15,60))return new NextResponse('Try again later',{status:429});
  const reader=request.body?.getReader();
  if(!reader)return new NextResponse('Missing upload',{status:400});
  const chunks:Buffer[]=[];
  let size=0;
  for(;;){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>4_150_000){await reader.cancel();return new NextResponse('Upload exceeds 4 MB',{status:413});}
    chunks.push(Buffer.from(value));
  }
  const body=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':mediaType}}).formData().catch(()=>null);
  if(!body)return new NextResponse('Invalid upload',{status:400});
  const fields=z.object({
    id:z.string().regex(/^[1-9]\d{0,17}$/),
    alt:z.string().trim().min(3).max(220),
    attribution:z.string().trim().min(8).max(800),
    source:z.union([z.url({protocol:/^https?$/}).max(1000),z.literal('')]).optional(),
    licence:z.union([z.url({protocol:/^https?$/}).max(1000),z.literal('')]).optional(),
  }).safeParse(Object.fromEntries(body));
  if(!fields.success)return new NextResponse('Check the submitted fields',{status:400});
  const {id,alt,attribution,source,licence}=fields.data;
  const redirect=(key:'error'|'notice',message:string)=>{
    const destination=new URL('/admin/products/'+id,origin);
    destination.searchParams.set(key,message);
    return NextResponse.redirect(destination,303);
  };
  if(!storageAvailable)return redirect('error','Configure private image storage before uploading.');
  const file=body.get('image');
  if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4_000_000)return redirect('error','Select a JPEG, PNG or WebP file under 4 MB.');
  const key='products/'+randomUUID()+'.webp';
  let attempted=false;
  try{
    const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:24_000_000,failOn:'warning'});
    const metadata=await image.metadata();
    if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1)return redirect('error','Select a supported still image.');
    const {data,info}=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer({resolveWithObject:true});
    attempted=true;
    await putImage(key,data);
    await transaction(async client=>{
      const product=await client.query('SELECT 1 FROM products WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]);
      if(!product.rowCount)throw Error('Missing product');
      const {rows}=await client.query<{id:string}>(`INSERT INTO product_images(product_id,path,object_key,attribution,alt,width,height,source_url,license_url)
        VALUES($1,'/media/'||$2::text,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[id,key.split('/')[1].replace('.webp',''),key,attribution,alt,info.width,info.height,source||null,licence||null]);
      await client.query("INSERT INTO audit_logs(actor_id,action,target,details) VALUES($1,'image-upload',$2,$3)",[user.id,id,JSON.stringify({imageId:rows[0].id})]);
    });
    return redirect('notice','Attributed image uploaded.');
  }catch{
    if(attempted)await removeImage(key).catch(()=>console.error('Could not clean up an incomplete media upload.'));
    return redirect('error','Image could not be saved. Check the file and storage configuration.');
  }
}
