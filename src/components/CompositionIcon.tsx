import type {CompositionStat} from '../../shared/composition';
const POSITIONS:Record<CompositionStat,string>={attack:'0% 0%',defense:'100% 0%',agility:'0% 100%',armor:'100% 100%'};
/** Four original painted minerals share one atlas; tier remains readable live text. */
export function CompositionIcon({stat,size=48}:{stat:CompositionStat;size?:number}){
 return <span className="composition-icon" aria-hidden="true" style={{display:'inline-block',width:size,height:size,flexShrink:0,backgroundImage:"url('/assets/ui/composition-stones.png')",backgroundSize:'200% 200%',backgroundPosition:POSITIONS[stat],backgroundRepeat:'no-repeat',pointerEvents:'none'}}/>;
}
