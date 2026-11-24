import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const args=process.argv.slice(2).flatMap(arg=>{
  if(arg==='--strictPort')return [];
  if(arg==='--host')return ['--hostname'];
  if(arg.startsWith('--host='))return ['--hostname='+arg.slice('--host='.length)];
  return [arg];
});
const next=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev',...args],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>next.kill(signal));
next.once('error',error=>{console.error(error.message);process.exitCode=1;});
next.once('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGINT'?130:143);});
