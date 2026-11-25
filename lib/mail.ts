import { siteOrigin } from './site';

export function mailConfigured(){
  return Boolean(process.env.MAIL_API_KEY && process.env.MAIL_FROM);
}

const escape = (value:string) => value.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));

export async function sendMail(to:string,subject:string,body:string,link?:URL){
  if(!mailConfigured())throw new Error('Transactional email is unavailable');
  const endpoint=process.env.MAIL_TEST_ENDPOINT && !process.env.VERCEL && siteOrigin().hostname==='localhost'
    ? new URL(process.env.MAIL_TEST_ENDPOINT) : new URL('https://api.resend.com/emails');
  if(endpoint.hostname!=='api.resend.com' && (endpoint.hostname!=='127.0.0.1' || endpoint.protocol!=='http:'))throw new Error('Invalid local mail endpoint');
  const text=body+(link?'\n\n'+link.href:'');
  const html=`<main style="max-width:520px;background:#f7f6f2;color:#263e32;padding:32px;font:16px/1.5 sans-serif"><strong>reissue</strong><h1>${escape(subject)}</h1><p>${escape(body)}</p>${link?`<p><a href="${escape(link.href)}">Continue on REISSUE</a></p>`:''}</main>`;
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{
    Authorization:'Bearer '+process.env.MAIL_API_KEY,'Content-Type':'application/json',
  },body:JSON.stringify({from:process.env.MAIL_FROM,to:[to],subject,text,html})});
  if(!response.ok)throw new Error('Email provider refused the service message');
}
