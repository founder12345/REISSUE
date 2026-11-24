'use client';
import { useState } from 'react';
export function Share(){
  const [message,setMessage]=useState('');
  return <div><button type="button" className="secondary" onClick={async()=>{
    try{
      const url=location.origin+location.pathname;
      if(navigator.share)await navigator.share({title:document.title,url});
      else {await navigator.clipboard.writeText(url);setMessage('Link copied.');}
    }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage(location.origin+location.pathname);}
  }}>Share</button>{message&&<p role="status">{message}</p>}</div>;
}
