import { legalStatus } from '@/lib/policies';
export function LegalDisclosure({fr=false}:{fr?:boolean}){
  const status=legalStatus();
  return <>
    {!status.approved&&<p className="kicker">{fr?'PROJET · VALIDATION JURIDIQUE REQUISE':'DRAFT · REQUIRES LEGAL REVIEW BEFORE LAUNCH'}</p>}
    {status.operator&&status.address&&status.contact?<dl><dt>{fr?'Exploitant':'Operator'}</dt><dd>{status.operator}</dd><dt>{fr?'Adresse':'Address'}</dt><dd>{status.address}</dd>
      <dt>Contact</dt><dd><a href={'mailto:'+status.contact}>{status.contact}</a></dd></dl>:<p className="small">{fr?'L’identité, l’adresse et le contact de l’exploitant restent à confirmer.':'The operator’s legal identity, address and contact details must be confirmed before launch.'}</p>}
  </>;
}
