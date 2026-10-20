import './PowerCounter.css';
import {useEffect,useId,useRef,useState} from 'react';

const COUNT_MS=700,FLOAT_MS=1400;
const format=(value:number)=>Math.round(value).toLocaleString('pt-BR');
type Tone='gold'|'up'|'down';
const TONES:Record<Tone,{face:[string,string,string];side:[string,string];ink:string}>={
 gold:{face:['#fffbd0','#ffd42e','#ff7a0a'],side:['#d4560a','#7a2604'],ink:'#2a0f05'},
 up:{face:['#f6ffd8','#8cff4a','#1fa82c'],side:['#178a22','#06420c'],ink:'#062a08'},
 down:{face:['#fff1ec','#ff7a5c','#d4231a'],side:['#a8180f','#560704'],ink:'#2e0503'}
};
/** Number with volume like the Ferreiro's SUCESSO!: extruded sides, thick outline, gradient face and gloss (Lilita One). */
function VolumeText({text,size,tone}:{text:string;size:number;tone:Tone}){
 const id='pw'+useId().replace(/[^a-zA-Z0-9]/g,''),{face,side,ink}=TONES[tone],depth=Math.max(2,Math.round(size/9)),pad=size*.22;
 const width=Math.ceil(text.length*size*.56+pad*2),height=Math.ceil(size*1.12+depth+pad);
 const at={x:width/2,y:size*.92+pad/2,fontFamily:"'Lilita One','Nunito',sans-serif",fontSize:size,textAnchor:'middle' as const,letterSpacing:.5,strokeLinejoin:'round' as const};
 return <svg className="power-volume-text" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
  <defs>
   <linearGradient id={`${id}f`} x2="0" y2="1"><stop offset=".08" stopColor={face[0]}/><stop offset=".5" stopColor={face[1]}/><stop offset="1" stopColor={face[2]}/></linearGradient>
   <linearGradient id={`${id}s`} x2="0" y2="1"><stop stopColor={side[0]}/><stop offset="1" stopColor={side[1]}/></linearGradient>
   <linearGradient id={`${id}g`} x2="0" y2="1"><stop offset=".1" stopColor="#fff" stopOpacity=".9"/><stop offset=".44" stopColor="#fff" stopOpacity=".3"/><stop offset=".45" stopColor="#fff" stopOpacity="0"/></linearGradient>
  </defs>
  <text {...at} y={at.y+depth+1.5} fill={ink} stroke={ink} strokeWidth={size*.24}>{text}</text>
  {Array.from({length:depth},(_,i)=><text key={i} {...at} y={at.y+depth-i} fill={`url(#${id}s)`} stroke={`url(#${id}s)`} strokeWidth={size*.16}>{text}</text>)}
  <text {...at} fill="none" stroke={ink} strokeWidth={size*.16}>{text}</text>
  <text {...at} fill={`url(#${id}f)`} stroke={face[0]} strokeWidth={size*.03} paintOrder="stroke">{text}</text>
  <text {...at} fill={`url(#${id}g)`}>{text}</text>
 </svg>;
}
/** Poder that counts to its new value when equipment changes, with the gain or loss floating above it (+2.000 / -2.000). */
export function PowerCounter({value,size=24}:{value:number;size?:number}){
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
 const tone:Tone=delta?(delta.amount>0?'up':'down'):'gold',label=format(value);
 return <strong className="power-counter" role="img" aria-label={label} data-change={delta?tone:undefined}>
  <VolumeText text={format(shown)} size={size} tone={tone}/>
  {delta&&delta.amount!==0&&<b key={delta.key} className="power-delta" aria-live="polite" aria-label={`${delta.amount>0?'+':'-'}${format(Math.abs(delta.amount))}`}><VolumeText text={`${delta.amount>0?'+':'-'}${format(Math.abs(delta.amount))}`} size={Math.round(size*.95)} tone={delta.amount>0?'up':'down'}/></b>}
 </strong>;
}
