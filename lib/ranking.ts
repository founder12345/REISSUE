export const weights = {
  identifier: 1000, identifierPrefix: 150, title: 300, brand: 70, titleSimilarity: 35,
  fullText: 55, phrase: 45, attributes: 24, aliases: 16, verified: 4, engagementCap: 5,
};
export const filterKeys = ['category','subcategory','brand','year','ended','decade','colour','material','availability','country','status','verification','currency'] as const;
export const numericFilters = ['minPrice','maxPrice','minDemand'] as const;
export const pageSize = 18;
export function foldQuery(input: string) {
  return input.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim().slice(0, 120);
}
export function encodeCursor(score: number, id: string) {
  return Buffer.from(JSON.stringify([score,id])).toString('base64url');
}
export function decodeCursor(cursor: string | null): [number,string] | null {
  if (!cursor || cursor.length > 128) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor,'base64url').toString());
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && Number.isFinite(v[0]) && typeof v[1] === 'string' && /^[1-9]\d{0,17}$/.test(v[1])) return [v[0],v[1]];
  } catch { return null; }
  return null;
}
