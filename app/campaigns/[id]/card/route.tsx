import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[1-9]\d{0,17}$/.test(id))return new Response(null,{status:404});
  const {rows:[card]}=await db.query<{title:string;brand:string;demo:boolean;supporters:number}>(`
    SELECT c.title,b.name brand,p.demo,
      (SELECT count(*)::int FROM campaign_supporters WHERE campaign_id=c.id) supporters
    FROM campaigns c JOIN products p ON p.id=c.product_id JOIN brands b ON b.id=p.brand_id
    WHERE c.id=$1 AND p.deleted_at IS NULL AND c.rejected_at IS NULL AND c.status NOT IN ('Under moderation','Archived')`,[id]);
  if(!card)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const title=card.title.length>105?card.title.slice(0,102)+'…':card.title;
  return new ImageResponse(
    <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:'100%',height:'100%',background:'#263E32',color:'#F7F6F2',padding:'56px 68px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}>
        <span style={{fontSize:52,fontWeight:700,letterSpacing:'-3px'}}>reissue</span>
        <span style={{fontSize:23,color:'#DCE5D5'}}>{card.demo?'DEMO CAMPAIGN':'COMEBACK CAMPAIGN'}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <span style={{fontSize:28,color:'#DCE5D5'}}>{card.brand}</span>
        <strong style={{fontSize:title.length>72?48:66,lineHeight:1.07}}>{title}</strong>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:25}}>
        <span>Help bring this product back.</span>
        <span style={{color:'#DCE5D5'}}>{!card.demo&&card.supporters>0?card.supporters+' registered interest':'Non-binding interest'}</span>
      </div>
    </div>,
    {width:1200,height:630,headers:{'Cache-Control':'no-store'}},
  );
}
