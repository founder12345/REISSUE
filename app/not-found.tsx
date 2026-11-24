import Link from 'next/link';
export default function NotFound(){
  return <div className="wrap page utility-page"><p className="kicker">PAGE UNAVAILABLE</p><h1>This page is missing.</h1><p className="intro">The record may have moved or may no longer be public.</p><Link className="button" href="/explore">Explore the archive</Link></div>;
}
