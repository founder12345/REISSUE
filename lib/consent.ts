import { cookies } from 'next/headers';
import { analyticsAllowed, consentCookie, consentVersion, optionalAnalytics } from './policies';

export async function consent(){
  const value=(await cookies()).get(consentCookie)?.value;
  return {
    analytics:analyticsAllowed(value),
    decided:value===consentVersion+'.necessary'||value===consentVersion+'.analytics',
    available:optionalAnalytics(),
  };
}
