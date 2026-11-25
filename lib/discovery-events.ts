import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import { consent } from './consent';
const flowId=z.uuid();
export async function searchObservation(query:string,count:number,userId:string|null){
  if(!(await consent()).analytics)return undefined;
  if(userId)await db.query('INSERT INTO member_activity_days(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
  if(!query||/@|https?:|\d[\d\s-]{7,}\d/i.test(query))return undefined;
  const id=randomUUID();
  await db.query("INSERT INTO search_events(kind,query,result_count,journey_id) VALUES('search',$1,$2,$3)",[query,count,id]);
  return id;
}
export async function recordAccountActivity(userId:string){
  if((await consent()).analytics)await db.query('INSERT INTO member_activity_days(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
}
export async function visitCampaign(campaign:string,flow:string|undefined){
  if(!flowId.safeParse(flow).success||!(await consent()).analytics)return;
  await db.query(`UPDATE search_events SET journey_campaign_id=$2,journey_viewed_at=now()
    WHERE journey_id=$1 AND journey_viewed_at IS NULL AND created_at>now()-interval '1 hour'`,[flow,campaign]);
}
export function validFlow(flow:string|undefined){
  return flowId.safeParse(flow).success?flow:undefined;
}
