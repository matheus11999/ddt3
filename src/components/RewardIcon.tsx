import {CURRENCY_NAME} from '../../shared/rewards';
import type {CardPrize} from '../../shared/rewards';
/** Coins and EXP come from the painted reward strip; forge stones and Color Tickets use their own art. */
export function RewardIcon({kind='coins',size=28,level=1}:{kind?:CardPrize['kind'];size?:number;level?:number}){
 if(kind==='stone')return <img src={`/assets/stone-${Math.max(1,Math.min(5,level))}.png`} width={size} height={size} alt={`Pedra de fortalecimento ${level}`} draggable={false} style={{flexShrink:0,verticalAlign:'middle',objectFit:'contain'}}/>;
 if(kind==='ticket')return <img src="/assets/ui/color-ticket.png" width={size} height={size} alt="Ticket de Cor" draggable={false} style={{flexShrink:0,verticalAlign:'middle',objectFit:'contain'}}/>;
 return <span role="img" aria-label={kind==='coins'?CURRENCY_NAME:'Experiência'} style={{display:'inline-block',flexShrink:0,width:size,height:size,verticalAlign:'middle',backgroundImage:"url('/assets/ui/reward-icons.png')",backgroundSize:'200% 100%',backgroundPosition:kind==='coins'?'0% 50%':'100% 50%',backgroundRepeat:'no-repeat'}}/>;
}
/** How a card prize is read out: "+2 Pedras I", "+100 Brasa". */
export function prizeLabel(prize:CardPrize){
 const roman=['I','II','III','IV','V'][Math.max(0,Math.min(4,(prize.level??1)-1))];
 return prize.kind==='coins'?{amount:`+${prize.amount}`,unit:'BRASA',spoken:`${prize.amount} ${CURRENCY_NAME}`}:prize.kind==='xp'?{amount:`+${prize.amount}`,unit:'EXP',spoken:`${prize.amount} EXP`}
  :prize.kind==='stone'?{amount:`+${prize.amount}`,unit:`PEDRA ${roman}`,spoken:`${prize.amount} pedra de fortalecimento ${roman}`}:{amount:`+${prize.amount}`,unit:'TICKET',spoken:`${prize.amount} Ticket de Cor`};
}
