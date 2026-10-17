import {useId} from 'react';
import './UpgradeTag.css';

/** Jewel crest for weapon cards: a cut gem in a metal frame with the number and a "FORÇA" ribbon.
 *  0–4 gray, 5–8 green, 9 blue, 10 gold with crown, 11 adds side spikes and a ruby, 12 adds a light burst, halo and sparkles. */
const TIERS={
 0:{gem:['#eef1f4','#9aa4ae','#424a54'],rim:['#d9dee3','#7c858f','#2c3239'],ribbon:'#4a535d'},
 5:{gem:['#d9ffd0','#36c95a','#0d4a20'],rim:['#f2f6f8','#9fb0b8','#34424a'],ribbon:'#17602c'},
 9:{gem:['#dcf2ff','#3a9cf0','#0d2f6a'],rim:['#f2f6f8','#9fb0b8','#34424a'],ribbon:'#164a94'},
 10:{gem:['#fff6c8','#f5b52a','#7a3d04'],rim:['#fff3b8','#d99a24','#5e3004'],ribbon:'#5b2d0f'},
 11:{gem:['#fff6c8','#f5b52a','#7a3d04'],rim:['#fff3b8','#d99a24','#5e3004'],ribbon:'#5b2d0f'},
 12:{gem:['#fffbe2','#ffc83c','#8a4504'],rim:['#fff8d0','#ecad2c','#5e3004'],ribbon:'#5b2a0c'}
} as const;
export function upgradeTier(level:number):keyof typeof TIERS {return level>=12?12:level>=11?11:level>=10?10:level>=9?9:level>=5?5:0;}

const OUTER='M60 4 92 18 92 46 60 62 28 46 28 18Z';
const INNER='M60 11 85 22 85 42 60 55 35 42 35 22Z';
const FONT="Nunito,'Trebuchet MS',sans-serif";

export function UpgradeTag({level,size=46,className=''}:{level:number;size?:number;className?:string}){
 const id=useId().replace(/:/g,''),tier=upgradeTier(level),t=TIERS[tier],u=(k:string)=>`url(#${id}${k})`;
 const fontSize=level>=10?27:31;
 return <svg className={`upgrade-tag upgrade-tag-${tier} ${className}`} viewBox="0 0 120 80" width={size} height={size*80/120} role="img" aria-label={`Força +${level}`}>
  <defs>
   <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={t.rim[0]}/><stop offset=".45" stopColor={t.rim[1]}/><stop offset="1" stopColor={t.rim[2]}/></linearGradient>
   <radialGradient id={`${id}g`} cx=".5" cy=".38" r=".7"><stop stopColor={t.gem[0]}/><stop offset=".45" stopColor={t.gem[1]}/><stop offset="1" stopColor={t.gem[2]}/></radialGradient>
   <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff"/><stop offset=".55" stopColor="#fff"/><stop offset="1" stopColor={t.gem[0]}/></linearGradient>
   <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={t.ribbon}/><stop offset="1" stopColor={t.rim[2]}/></linearGradient>
   <radialGradient id={`${id}h`}><stop stopColor={t.gem[0]} stopOpacity=".95"/><stop offset=".5" stopColor={t.gem[1]} stopOpacity=".35"/><stop offset="1" stopColor={t.gem[1]} stopOpacity="0"/></radialGradient>
  </defs>
  {tier===12&&<ellipse className="upgrade-tag-halo" cx="60" cy="34" rx="58" ry="38" fill={u('h')} opacity=".6"/>}
  {tier===12&&<g className="upgrade-tag-burst" fill={t.gem[1]} opacity=".7">{Array.from({length:24},(_,i)=><path key={i} d={`M60 33 ${i%2?59.4:58.8} ${i%2?4:-6}h${i%2?1.2:2.4}Z`} transform={`rotate(${i*15} 60 33)`}/>)}</g>}
  {tier>=9&&tier<12&&<ellipse cx="60" cy="34" rx="40" ry="30" fill={u('h')} opacity=".7"/>}
  {/* side spikes from +11 */}
  {tier>=11&&<g fill={u('m')} stroke={t.rim[2]} strokeWidth="1.2" strokeLinejoin="round">
   <path d="M29 24 10 32 29 40Z"/><path d="M91 24 110 32 91 40Z"/>
   <path d="m30 20-12-7 9 11Z"/><path d="m90 20 12-7-9 11Z"/>
  </g>}
  {tier>=11&&<g fill={tier===12?'#fffbe2':'#ff4a3a'} stroke={t.rim[2]} strokeWidth="1"><circle cx="14" cy="32" r="2.6"/><circle cx="106" cy="32" r="2.6"/></g>}
  {/* crown from +10 */}
  {tier>=10&&<g>
   <path d="M44 14 41 1 51 7 60-1 69 7 79 1 76 14Z" fill={u('m')} stroke={t.rim[2]} strokeWidth="1.3" strokeLinejoin="round"/>
   <circle cx="60" cy="5" r="2.4" fill={tier===11?'#ff4a3a':'#fff'} stroke={t.rim[2]} strokeWidth=".8"/>
   <circle cx="47" cy="9" r="1.5" fill="#fff"/><circle cx="73" cy="9" r="1.5" fill="#fff"/>
  </g>}
  {/* frame + cut gem */}
  <path d={OUTER} fill={u('m')} stroke={t.rim[2]} strokeWidth="1.6" strokeLinejoin="round"/>
  <path d="M60 6 90 19 86 21 60 9.5 34 21 30 19Z" fill="#fff" opacity=".55"/>
  <path d={INNER} fill={u('g')} stroke={t.rim[2]} strokeWidth="1.2" strokeLinejoin="round"/>
  <g fill="#fff">
   <path d="M60 11 85 22 72 25 60 17 48 25 35 22Z" opacity=".38"/>
   <path d="M35 22 48 25 48 38 35 42Z" opacity=".16"/>
   <path d="M60 55 72 39 85 42Z" opacity=".1"/>
  </g>
  <text x="60" y="44" textAnchor="middle" fontFamily={FONT} fontSize={fontSize} fontWeight="900" letterSpacing="-1" fill={u('n')} stroke={t.gem[2]} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">{level}</text>
  {/* ribbon */}
  <path d="M30 60 18 58l5 6-5 6 16 0Z M90 60l12-2-5 6 5 6-16 0Z" fill={u('r')} stroke={t.rim[2]} strokeWidth="1.2" strokeLinejoin="round"/>
  <path d="M30 57Q60 52 90 57L88 72Q60 67 32 72Z" fill={u('r')} stroke={t.rim[1]} strokeWidth="1.6" strokeLinejoin="round"/>
  <text x="60" y="68" textAnchor="middle" fontFamily={FONT} fontSize="9.5" fontWeight="900" letterSpacing="1.4" fill={t.rim[0]}>FORÇA</text>
  {tier===12&&<g className="upgrade-tag-sparkles" fill="#fff">
   <path d="m20 10 1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z"/><path d="m100 8 1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z"/><path d="m80 26 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
  </g>}
 </svg>;
}
