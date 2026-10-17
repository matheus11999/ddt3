import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import './MenuFrame.css';
import {useMobileOrientation} from './MobileOrientation';
export function Modal({title,subtitle,children,onClose,className='',viewport=false}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void;className?:string;viewport?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 const {mobile}=useMobileOrientation();
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width: 700px)'),change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,element=ref.current;element?.focus();
  const trap=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.stopPropagation();onClose();}
   if(e.key==='Tab'){
    const nodes=[...element!.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length>0),first=nodes[0],last=nodes.at(-1);
    if(!first){e.preventDefault();return;}
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===element)){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===element)){e.preventDefault();first.focus();}
   }
  };
  element?.addEventListener('keydown',trap);
  return()=>{element?.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
 },[onClose,compact]);
 const content=<div className="modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`game-window menu-frame ${className}`}><header className="window-header"><div><h1>{title}</h1>{subtitle&&<span>{subtitle}</span>}</div><button className="close-button" aria-label="Fechar" onClick={onClose}><X size={23}/></button></header>{children}</div></div>;
 return compact||viewport||mobile?createPortal(<div className={`compact-modal-layer ${viewport?'inventory-modal-layer':''}`}>{content}</div>,document.body):content;
}
