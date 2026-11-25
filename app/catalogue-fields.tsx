import { db } from '@/lib/db';
export async function CatalogueFields({defaults={}}:{defaults?:Record<string,string|number|null|undefined>}){
  const [brands,categories]=await Promise.all([
    db.query<{slug:string;name:string}>('SELECT slug,name FROM brands ORDER BY name'),
    db.query<{slug:string;name:string}>('SELECT slug,name FROM categories ORDER BY name'),
  ]);
  return <>
    <label>Product name<input name="name" defaultValue={defaults.name??undefined} required maxLength={140}/></label><label>Archive slug<input name="slug" defaultValue={defaults.slug??undefined} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="example-product"/></label>
    <div className="split"><label>Brand<select name="brand" defaultValue={defaults.brand??undefined} required><option value="">Choose a brand</option>{brands.rows.map(b=><option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label><label>Category<select name="category" defaultValue={defaults.category??undefined} required><option value="">Choose a category</option>{categories.rows.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
      <label>Model<input name="model" defaultValue={defaults.model??undefined}/></label><label>Reference number<input name="reference_number" defaultValue={defaults.reference_number??undefined}/></label><label>SKU<input name="sku" defaultValue={defaults.sku??undefined}/></label><label>Subcategory<input name="subcategory" defaultValue={defaults.subcategory??undefined}/></label><label>Release year<input name="release_year" defaultValue={defaults.release_year??undefined} type="number" min="1000" max="2100"/></label><label>Discontinuation year<input name="discontinued_year" defaultValue={defaults.discontinued_year??undefined} type="number" min="1000" max="2100"/></label><label>Original retail price<input name="retail_price" defaultValue={defaults.retail_price??undefined} type="number" min="0" step=".01"/></label><label>Currency code<input name="currency" defaultValue={defaults.currency??undefined} maxLength={3}/></label>
      <label>Colours (separated by |)<input name="colours" defaultValue={defaults.colours??undefined}/></label><label>Materials (separated by |)<input name="materials" defaultValue={defaults.materials??undefined}/></label><label>Alternative names (separated by |)<input name="aliases" defaultValue={defaults.aliases??undefined}/></label><label>Country of origin<input name="country" defaultValue={defaults.country??undefined}/></label>
      <label>Availability<select name="availability" defaultValue={defaults.availability??undefined}><option value="unknown">Unknown</option><option value="discontinued">Discontinued</option></select></label><label>Source URL<input name="source" defaultValue={defaults.source??undefined} type="url"/></label>
      <label>Official product URL<input name="official_url" type="url" defaultValue={defaults.official_url??undefined}/></label>
      <label>Variants (separated by |)<input name="variants" defaultValue={defaults.variants??undefined}/></label>
      <label>Specifications (name=value separated by |)<input name="specifications" defaultValue={defaults.specifications??undefined}/></label>
    </div><label>Description<textarea name="description" defaultValue={defaults.description??undefined} minLength={5} maxLength={5000} required/></label><label>Product history<textarea name="history" defaultValue={defaults.history??undefined} maxLength={5000}/></label>
  </>;
}
