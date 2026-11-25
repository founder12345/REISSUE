import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legalStatus } from '@/lib/policies';
import { LegalDisclosure } from '../../legal-status';

const policies={
  'legal-notice':{title:'Legal notice · Mentions légales',text:'These details identify the service operator. Hosting provider identity, contact details and any applicable registration or publication particulars must be confirmed before public launch.'},
  community:{title:'Community guidelines',text:'Share accurate catalogue information, disclose uncertainty and credit sources. Keep discussion respectful. Campaign support is non-binding and never shows a brand endorsement on its own.'},
  'acceptable-use':{title:'Acceptable use',text:'Do not impersonate a rights holder, fabricate demand, circumvent account controls, upload malicious or unlawful content, or access private information without authorisation.'},
  'intellectual-property':{title:'Intellectual property',text:'Brands, trademarks and product references belong to their rights holders. Share photos and other media only with permission or a compatible licence. Include the creator, licence and source when available.'},
  'content-reporting':{title:'Content reporting',text:'Provide the precise location, reason for the report and a contact address. A moderator reviews the issue and records the decision. Affected members can appeal from the privacy request area. For unlawful content, explain the legal or factual basis if you know it.'},
};
export default async function Policy({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!Object.hasOwn(policies,slug))notFound();
  const policy=policies[slug as keyof typeof policies];
  if(legalStatus().withheld)return <div className="wrap page legal-page"><h1>{policy.title}</h1><p>This policy is being prepared for public launch.</p></div>;
  return <div className="wrap page legal-page"><h1>{policy.title}</h1><LegalDisclosure/><p>{policy.text}</p>
    <div className="account-links"><Link href="/report-content">Report content</Link><Link href="/rights">Appeal a decision</Link><Link href="/terms">Terms of Service</Link></div></div>;
}
