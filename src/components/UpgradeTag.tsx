import {useId} from 'react';
import './UpgradeTag.css';

/** Compact "+N" plate for item cards. The design climbs with the upgrade:
 *  0–4 bronze, 5–8 emerald wings, 9 violet gem, 10 sapphire crown, 11 ruby crown with flames, 12 gold crown with rays. */
const TIERS={
 0:['#ffe3b5','#d0904f','#6a3a14'],
 5:['#d4ffc9','#2fbf5a','#0d4f24'],
 9:['#f4d6ff','#a54ae8','#43106e'],
 10:['#d3efff','#2f8ff0','#0f3772'],
 11:['#ffd0b8','#ec3b2c','#650f06'],
 12:['#fff7c2','#ffbf2a','#7c3f03']
} as const;
export function upgradeTier(level:number):keyof typeof TIERS {return level>=12?12:level>=11?11:level>=10?10:level>=9?9:level>=5?5:0;}
export function UpgradeTag({level,size=34,className=''}:{level:number;size?:number;className?:string}){
 const id=useId().replace(/:/g,''),tier=upgradeTier(level),[light,mid,dark]=TIERS[tier];
 return <svg className={`upgrade-tag upgrade-tag-${tier} ${className}`} viewBox="0 0 72 40" width={size} height={size*40/72} role="img" aria-label={`Fortalecimento +${level}`}>
  <defs>
   <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={light}/><stop offset=".45" stopColor={mid}/><stop offset="1" stopColor={dark}/></linearGradient>
   <radialGradient id={`${id}g`}><stop stopColor={light} stopOpacity=".95"/><stop offset="1" stopColor={mid} stopOpacity="0"/></radialGradient>
  </defs>
  {tier===12&&<g className="upgrade-tag-rays" fill={light} opacity=".85">{Array.from({length:12},(_,i)=><path key={i} d="M36 24 34.6 1h2.8Z" transform={`rotate(${i*30} 36 24)`}/>)}</g>}
  {tier>=11&&<path className="upgrade-tag-flame" d="M14 34Q8 22 15 12q1 8 6 9-2-12 8-19 0 9 7 12 7-3 7-12 10 7 8 19 5-1 6-9 7 10 1 22Z" fill={`url(#${id}g)`}/>}
  {tier>=5&&<g fill={`url(#${id}f)`} stroke={dark} strokeWidth="1.2" strokeLinejoin="round">
   <path d="M17 18Q8 16 2 9q0 8 6 12-5 0-6-2 2 8 13 9Z"/><path d="M55 18q9-2 15-9 0 8-6 12 5 0 6-2-2 8-13 9Z"/>
  </g>}
  <rect x="13" y="13" width="46" height="24" rx="9" fill={`url(#${id}f)`} stroke={dark} strokeWidth="2"/>
  <rect x="16" y="15.5" width="40" height="7" rx="3.5" fill="#fff" opacity=".28"/>
  {tier>=9&&tier<10&&<path d="m36 3 5 6-5 6-5-6Z" fill={`url(#${id}f)`} stroke={dark} strokeWidth="1.2"/>}
  {tier>=10&&<path d="m25 14-2-11 7 5 6-7 6 7 7-5-2 11Z" fill={`url(#${id}f)`} stroke={dark} strokeWidth="1.3" strokeLinejoin="round"/>}
  {tier>=10&&<circle cx="36" cy="5" r="1.8" fill={light}/>}
  <text x="36" y="32" textAnchor="middle" fontFamily="Nunito,'Trebuchet MS',sans-serif" fontSize="17" fontWeight="900" fill="#fff" stroke={dark} strokeWidth="3.2" paintOrder="stroke">+{level}</text>
 </svg>;
}
