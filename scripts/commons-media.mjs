import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const manifest=JSON.parse(await readFile('docs/archive-media.json','utf8'));
const agent='REISSUE catalogue engineering/1.0 (https://github.com/founder12345/REISSUE)';
const request=async url=>{
  const response=await fetch(url,{headers:{'User-Agent':agent},redirect:'error',signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error('Commons returned '+response.status);
  return response;
};

for(const item of manifest){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug))throw new Error('Invalid output slug');
  const query=new URLSearchParams({action:'query',titles:'File:'+item.file,prop:'imageinfo',iiprop:'url|extmetadata',format:'json'});
  const lookup=await (await request('https://commons.wikimedia.org/w/api.php?'+query)).json();
  const image=Object.values(lookup.query.pages)[0]?.imageinfo?.[0];
  const source=image&&new URL(image.url);
  if(!source||source.origin!=='https://upload.wikimedia.org'||image.extmetadata.LicenseShortName?.value!==item.license){
    throw new Error('Missing or changed media rights for '+item.file);
  }
  const response=await request(source);
  const chunks=[];
  let size=0;
  for await(const chunk of response.body){
    size+=chunk.byteLength;
    if(size>25_000_000)throw new Error('Media exceeds download cap');
    chunks.push(chunk);
  }
  const output=await sharp(Buffer.concat(chunks),{limitInputPixels:42_000_000}).rotate().resize({
    width:1440,height:1440,fit:'inside',withoutEnlargement:true,
  }).webp({quality:86}).toBuffer();
  await mkdir('public/archive',{recursive:true});
  await writeFile('public/archive/'+item.slug+'.webp',output);
  console.log(item.slug,image.descriptionurl);
}
