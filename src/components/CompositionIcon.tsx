import type {CompositionStat} from '../../shared/composition';
const POSITIONS:Record<Exclude<CompositionStat,'luck'>,string>={attack:'0% 0%',defense:'100% 0%',agility:'0% 100%',armor:'100% 100%'};
/** The first four painted minerals share one atlas; Sorte (added later) has its own image. Tier remains readable live text. */
export function CompositionIcon({stat,size=48}:{stat:CompositionStat;size?:number}){
 return <span className="composition-icon" aria-hidden="true" style={{display:'inline-block',width:size,height:size,flexShrink:0,backgroundImage:stat==='luck'?"url('/assets/ui/composition-luck.png')":"url('/assets/ui/composition-stones.png')",backgroundSize:stat==='luck'?'100% 100%':'200% 200%',backgroundPosition:stat==='luck'?'50% 50%':POSITIONS[stat],backgroundRepeat:'no-repeat',pointerEvents:'none'}}/>;
}
