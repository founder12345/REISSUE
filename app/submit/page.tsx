import { Action,Notice,type Params } from '../ui';
import { CatalogueFields } from '../catalogue-fields';
export const dynamic='force-dynamic';
export default async function Submit({searchParams}:{searchParams:Promise<Params>}){
  return <div className="wrap page"><h1>Submit an archival product</h1><p className="intro">Add independently sourced information for moderation. Once approved, the product can be used for a comeback campaign.</p><Notice params={await searchParams}/><div className="panel"><Action name="submit-product" back="/submit"><CatalogueFields/><button>Submit product for review</button></Action></div></div>;
}
