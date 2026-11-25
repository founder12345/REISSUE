import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL for the intended environment.');
const apply=process.argv.includes('--apply');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const targets=[
  ['account_tokens','expires_at < now()'],['oauth_flows','expires_at < now()'],
  ['oauth_onboarding','expires_at < now()'],['sessions','expires_at < now()'],['rate_limits','expires_at < now()'],
  ['profiles',"verification_required AND email_verified_at IS NULL AND created_at < now()-interval '2 days'"],
  ['search_events',"created_at < now()-interval '30 days'"],
];
try{
  for(const [table,condition] of targets){
    const preview=!apply?await pool.query(`SELECT count(*) FROM ${table} WHERE ${condition}`):null;
    const removed=apply?await pool.query(`DELETE FROM ${table} WHERE ${condition}`):null;
    console.log(table,preview?.rows[0].count??removed?.rowCount,apply?'removed':'eligible');
  }
}finally{await pool.end();}
