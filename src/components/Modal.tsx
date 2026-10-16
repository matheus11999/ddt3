import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,subtitle,children,onClose,className=''}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void;className?:string}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.focus();const trap=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};ref.current?.addEventListener('keydown',trap);return()=>{ref.current?.removeEventListener('keydown',trap);previous?.focus();};},[onClose]);
 return <div className="modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`game-window ${className}`}><header className="window-header"><div><h1>{title}</h1>{subtitle&&<span>{subtitle}</span>}</div><button className="close-button" aria-label="Fechar" onClick={onClose}><X size={23}/></button></header>{children}</div></div>;
}
