import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SearchOverlay } from './search-overlay';
import './style.css';

export const metadata:Metadata={
  title:{default:'REISSUE — Bring back what you love',template:'%s | REISSUE'},
  description:'Explore the archive of discontinued design and rally a community to bring back what you love.',
};
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>
    <a className="skip" href="#main">Skip to content</a>
    <header className="site-header"><div className="nav wrap">
      <Link href="/" className="wordmark" aria-label="Reissue home"><Image src="/wordmark.svg" alt="" width={130} height={21} priority/></Link>
      <nav aria-label="Main navigation"><Link href="/explore">Explore</Link><Link href="/collections">Collections</Link><Link href="/campaigns">Campaigns</Link><Link href="/brands">For brands</Link></nav>
      <div className="utilities"><SearchOverlay/><Link href="/account#saved">Saved</Link><Link className="account-link" href="/account">Account</Link></div>
    </div></header>
    <main id="main">{children}</main>
    <footer className="site-footer"><div className="wrap footer-inner"><div><Link className="wordmark" href="/">REISSUE</Link><p>Bring back what you love.</p></div><div><Link href="/submit">Submit a product</Link><Link href="/brands">For brands</Link><Link href="/privacy">Privacy</Link></div><small>Conditra Studio</small></div></footer>
  </body></html>;
}
