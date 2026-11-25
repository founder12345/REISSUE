import { db } from '@/lib/db';
import { Action,Empty } from './ui';
import { ConfirmButton } from './confirm-button';
import { ImportInput } from './import-input';
export async function ImportPanel({user,back,brand}:{user:string;back:string;brand?:string}){
  const fields=brand?{brand}:undefined;
  const [jobs,registry]=await Promise.all([
    db.query<{id:string;status:string;mode:string;next_row:number;last_error:string|null;errors:string[];data:{slug:string;name:string}[]}>(`SELECT id,status,mode,next_row,last_error,errors,data FROM import_jobs WHERE user_id=$1 AND brand_id IS NOT DISTINCT FROM $2::bigint ORDER BY id DESC LIMIT 10`,[user,brand??null]),
    brand?null:db.query<{id:string;name:string}>('SELECT id,name FROM catalogue_sources ORDER BY name'),
  ]);
  return <section className="stack"><h2>Catalogue imports</h2>
    <div className="panel"><Action name="import-preview" back={back} fields={fields}>
      <label>Import mode<select name="mode"><option value="create">Add new products</option><option value="sources">Append sources to matching products</option></select></label>
      {registry&&<label>Registered source<select name="sourceId"><option value="">Internal or brand-supplied material</option>{registry.rows.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label>}
      <ImportInput/>
      <label className="check"><input name="rights" value="yes" type="checkbox" required/> I have permission to reuse the data in this import.</label>
      <p className="small">Required fields are slug, name, brand, category and description. Up to 200 records and 55,000 characters per job. New records stay hidden until the final batch is committed.</p><button>Preview import</button>
    </Action></div>
    {jobs.rows.length?jobs.rows.map(job=><details className="panel" key={job.id}><summary>Import {job.id} · {job.status} · {job.data.length} rows · {job.errors.length} errors</summary>
      {job.last_error&&<p className="notice error">{job.last_error}</p>}
      {job.status==='processing'&&<p>{job.next_row} of {job.data.length} rows staged</p>}
      {job.errors.length>0&&<ul>{job.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>}<ul>{job.data.map(r=><li key={r.slug}>{r.name} · {r.slug}</li>)}</ul>
      {['preview','processing'].includes(job.status)&&<div className="actions">
        {!job.errors.length&&<Action name="import-commit" back={back} id={job.id} fields={fields}><button>{job.status==='processing'?'Continue import':'Commit validated records'}</button></Action>}
        <Action name="import-rollback" back={back} id={job.id} fields={fields}><ConfirmButton message="Discard this import and any unpublished rows it staged?">Roll back pending import</ConfirmButton></Action>
      </div>}
    </details>):<Empty>Import previews and error reports appear here.</Empty>}
  </section>;
}
