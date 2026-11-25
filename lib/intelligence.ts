import { db } from './db';

export const reportingThreshold=5;
export type Opportunity = {
  id:string; title:string; product:string; status:string; supporters:number; recent:number;
  baseline:number; intent_responses:number; high_intent:number; price_responses:number;
  largest_band:number; verified:boolean;
};

export function revivalScore(d:Opportunity){
  if(d.supporters<reportingThreshold)return null;
  const demand=45*Math.min(d.supporters/50,1);
  const growth=d.recent>=reportingThreshold?20*Math.min(Math.max(d.recent-d.baseline,0)/Math.max(10,d.baseline),1):0;
  const intent=d.intent_responses>=reportingThreshold?15*d.high_intent/d.intent_responses:0;
  const price=d.largest_band>=reportingThreshold?10*d.largest_band/d.price_responses:0;
  return Math.round(demand+growth+intent+price+(d.verified?10:0));
}

export async function brandOpportunities(brandId:string,userId:string){
  const {rows}=await db.query<Opportunity>(`
    WITH eligible AS (
      SELECT c.id,c.title,c.status,p.name product,p.verification='verified' verified
      FROM campaigns c JOIN products p ON p.id=c.product_id
      JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
      WHERE p.brand_id=$1 AND NOT p.demo AND p.deleted_at IS NULL AND c.rejected_at IS NULL AND c.status<>'Under moderation'
    ), preferences AS (
      SELECT s.*,floor(coalesce((s.price+s.price_max)/2,s.price)/25) band
      FROM campaign_supporters s JOIN eligible e ON e.id=s.campaign_id
    ), counts AS (
      SELECT campaign_id,count(*)::int supporters,
        count(*) FILTER(WHERE created_at>=now()-interval '30 days')::int recent,
        count(*) FILTER(WHERE created_at<now()-interval '30 days' AND created_at>=now()-interval '60 days')::int baseline,
        count(likelihood)::int intent_responses,count(*) FILTER(WHERE likelihood>=4)::int high_intent,count(band)::int price_responses
      FROM preferences GROUP BY campaign_id HAVING count(*) >= $3
    ), price_clusters AS (
      SELECT campaign_id,max(n)::int largest_band FROM (
        SELECT campaign_id,band,count(*) n FROM preferences WHERE band IS NOT NULL GROUP BY campaign_id,band
      ) bins GROUP BY campaign_id
    )
    SELECT e.*,counts.supporters,counts.recent,counts.baseline,counts.intent_responses,counts.high_intent,counts.price_responses,
      coalesce(p.largest_band,0) largest_band FROM eligible e
    JOIN counts ON counts.campaign_id=e.id LEFT JOIN price_clusters p ON p.campaign_id=e.id
    ORDER BY counts.supporters DESC,e.id DESC`,[brandId,userId,reportingThreshold]);
  return rows.map(row=>({
    id:row.id,title:row.title,product:row.product,status:row.status,supporters:row.supporters,
    score:revivalScore(row),
    recent:row.recent>=reportingThreshold?row.recent:null,
    baseline:row.baseline>=reportingThreshold?row.baseline:null,
    highIntent:row.intent_responses>=reportingThreshold&&row.high_intent>=reportingThreshold
      &&(row.intent_responses-row.high_intent===0||row.intent_responses-row.high_intent>=reportingThreshold)?row.high_intent:null,
  })).sort((a,b)=>(b.score??0)-(a.score??0)||b.supporters-a.supporters);
}

export async function uniqueBrandSupporters(brandId:string,userId:string){
  const {rows:[row]}=await db.query<{supporters:number}>(`SELECT count(DISTINCT s.user_id)::int supporters FROM campaign_supporters s
    JOIN campaigns c ON c.id=s.campaign_id JOIN products p ON p.id=c.product_id
    JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
    WHERE p.brand_id=$1 AND NOT p.demo AND p.deleted_at IS NULL AND c.rejected_at IS NULL AND c.status<>'Under moderation'`,[brandId,userId]);
  return row.supporters;
}
