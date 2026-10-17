import type {CSSProperties} from 'react';
import './VipBadge.css';

/** Escudo VIP pintado (atlas 2×1): dourado com o nível quando ativo, cinza quando inativo. O jogo escreve o número e "VIP" por cima. */
export function VipBadge({level=0,size=40,className=''}:{level?:number;size?:number;className?:string}){
 const active=level>0,label=active?`VIP nível ${level}`:'VIP inativo';
 return <span className={`vip-badge ${active?'is-active':'is-inactive'} ${className}`} style={{'--vip-size':size+'px'} as CSSProperties} role="img" aria-label={label} title={label}>
  {active&&<b className="vip-level" aria-hidden="true">{level}</b>}
  <small className="vip-word" aria-hidden="true">VIP</small>
 </span>;
}
