import { ConfirmButton } from '../../../confirm-button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { viewer } from '@/lib/auth';
import { Action,Notice,type Params } from '../../../ui';
import { storageAvailable } from '@/lib/storage';
import { CatalogueFields } from '../../../catalogue-fields';

export const dynamic='force-dynamic';
export default async function EditProduct({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const [{id},query,user]=await Promise.all([params,searchParams,viewer()]);
  if(user?.role!=='admin'||!/^[1-9]\d{0,17}$/.test(id))notFound();
  const {rows}=await db.query<Record<string,string|number|null>>(`SELECT p.id,p.name,p.slug,p.description,p.history,p.availability,p.release_year,p.discontinued_year,p.retail_price,p.currency,p.subcategory,p.model,p.reference_number,p.sku,p.country,
    array_to_string(p.colours,'|') colours,array_to_string(p.materials,'|') materials,
    (SELECT string_agg(alias,'|' ORDER BY alias) FROM product_aliases WHERE product_id=p.id) aliases,
    (SELECT url FROM product_sources WHERE product_id=p.id AND label<>'Official product link' ORDER BY url LIMIT 1) source,
    (SELECT url FROM product_sources WHERE product_id=p.id AND label='Official product link' ORDER BY url LIMIT 1) official_url,
    (SELECT string_agg(name||'='||value,'|' ORDER BY name) FROM product_attributes WHERE product_id=p.id) specifications,
    b.slug brand,c.slug category FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE p.id=$1`,[id]);
  const product=rows[0];
  if(!product)notFound();
  const back='/admin/products/'+id;
  return <div className="wrap page"><Link href="/admin" className="text-link">Back to moderation</Link><h1>Edit {product.name}</h1><Notice params={query}/>
    <section className="panel stack"><h2>Catalogue record</h2><p>Product ID {id}. Edits require fresh source verification.</p>
    <Action name="admin-edit-product" back={back} id={id}><CatalogueFields defaults={product}/><button>Save catalogue changes</button></Action></section>
    <section className="panel stack"><h2>Product photography</h2>{storageAvailable?<form className="action" action="/api/image-upload" method="post" encType="multipart/form-data">
      <input type="hidden" name="id" value={id}/><label>Authorised JPEG, PNG or WebP (up to 4 MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required/></label>
      <label>Alternative text<input name="alt" minLength={3} maxLength={220} required/></label><label>Creator, source and usage rights<textarea name="attribution" minLength={8} maxLength={800} required/></label><label>Source URL (optional)<input name="source" type="url" maxLength={1000}/></label>
      <label>Licence URL (optional)<input name="licence" type="url" maxLength={1000}/></label><button>Upload product photo</button>
    </form>:<p>Image uploads become available when private object storage is configured.</p>}</section>
    <section className="panel stack"><h2>Merge duplicate</h2><p>Move campaigns, evidence and saved references to the canonical record and hide this duplicate.</p>
    <Action name="admin-merge-product" back="/admin" id={id}><label>Canonical product ID<input name="product" inputMode="numeric" pattern="[1-9][0-9]*" required/></label><ConfirmButton secondary={false} message="Merge this record into the selected product and hide the duplicate?">Merge into canonical product</ConfirmButton></Action></section>
  </div>;
}
