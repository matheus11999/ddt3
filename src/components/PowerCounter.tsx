import './PowerCounter.css';
import {useEffect,useRef,useState} from 'react';

const COUNT_MS=700,FLOAT_MS=1400;
const format=(value:number)=>Math.round(value).toLocaleString('pt-BR');
/** Poder that counts to its new value when equipment changes, with the gain or loss floating above it (+2.000 / -2.000). */
export function PowerCounter({value}:{value:number}){
 const [shown,setShown]=useState(value),[delta,setDelta]=useState<{amount:number;key:number}|null>(null);
 const from=useRef(value),target=useRef(value);
 useEffect(()=>{
  if(value===target.current)return;
  const start=from.current,change=value-target.current,began=performance.now();target.current=value;
  setDelta(current=>({amount:(current&&performance.now()-current.key<COUNT_MS?current.amount:0)+change,key:began}));
  let frame=0;const step=(now:number)=>{const t=Math.min(1,(now-began)/COUNT_MS),eased=1-(1-t)**3,next=start+(value-start)*eased;from.current=next;setShown(next);if(t<1)frame=requestAnimationFrame(step);};
  frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
 },[value]);
 useEffect(()=>{if(!delta)return;const timer=setTimeout(()=>setDelta(null),FLOAT_MS);return()=>clearTimeout(timer);},[delta]);
 const label=format(value),sign=delta&&delta.amount>0?'up':'down';
 return <strong className="power-counter" aria-label={label} data-change={delta?sign:undefined}>
  <span aria-hidden="true">{format(shown)}</span>
  {delta&&delta.amount!==0&&<b key={delta.key} className={`power-delta ${sign}`} aria-live="polite">{delta.amount>0?'+':'-'}{format(Math.abs(delta.amount))}</b>}
 </strong>;
}
