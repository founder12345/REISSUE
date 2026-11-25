import { brandOpportunities } from '@/lib/intelligence';
import { NextResponse } from 'next/server';
import { viewer } from '@/lib/auth';
import { brandCampaigns,brandFor,csvCell } from '@/lib/brand';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const [user,{id}]=await Promise.all([viewer(),params]);
  if(!user||!await brandFor(user.id,id))return new NextResponse('Not found',{status:404});
  const [campaigns,opportunities]=await Promise.all([brandCampaigns(id,user.id),brandOpportunities(id,user.id)]);
  const rows=campaigns.filter(c=>!c.demo);
  const scores=new Map(opportunities.map(row=>[row.id,row]));
  const csv=[['Campaign','Product','Status','Registered interest','Target','Opportunity score','Last 30 days','High intent'],...rows.map(c=>[c.title,c.product,c.status,c.supporters,c.target,scores.get(c.id)?.score,scores.get(c.id)?.recent,scores.get(c.id)?.highIntent])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="reissue-demand.csv"','Cache-Control':'private, no-store'}});
}
