import { asActor } from '@/lib/db';
import { viewer, limit } from '@/lib/auth';

const sections = {
  profile:'SELECT email,name,username,search_history,created_at,email_verified_at FROM profiles WHERE id=$1',
  campaigns:'SELECT id,title,description,details,status,created_at,rejection_reason FROM campaigns WHERE author_id=$1',
  avatar:"SELECT encode(avatar_bytes,'base64') AS webp_base64 FROM profiles WHERE id=$1 AND avatar_bytes IS NOT NULL",
  drafts:'SELECT id,product_id,title,proposal,variants,context,target_price,submitted_campaign_id,updated_at FROM campaign_drafts WHERE user_id=$1',
  support:'SELECT * FROM campaign_supporters WHERE user_id=$1',
  savedCampaigns:'SELECT campaign_id FROM saved_campaigns WHERE user_id=$1',
  savedProducts:'SELECT product_id FROM saved_products WHERE user_id=$1',
  savedSearches:'SELECT query,saved_at FROM saved_searches WHERE user_id=$1',
  searchHistory:'SELECT query,used_at FROM search_history WHERE user_id=$1',
  collections:'SELECT c.id,c.title,c.description,c.published,c.created_at,ARRAY(SELECT product_id FROM collection_items WHERE collection_id=c.id) products FROM collections c WHERE user_id=$1',
  comments:'SELECT id,campaign_id,body,created_at,deleted_at FROM campaign_comments WHERE user_id=$1',
  follows:'SELECT campaign_id FROM campaign_follows WHERE user_id=$1',
  followedBrands:'SELECT brand_id FROM brand_follows WHERE user_id=$1',
  submissions:'SELECT id,data,status,created_at FROM product_submissions WHERE user_id=$1',
  corrections:'SELECT id,product_id,suggestion,status FROM correction_requests WHERE user_id=$1',
  reports:'SELECT id,campaign_id,comment_id,reason,status FROM moderation_reports WHERE user_id=$1',
  alerts:'SELECT body,path,created_at,read_at FROM service_notices WHERE user_id=$1',
  campaignNotifications:'SELECT update_id,read_at FROM notifications WHERE user_id=$1',
  rights:'SELECT id,kind,target,statement,status,response,created_at,updated_at FROM rights_cases WHERE user_id=$1',
  terms:'SELECT version,accepted_at FROM terms_acceptances WHERE user_id=$1',
  brandRequests:'SELECT brand_id,evidence,status,created_at FROM brand_ownership_requests WHERE user_id=$1',
  inquiries:'SELECT kind,company,website,body,created_at,reviewed_at FROM launch_inquiries WHERE $1= (SELECT id FROM profiles WHERE email=launch_inquiries.email)',
};
export async function GET(){
  const user=await viewer();
  if(!user)return new Response('Sign in to download your data.',{status:401,headers:{'Cache-Control':'private, no-store'}});
  if(!await limit('export:'+user.id,6,600))return new Response('Try again later.',{status:429});
  const data=await asActor(user.id,async client=>{
    const output:Record<string,unknown[]>={};
    for(const [key,sql] of Object.entries(sections))output[key]=(await client.query(sql,[user.id])).rows;
    return output;
  });
  return Response.json({exportedAt:new Date().toISOString(),...data},{headers:{'Cache-Control':'private, no-store',
    'Content-Disposition':'attachment; filename="reissue-account-data.json"'}});
}
