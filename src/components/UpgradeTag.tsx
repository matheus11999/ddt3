import {useId} from 'react';
import './UpgradeTag.css';

/** Winged strengthening crest for weapon cards: big number, feathered wings and a "FORÇA" ribbon.
 *  0–4 silver gray, 5–8 green, 9 blue, 10 gold, 11 gold with ruby, 12 gold with the largest wings, halo and sparkles. */
const TIERS={
 0:{light:'#f6f8fa',mid:'#a7b0ba',dark:'#353c45',ribbon:'#4c5662',feathers:3,span:1},
 5:{light:'#e6ffd8',mid:'#3fcf5c',dark:'#0f4a20',ribbon:'#1b6630',feathers:4,span:1.05},
 9:{light:'#e2f4ff',mid:'#3a9cf0',dark:'#0e316b',ribbon:'#174d98',feathers:4,span:1.1},
 10:{light:'#fff7c6',mid:'#f2b52c',dark:'#6a3905',ribbon:'#5b2d0f',feathers:5,span:1.15},
 11:{light:'#fff7c6',mid:'#f2b52c',dark:'#6a3905',ribbon:'#5b2d0f',feathers:5,span:1.2},
 12:{light:'#fffbe0',mid:'#ffc23a',dark:'#6a3604',ribbon:'#5b2a0c',feathers:6,span:1.28}
} as const;
export function upgradeTier(level:number):keyof typeof TIERS {return level>=12?12:level>=11?11:level>=10?10:level>=9?9:level>=5?5:0;}

const FEATHER='M0 0Q-13-9-34-7Q-27-2-33 3Q-15 7 0 5Z';

export function UpgradeTag({level,size=46,className=''}:{level:number;size?:number;className?:string}){
 const id=useId().replace(/:/g,''),tier=upgradeTier(level),t=TIERS[tier];
 const fill=`url(#${id}f)`,label=level>=10?36:42;
 const wing=<g fill={fill} stroke={t.dark} strokeWidth="1.3" strokeLinejoin="round">
  {Array.from({length:t.feathers},(_,i)=>{const a=-4+i*(66/(t.feathers-1||1)),s=t.span*(1-i*.06);
   return <path key={i} d={FEATHER} transform={`translate(44 48) rotate(${a}) scale(${s})`}/>;}).reverse()}
 </g>;
 return <svg className={`upgrade-tag upgrade-tag-${tier} ${className}`} viewBox="0 0 120 80" width={size} height={size*80/120} role="img" aria-label={`Força +${level}`}>
  <defs>
   <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={t.light}/><stop offset=".5" stopColor={t.mid}/><stop offset="1" stopColor={t.dark}/></linearGradient>
   <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff"/><stop offset=".35" stopColor={t.light}/><stop offset=".75" stopColor={t.mid}/></linearGradient>
   <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={t.ribbon}/><stop offset="1" stopColor={t.dark}/></linearGradient>
   <radialGradient id={`${id}h`}><stop stopColor={t.light} stopOpacity=".9"/><stop offset=".55" stopColor={t.mid} stopOpacity=".35"/><stop offset="1" stopColor={t.mid} stopOpacity="0"/></radialGradient>
  </defs>
  {tier>=10&&<ellipse className="upgrade-tag-halo" cx="60" cy="38" rx={tier===12?56:44} ry={tier===12?34:26} fill={`url(#${id}h)`}/>}
  <g className="upgrade-tag-wing">{wing}</g>
  <g className="upgrade-tag-wing" transform="translate(120 0) scale(-1 1)">{wing}</g>
  {/* ribbon: folded tails behind, band in front */}
  <path d="M32 60 20 58l6 6-6 6 16 0Z M88 60l12-2-6 6 6 6-16 0Z" fill={`url(#${id}r)`} stroke={t.dark} strokeWidth="1.2" strokeLinejoin="round"/>
  <path d="M30 57Q60 52 90 57L88 72Q60 67 32 72Z" fill={`url(#${id}r)`} stroke={t.mid} strokeWidth="1.6" strokeLinejoin="round"/>
  <text x="60" y="68" textAnchor="middle" fontFamily="Nunito,'Trebuchet MS',sans-serif" fontSize="9.5" fontWeight="900" letterSpacing="1.4" fill={t.light}>FORÇA</text>
  {tier>=11&&<path d="m60 71 4 4-4 5-4-5Z" fill={tier===12?'#fffbe0':'#ff4a3a'} stroke={t.dark} strokeWidth="1"/>}
  <text x="60" y="53" textAnchor="middle" fontFamily="Nunito,'Trebuchet MS',sans-serif" fontSize={label} fontWeight="900" letterSpacing="-1" fill={t.dark} stroke={t.dark} strokeWidth="8" strokeLinejoin="round" transform="translate(0 2)">{level}</text>
  <text x="60" y="53" textAnchor="middle" fontFamily="Nunito,'Trebuchet MS',sans-serif" fontSize={label} fontWeight="900" letterSpacing="-1" fill={`url(#${id}n)`} stroke={t.dark} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">{level}</text>
  {tier===12&&<g className="upgrade-tag-sparkles" fill="#fff">
   <path d="m22 14 1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z"/><path d="m98 10 1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z"/><path d="m84 44 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
  </g>}
 </svg>;
}
