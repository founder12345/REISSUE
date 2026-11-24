import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata:Metadata={title:'Terms of use draft',robots:{index:false,follow:true}};
export default function Terms(){
  return <div className="wrap page legal-page"><p className="kicker">DRAFT · REQUIRES LEGAL REVIEW BEFORE LAUNCH</p><h1>Terms of use</h1>
  <h2>The archive</h2><p>REISSUE is operated by Conditra Studio. Catalogue information may change as sources are reviewed. Demonstration records are identified in the archive.</p>
  <h2>Comeback campaigns</h2><p>Registering interest is an expression of preference. It does not place an order, reserve stock or commit you or a brand to a purchase or revival. You can withdraw your interest through the campaign page.</p>
  <h2>Community contributions</h2><p>Submit information and media you have the right to share. Use your own account and respect other members. REISSUE may review, correct, hide or remove content that is inaccurate, abusive or infringes rights.</p>
  <h2>Questions and corrections</h2><p>Send <Link href="/feedback">feedback</Link> or use the correction form on an individual record.</p></div>;
}
