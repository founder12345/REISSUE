'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){
  return <div className="wrap page utility-page"><h1>The page couldn’t load.</h1><p className="intro">Try again or return to the archive.</p><div className="actions"><button onClick={reset}>Try again</button><Link className="button secondary" href="/">Go home</Link></div></div>;
}
