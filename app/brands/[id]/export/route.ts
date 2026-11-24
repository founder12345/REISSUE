import { NextResponse } from 'next/server';
import { viewer } from '@/lib/auth';
import { brandCampaigns,brandFor,csvCell } from '@/lib/brand';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const [user,{id}]=await Promise.all([viewer(),params]);
  if(!user||!await brandFor(user.id,id))return new NextResponse('Not found',{status:404});
  const rows=(await brandCampaigns(id,user.id)).filter(c=>!c.demo);
  const csv=[['Campaign','Product','Status','Registered interest','Target'],...rows.map(c=>[c.title,c.product,c.status,c.supporters,c.target])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="reissue-demand.csv"','Cache-Control':'private, no-store'}});
}
