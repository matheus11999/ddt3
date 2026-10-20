import {useState} from 'react';
import type {CSSProperties,MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {Crown} from 'lucide-react';
import {FISH_BY_ID,fishRarity,weightShare} from '../../shared/fishing';
import type {BagFish,Fish} from '../../shared/fishing';
import {FishingIcon} from './FishingIcon';

export const kg=(n:number)=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
/** How heavy a fish is for its kind, in words (the exact share stays hidden). */
export function weightClass(fish:Pick<Fish,'minKg'|'maxKg'>,weight:number){
 const s=weightShare(fish,weight);
 return s>=.8?{id:'trophy',name:'Troféu'}:s>=.45?{id:'heavy',name:'Pesado'}:s>=.15?{id:'medium',name:'Médio'}:{id:'light',name:'Leve'};
}
function ago(at:number){const m=Math.max(0,Math.round((Date.now()-at)/60000));return m<1?'agora':m<60?`há ${m} min`:m<1440?`há ${Math.round(m/60)} h`:`há ${Math.round(m/1440)} d`;}

/** One fish of the Sacola: the fish over its rarity colour, its weight and what it sells for. */
export function BagFishCard({item,record,selected,onClick,onHover,size=44}:{item:BagFish;record?:boolean;selected?:boolean;onClick?:(e:MouseEvent)=>void;onHover?:{onMouseEnter:(e:MouseEvent)=>void;onMouseLeave:()=>void};size?:number}){
 const fish=FISH_BY_ID.get(item.fish)!,r=fishRarity(fish),w=weightClass(fish,item.kg);
 const Tag=onClick?'button':'div';
 return <Tag type={onClick?'button':undefined} className={`fish-card rarity-${r.id} weight-${w.id} ${selected?'selected':''}`} style={{'--rarity':r.color} as CSSProperties}
  onClick={onClick} aria-pressed={onClick?!!selected:undefined} aria-label={`${fish.name}, ${kg(item.kg)} kg, vale ${item.value} pontos`} {...onHover}>
  <FishingIcon id={fish.id} size={size}/>
  {record&&<i className="fish-card-record" title="Recorde desta espécie"><Crown size={11}/></i>}
  {selected&&<i className="fish-card-check" aria-hidden>✓</i>}
  <span className="fish-card-kg">{kg(item.kg)} kg</span>
  <span className="fish-card-value"><FishingIcon id="fishing-points" size={12}/>{item.value.toLocaleString('pt-BR')}</span>
 </Tag>;
}

/** The fish's card on hover: name, rarity, weight (with how heavy it is for its kind) and value. */
function FishInfo({item,record}:{item:BagFish;record:boolean}){
 const fish=FISH_BY_ID.get(item.fish)!,r=fishRarity(fish),w=weightClass(fish,item.kg),share=weightShare(fish,item.kg);
 return <div className="fish-info" style={{'--rarity':r.color} as CSSProperties}>
  <header><span className="fish-info-art"><FishingIcon id={fish.id} size={46}/></span><div><b>{fish.name}</b><em>{r.name}</em></div></header>
  <dl>
   <div><dt>Peso</dt><dd>{kg(item.kg)} kg <small className={`weight-${w.id}`}>{w.name}</small></dd></div>
   <div className="fish-info-scale" aria-hidden><span>{kg(fish.minKg)}</span><i><b style={{width:`${Math.max(3,share*100)}%`}}/></i><span>{kg(fish.maxKg)}</span></div>
   <div><dt>Vende por</dt><dd className="fish-info-value"><FishingIcon id="fishing-points" size={14}/>{item.value.toLocaleString('pt-BR')} {item.value===1?'ponto':'pontos'}</dd></div>
  </dl>
  <small>{record?'Seu recorde desta espécie · ':''}{item.auto?'Pescado no automático · ':''}{ago(item.at)}</small>
 </div>;
}
/** Hover card for fish (Sacola and Vender): `handlers(item,record)` for each card, `node` once in the window. */
export function useFishTip(){
 const [tip,setTip]=useState<{item:BagFish;record:boolean;x:number;left:number;y:number}|null>(null);
 const handlers=(item:BagFish,record:boolean)=>({
  onMouseEnter:(e:MouseEvent)=>{const b=(e.currentTarget as HTMLElement).getBoundingClientRect();setTip({item,record,x:b.right+8,left:b.left,y:b.top});},
  onMouseLeave:()=>setTip(null),
 });
 const style:CSSProperties|undefined=tip?{left:tip.x+250>window.innerWidth?Math.max(8,tip.left-258):tip.x,top:Math.max(8,Math.min(tip.y,window.innerHeight-210))}:undefined;
 const node=tip?createPortal(<div className="rod-tip fish-tip" style={style}><FishInfo item={tip.item} record={tip.record}/></div>,document.body):null;
 return {handlers,node,clear:()=>setTip(null)};
}
