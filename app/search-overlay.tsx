'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
type Suggestion={label:string;href:string;kind:string};
export function SearchOverlay(){
  const dialog=useRef<HTMLDialogElement>(null);
  const input=useRef<HTMLInputElement>(null);
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState('');
  const [selection,setSelection]=useState(-1);
  const [answer,setAnswer]=useState<{q:string;items:Suggestion[];total:number}|null>(null);
  const [failed,setFailed]=useState<string|null>(null);
  useEffect(()=>{
    function shortcut(event:KeyboardEvent){
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();
        if(!dialog.current?.open)dialog.current?.showModal();
        setOpen(true);
        input.current?.focus();
      }
    }
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  useEffect(()=>{
    if(!open) return;
    const ctrl=new AbortController();
    const timer=setTimeout(()=>{
      fetch('/api/suggest?q='+encodeURIComponent(q),{signal:ctrl.signal,cache:'no-store'})
        .then(r=>{if(!r.ok) throw Error('Search unavailable');return r.json();})
        .then(data=>{if(!ctrl.signal.aborted) setAnswer({q,...data});})
        .catch(()=>{if(!ctrl.signal.aborted) setFailed(q);});
    },q?180:0);
    return ()=>{clearTimeout(timer);ctrl.abort();};
  },[q,open]);
  const items=answer?.q===q?answer.items:[];
  function openSearch(){
    if(!dialog.current?.open)dialog.current?.showModal();
    setOpen(true);
    input.current?.focus();
  }
  useEffect(()=>{
    if(selection>=0)document.getElementById('suggestion-'+selection)?.scrollIntoView({block:'nearest'});
  },[selection]);
  function navigate(href:string){dialog.current?.close();router.push(href);}
  return <>
    <button type="button" className="quiet search-trigger" onClick={openSearch}><span aria-hidden="true">⌕</span> Search</button>
    <dialog ref={dialog} onClose={()=>setOpen(false)} aria-label="Search the archive">
      <form onSubmit={event=>{event.preventDefault();navigate(items[selection]?.href??'/explore?q='+encodeURIComponent(q));}}>
        <div className="overlay-head"><label className="sr-only" htmlFor="command-query">Search the archive</label>
          <input ref={input} id="command-query" placeholder="Search the archive" autoComplete="off" aria-autocomplete="list" maxLength={120} value={q}
            role="combobox" aria-expanded={items.length>0} aria-controls="suggestions" aria-activedescendant={selection>=0&&items[selection]?'suggestion-'+selection:undefined}
            onChange={event=>{setQ(event.target.value);setSelection(-1);setFailed(null);}}
            onKeyDown={event=>{
              if(!items.length)return;
              if(event.key==='ArrowDown'){event.preventDefault();setSelection((selection+1)%items.length);}
              if(event.key==='ArrowUp'){event.preventDefault();setSelection(selection<=0?items.length-1:selection-1);}
            }}/>
          <button type="button" className="quiet" onClick={()=>dialog.current?.close()}>Close</button>
        </div>
        <p className="small" role="status">{failed===q?'Suggestions unavailable. Press Enter to search.':answer?.q!==q?'Loading suggestions…':q?(answer.total?`${answer.total} matching archival products`:'No matching products. Press Enter to see search options.'):(items.length?'Recent searches or popular queries':'Try a product name, brand or reference.')}</p>
        <ul id="suggestions" role="listbox" aria-label="Search suggestions">
          {items.map((item,i)=><li id={'suggestion-'+i} role="option" aria-selected={selection===i} key={item.kind+item.href} onClick={()=>navigate(item.href)}>{item.label}<small>{item.kind}</small></li>)}
        </ul>
        <button>Search archive</button>
      </form>
    </dialog>
  </>;
}
