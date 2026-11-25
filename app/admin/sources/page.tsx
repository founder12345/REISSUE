import Link from 'next/link';
import { notFound } from 'next/navigation';
import { viewer } from '@/lib/auth';
import { db } from '@/lib/db';
import { Action,Empty,Notice,type Params } from '../../ui';

export default async function Sources({searchParams}:{searchParams:Promise<Params>}){
  const user=await viewer();
  if(user?.role!=='admin')notFound();
  const {rows}=await db.query<{id:string;name:string;kind:string;source_url:string;permission:string;restrictions:string;retrieved:string}>(`SELECT id,name,kind,source_url,permission,restrictions,retrieved_on::text retrieved
    FROM catalogue_sources ORDER BY id DESC LIMIT 100`);
  return <div className="wrap page legal-page"><Link className="text-link" href="/admin">Archive moderation</Link>
    <h1>Catalogue sources</h1><Notice params={await searchParams}/>
    <section className="panel"><Action name="register-catalogue-source" back="/admin/sources">
      <label>Source name<input name="name" required maxLength={140}/></label>
      <label>Source type<select name="kind"><option value="brand">Brand-supplied</option><option value="licensed_dataset">Licensed dataset</option><option value="authorized_api">Authorised API</option><option value="historical_catalogue">Historical catalogue</option><option value="manual_research">Manual research</option></select></label>
      <label>Source URL<input name="source" type="url" required maxLength={1000}/></label>
      <label>Retrieved on<input name="retrieved" type="date" required/></label>
      <label>Licence or written permission<textarea name="permission" required minLength={8} maxLength={1800}/></label>
      <label>Restrictions, attribution and renewal conditions<textarea name="restrictions" maxLength={1800}/></label>
      <button>Register source</button>
    </Action></section>
    <section className="stack"><h2>Registered sources</h2>{rows.length?rows.map(s=><article className="panel" key={s.id}>
      <h3>{s.name}</h3><p>{s.kind.replaceAll('_',' ')} · Retrieved {s.retrieved}</p><p>{s.permission}</p>{s.restrictions&&<p>{s.restrictions}</p>}
      <a className="text-link" href={s.source_url}>View source</a>
    </article>):<Empty>No catalogue sources registered yet.</Empty>}</section>
  </div>;
}
