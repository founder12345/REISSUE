import type { Metadata } from 'next';
import Link from 'next/link';
import { legalStatus,termsVersion } from '@/lib/policies';
import { LegalDisclosure } from '../legal-status';

export const metadata:Metadata={title:'Terms of Service',robots:{index:false,follow:true}};
export default function Terms(){
  if(legalStatus().withheld)return <div className="wrap page legal-page"><h1>Terms of Service</h1><p>Public onboarding is closed while the operator finalises the terms.</p></div>;
  return <div className="wrap page legal-page"><h1>Terms of Service</h1><LegalDisclosure/><p className="small">Version {termsVersion()}</p>
    <h2>The archive</h2><p>REISSUE helps people discover archival products and express demand for a revival. Catalogue information can change as sources are reviewed. Brands listed in the archive are not automatically affiliated with REISSUE.</p>
    <h2>Comeback campaigns</h2><p>Supporting a campaign is non-binding. It does not place an order, reserve stock or guarantee a revival. REISSUE does not process purchases or payments.</p>
    <h2>Contributing</h2><p>Submit accurate information and only content you have permission to share. Trademarks and product references belong to their respective rights holders. We may restrict or remove content that breaches the rules.</p>
    <h2>Reports and appeals</h2><p>See the <Link href="/policies/community">community guidelines</Link>, <Link href="/policies/acceptable-use">acceptable use policy</Link>, <Link href="/policies/intellectual-property">intellectual property policy</Link> and <Link href="/policies/content-reporting">content reporting policy</Link>.</p>
  </div>;
}
