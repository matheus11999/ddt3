import {CURRENCY_NAME} from '../../shared/rewards';
export function RewardIcon({kind='coins',size=28}:{kind?:'coins'|'xp';size?:number}){
 return <span role="img" aria-label={kind==='coins'?CURRENCY_NAME:'Experiência'} style={{display:'inline-block',flexShrink:0,width:size,height:size,verticalAlign:'middle',backgroundImage:"url('/assets/ui/reward-icons.png')",backgroundSize:'200% 100%',backgroundPosition:kind==='coins'?'0% 50%':'100% 50%',backgroundRepeat:'no-repeat'}}/>;
}
