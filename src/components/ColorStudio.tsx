import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Check,Eye,Hammer,LoaderCircle,Palette,PersonStanding,RotateCcw,Shirt,Trash2,X} from 'lucide-react';
import {CATALOG,SLOT_NAMES,copyBase,isCopyKey,normalizeVisibility} from '../../shared/catalog';
import type {Equipment} from '../../shared/catalog';
import {BODY_COLOR_NAMES,COLOR_PRESETS,COLOR_TICKET,EYE_PRESETS,SKIN_PRESETS,isColorSlot,normalizeHex} from '../../shared/colors';
import type {BodyColorPart} from '../../shared/colors';
import {RECOLOR_ZONES} from '../game/rig/recolorZones';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {ItemCardFrame} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import './ColorStudio.css';

export type ColorTarget={kind:'item';key:string}|{kind:'body';part:BodyColorPart};
const hexToRgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const rgbToHex=(rgb:number[])=>'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');

export function TicketIcon({size=22}:{size?:number}){return <img className="color-ticket-icon" src={COLOR_TICKET.icon} alt="" aria-hidden="true" width={size} height={size} draggable={false}/>;}

/** Paints one cosmetic copy, the skin or the eyes. Presets plus a free RGB picker; every change costs one ticket. */
export function ColorStudio({target:initial,equipment,onClose,onDone}:{target:ColorTarget;equipment:Equipment;onClose:()=>void;onDone:(message:string)=>void}){
 const state=useGame(),p=state.profile!;
 const [target,setTarget]=useState(initial);
 const current=target.kind==='item'?p.itemColors[target.key]??null:p.bodyColors[target.part]??null;
 const [draft,setDraft]=useState<string|null>(current),[hexText,setHexText]=useState(current??''),[pending,setPending]=useState(false);
 const sent=useRef<{result:typeof state.colorResult}|null>(null),applyButton=useRef<HTMLButtonElement>(null);
 const item=target.kind==='item'?CATALOG[copyBase(target.key)]:null,zone=item?RECOLOR_ZONES[item.id]:undefined;
 const tickets=p.colorTickets,locked=pending||state.status!=='online'||!!state.battle;
 const changed=draft!==current,canApply=changed&&tickets>0&&!locked;
 useEffect(()=>{setDraft(current);setHexText(current??'');},[target.kind,target.kind==='item'?target.key:target.part]);
 useEffect(()=>{
  if(!sent.current)return;
  const result=state.colorResult;
  if(result&&result!==sent.current.result){sent.current=null;setPending(false);audio.play('click');onDone(`Cor aplicada! ${result.tickets===1?'Resta 1 ticket':`Restam ${result.tickets} tickets`}.`);return;}
  if(state.error||state.status!=='online'){sent.current=null;setPending(false);}
 },[state.colorResult,state.error,state.status,onDone]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!sent.current){event.preventDefault();event.stopPropagation();onClose();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[onClose]);
 function pick(color:string|null){setDraft(color);setHexText(color??'');audio.play('click');}
 function apply(){
  if(!canApply)return;sent.current={result:state.colorResult};setPending(true);
  if(target.kind==='item')client.recolor(target.key,draft);else client.bodyColor(target.part,draft);
 }
 // The fitting shows the piece worn, with the draft color, over the current look.
 const preview:Equipment=(()=>{
  if(target.kind==='body')return {...equipment,[target.part]:draft??undefined};
  const slot=item!.slot as 'hat'|'outfit'|'hair'|'glasses',visibility=normalizeVisibility(equipment.visibility);visibility.costume=false;if(slot==='hat'||slot==='glasses')visibility[slot]=true;
  const copies={...equipment.copies};if(isCopyKey(target.key))copies[slot]=target.key;else delete copies[slot];
  return {...equipment,[slot]:item!.id,copies,visibility,colors:{...equipment.colors,[slot]:draft??undefined}};
 })();
 const presets=target.kind==='body'?(target.part==='skin'?SKIN_PRESETS:EYE_PRESETS):COLOR_PRESETS;
 const rgb=hexToRgb(draft??'#808080');
 const title=target.kind==='item'?'Trocar cor':BODY_COLOR_NAMES[target.part];
 return <div className="color-studio-layer" onPointerDown={event=>{if(event.target===event.currentTarget&&!pending)onClose();}}>
  <section className="color-studio" role="dialog" aria-modal="true" aria-label={title}>
   <header><strong>{title}</strong><button className="wood-close" aria-label="Fechar" disabled={pending} onClick={onClose}><X size={18}/></button></header>
   <div className="color-studio-body">
    <div className="color-studio-preview">
     <i className="wood-sigil" aria-hidden="true"/>
     <Avatar equipment={preview} size={250} weapon={false} animated={false}/>
     <div className="color-studio-piece">
      {item?<ItemCardFrame rarity={item.rarity} variant="detail"><ItemIcon id={item.id} size={70} color={draft??undefined}/></ItemCardFrame>
       :<ItemCardFrame rarity="common" variant="detail"><ItemIcon id={equipment.face} size={70} skin={target.kind==='body'&&target.part==='skin'?draft??undefined:equipment.skin} eyes={target.kind==='body'&&target.part==='eyes'?draft??undefined:equipment.eyes}/></ItemCardFrame>}
     </div>
    </div>
    <div className="color-studio-controls">
     {target.kind==='body'&&<nav className="color-studio-tabs" aria-label="Parte do corpo">{(['skin','eyes'] as const).map(part=><button key={part} aria-pressed={target.part===part} className={target.part===part?'active':''} disabled={pending} onClick={()=>{setTarget({kind:'body',part});audio.play('click');}}>{part==='skin'?<PersonStanding size={16}/>:<Eye size={16}/>}{part==='skin'?'Corpo':'Olhos'}</button>)}</nav>}
     {item&&<div className="color-studio-name"><b>{item.name}</b><small>{SLOT_NAMES[item.slot]}{zone?` · Muda: ${zone.label.charAt(0).toLowerCase()}${zone.label.slice(1)}`:''}</small></div>}
     {target.kind==='body'&&<div className="color-studio-name"><b>{target.part==='skin'?'Cor da pele do personagem':'Cor da íris'}</b><small>{target.part==='skin'?'Rosto, orelhas, braços e pernas':'Só a íris muda; o branco e o contorno ficam'}</small></div>}
     <div className="color-swatches" role="group" aria-label="Cores prontas">
      <button className={`color-swatch original ${draft===null?'active':''}`} aria-pressed={draft===null} title="Cor original" aria-label="Cor original" onClick={()=>pick(null)}><RotateCcw size={15}/></button>
      {presets.map(color=><button key={color} className={`color-swatch ${draft===color?'active':''}`} style={{background:color}} aria-pressed={draft===color} title={color} aria-label={`Cor ${color}`} onClick={()=>pick(color)}>{draft===color&&<Check size={14}/>}</button>)}
     </div>
     <div className="color-rgb" aria-label="Cor personalizada">
      <label className="color-rgb-picker" title="Escolher qualquer cor"><input type="color" value={draft??'#808080'} onChange={event=>{setDraft(event.target.value);setHexText(event.target.value);}} aria-label="Seletor de cor"/><Palette size={16} aria-hidden="true"/></label>
      <div className="color-rgb-sliders">
       {(['R','G','B'] as const).map((label,index)=><label key={label} data-channel={label}><span>{label}</span><input type="range" min={0} max={255} value={rgb[index]} aria-label={`Canal ${label}`} onChange={event=>{const next=[...rgb];next[index]=Number(event.target.value);const hex=rgbToHex(next);setDraft(hex);setHexText(hex);}}/><b>{rgb[index]}</b></label>)}
      </div>
      <label className="color-hex"><span>HEX</span><input value={hexText} placeholder="#rrggbb" maxLength={7} spellCheck={false} aria-label="Código da cor" onChange={event=>{const text=event.target.value.trim();setHexText(text);const hex=normalizeHex(text.startsWith('#')?text:`#${text}`);if(hex)setDraft(hex);}}/></label>
     </div>
    </div>
   </div>
   <footer>
    <span className={`color-studio-wallet ${tickets<1?'empty':''}`}><TicketIcon size={30}/><span><small>{COLOR_TICKET.name}</small><b>{tickets}</b></span></span>
    <span className="color-studio-hint" role="status">{tickets<1?'Compre Tickets de Cor na loja.':!changed?'Escolha uma cor diferente da atual.':'Cada troca gasta 1 ticket.'}</span>
    <button className="wood-quiet" disabled={pending} onClick={onClose}>Cancelar</button>
    <button ref={applyButton} className="wood-button" disabled={!canApply&&!pending} aria-busy={pending} onClick={apply}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<TicketIcon size={20}/>}{pending?'Aplicando…':'Aplicar · 1'}</button>
   </footer>
  </section>
 </div>;
}

