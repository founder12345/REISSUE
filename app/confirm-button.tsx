'use client';
export function ConfirmButton({children,message,secondary=true}:{children:React.ReactNode;message:string;secondary?:boolean}){
  return <button type="submit" className={secondary?'secondary':undefined} onClick={event=>{
    if(!window.confirm(message))event.preventDefault();
  }}>{children}</button>;
}
