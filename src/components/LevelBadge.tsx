import type {CSSProperties} from 'react';
import {MAX_PLAYER_LEVEL,normalizeLevel} from '../../shared/progression';
import './LevelBadge.css';

// Extracted at 3x from the Flash timelines. Coordinates share the numeral's
// top-left origin (a 40px bitmap, 120px at extraction scale).
const EFFECTS=[
 {frames:25,width:99,height:116,x:0,y:-70.8},
 {frames:40,width:190,height:120,x:-25.8,y:-70.05},
 {frames:30,width:157,height:171,x:-.15,y:-23.4},
 {frames:30,width:170,height:238,x:-25.65,y:-73.35},
 {frames:29,width:150,height:227,x:2.25,y:-56.1}
] as const;

/** Number and animated overlay composed in HTML/CSS, with no Flash runtime.
 * The source stops at 60; 61–70 keep the game's gold numerals and last effect. */
export function LevelBadge({level,size=42,className=''}:{level:number;size?:number;className?:string}){
 const value=normalizeLevel(level);
 const tier=Math.min(5,Math.floor((value-1)/10));
 const effect=value>10?EFFECTS[Math.min(4,tier-1)]:undefined;
 const scaled=(pixels:number)=>`calc(var(--level-size) * ${pixels/120})`;
 const style={width:size,height:size,'--level-size':size+'px'} as CSSProperties;
 const effectStyle:CSSProperties|undefined=effect?{width:scaled(effect.width),height:scaled(effect.height),left:scaled(effect.x),top:scaled(effect.y),backgroundImage:`url('/assets/ui/levels/effect-${Math.min(5,tier)}.webp')`,backgroundSize:`${(effect.frames+1)*100}% 100%`,animationDuration:`${effect.frames/24}s`,animationTimingFunction:`steps(${effect.frames})`}:undefined;
 return <span className={'level-badge '+className} style={style} role="img" aria-label={'Nível '+value+' de '+MAX_PLAYER_LEVEL} title={'Nível '+value} data-level={value} data-tier={tier+1} data-level-original={value<=60?'true':undefined}>
  {value<=60?<img className="level-badge-number level-badge-original" src={`/assets/ui/levels/level-${String(value).padStart(2,'0')}.webp`} alt="" aria-hidden="true" draggable={false}/>:<>
   <span className="level-badge-art" aria-hidden="true"/>
   <span className="level-badge-digits" aria-hidden="true"><span className="level-badge-depth">{value}</span><span className="level-badge-rim">{value}</span><b className="level-badge-number">{value}</b></span>
  </>}
  {effect&&<span key={tier} className="level-badge-effect" style={effectStyle} aria-hidden="true" data-additive={value>40?'true':undefined}/>}
 </span>;
}
