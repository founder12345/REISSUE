import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor, encodeCursor, foldQuery, weights } from '../lib/ranking.ts';
import { previewImport, record } from '../lib/ingestion.ts';

test('query folding, validated cursors and identifier weighting',()=>{
  assert.equal(foldQuery('  OLYMPÜS XA  '),'olympus xa');
  assert.deepEqual(decodeCursor(encodeCursor(12.5,'123')),[12.5,'123']);
  assert.equal(decodeCursor(encodeCursor(1,'no')),null);
  assert.equal(decodeCursor('malformed'),null);
  assert.ok(weights.identifier>weights.title+weights.engagementCap);
});
test('CSV preview reports invalid and duplicate records',()=>{
  const input='slug,name,brand,category,description\nplayer,Player,sony,audio,Historic player\nplayer,Other,sony,audio,Historic player\ninvalid,Other,sony,audio,x';
  const preview=previewImport(input,'csv');
  assert.equal(preview.data.length,1);
  assert.equal(preview.errors.length,2);
  assert.match(preview.errors[0],/duplicate/);
});
test('known discontinuation requires documentation and a valid chronology',()=>{
  const valid={slug:'player',name:'Player',brand:'sony',category:'audio',description:'Historic player',availability:'discontinued',source:'https://example.com/manual'};
  assert.equal(record.safeParse(valid).success,true);
  assert.equal(record.safeParse({...valid,source:'javascript:alert(1)'}).success,false);
  assert.equal(record.safeParse({...valid,release_year:1990,discontinued_year:1980}).success,false);
  assert.equal(record.safeParse({...valid,retail_price:100}).success,false);
});


test('natural date and lifecycle intent retain explicit facets and quoted phrases',async()=>{
  const {parseArchiveQuery}=await import('../lib/ranking.ts');
  const query=parseArchiveQuery(new URLSearchParams({q:'Discontinued jacket from 2015'}));
  assert.equal(query.text,'jacket');
  assert.equal(query.filters.get('year'),'2015');
  assert.equal(query.filters.get('availability'),'discontinued');
  assert.equal(parseArchiveQuery(new URLSearchParams({q:'Walkman from the 1990s'})).filters.get('decade'),'1990');
  assert.equal(parseArchiveQuery(new URLSearchParams({q:'"jacket from 2015"'})).filters.get('year'),null);
  assert.equal(parseArchiveQuery(new URLSearchParams({q:'jacket from 2015',year:'2016'})).filters.get('year'),'2016');
});
