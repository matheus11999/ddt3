import type {CSSProperties} from 'react';
import './UpgradeTag.css';

/** Strength crest for weapons, built from the game's painted winged badges (`level-badge-backdrops.png`)
 *  with a sculpted number: 0–4 gray chevron, 5–8 green wings, 9 blue wings, 10 gold wings,
 *  11 gold wings with crown, 12 crown plus light rays and sparkles. */
const ART_CELL={0:0,5:1,9:2,10:3,11:5,12:5} as const;
export function upgradeTier(level:number):keyof typeof ART_CELL {return level>=12?12:level>=11?11:level>=10?10:level>=9?9:level>=5?5:0;}

export function UpgradeTag({level,size=46,className=''}:{level:number;size?:number;className?:string}){
 const tier=upgradeTier(level),cell=ART_CELL[tier];
 const style={width:size,height:size,'--tag-size':size+'px','--tag-art-x':(cell%3)*50+'%','--tag-art-y':Math.floor(cell/3)*100+'%'} as CSSProperties;
 return <span className={`upgrade-tag ${className}`} style={style} data-tier={tier} role="img" aria-label={`Força +${level}`}>
  {tier>=11&&<span className="upgrade-tag-fx" aria-hidden="true"/>}
  <span className="upgrade-tag-art" aria-hidden="true"/>
  <span className="upgrade-tag-digits" aria-hidden="true"><span className="upgrade-tag-depth">{level}</span><span className="upgrade-tag-rim">{level}</span><b className="upgrade-tag-number">{level}</b></span>
  {size>=64&&<span className="upgrade-tag-ribbon" aria-hidden="true">FORÇA</span>}
 </span>;
}
