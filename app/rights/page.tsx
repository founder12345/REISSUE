import Link from 'next/link';
import { redirect } from 'next/navigation';
import { viewer } from '@/lib/auth';
import { asActor } from '@/lib/db';
import { Action,Empty,Notice,type Params } from '../ui';

export default async function Rights({searchParams}:{searchParams:Promise<Params>}){
  const user=await viewer();
  if(!user)redirect('/account?resume=%2Frights');
  const {rows}=await asActor(user.id,client=>client.query<{id:string;kind:string;statement:string;status:string;response:string|null}>(`SELECT id,kind,statement,status,response
    FROM rights_cases WHERE user_id=$1 ORDER BY created_at DESC`,[user.id]));
  return <div className="wrap page legal-page"><h1>Privacy requests</h1><Notice params={await searchParams}/>
    <p>Your signed-in account identifies you. We may ask for more information if we cannot confirm your identity from these details.</p>
    <p>Use your <Link href="/account#privacy">account settings</Link> for an immediate export, profile changes and deletion. Use this form for a request that needs review.</p>
    <section className="panel"><Action name="rights-file" back="/rights">
      <label>Request type<select name="kind"><option value="access">Access</option><option value="rectification">Correction</option><option value="erasure">Erasure</option><option value="portability">Portability</option><option value="restriction">Restriction</option><option value="objection">Objection</option><option value="consent">Consent withdrawal</option><option value="appeal">Appeal a moderation decision</option></select></label>
      <label>What would you like us to review?<textarea name="body" required minLength={10} maxLength={3000}/></label><button>Submit request</button>
    </Action></section>
    <section className="stack"><h2>Your requests</h2>{rows.length?rows.map(item=><article className="panel" key={item.id}><h3>{item.kind} · {item.status}</h3><p>{item.statement}</p>{item.response&&<p>Response · {item.response}</p>}</article>):<Empty>No requests filed yet.</Empty>}</section>
  </div>;
}
