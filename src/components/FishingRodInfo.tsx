import {useState} from 'react';
import type {CSSProperties,MouseEvent,ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {FISHING_RODS,FISHING_SHOP,ROD_MARK_TOP} from '../../shared/fishing';
import type {FishingRod} from '../../shared/fishing';
import {FishingIcon} from './FishingIcon';
import {PrizeArt} from './FishingHud';

/** Fisher level each rod asks for in the Casa de Pesca (the Bamboo is the starter). */
export const ROD_LEVEL=new Map(FISHING_SHOP.flatMap(o=>o.prize.kind==='rod'?[[o.prize.rod,o.level??1] as const]:[]));
const best=(f:(r:FishingRod)=>number)=>Math.max(...FISHING_RODS.map(f))||1;
const dropOf=(rod:FishingRod,kind:'gold'|'coupons'|'fragment')=>rod.drops?.find(d=>d.kind===kind);
/** How much of each a rod gives, from 0 (never) to 5 marks (prizes against ROD_MARK_TOP, the rest against the best rod): no numbers (pedido do matheus). */
export function rodMarks(rod:FishingRod){
 const scale=(v:number,top:number)=>v<=0?0:Math.max(1,Math.min(5,Math.round(v/top*5)));
 const gold=(r:FishingRod)=>{const d=dropOf(r,'gold');return d&&d.kind==='gold'?d.chance*(d.min+d.max)/2:0;};
 const chance=(r:FishingRod,kind:'coupons'|'fragment')=>dropOf(r,kind)?.chance??0;
 return {
  rare:1+scale(rod.luck,best(r=>r.luck))*.8,control:1+scale(rod.control,best(r=>r.control))*.8,auto:1+scale(rod.auto,best(r=>r.auto))*.8,
  gold:scale(gold(rod),ROD_MARK_TOP.gold),coupons:scale(chance(rod,'coupons'),ROD_MARK_TOP.coupons),fragments:scale(chance(rod,'fragment'),ROD_MARK_TOP.fragments),
 };
}
function Marks({value}:{value:number}){
 const n=Math.round(value);
 return n?<span className="rod-marks" aria-label={`${n} de 5`}>{Array.from({length:5},(_,i)=><i key={i} className={i<n?'on':''}/>)}</span>:<span className="rod-none">Não dá</span>;
}
/** The rod's card: name, what it is, and how good it is at each thing, in marks. */
export function RodInfo({rod,owned,using,level}:{rod:FishingRod;owned:boolean;using:boolean;level:number}){
 const m=rodMarks(rod),need=ROD_LEVEL.get(rod.id)??1;
 const row=(label:ReactNode,value:number)=><li><span>{label}</span><Marks value={value}/></li>;
 return <div className="rod-info">
  <header><span className="rod-info-art"><FishingIcon id={rod.id} size={52}/></span><div><b>{rod.name}</b>{using?<em className="using">Em uso</em>:owned?<em>Na sacola</em>:<em className={level>=need?'ready':'locked'}>{level>=need?'Nas Trocas':`Pescador Nv. ${need}`}</em>}</div></header>
  <p>{rod.description}</p>
  <h4>Peixes</h4>
  <ul>{row('Peixes raros',m.rare)}{row('Alvo na barra',m.control)}{row('No automático',m.auto)}</ul>
  <h4>Prêmios com o peixe</h4>
  <ul>{row(<><PrizeArt kind="gold" size={16}/>Ouro</>,m.gold)}{row(<><PrizeArt kind="coupons" size={16}/>Cupons</>,m.coupons)}{row(<><PrizeArt kind="fragments" size={16}/>Fragmentos</>,m.fragments)}</ul>
 </div>;
}
/** Hover tooltip for rods in the Sacola and the Casa de Pesca: `tip(rod)` gives the handlers, `node` the floating card. */
export function useRodTip(owned:readonly string[],using:string,level:number){
 const [tip,setTip]=useState<{rod:FishingRod;x:number;y:number}|null>(null);
 const handlers=(rod:FishingRod)=>({
  onMouseEnter:(e:MouseEvent)=>{const b=(e.currentTarget as HTMLElement).getBoundingClientRect();setTip({rod,x:b.right+10,y:b.top});},
  onMouseLeave:()=>setTip(null),
 });
 const style:CSSProperties|undefined=tip?{left:Math.min(tip.x,window.innerWidth-300),top:Math.max(8,Math.min(tip.y,window.innerHeight-360))}:undefined;
 const node=tip?createPortal(<div className="rod-tip" style={style}><RodInfo rod={tip.rod} owned={owned.includes(tip.rod.id)} using={tip.rod.id===using} level={level}/></div>,document.body):null;
 return {handlers,node};
}
