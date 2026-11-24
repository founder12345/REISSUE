import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { PoolClient } from 'pg';
const empty = (value: unknown) => value === '' || value === null ? undefined : value;
const optional = (size: number) => z.preprocess(empty,z.string().trim().max(size).optional());
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const list = z.preprocess(v => typeof v==='string' ? v.split('|').map(s=>s.trim()).filter(Boolean) : v,z.array(z.string().trim().min(1).max(100)).max(20).default([]));
const sourceUrl=z.preprocess(empty,z.url({protocol:/^https?$/}).max(1000).optional());
const specs=z.preprocess(value=>{
  if(typeof value!=='string')return value;
  return Object.fromEntries(value.split('|').map(part=>{
    const split=part.indexOf('=');
    return split<0?[part.trim(),'']:[part.slice(0,split).trim(),part.slice(split+1).trim()];
  }).filter(([key])=>key));
},z.record(z.string().min(1).max(80),z.string().min(1).max(180)).refine(value=>Object.keys(value).length<=30).default({}));
const year = z.preprocess(empty,z.coerce.number().int().min(1000).max(2100).optional());
export const record = z.object({
  slug, name:z.string().trim().min(2).max(140), brand:slug, category:slug,
  description:z.string().trim().min(5).max(5000), history:optional(5000), subcategory:optional(100),
  model:optional(100), reference_number:optional(120), sku:optional(120),
  release_year:year, discontinued_year:year,
  retail_price:z.preprocess(empty,z.coerce.number().min(0).max(9999999999).optional()),
  currency:z.preprocess(empty,z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional()),
  colours:list, materials:list, aliases:list, country:optional(80),
  availability:z.preprocess(empty,z.enum(['unknown','discontinued']).default('unknown')),
  source:sourceUrl, official_url:sourceUrl, specifications:specs,
}).refine(row=>(row.retail_price === undefined)===(row.currency === undefined),'Price requires a currency').refine(row=>!row.discontinued_year || !row.release_year || row.discontinued_year>=row.release_year,'Discontinuation precedes release').refine(row=>row.availability!=='discontinued' || !!(row.source||row.official_url),'Discontinuation requires a source');
export type ArchiveRecord=z.infer<typeof record>;

export function previewImport(input: string, format: string) {
  const rows: unknown = format === 'csv' ? parse(input,{columns:true,skip_empty_lines:true,bom:true,max_record_size:16000}) : JSON.parse(input);
  if (!Array.isArray(rows) || rows.length===0 || rows.length>100) throw new Error('Import must contain 1 to 100 records.');
  const data: ArchiveRecord[]=[];
  const errors: string[]=[];
  const seen=new Set<string>();
  rows.forEach((row,index)=>{
    const result=record.safeParse(row);
    if (!result.success) {
      errors.push(`Row ${index+1}: ${result.error.issues.map(i=>[i.path.join('.'),i.message].filter(Boolean).join(' ')).join(', ')}`);
      return;
    }
    const key=[result.data.brand,result.data.name,result.data.model].join('|').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');
    const slugKey='slug:'+result.data.slug;
    if (seen.has(key) || seen.has(slugKey)) {errors.push(`Row ${index+1}: duplicate product or slug`);return;}
    seen.add(key);
    seen.add(slugKey);
    data.push(result.data);
  });
  return {data,errors};
}
export async function insertProduct(client:PoolClient,r:ArchiveRecord) {
  const {rows}=await client.query<{id:string}>(`INSERT INTO products(slug,name,brand_id,category_id,description,history,subcategory,model,reference_number,sku,release_year,discontinued_year,retail_price,currency,colours,materials,country,availability)
   SELECT $1,$2,b.id,c.id,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
   FROM brands b CROSS JOIN categories c WHERE b.slug=$3 AND c.slug=$4 RETURNING id`,
  [r.slug,r.name,r.brand,r.category,r.description,r.history,r.subcategory,r.model,r.reference_number,r.sku,r.release_year,r.discontinued_year,r.retail_price,r.currency,r.colours,r.materials,r.country,r.availability]);
  const id=rows[0]?.id;
  if (!id) throw new Error('Unknown brand or category');
  await client.query('INSERT INTO product_aliases(product_id,alias) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',[id,r.aliases]);
  await addSources(client,id,r);
  await addSpecifications(client,id,r);
  return id;
}

