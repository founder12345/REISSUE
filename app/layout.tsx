import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SearchOverlay } from './search-overlay';
import { siteOrigin } from '@/lib/site';
import './style.css';

export const metadata:Metadata={
  title:{default:'REISSUE — Bring back what you love',template:'%s | REISSUE'},
  metadataBase:siteOrigin(),
  openGraph:{type:'website',siteName:'REISSUE',images:[{url:'/social.webp',width:1200,height:630,alt:'REISSUE'}]},
  twitter:{card:'summary_large_image',images:['/social.webp']},
  description:'Explore the archive of discontinued design and rally a community to bring back what you love.',
};
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>
    <a className="skip" href="#main">Skip to content</a>
    <header className="site-header"><div className="nav wrap">
      <Link prefetch={false} href="/" className="wordmark" aria-label="Reissue home"><Image src="/wordmark.svg" alt="" width={138} height={27} priority/></Link>
      <nav aria-label="Main navigation"><Link prefetch={false} href="/explore">Explore</Link><Link prefetch={false} href="/collections">Collections</Link><Link prefetch={false} href="/campaigns">Campaigns</Link><Link prefetch={false} href="/brands">For brands</Link></nav>
      <div className="utilities"><SearchOverlay/><Link prefetch={false} href="/account#saved">Saved</Link><Link prefetch={false} className="account-link" href="/account">Account</Link></div>
    </div></header>
    <main id="main">{children}</main>
    <footer className="site-footer"><div className="wrap footer-inner"><div><Link prefetch={false} className="wordmark" aria-label="Reissue home" href="/"><Image src="/wordmark.svg" alt="" width={125} height={25}/></Link><p>Bring back what you love.</p></div><div><Link prefetch={false} href="/submit">Submit a product</Link><Link prefetch={false} href="/brands">For brands</Link><Link prefetch={false} href="/privacy">Privacy</Link><Link prefetch={false} href="/terms">Terms</Link><Link prefetch={false} href="/feedback">Feedback</Link></div><small>Conditra Studio</small></div></footer>
  </body></html>;
}
