import {useState} from 'react';
import type {DragEvent} from 'react';
import {ABILITIES,ABILITY_IDS,normalizeAbilityLoadout} from '../../shared/abilities';
import type {AbilityId,AbilityLoadout} from '../../shared/abilities';
import './AbilitySlots.css';

/** The room and combat HUD share the same ability order, art and descriptions. */
export function AbilitySlots({loadout,counts,active=[],disabled=false,unavailable=[],onUse,className=''}:{
 loadout?:AbilityLoadout;
 counts?:Partial<Record<AbilityId,number>>;
 active?:AbilityId[];
 disabled?:boolean;
 unavailable?:AbilityId[];
 onUse?:(id:AbilityId)=>void;
 className?:string;
}){
 return <div className={`ability-slots ${onUse?'interactive':'informative'} ${className}`} role="group" aria-label="Habilidades">
  {normalizeAbilityLoadout(loadout).map((id,index)=>{
   if(!id)return <button key={`empty-${index}`} type="button" className="ability-slot ability-empty" data-ability-slot={index} aria-label={`Espaço de habilidade ${index+1} vazio`} disabled><span aria-hidden="true">{index+1}</span></button>;
   const ability=ABILITIES.find(ability=>ability.id===id)!;
   const remaining=counts?.[ability.id]??ability.uses,armed=active.includes(ability.id);
   const description=`${ability.name}. ${ability.detail}${onUse?` ${remaining} ${remaining===1?'uso disponível':'usos disponíveis'}.`:''}`;
   return <button key={ability.id} type="button" className={`ability-slot ${armed?'ability-active':''} ${remaining===0?'ability-spent':''}`} data-ability={ability.id} data-uses={remaining} title={description} aria-label={description} aria-pressed={onUse?armed:undefined} disabled={!!onUse&&(disabled||remaining===0||unavailable.includes(ability.id))} onClick={onUse?event=>{onUse(ability.id);if(event.detail>0)event.currentTarget.blur();}:undefined}>
    <img src={`/assets/abilities/${ability.id}.png`} alt="" draggable={false}/>
    <span className="ability-use-count" aria-hidden="true">{remaining}</span>
    {armed&&<span className="ability-active-gem" aria-hidden="true"/>}
   </button>;
  })}
 </div>;
}

const ABILITY_DRAG_TYPE='application/x-brasa-ability';
/** The same placement operation handles mouse drag, touch taps and keyboard. */
export function AbilityPreparation({loadout,disabled,pending,onChange}:{loadout:AbilityLoadout;disabled:boolean;pending:boolean;onChange:(slots:AbilityLoadout)=>void}){
 const [selected,setSelected]=useState<AbilityId|null>(null),[over,setOver]=useState<number|null>(null);
 const place=(id:AbilityId,index:number)=>{
  if(disabled)return;
  const next=[...loadout] as AbilityLoadout,origin=next.indexOf(id);
  if(origin===index){setSelected(null);return;}
  if(origin>=0)next[origin]=next[index];
  next[index]=id;onChange(next);setSelected(null);setOver(null);
 };
 const remove=(index:number)=>{if(!disabled&&loadout[index]){const next=[...loadout] as AbilityLoadout;next[index]=null;onChange(next);setSelected(null);}};
 const drag=(event:DragEvent,id:AbilityId)=>{if(disabled){event.preventDefault();return;}event.dataTransfer.setData(ABILITY_DRAG_TYPE,id);event.dataTransfer.effectAllowed='move';setSelected(id);};
 const drop=(event:DragEvent,index:number)=>{event.preventDefault();setOver(null);const id=event.dataTransfer.getData(ABILITY_DRAG_TYPE);if(ABILITY_IDS.includes(id as AbilityId))place(id as AbilityId,index);};
 return <section className={`ability-preparation ${disabled?'locked':''}`} aria-label="Preparação de habilidades">
  <header><h2>Minhas ferramentas</h2><span className="preparation-state" role="status">{pending?'Aplicando…':'1 uso por habilidade'}</span></header>
  <div className="preparation-loadout" role="group" aria-label="Três habilidades ativas">{loadout.map((id,index)=>{
   const ability=ABILITIES.find(ability=>ability.id===id);
   return <button key={index} type="button" className={`preparation-slot ${id?'filled':'empty'} ${over===index?'drag-over':''} ${selected?'can-place':''}`} data-loadout-slot={index} data-loadout-ability={id??''} aria-label={`Habilidade ativa ${index+1}: ${ability?.name??'vazia'}`} title={ability?`${ability.name}. ${ability.detail} Duplo clique para retirar.`:'Selecione ou arraste uma habilidade.'} disabled={disabled} draggable={!!id&&!disabled} onDragStart={event=>{if(id)drag(event,id);}} onDragEnd={()=>setOver(null)} onDragOver={event=>{if(!disabled&&event.dataTransfer.types.includes(ABILITY_DRAG_TYPE)){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(index);}}} onDragLeave={()=>setOver(null)} onDrop={event=>drop(event,index)} onClick={()=>{if(selected)place(selected,index);else if(id)setSelected(id);}} onDoubleClick={()=>remove(index)} onKeyDown={event=>{if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove(index);}}}>
    <span className="preparation-slot-number" aria-hidden="true">{index+1}</span>{id?<img src={`/assets/abilities/${id}.png`} alt="" draggable={false}/>:<span className="preparation-slot-empty" aria-hidden="true">+</span>}
   </button>;
  })}</div>
  <div className="preparation-divider" aria-hidden="true"><i/><span>Ferramentas</span><i/></div>
  <div className="preparation-catalog" role="group" aria-label="Habilidades disponíveis">{ABILITIES.map(ability=><button key={ability.id} type="button" className={`preparation-choice ${selected===ability.id?'chosen':''}`} data-ability={ability.id} aria-label={`Selecionar ${ability.name}`} aria-pressed={selected===ability.id} title={`${ability.name}. ${ability.detail}`} disabled={disabled} draggable={!disabled} onDragStart={event=>drag(event,ability.id)} onDragEnd={()=>setOver(null)} onClick={()=>setSelected(current=>current===ability.id?null:ability.id)}><img src={`/assets/abilities/${ability.id}.png`} alt="" draggable={false}/></button>)}{[0,1,2,3].map(index=><button key={`future-${index}`} type="button" className="preparation-choice preparation-future" aria-label="Ferramenta indisponível" disabled/>)}</div>
  <p className="preparation-hint">{selected?'Escolha um espaço acima':'Arraste ou toque para preparar'}</p>
 </section>;
}
