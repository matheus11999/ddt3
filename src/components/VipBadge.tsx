import type {CSSProperties} from 'react';
import './VipBadge.css';

/** Escudo VIP do card de jogador: dourado com coroa e nível quando ativo, pedra cinza quando inativo. */
export function VipBadge({level=0,size=40,className=''}:{level?:number;size?:number;className?:string}){
 const active=level>0,label=active?`VIP nível ${level}`:'VIP inativo';
 return <span className={`vip-badge ${active?'is-active':'is-inactive'} ${className}`} style={{'--vip-size':size+'px'} as CSSProperties} role="img" aria-label={label} title={label}>
  <svg viewBox="0 0 48 52" aria-hidden="true">
   <defs>
    <linearGradient id="vip-face-on" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3b0"/><stop offset=".45" stopColor="#ffc93c"/><stop offset=".55" stopColor="#f29a12"/><stop offset="1" stopColor="#c45f08"/></linearGradient>
    <linearGradient id="vip-face-off" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eeeae3"/><stop offset=".5" stopColor="#b9b2a7"/><stop offset="1" stopColor="#857c70"/></linearGradient>
    <linearGradient id="vip-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9a9a"/><stop offset="1" stopColor="#c8102e"/></linearGradient>
   </defs>
   <path className="vip-crown" d="M13 15 L15 6 L20 11 L24 3 L28 11 L33 6 L35 15 Z"/>
   <circle className="vip-crown-gem" cx="24" cy="4.5" r="2"/>
   <path className="vip-shield" d="M24 13 L41 18 V30 C41 40 33 46 24 50 C15 46 7 40 7 30 V18 Z"/>
   <path className="vip-shield-inner" d="M24 17 L37 21 V30 C37 37.5 31.5 42.5 24 45.5 C16.5 42.5 11 37.5 11 30 V21 Z"/>
   <path className="vip-ribbon" d="M3 37 H45 L42 42 L45 47 H3 L6 42 Z"/>
  </svg>
  {active&&<b className="vip-level">{level}</b>}
  <small className="vip-word">VIP</small>
 </span>;
}