export interface BagMenuAction {id:string;label:string;icon:ReactNode;onSelect:()=>void;danger?:boolean;disabled?:boolean;title?:string;}
export const MENU_ICONS={equip:<Shirt size={16}/>,forge:<Hammer size={16}/>,color:<Palette size={16}/>,discard:<Trash2 size={16}/>};
/** The game's own right-click menu (the browser's is suppressed in the backpack). */
export function BagContextMenu({x,y,title,actions,onClose}:{x:number;y:number;title:string;actions:BagMenuAction[];onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState({x,y});
 useLayoutEffect(()=>{const box=ref.current?.getBoundingClientRect();if(!box)return;setPosition({x:Math.max(8,Math.min(innerWidth-box.width-8,x)),y:Math.max(8,Math.min(innerHeight-box.height-8,y))});ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});},[x,y]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))onClose();};
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
   if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;event.preventDefault();
   const buttons=[...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],at=buttons.indexOf(document.activeElement as HTMLButtonElement);
   buttons[(at+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  };
  const dismiss=()=>onClose();
  window.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',key,true);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
  return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',key,true);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
 },[onClose]);
 return <div ref={ref} className="bag-context-menu" role="menu" aria-label={title} style={{left:position.x,top:position.y}} onContextMenu={event=>event.preventDefault()}>
  <strong>{title}</strong>
  {actions.map(action=><button key={action.id} role="menuitem" className={action.danger?'danger':''} disabled={action.disabled} title={action.title} onClick={()=>{onClose();action.onSelect();}}>{action.icon}<span>{action.label}</span></button>)}
 </div>;
}

