/** Original painted power emblem, shared by player summaries and character cards. */
export function PowerIcon({size=24,className=''}:{size?:number;className?:string}){
 return <img className={`power-icon ${className}`} src="/assets/ui/power-emblem.png" alt="" aria-hidden="true" draggable={false} width={size} height={size} style={{width:size,height:size,objectFit:'contain',flexShrink:0,pointerEvents:'none',filter:'drop-shadow(0 1px 2px #07132999)'}}/>;
}
