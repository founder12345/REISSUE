import { db } from '@/lib/db';
import { Action,Empty } from './ui';
export async function ImportPanel({user,back,brand}:{user:string;back:string;brand?:string}){
  const fields=brand?{brand}:undefined;
  const {rows}=await db.query<{id:string;status:string;errors:string[];data:{slug:string;name:string}[]}>(`SELECT id,status,errors,data FROM import_jobs WHERE user_id=$1 AND brand_id IS NOT DISTINCT FROM $2::bigint ORDER BY id DESC LIMIT 10`,[user,brand??null]);
  return <section className="stack"><h2>Catalogue imports</h2>
    <div className="panel"><Action name="import-preview" back={back} fields={fields}>
      <label>Format<select name="format"><option value="csv">CSV with a header row</option><option value="json">JSON array</option></select></label>
      <label>Catalogue data<textarea name="data" maxLength={55000} required placeholder="slug,name,brand,category,description"/></label>
      <p className="small">Required fields are slug, name, brand, category and description. Imports are limited to 100 records.</p><button>Preview import</button>
    </Action></div>
    {rows.length?rows.map(job=><details className="panel" key={job.id}><summary>Import {job.id} · {job.status} · {job.data.length} rows · {job.errors.length} errors</summary>
      {job.errors.length>0&&<ul>{job.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>}<ul>{job.data.map(r=><li key={r.slug}>{r.name} · {r.slug}</li>)}</ul>
      {job.status==='preview'&&job.errors.length===0&&<Action name="import-commit" back={back} id={job.id} fields={fields}><button>Commit validated records</button></Action>}
    </details>):<Empty>Import previews and error reports appear here.</Empty>}
  </section>;
}
