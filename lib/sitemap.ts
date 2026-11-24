import type { db } from './db';
export const sitemapPageSize=25000;
export async function sitemapPages(connection:Pick<typeof db,'query'>){
  const {rows}=await connection.query<{batch:string}>(`SELECT DISTINCT ((id-1)/${sitemapPageSize})::text AS batch FROM products WHERE NOT demo AND verification='verified' AND deleted_at IS NULL`);
  return [...new Set([0,...rows.map(row=>Number(row.batch))])].sort((a,b)=>a-b);
}
