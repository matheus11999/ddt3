import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Check,Eye,Hammer,LoaderCircle,Palette,PersonStanding,RotateCcw,Shirt,Trash2,Undo2,X} from 'lucide-react';
import {CATALOG,SLOT_NAMES,copyBase,equippedCopy,isCopyKey,isEmptyItem,normalizeVisibility} from '../../shared/catalog';
import type {Equipment} from '../../shared/catalog';
import {BODY_COLOR_PARTS,COLOR_PRESETS,COLOR_TICKET,EYE_PRESETS,SKIN_PRESETS,isBodyColorPart,isColorSlot,normalizeHex} from '../../shared/colors';
import type {BodyColorPart,ColorSlot} from '../../shared/colors';
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
const PART_SLOTS=['hair','hat','glasses','outfit'] as const;

export function TicketIcon({size=22}:{size?:number}){return <img className="color-ticket-icon" src={COLOR_TICKET.icon} alt="" aria-hidden="true" width={size} height={size} draggable={false}/>;}

/** Paints the worn pieces, the skin and the eyes in one window: every change shows on the preview,
 * and "Aplicar tudo" sends them together, one ticket per piece that really changed. */
export function ColorStudio({target:initial,equipment,onClose,onDone}:{target:ColorTarget;equipment:Equipment;onClose:()=>void;onDone:(message:string)=>void}){
 const state=useGame(),p=state.profile!;
 const focusKey=initial.kind==='item'?initial.key:initial.part,focusSlot=initial.kind==='item'?CATALOG[copyBase(initial.key)]?.slot:undefined;
 // The pieces on the character (the one right-clicked replaces the worn one in its slot), then skin and eyes.
 const [parts]=useState(()=>[...PART_SLOTS.map(slot=>slot===focusSlot?focusKey:equippedCopy(equipment,slot)).filter(key=>canRecolor(key)),...BODY_COLOR_PARTS]);
 const [selected,setSelected]=useState(focusKey),[drafts,setDrafts]=useState<Record<string,string|null>>({}),[hexText,setHexText]=useState<string|null>(null),[pending,setPending]=useState(false);
 const sent=useRef<{result:typeof state.colorResult}|null>(null);
 const current=(key:string)=>(isBodyColorPart(key)?p.bodyColors[key]:p.itemColors[key])??null;
 const value=(key:string)=>key in drafts?drafts[key]:current(key);
 const changes=parts.filter(key=>value(key)!==current(key)).map(target=>({target,color:value(target)}));
 const tickets=p.colorTickets,locked=pending||state.status!=='online'||!!state.battle;
 const canApply=changes.length>0&&tickets>=changes.length&&!locked;
 useEffect(()=>{
  if(!sent.current)return;
  const result=state.colorResult;
  if(result&&result!==sent.current.result){sent.current=null;setPending(false);audio.play('click');const n=result.changes.length;onDone(`${n===1?'Cor aplicada':`${n} cores aplicadas`}! ${result.tickets===1?'Resta 1 ticket':`Restam ${result.tickets} tickets`}.`);return;}
  if(state.error||state.status!=='online'){sent.current=null;setPending(false);}
 },[state.colorResult,state.error,state.status,onDone]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!sent.current){event.preventDefault();event.stopPropagation();onClose();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[onClose]);
 const draft=value(selected),shownHex=hexText??draft??'';
 function set(color:string|null,text?:string){setDrafts(old=>({...old,[selected]:color}));setHexText(text??null);}
 function pick(color:string|null){set(color);audio.play('click');}
 function select(key:string){setSelected(key);setHexText(null);audio.play('click');}
 function apply(){if(!canApply)return;sent.current={result:state.colorResult};setPending(true);client.paint(changes);}
 // The preview wears every piece of the list with its draft color.
 const preview:Equipment=(()=>{
  const visibility=normalizeVisibility(equipment.visibility),copies={...equipment.copies},colors={...equipment.colors},next:Equipment={...equipment};
  visibility.costume=false;
  for(const key of parts){
   if(isBodyColorPart(key)){next[key]=value(key)??undefined;continue;}
   const item=CATALOG[copyBase(key)],slot=item.slot as ColorSlot;
   next[slot]=item.id;if(isCopyKey(key))copies[slot]=key;else delete copies[slot];colors[slot]=value(key)??undefined;
   if(key===focusKey&&(slot==='hat'||slot==='glasses'))visibility[slot]=true;
  }
  return {...next,copies,colors,visibility};
 })();
 const icon=(key:string,size:number)=>isBodyColorPart(key)
  ?<ItemIcon id={equipment.face} size={size} skin={value('skin')??undefined} eyes={key==='eyes'?value('eyes')??undefined:equipment.eyes}/>
  :<ItemIcon id={copyBase(key)} size={size} color={value(key)??undefined}/>;
 const item=isBodyColorPart(selected)?null:CATALOG[copyBase(selected)],zone=item?RECOLOR_ZONES[item.id]:undefined;
 const presets=selected==='skin'?SKIN_PRESETS:selected==='eyes'?EYE_PRESETS:COLOR_PRESETS;
 const rgb=hexToRgb(draft??'#808080');
 const hint=locked&&!pending?'Troque as cores fora da batalha.':changes.length===0?'Escolha as cores e veja na prévia.':tickets<changes.length?`Você tem ${tickets} ${tickets===1?'ticket':'tickets'} e precisa de ${changes.length}. Compre Tickets de Cor na loja.`:`${changes.length} ${changes.length===1?'troca gasta 1 ticket':`trocas gastam ${changes.length} tickets`}.`;
 return <div className="color-studio-layer" onPointerDown={event=>{if(event.target===event.currentTarget&&!pending)onClose();}}>
  <section className="color-studio" role="dialog" aria-modal="true" aria-label="Trocar cor">
   <header><strong>Trocar cor</strong><button className="wood-close" aria-label="Fechar" disabled={pending} onClick={onClose}><X size={18}/></button></header>
   <div className="color-studio-body">
    <div className="color-studio-preview">
     <i className="color-studio-floor" aria-hidden="true"/>
     <Avatar equipment={preview} size={400} weapon={false} animated={false}/>
    </div>
    <div className="color-studio-controls">
     <nav className="color-studio-parts" aria-label="Partes do personagem">
      {[parts.filter(key=>!isBodyColorPart(key)),parts.filter(isBodyColorPart)].map((group,index)=><div key={index} className="color-part-group" data-group={index?'body':'pieces'}>
       <small>{index?'Personagem':'Visual'}</small>
       <div>{group.map(key=>{const body=isBodyColorPart(key),base=body?null:CATALOG[copyBase(key)],label=body?(key==='skin'?'Corpo':'Olhos'):SLOT_NAMES[base!.slot],edited=value(key)!==current(key);
        return <button key={key} className={`color-part ${selected===key?'active':''} ${edited?'edited':''}`} aria-pressed={selected===key} aria-label={`${label}${base?`: ${base.name}`:''}${edited?' (cor nova)':''}`} title={base?.name??(key==='skin'?'Cor do corpo':'Cor dos olhos')} disabled={pending} onClick={()=>select(key)}>
         <span className="color-part-art">{icon(key,50)}{edited&&<i className="color-part-dot" aria-hidden="true"/>}</span>
         <span className="color-part-label">{label}</span>
        </button>;})}</div>
      </div>)}
     </nav>
     <div className="color-studio-head">
      <div className="color-studio-name">
       {item?<><b>{item.name}</b><small>{zone?`Muda: ${zone.label.charAt(0).toLowerCase()}${zone.label.slice(1)}`:SLOT_NAMES[item.slot]}</small></>
        :<><b>{selected==='skin'?'Cor da pele do personagem':'Cor da íris'}</b><small>{selected==='skin'?'Rosto, orelhas, braços e pernas':'Só a íris muda; o branco e o contorno ficam'}</small></>}
      </div>
      {draft!==current(selected)&&<button className="color-studio-undo" disabled={pending} onClick={()=>{setDrafts(old=>{const next={...old};delete next[selected];return next;});setHexText(null);audio.play('click');}}><Undo2 size={15}/>Desfazer</button>}
     </div>
     <section className="color-studio-section">
      <h3>Cores prontas</h3>
      <div className="color-swatches" role="group" aria-label="Cores prontas">
       <button className={`color-swatch original ${draft===null?'active':''}`} aria-pressed={draft===null} title="Cor original" aria-label="Cor original" disabled={pending} onClick={()=>pick(null)}><RotateCcw size={15}/></button>
       {presets.map(color=><button key={color} className={`color-swatch ${draft===color?'active':''}`} style={{background:color}} aria-pressed={draft===color} title={color} aria-label={`Cor ${color}`} disabled={pending} onClick={()=>pick(color)}>{draft===color&&<Check size={14}/>}</button>)}
      </div>
     </section>
     <section className="color-studio-section">
      <h3>Cor personalizada</h3>
      <div className="color-rgb" aria-label="Cor personalizada">
       <label className="color-rgb-picker" title="Escolher qualquer cor" style={{background:draft??'#808080'}}><input type="color" value={draft??'#808080'} disabled={pending} onChange={event=>set(event.target.value)} aria-label="Seletor de cor"/><Palette size={18} aria-hidden="true"/></label>
       <div className="color-rgb-sliders">
        {(['R','G','B'] as const).map((label,index)=><label key={label} data-channel={label}><span>{label}</span><input type="range" min={0} max={255} value={rgb[index]} disabled={pending} aria-label={`Canal ${label}`} onChange={event=>{const next=[...rgb];next[index]=Number(event.target.value);set(rgbToHex(next));}}/><b>{rgb[index]}</b></label>)}
       </div>
       <label className="color-hex"><span>HEX</span><input value={shownHex} placeholder="#rrggbb" maxLength={7} spellCheck={false} disabled={pending} aria-label="Código da cor" onChange={event=>{const text=event.target.value.trim(),hex=normalizeHex(text.startsWith('#')?text:`#${text}`);if(hex)set(hex,text);else setHexText(text);}}/></label>
      </div>
     </section>
    </div>
   </div>
   <footer>
    <span className={`color-studio-wallet ${tickets<Math.max(1,changes.length)?'empty':''}`}><TicketIcon size={30}/><span><small>{COLOR_TICKET.name}</small><b>{tickets}</b></span></span>
    <span className="color-studio-hint" role="status">{hint}</span>
    <button className="wood-quiet" disabled={pending} onClick={onClose}>Cancelar</button>
    <button className="wood-button" disabled={!canApply&&!pending} aria-busy={pending} onClick={apply}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<TicketIcon size={20}/>}{pending?'Aplicando…':`Aplicar tudo · ${changes.length}`}</button>
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
export const canRecolor=(key:string)=>{const item=CATALOG[copyBase(key)];return !!item&&!isEmptyItem(item)&&isColorSlot(item.slot)&&!!RECOLOR_ZONES[item.id];};
