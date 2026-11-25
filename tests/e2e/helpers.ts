import { expect,type APIRequestContext } from '@playwright/test';
export const origin='http://localhost:3210';
export const password='Comeback-archive-2026!';
export function username(email:string){return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,24);}
export async function action(request:APIRequestContext,form:Record<string,string>){
  const response=await request.post('/api/action',{form:{returnTo:'/account',...form},headers:{origin},maxRedirects:0});
  expect(response.status()).toBe(303);
  return decodeURIComponent(response.headers().location.replaceAll('+',' '));
}
export async function mailLink(email:string,purpose='verify'){
  let link:URL|undefined;
  await expect.poll(async ()=>{
    const captured=await fetch('http://127.0.0.1:3219/message?'+new URLSearchParams({email,purpose}));
    if(!captured.ok)return false;
    const data=await captured.json();
    const found=data.text.match(/http:\/\/localhost:3210\/account\/access\?[^\s]+/)?.[0];
    if(found)link=new URL(found);
    return link?.searchParams.get('purpose')===purpose;
  }).toBe(true);
  return link!;
}
export async function register(request:APIRequestContext,email:string,name:string){
  expect(await action(request,{action:'register',email,name,password,username:username(email),terms:'yes',termsVersion:'internal-draft-1'})).toContain('purpose=verify');
  const link=await mailLink(email);
  expect(await action(request,{action:'verify-email',token:link.searchParams.get('token')??'',password})).toContain('Email verified.');
}
