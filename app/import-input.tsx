'use client';
import { useState } from 'react';

export function ImportInput(){
  const [format,setFormat]=useState('csv');
  const [data,setData]=useState('');
  const [message,setMessage]=useState('');
  return <>
    <label>Format<select name="format" value={format} onChange={event=>setFormat(event.target.value)}><option value="csv">CSV with a header row</option><option value="json">JSON array</option></select></label>
    <label>Load a CSV or JSON file<input type="file" accept=".csv,.json" onChange={async event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      if(file.size>220000){setMessage('This file exceeds the import size limit.');return;}
      try{
        const content=await file.text();
        if(content.length>55000){setMessage('Use at most 55,000 characters per import.');return;}
        const suffix=file.name.split('.').at(-1)?.toLowerCase();
        if(suffix==='csv'||suffix==='json')setFormat(suffix);
        setData(content);setMessage('File loaded. Review the data and preview the import.');
      }catch{setMessage('This file could not be read.');}
    }}/></label>
    {message&&<p role="status">{message}</p>}
    <label>Catalogue data<textarea name="data" value={data} onChange={event=>setData(event.target.value)} maxLength={55000} required placeholder="slug,name,brand,category,description"/></label>
  </>;
}
