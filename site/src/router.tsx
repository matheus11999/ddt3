import {useEffect,useState} from 'react';

/** Tiny history router: `/`, `/jogador`, `/forum`, `/forum/<id>`. */
export function navigate(path:string){if(path!==location.pathname+location.search){history.pushState(null,'',path);dispatchEvent(new PopStateEvent('popstate'));}scrollTo({top:0});}
export function useLocation(){
 const [path,setPath]=useState(()=>location.pathname+location.search);
 useEffect(()=>{const on=()=>setPath(location.pathname+location.search);addEventListener('popstate',on);return ()=>removeEventListener('popstate',on);},[]);
 return path;
}
/** Plain `<a>` that routes inside the page. */
export function Link({to,className,children,...rest}:{to:string;className?:string;children:React.ReactNode}&React.AnchorHTMLAttributes<HTMLAnchorElement>){
 return <a href={to} className={className} {...rest} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();navigate(to);}}>{children}</a>;
}
