import type {CSSProperties} from 'react';
import {MAX_PLAYER_LEVEL,normalizeLevel} from '../../shared/progression';
import './LevelBadge.css';

/** A live, sculpted numeral leads; the original painted accents stay behind it. */
export function LevelBadge({level,size=42,className=''}:{level:number;size?:number;className?:string}){
 const value=normalizeLevel(level);
 // The gold palette spans both decades after silver (levels 51–70).
 const tier=Math.min(5,Math.floor((value-1)/10));
 const auraStage=value>=70?'sovereign':value>=60?'solar':value>=50?'crowned':value>=40?'radiant':value>=30?'soft':undefined;
 const style={width:size,height:size,'--level-size':size+'px','--level-art-x':(tier%3)*50+'%','--level-art-y':Math.floor(tier/3)*100+'%','--level-aura-progress':Math.max(0,Math.min(1,(value-30)/(MAX_PLAYER_LEVEL-30)))} as CSSProperties;
 return <span className={'level-badge '+className} style={style} role="img" aria-label={'Nível '+value+' de '+MAX_PLAYER_LEVEL} title={'Nível '+value} data-level={value} data-tier={tier+1} data-aura={value>=30?'true':undefined} data-aura-stage={auraStage}>
  {value>=30&&<span className="level-badge-aura" aria-hidden="true"/>}
  <span className="level-badge-art" aria-hidden="true"/>
  <span className="level-badge-digits" aria-hidden="true"><span className="level-badge-depth">{value}</span><span className="level-badge-rim">{value}</span><b className="level-badge-number">{value}</b></span>
 </span>;
}
