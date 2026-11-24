import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/search';

export type Params=Record<string,string|string[]|undefined>;
export const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export function queryParams(params:Params){
  const output=new URLSearchParams();
  for(const [key,value] of Object.entries(params)) for(const item of Array.isArray(value)?value:value===undefined?[]:[value])output.append(key,item);
  return output;
}
export function Notice({params}:{params:Params}){
  const error=first(params.error);
  const notice=first(params.notice);
  return error||notice?<p className={error?'notice error':'notice'} role={error?'alert':'status'}>{error??notice}</p>:null;
}
export function Action({name,back,id,enabled,children,fields}:{name:string;back:string;id?:string;enabled?:boolean;children:React.ReactNode;fields?:Record<string,string>}){
  return <form className="action" action="/api/action" method="post">
    <input type="hidden" name="action" value={name}/><input type="hidden" name="returnTo" value={back}/>
    {id&&<input type="hidden" name="id" value={id}/>}
    {enabled!==undefined&&<input type="hidden" name="enabled" value={String(enabled)}/>}
    {fields&&Object.entries(fields).map(([key,value])=><input type="hidden" name={key} value={value} key={key}/>)}
    {children}
  </form>;
}
export function ProductVisual({product,featured=false}:{product:Pick<Product,'slug'|'category_slug'|'image'|'image_alt'|'name'|'demo'>;featured?:boolean}){
  const icons:Record<string,string>={technology:'◉',audio:'▣',photography:'◎','design-objects':'▦',watches:'◫',outdoor:'▲'};
  return <div className={'product-visual tone-'+product.category_slug}>
    {product.image?.startsWith('/')&&!product.image.startsWith('//')?<Image src={product.image} alt={product.image_alt??product.name} fill loading={featured?'eager':'lazy'} fetchPriority={featured?'high':undefined} sizes={featured?'(max-width: 800px) 100vw, 50vw':'(max-width: 800px) 50vw, 360px'}/>:<span aria-hidden="true">{icons[product.category_slug]??'◇'}</span>}
    {product.demo&&<small>Demo catalogue</small>}
  </div>;
}
function Highlight({value,q}:{value:string;q?:string}){
  const term=q?.replaceAll('"','').trim();
  if(!term)return value;
  const index=value.toLowerCase().indexOf(term.toLowerCase());
  return index<0?value:<>{value.slice(0,index)}<mark>{value.slice(index,index+term.length)}</mark>{value.slice(index+term.length)}</>;
}
export function ProductGrid({products,q}:{products:Product[];q?:string}){
  return <div className="product-grid">{products.map(p=><Link className="product-card" prefetch={false} key={p.id} href={'/products/'+p.slug+(q?'?from=search':'')}>
    <ProductVisual product={p}/><div className="card-meta"><span>{p.brand}</span><span>{p.release_year??'Year unknown'}</span></div>
    <h3><Highlight value={p.name} q={q}/></h3><p>{p.category}{p.demand>0?' · '+p.demand+' interested':''}</p>
  </Link>)}</div>;
}
export function Empty({children}:{children:React.ReactNode}){return <p className="empty">{children}</p>;}
