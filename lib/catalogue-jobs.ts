import type { PoolClient } from 'pg';
import { insertProduct,normalizeCatalogueKey,previewImport,record } from './ingestion';

export class CatalogueError extends Error {}
const batchSize=20;
const requireCondition=(value:unknown,message:string)=>{
  if(!value)throw new CatalogueError(message);
};

export async function queueCatalogue(client:PoolClient, options:{
  input:string; format:string; mode:'create'|'sources'; sourceId:string|null;
  user:string; brandId:string|null; brandSlug?:string;
}){
  const {input,format,mode,sourceId,user,brandId,brandSlug}=options;
  const brands=(await client.query<{slug:string;name:string;aliases:string[]}>('SELECT slug,name,aliases FROM brands ORDER BY slug')).rows;
  const categories=(await client.query<{slug:string;name:string}>('SELECT slug,name FROM categories ORDER BY slug')).rows;
  const mappings=(items:{slug:string;name:string;aliases?:string[]}[])=>{
    const map=new Map<string,string>(), ambiguous=new Set<string>();
    for(const item of items)for(const key of [item.name,...(item.aliases??[])].map(normalizeCatalogueKey)){
      if(map.has(key)&&map.get(key)!==item.slug)ambiguous.add(key);
      else map.set(key,item.slug);
    }
    for(const key of ambiguous)map.delete(key);
    for(const item of items)map.set(item.slug,item.slug);
    return map;
  };
  let preview;
  try{preview=previewImport(input,format,{brands:mappings(brands),categories:mappings(categories)});}
  catch{throw new CatalogueError('Provide valid CSV or a JSON array containing 1 to 200 archive records.');}
  const {rows}=await client.query<{slug:string;valid:boolean;duplicate:boolean;exact:boolean}>(`
    SELECT r.slug,b.id IS NOT NULL AND c.id IS NOT NULL AS valid,
      EXISTS(SELECT 1 FROM products p WHERE p.slug=r.slug OR (p.brand_id=b.id AND archive_fold(p.name)=archive_fold(r.name)
        AND archive_fold(coalesce(p.model,''))=archive_fold(coalesce(r.model,'')))) AS duplicate,
      EXISTS(SELECT 1 FROM products p WHERE p.slug=r.slug AND p.brand_id=b.id AND NOT p.demo AND p.deleted_at IS NULL) AS exact
    FROM jsonb_to_recordset($1::jsonb) r(slug text,brand text,category text,name text,model text)
    LEFT JOIN brands b ON b.slug=r.brand LEFT JOIN categories c ON c.slug=r.category`,[JSON.stringify(preview.data)]);
  for(const r of preview.data){
    if(brandSlug&&r.brand!==brandSlug)preview.errors.push('Brand mismatch: '+r.slug);
    if((sourceId||mode==='sources')&&!r.source&&!r.official_url)preview.errors.push('Missing product source URL: '+r.slug);
  }
  for(const row of rows){
    if(!row.valid)preview.errors.push('Unknown category or brand: '+row.slug);
    if(mode==='create'&&row.duplicate)preview.errors.push('Already in archive: '+row.slug);
    if(mode==='sources'&&!row.exact)preview.errors.push('Source updates need an existing visible product of the same brand: '+row.slug);
  }
  await client.query('INSERT INTO import_jobs(user_id,brand_id,data,errors,mode,source_id) VALUES($1,$2,$3,$4,$5,$6)',
    [user,brandId,JSON.stringify(preview.data),JSON.stringify(preview.errors),mode,sourceId]);
}

export async function continueCatalogue(client:PoolClient, options:{
  id:string; user:string; brandId:string|null; brandSlug?:string; rollback:boolean;
}){
  const {id,user,brandId,brandSlug,rollback}=options;
  const {rows:[job]}=await client.query<{status:string;data:unknown[];errors:string[];mode:string;next_row:number;source_id:string|null}>(`
    SELECT status,data,errors,mode,next_row,source_id FROM import_jobs WHERE id=$1 AND user_id=$2
      AND brand_id IS NOT DISTINCT FROM $3::bigint FOR UPDATE`,[id,user,brandId]);
  if(!job||!['preview','processing'].includes(job.status))throw new CatalogueError('Import is unavailable.');
  if(rollback){
    await client.query(`DELETE FROM products p USING import_created_products j
      WHERE j.import_id=$1 AND p.id=j.product_id AND p.deleted_at IS NOT NULL AND p.merged_into_id IS NULL`,[id]);
    await client.query("UPDATE import_jobs SET status='rolled_back',last_error=NULL WHERE id=$1",[id]);
    return {status:'rolled_back',progress:job.next_row,count:job.data.length};
  }
  requireCondition(job.errors.length===0 && job.data.length,'Resolve preview errors before importing.');
  await client.query('SAVEPOINT catalogue_batch');
  try{
    const end=job.mode==='sources'?job.data.length:Math.min(job.next_row+batchSize,job.data.length);
    const batch=job.data.slice(job.next_row,end).map(item=>record.parse(item));
    for(const row of batch)requireCondition(!brandSlug||row.brand===brandSlug,'Catalogue access denied.');
    if(job.mode==='sources'){
      const payload=JSON.stringify(batch);
      const targets=`FROM jsonb_to_recordset($1::jsonb) r(slug text,brand text,source text,official_url text)
        JOIN brands b ON b.slug=r.brand JOIN products p ON p.slug=r.slug AND p.brand_id=b.id
        AND NOT p.demo AND p.deleted_at IS NULL`;
      const locked=await client.query(`SELECT p.id ${targets} ORDER BY p.id FOR UPDATE OF p`,[payload]);
      requireCondition(locked.rowCount===batch.length,'A source update no longer targets an eligible product.');
      await client.query(`INSERT INTO product_sources(product_id,url,label,catalogue_source_id)
        SELECT p.id,e.url,e.label,$2 ${targets}
        CROSS JOIN LATERAL (VALUES (r.source,'Submitted source'),(r.official_url,'Official product link')) e(url,label)
        WHERE e.url IS NOT NULL ON CONFLICT DO NOTHING`,[payload,job.source_id]);
    }else{
      for(const row of batch){
        const product=await insertProduct(client,row,{staged:true,sourceId:job.source_id});
        await client.query('INSERT INTO import_created_products(import_id,product_id) VALUES($1,$2)',[id,product]);
      }
    }
    const complete=end===job.data.length;
    if(complete&&job.mode==='create'){
      await client.query(`UPDATE products p SET deleted_at=NULL FROM import_created_products j
        WHERE j.import_id=$1 AND p.id=j.product_id`,[id]);
    }
    const status=complete?'committed':'processing';
    await client.query('UPDATE import_jobs SET status=$2,next_row=$3,last_error=NULL WHERE id=$1',[id,status,end]);
    await client.query('RELEASE SAVEPOINT catalogue_batch');
    return {status,progress:end,count:job.data.length};
  }catch(error){
    await client.query('ROLLBACK TO SAVEPOINT catalogue_batch');
    await client.query('RELEASE SAVEPOINT catalogue_batch');
    const reason=error instanceof CatalogueError?error.message:
      (error as {code?:string}).code==='23505'?'A duplicate or reserved archive record appeared after preview.':
      'The batch could not be completed. Review the inputs before retrying.';
    await client.query('UPDATE import_jobs SET last_error=$2 WHERE id=$1',[id,reason]);
    return {status:'retry',progress:job.next_row,count:job.data.length};
  }
}
