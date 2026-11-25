import { readFile } from 'node:fs/promises';
const cases=JSON.parse(await readFile(new URL('../tests/search/queries.json',import.meta.url),'utf8'));
const origin=process.env.SEARCH_TEST_ORIGIN??'http://localhost:3210';
const repeats=Number(process.env.SEARCH_TEST_REPEATS??1);
const concurrency=Number(process.env.SEARCH_TEST_CONCURRENCY??1);
if(!Number.isInteger(repeats)||repeats<1||!Number.isInteger(concurrency)||concurrency<1)throw Error('Set positive integer benchmark settings.');
async function run({query,expected}){
  const url=new URL('/api/suggest',origin);
  url.searchParams.set('q',query);
  const start=performance.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(response.status+' for '+query);
  const data=await response.json();
  const elapsed=performance.now()-start;
  const slugs=data.items.filter(item=>item.kind==='Product').map(item=>item.href.split('/').at(-1));
  const rank=expected===null?Number(slugs.length===0):slugs.indexOf(expected)+1;
  return {query,expected,actual:slugs[0]??null,rank,elapsed};
}
await run(cases[0]);
const queue=Array.from({length:repeats},()=>cases).flat();
const results=[];
let index=0;
await Promise.all(Array.from({length:concurrency},async ()=>{
  while(index<queue.length)results.push(await run(queue[index++]));
}));
const times=results.map(row=>row.elapsed).sort((a,b)=>a-b);
const at=p=>Number(times[Math.ceil(p*times.length)-1].toFixed(1));
const first=results.filter(row=>row.rank===1).length;
const top5=results.filter(row=>row.rank>0).length;
const percent=count=>Number((100*count/results.length).toFixed(2));
const errors=results.filter(row=>row.rank!==1).slice(0,30).map(({query,expected,actual,rank})=>({query,expected,actual,rank}));
console.log(JSON.stringify({
  cases:cases.length,requests:results.length,concurrency,top1:percent(first),top5:percent(top5),
  p50Ms:at(.5),p95Ms:at(.95),p99Ms:at(.99),maxMs:at(1),errors,
},null,2));
if(first!==results.length&&!process.argv.includes('--latency-only'))process.exitCode=1;
