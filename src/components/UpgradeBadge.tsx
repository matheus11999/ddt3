import {useId} from 'react';
export function UpgradeBadge({level,size=140}:{level:number;size?:number}){
 const id=useId().replace(/:/g,'');
 const tier=level>=12?12:level>=10?10:level>=9?9:level>=5?5:0;
 const [light,metal,dark,core]=tier===12?['#fff8c1','#ffbd4b','#9e4925','#923d42']:tier===10?['#fff4b6','#e5ae50','#8d562c','#70484b']:tier===9?['#e6fcff','#71ceef','#367292','#364c88']:tier===5?['#f0f7ff','#aebfd6','#677591','#4f5579']:['#e9dfd4','#aba39c','#665a53','#64564e'];
 return <svg className={`upgrade-badge badge-tier-${tier} ${tier===12?'legendary':''}`} viewBox="0 0 180 86" width={size} height={size*86/180} role="img" aria-label={`Fortalecimento nível ${level}`}>
  <defs><linearGradient id={`${id}metal`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={light}/><stop offset=".27" stopColor={metal}/><stop offset=".51" stopColor={light}/><stop offset=".65" stopColor={metal}/><stop offset="1" stopColor={dark}/></linearGradient><radialGradient id={`${id}core`}><stop stopColor={core}/><stop offset="1" stopColor="#2c2531"/></radialGradient></defs>
  {tier>=5&&<g fill={`url(#${id}metal)`} stroke={dark} strokeWidth="1.5">{[false,true].map((flip,index)=><g key={index} transform={flip?'translate(180 0) scale(-1 1)':undefined}>
   <path d="M72 34C48 32 27 32 13 14c-2 13 9 26 24 31L15 31c3 18 22 25 41 21L28 43c8 18 24 20 42 10Z"/>
   <path d="M67 40Q38 36 21 23M68 45Q44 48 25 39M68 50Q48 57 38 51" fill="none" stroke={light} strokeWidth="2"/>
   {tier>=9&&<><path d="M68 28C44 25 32 17 27 6c-2 13 6 21 18 28"/><path d="M63 52C39 46 38 67 51 67c9 0 10-12 2-12m-13 8c-15 6-17-8-7-11" fill="none" stroke={`url(#${id}metal)`} strokeWidth="4"/></>}
   {tier===12&&<><path d="M61 27C38 16 25 18 8 4c0 17 16 31 35 33M58 59c-6 18-24 14-31 8 3 12 20 17 35 3"/><path d="m14 17 3 6 7 2-7 3-3 6-3-6-7-3 7-2Z" fill={light}/></>}
  </g>)}</g>}
  {tier===0&&<g stroke={dark} fill={metal}><path d="m53 38 14-8v27l-14 5 3-12Zm74 0-14-8v27l14 5-3-12Z"/><circle cx="59" cy="44" r="3" fill={light}/><circle cx="121" cy="44" r="3" fill={light}/></g>}
  <path d={tier>=5?'M64 25 73 29 79 16 90 23 101 16 107 29 116 25 113 61 90 77 67 61Z':'M67 26 90 19 113 26 112 59 90 74 68 59Z'} fill={`url(#${id}metal)`} stroke={dark} strokeWidth="2"/>
  <path d="M73 31 90 26 107 31 105 56 90 67 75 56Z" fill={`url(#${id}core)`} stroke={light} strokeWidth="1.2"/>
  {tier>=5&&<path d="m90 7 6 8-6 8-6-8Z" fill={light} stroke={dark}/>}
  {tier>=10&&<path d="m75 21-6-11 12 6 9-13 9 13 12-6-6 11" fill={`url(#${id}metal)`} stroke={dark}/>}
  <text x="90" y="57" textAnchor="middle" fontFamily="Georgia,serif" fontSize="35" fontWeight="900" fill={light} stroke={dark} strokeWidth="1.5" paintOrder="stroke">{level}</text>
  {tier>=5&&<><path d="M48 62Q90 55 132 62l-4 13Q90 69 52 75Z" fill={dark} stroke={metal}/><text x="90" y="70" textAnchor="middle" fontFamily="Trebuchet MS,sans-serif" fontSize="7" fontWeight="900" letterSpacing=".9" fill={light}>FORTALECIMENTO</text></>}
  {tier===12&&<g fill={light}><path d="m151 36 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/><circle cx="24" cy="53" r="2"/><circle cx="147" cy="18" r="1.8"/></g>}
 </svg>;
}
