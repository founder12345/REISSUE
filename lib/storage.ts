import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
const bucket=process.env.S3_BUCKET;
const storage=bucket?new S3Client({
  region:process.env.S3_REGION??'us-east-1',
  endpoint:process.env.S3_ENDPOINT||undefined,
  forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',
}):null;
export const storageAvailable=Boolean(storage);
export async function putImage(key:string,body:Buffer){
  if(!storage||!bucket)throw new Error('Image storage is unavailable.');
  await storage.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:'image/webp'}));
}
export async function getImage(key:string){
  if(!storage||!bucket)return null;
  const {Body}=await storage.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  return Body?.transformToWebStream()??null;
}
export async function removeImage(key:string){
  if(storage&&bucket)await storage.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
}
