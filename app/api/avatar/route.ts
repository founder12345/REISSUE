import { NextRequest,NextResponse } from 'next/server';
import sharp from 'sharp';
import { limit,viewer } from '@/lib/auth';
import { db } from '@/lib/db';
import { configuredOrigin } from '@/lib/site';

export async function GET(){
  const user=await viewer();
  if(!user)return new Response(null,{status:404});
  const {rows:[profile]}=await db.query<{avatar_bytes:Buffer|null}>('SELECT avatar_bytes FROM profiles WHERE id=$1',[user.id]);
  if(!profile?.avatar_bytes)return new Response(null,{status:404});
  return new Response(new Uint8Array(profile.avatar_bytes),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
  const origin=configuredOrigin()??request.nextUrl.origin;
  if(request.headers.get('origin')!==origin)return new Response('Invalid request origin',{status:403});
  const user=await viewer();
  if(!user)return new Response(null,{status:401});
  if(!await limit('avatar:'+user.id,8,600))return new Response('Try again later',{status:429});
  const finish=(message:string,error=false)=>{
    const url=new URL('/account#profile',origin);
    url.searchParams.set(error?'error':'notice',message);
    return NextResponse.redirect(url,303);
  };
  const type=request.headers.get('content-type');
  const reader=request.body?.getReader();
  if(!type?.startsWith('multipart/form-data;')||!reader)return new Response('Unsupported upload',{status:415});
  const chunks:Uint8Array[]=[];
  let size=0;
  for(;;){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>2_150_000){await reader.cancel();return finish('Upload an image smaller than 2 MB.',true);}
    chunks.push(value);
  }
  try{
    const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':type}}).formData();
    const file=form.get('avatar');
    if(!(file instanceof File)||file.size>2_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))return finish('Choose a JPEG, PNG or WebP image below 2 MB.',true);
    const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:12_000_000,failOn:'warning'});
    const metadata=await image.metadata();
    if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1)return finish('Choose a supported still image.',true);
    const avatar=await image.rotate().resize(160,160,{fit:'cover'}).webp({quality:78}).toBuffer();
    await db.query('UPDATE profiles SET avatar_bytes=$2 WHERE id=$1',[user.id,avatar]);
    return finish('Profile picture updated.');
  }catch{return finish('The image could not be processed.',true);}
}