/** Discarding is permanent, so it always asks first. */
export function DiscardConfirm({itemKey,onCancel,onConfirm,pending}:{itemKey:string;onCancel:()=>void;onConfirm:()=>void;pending:boolean}){
 const item=CATALOG[copyBase(itemKey)],confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{confirm.current?.focus({preventScroll:true});const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending){event.preventDefault();event.stopPropagation();onCancel();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[onCancel,pending]);
 if(!item)return null;
 return <div className="color-studio-layer" onPointerDown={event=>{if(event.target===event.currentTarget&&!pending)onCancel();}}>
  <section className="color-studio discard-confirm" role="alertdialog" aria-modal="true" aria-label="Excluir item">
   <header><strong>Excluir item</strong><button className="wood-close" aria-label="Fechar" disabled={pending} onClick={onCancel}><X size={18}/></button></header>
   <div className="discard-body">
    <ItemCardFrame rarity={item.rarity} variant="detail"><ItemIcon id={item.id} size={76}/></ItemCardFrame>
    <b>{item.name}</b>
    <p>O item some da mochila para sempre{item.slot==='weapon'?', com o fortalecimento e a composição':''}. Não dá para desfazer.</p>
   </div>
   <footer><button className="wood-quiet" disabled={pending} onClick={onCancel}>Cancelar</button><button ref={confirm} className="wood-button danger" disabled={pending} aria-busy={pending} onClick={onConfirm}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<Trash2 size={18}/>}{pending?'Excluindo…':'Excluir'}</button></footer>
  </section>
 </div>;
}
export const canRecolor=(key:string)=>{const item=CATALOG[copyBase(key)];return !!item&&isColorSlot(item.slot)&&!!RECOLOR_ZONES[item.id];};
