import { db } from './db';
import { decodeCursor, encodeCursor, filterKeys, foldQuery, numericFilters, pageSize, weights } from './ranking';

export type Product = {
  id: string; slug: string; name: string; brand: string; brand_slug: string; brand_id: string;
  category: string; category_slug: string; subcategory: string|null; description: string; history: string|null;
  release_year: number|null; discontinued_year: number|null; retail_price: string|null; currency: string|null;
  availability: string; verification: string; demo: boolean; colours: string[]; materials: string[]; country: string|null;
  reference_number: string|null; model: string|null; sku: string|null;
  demand: number; momentum: number; campaign_id: string|null; campaign_status: string|null;
  image: string|null; image_alt: string|null; score: number;
};

const projection = `p.*, b.name AS brand, b.slug AS brand_slug, c.name AS category, c.slug AS category_slug,
    coalesce(d.demand,0)::int AS demand, coalesce(d.momentum,0)::int AS momentum,
    d.id AS campaign_id, d.status AS campaign_status, image.path AS image, image.alt AS image_alt`;
const catalogueFrom = `FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
  LEFT JOIN LATERAL (
    SELECT k.id,k.status,count(s.user_id) AS demand,count(s.user_id) FILTER (WHERE s.created_at>=now()-interval '7 days') AS momentum
    FROM campaigns k LEFT JOIN campaign_supporters s ON s.campaign_id=k.id
    WHERE k.product_id=p.id AND k.status NOT IN ('Under moderation','Archived','Completed','Brand declined')
    GROUP BY k.id ORDER BY k.id DESC LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (SELECT path,alt FROM product_images WHERE product_id=p.id ORDER BY id LIMIT 1) image ON true
`;

export const catalogue = `SELECT ${projection} ${catalogueFrom}`;

const columns = {
  category:'c.slug', subcategory:'p.subcategory', brand:'b.slug', year:'p.release_year',
  ended:'p.discontinued_year', decade:'(p.release_year / 10 * 10)', colour:'p.colours', material:'p.materials',
  availability:'p.availability', country:'p.country', status:'d.status', verification:'p.verification', currency:'p.currency',
};
const stopWords = new Set(['the','a','an','of','for','by','old','vintage']);
const keywords = (q: string) => (q.match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => !stopWords.has(word)).slice(0,12);

