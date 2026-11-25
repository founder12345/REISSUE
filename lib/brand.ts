import { db } from './db';
export async function brandFor(user:string,id:string){
  if(!/^[1-9]\d{0,17}$/.test(id))return null;
  const {rows}=await db.query<{id:string;slug:string;name:string}>('SELECT b.id,b.name,b.slug FROM brands b JOIN brand_members m ON m.brand_id=b.id WHERE b.id=$1 AND m.user_id=$2',[id,user]);
  return rows[0]??null;
}
export async function brandCampaigns(id:string,user:string){
  return (await db.query<{id:string;title:string;status:string;product:string;supporters:number;target:number;demo:boolean}>(`SELECT c.id,c.title,c.status,p.name AS product,p.demo,c.target,count(s.user_id)::int supporters
    FROM campaigns c JOIN products p ON p.id=c.product_id JOIN brand_members m ON m.brand_id=p.brand_id AND m.user_id=$2
    LEFT JOIN campaign_supporters s ON s.campaign_id=c.id
    WHERE p.brand_id=$1 AND p.deleted_at IS NULL AND c.status<>'Under moderation' AND c.rejected_at IS NULL
    GROUP BY c.id,p.id ORDER BY supporters DESC,c.id DESC`,[id,user])).rows;
}
export function csvCell(value:unknown){
  const raw=String(value??'');
  return '"'+(/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/u.test(raw)?"'"+raw:raw).replaceAll('"','""')+'"';
}
