import type { PoolClient } from 'pg';
import { z } from 'zod';

export const verificationLevel=z.enum(['unverified','source_supported','historical','brand_confirmed']);
export const lifecycleStatus=z.enum(['unknown','discontinued','reissued']);
export const verificationLabel={
  unverified:'Unverified archive record',source_supported:'Source-supported record',historical:'Verified historical product',
  brand_confirmed:'Brand-confirmed product',
};
export const lifecycleLabel={unknown:'Lifecycle unconfirmed',discontinued:'Confirmed discontinued',reissued:'Confirmed reissued'};
export type VerificationLevel=z.infer<typeof verificationLevel>;
export type LifecycleStatus=z.infer<typeof lifecycleStatus>;

export async function saveEvidence(client:PoolClient,options:{
  id:string;actor:string;admin:boolean;level:VerificationLevel;status:LifecycleStatus;date:string|null;source:string;rationale:string;
}){
  const {id,actor,admin,level,status,date,source,rationale}=options;
  const {rows:[product]}=await client.query<{brand_id:string;lifecycle_status:LifecycleStatus;discontinuation_date:string|null;release_year:number|null}>(`
    SELECT brand_id,lifecycle_status,discontinuation_date::text,release_year FROM products
    WHERE id=$1 AND NOT demo AND deleted_at IS NULL FOR UPDATE`,[id]);
  if(!product)return false;
  if(level==='brand_confirmed'){
    const matching=await client.query('SELECT 1 FROM brand_members WHERE brand_id=$1 AND user_id=$2 FOR SHARE',[product.brand_id,actor]);
    if(!matching.rowCount)return false;
  }else if(!admin)return false;
  const signedStatus=admin?status:product.lifecycle_status;
  const signedDate=admin?date:product.discontinuation_date;
  if(signedDate&&(signedStatus==='unknown'||(product.release_year&&Number(signedDate.slice(0,4))<product.release_year)))return false;
  const {rowCount}=await client.query('SELECT 1 FROM product_sources WHERE product_id=$1 AND url=$2',[id,source]);
  if(!rowCount)return false;
  await client.query(`INSERT INTO product_evidence_decisions(product_id,actor_id,source_url,rationale,verification_level,lifecycle_status,discontinuation_date)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,actor,source,rationale,level,signedStatus,signedDate]);
  await client.query(`UPDATE products SET verification_level=$2,lifecycle_status=$3,discontinuation_date=$4,
    verification=CASE WHEN $2 IN ('historical','brand_confirmed') THEN 'verified' ELSE 'unverified' END,
    verified_at=CASE WHEN $2 IN ('historical','brand_confirmed') THEN now() ELSE NULL END
    WHERE id=$1`,[id,level,signedStatus,signedDate]);
  return true;
}