export async function search(params: URLSearchParams) {
  const raw = foldQuery(params.get('q') ?? '');
  const quoted = raw.startsWith('"') && raw.endsWith('"') && raw.length > 2;
  const q = quoted ? raw.slice(1,-1) : raw;
  const terms = keywords(q);
  const values: unknown[] = [];
  const param = (value: unknown) => {values.push(value);return '$'+values.length;};
  const qRef = param(q);
  const termRef = param(terms);
  const where = ['p.deleted_at IS NULL', `${qRef}::text IS NOT NULL`];
  for (const key of filterKeys) {
    const selected = params.getAll(key).slice(0,20).map(foldQuery).filter(Boolean);
    if (!selected.length) continue;
    const value = param(selected);
    const column = columns[key];
    where.push(key === 'colour' || key === 'material'
      ? `EXISTS(SELECT 1 FROM unnest(${column}) v WHERE archive_fold(v)=ANY(${value}::text[]))`
      : `archive_fold(${column}::text)=ANY(${value}::text[])`);
  }
  for (const key of numericFilters) {
    const entry = params.get(key);
    if (!entry || !/^\d{1,9}(\.\d{1,2})?$/.test(entry)) continue;
    where.push(`${key === 'minDemand' ? 'coalesce(d.demand,0)' : 'p.retail_price'} ${key === 'maxPrice' ? '<=' : '>='} ${param(entry)}::numeric`);
  }
  if (q) {
    where.push(quoted ? `(s.title=${qRef} OR strpos(s.document,${qRef})>0)` :
      `(s.identifiers @> ARRAY[${qRef}::text] OR s.title=${qRef} OR s.vector @@ query.strict OR s.vector @@ query.expanded OR s.title % ${qRef}
        OR s.document %> ${qRef} OR (query.minimum > 0 AND token_matches.hits >= query.minimum))`);
  }
  const relevance = `(CASE WHEN s.identifiers @> ARRAY[${qRef}::text] THEN ${weights.identifier} ELSE 0 END
    + CASE WHEN s.title=${qRef} THEN ${weights.title} ELSE 0 END
    + CASE WHEN s.brand=${qRef} THEN ${weights.brand} ELSE 0 END
    + similarity(s.title,${qRef})*${weights.titleSimilarity}
    + ts_rank_cd(s.vector,query.expanded,32)*${weights.fullText}
    + CASE WHEN strpos(s.document,${qRef})>0 THEN ${weights.phrase} ELSE 0 END
    + token_matches.hits*${weights.attributes}
    + CASE WHEN strpos(s.aliases,${qRef})>0 THEN ${weights.aliases} ELSE 0 END
    + CASE WHEN p.verification='verified' THEN ${weights.verified} ELSE 0 END
    + least(coalesce(d.demand,0),${weights.engagementCap}))`;
  const sort = params.get('sort');
  const score = sort === 'demand' ? 'coalesce(d.demand,0)' : sort === 'oldest' ? '-coalesce(p.release_year,9999)' :
    sort === 'newest' || !q ? 'extract(epoch from p.created_at)' : relevance;
  const cursor = decodeCursor(params.get('cursor'));
  const bounds = cursor ? `WHERE (score,id)<(${param(cursor[0])}::double precision,${param(cursor[1])}::bigint)` : '';
  const {rows} = await db.query<Product & {total: number|null}>(`
    WITH query AS (
      SELECT coalesce(to_tsquery('simple',nullif(string_agg(quote_literal(word)||':*',' & '),'')),plainto_tsquery('simple','')) AS strict,
        coalesce(to_tsquery('simple',nullif(string_agg('('||quote_literal(word)||':*'||
          coalesce(' | ('||replacement.query||')','')||')',' & '),'')),plainto_tsquery('simple','')) AS expanded,
        CASE WHEN count(*)=1 THEN 1 ELSE ceil(count(*)*.67) END AS minimum
      FROM unnest(${termRef}::text[]) word
      LEFT JOIN search_synonyms sn ON sn.term=word
      LEFT JOIN LATERAL (SELECT string_agg(quote_literal(part)||':*',' & ') AS query
        FROM regexp_split_to_table(archive_fold(sn.replacement),'[^[:alnum:]]+') part WHERE part<>'') replacement ON true
    ), matches AS (
      SELECT ${projection},(${score})::double precision AS score,count(*) OVER ()::int AS total
      ${catalogueFrom}
      JOIN product_search s ON s.product_id=p.id
      CROSS JOIN query
      LEFT JOIN LATERAL (
        SELECT count(*) AS hits FROM unnest(${termRef}::text[]) word
        WHERE s.vector @@ to_tsquery('simple',quote_literal(word)||':*')
          OR (length(word)>=4 AND word_similarity(word,s.document)>=.50)
      ) token_matches ON true
      WHERE ${where.join(' AND ')}
    )
    SELECT * FROM matches ${bounds} ORDER BY score DESC,id DESC LIMIT ${pageSize+1}
  `,values);
  const products=rows.slice(0,pageSize);
  const last=products.at(-1);
  return {products,total:rows[0]?.total ?? 0,next:rows.length>pageSize && last ? encodeCursor(last.score,last.id) : null};
}

export async function discovery(order: 'recent'|'requested'|'momentum'|'verified', limit = 4) {
  const sorting = {recent:'p.created_at DESC',requested:'d.demand DESC',momentum:'d.momentum DESC',verified:'p.demo ASC,p.created_at DESC'};
  const conditions = {recent:'true',requested:'d.demand>0',momentum:'d.momentum>0',verified:"p.verification='verified' OR p.demo"};
  return (await db.query<Product>(`${catalogue} WHERE p.deleted_at IS NULL AND (${conditions[order]}) ORDER BY ${sorting[order]},p.id DESC LIMIT $1`,[limit])).rows;
}
