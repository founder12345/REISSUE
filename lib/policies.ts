export const consentCookie = 'reissue_consent';
export const consentVersion = '1';
export const consentLifetime = 60 * 60 * 24 * 180;
export const termsVersion = () => process.env.TERMS_VERSION?.trim() || 'internal-draft-1';
export const optionalAnalytics = () => process.env.SEARCH_ANALYTICS === 'true';
export function registrationOpen(){
  return process.env.VERCEL_ENV !== 'production' || Boolean(process.env.LEGAL_APPROVED==='true'
    && process.env.LEGAL_OPERATOR?.trim() && process.env.LEGAL_ADDRESS?.trim()
    && process.env.LEGAL_CONTACT_EMAIL?.trim() && process.env.TERMS_VERSION?.trim()
    && process.env.TERMS_VERSION!=='internal-draft-1');
}

export function analyticsAllowed(value:string|undefined){
  return optionalAnalytics() && value===consentVersion+'.analytics';
}

export function legalStatus(){
  const operator=process.env.LEGAL_OPERATOR?.trim();
  const address=process.env.LEGAL_ADDRESS?.trim();
  const contact=process.env.LEGAL_CONTACT_EMAIL?.trim();
  const approved=Boolean(process.env.LEGAL_APPROVED==='true'&&operator&&address&&contact
    && process.env.TERMS_VERSION?.trim()&&termsVersion()!=='internal-draft-1');
  return {operator,address,contact,approved,withheld:process.env.VERCEL_ENV==='production'&&!approved};
}