async function addSources(client:PoolClient,id:string,r:ArchiveRecord){
  await client.query(`INSERT INTO product_sources(product_id,url,label)
    SELECT $1,url,label FROM (VALUES ($2::text,'Submitted source'),($3::text,'Official product link')) valueset(url,label)
    WHERE url IS NOT NULL ON CONFLICT DO NOTHING`,[id,r.source,r.official_url]);
}
async function addSpecifications(client:PoolClient,id:string,r:ArchiveRecord){
  await client.query(`INSERT INTO product_attributes(product_id,name,value)
    SELECT $1,key,value FROM jsonb_each_text($2::jsonb)`,[id,JSON.stringify(r.specifications)]);
}

export async function editProduct(client:PoolClient,id:string,r:ArchiveRecord) {
  const result=await client.query(`UPDATE products p
    SET slug=$2,name=$3,brand_id=b.id,category_id=c.id,description=$6,history=$7,subcategory=$8,model=$9,reference_number=$10,sku=$11,
    release_year=$12,discontinued_year=$13,retail_price=$14,currency=$15,colours=$16,materials=$17,country=$18,
    availability=$19,verification='unverified'
    FROM brands b CROSS JOIN categories c
    WHERE p.id=$1 AND b.slug=$4 AND c.slug=$5 AND (p.brand_id=b.id OR NOT EXISTS(SELECT 1 FROM campaigns WHERE product_id=p.id))`,
  [id,r.slug,r.name,r.brand,r.category,r.description,r.history,r.subcategory,r.model,r.reference_number,r.sku,r.release_year,r.discontinued_year,r.retail_price,r.currency,r.colours,r.materials,r.country,r.availability]);
  if(!result.rowCount)throw new Error('Product, brand or category unavailable. Products with campaigns cannot be transferred to a different brand.');
  await client.query('DELETE FROM product_aliases WHERE product_id=$1',[id]);
  await client.query('INSERT INTO product_aliases(product_id,alias) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',[id,r.aliases]);
  await addSources(client,id,r);
  await client.query('DELETE FROM product_attributes WHERE product_id=$1',[id]);
  await addSpecifications(client,id,r);
}

export async function mergeProduct(client:PoolClient,source:string,target:string) {
  if(source===target)return false;
  const rows=await client.query<{id:string;demo:boolean;brand_id:string}>(`SELECT id,demo,brand_id FROM products WHERE id=ANY($1::bigint[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`,[[source,target]]);
  if(rows.rowCount!==2||rows.rows[0].demo!==rows.rows[1].demo||rows.rows[0].brand_id!==rows.rows[1].brand_id)return false;
  const active=await client.query(`SELECT id FROM campaigns WHERE product_id=ANY($1::bigint[]) AND status NOT IN ('Archived','Completed','Brand declined') FOR UPDATE`,[[source,target]]);
  if((active.rowCount??0)>1)return false;
  await client.query('UPDATE campaigns SET product_id=$2 WHERE product_id=$1',[source,target]);
  await client.query('UPDATE product_images SET product_id=$2 WHERE product_id=$1',[source,target]);
  await client.query('UPDATE correction_requests SET product_id=$2 WHERE product_id=$1',[source,target]);
  await client.query(`INSERT INTO product_aliases(product_id,alias) SELECT $2::bigint,alias FROM product_aliases WHERE product_id=$1
    UNION SELECT $2::bigint,name FROM products WHERE id=$1 ON CONFLICT DO NOTHING`,[source,target]);
  await client.query('INSERT INTO product_sources(product_id,url,label) SELECT $2,url,label FROM product_sources WHERE product_id=$1 ON CONFLICT DO NOTHING',[source,target]);
  await client.query('INSERT INTO product_attributes(product_id,name,value) SELECT $2,name,value FROM product_attributes WHERE product_id=$1 ON CONFLICT DO NOTHING',[source,target]);
  await client.query('INSERT INTO collection_items(collection_id,product_id) SELECT collection_id,$2 FROM collection_items WHERE product_id=$1 ON CONFLICT DO NOTHING',[source,target]);
  await client.query('INSERT INTO saved_products(user_id,product_id) SELECT user_id,$2 FROM saved_products WHERE product_id=$1 ON CONFLICT DO NOTHING',[source,target]);
  await client.query('DELETE FROM collection_items WHERE product_id=$1',[source]);
  await client.query('DELETE FROM saved_products WHERE product_id=$1',[source]);
  await client.query('UPDATE products SET deleted_at=now() WHERE id=$1',[source]);
  return true;
}
