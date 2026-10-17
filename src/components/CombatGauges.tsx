import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';

const polar=(cx:number,cy:number,facing:1|-1,degree:number,radius:number)=>({x:cx+facing*Math.cos(degree*Math.PI/180)*radius,y:cy-Math.sin(degree*Math.PI/180)*radius});
const arcPath=(cx:number,cy:number,facing:1|-1,start:number,end:number,radius:number)=>{
 const a=polar(cx,cy,facing,start,radius),b=polar(cx,cy,facing,end,radius);
 return `M${a.x.toFixed(2)} ${a.y.toFixed(2)}A${radius} ${radius} 0 0 ${facing===1?0:1} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

/** Artillery gauge: the quadrant faces the same side as the fighter and the
 * band shows the weapon limits already shifted by the ground under the feet. */
export function AngleGauge({angle,minAngle,maxAngle,facing,slope}:{angle:number;minAngle:number;maxAngle:number;facing:1|-1;slope:number}){
 const cx=60,cy=58,shown=Math.max(0,Math.min(90,angle));
 const tip=polar(cx,cy,facing,shown,44),left=polar(cx,cy,facing,shown+90,3.6),right=polar(cx,cy,facing,shown-90,3.6),tail=polar(cx,cy,facing,shown+180,9);
 return <div className="angle-gauge" data-facing={facing}>
  <svg viewBox="0 0 120 120" aria-hidden="true">
   <defs>
    <radialGradient id="angle-gauge-face" cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#1f4a6e"/><stop offset=".7" stopColor="#0d2541"/><stop offset="1" stopColor="#071629"/></radialGradient>
    <linearGradient id="angle-gauge-needle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffe36b"/><stop offset=".55" stopColor="#ff8a1f"/><stop offset="1" stopColor="#e2261b"/></linearGradient>
   </defs>
   <circle className="angle-gauge-bezel" cx="60" cy="60" r="57"/>
   <circle className="angle-gauge-face" cx="60" cy="60" r="51" fill="url(#angle-gauge-face)"/>
   <path className="angle-gauge-sweep" d={`M${cx} ${cy}L${polar(cx,cy,facing,0,47).x} ${polar(cx,cy,facing,0,47).y}${arcPath(cx,cy,facing,0,90,47).replace(/^M[^A]+/,'')}Z`}/>
   <path className="angle-gauge-blocked" d={arcPath(cx,cy,facing,0,90,47)}/>
   <path className="angle-gauge-range" d={arcPath(cx,cy,facing,minAngle,maxAngle,47)}/>
   {Array.from({length:19},(_,index)=>{const degree=index*5,major=degree%15===0,a=polar(cx,cy,facing,degree,major?36:40),b=polar(cx,cy,facing,degree,44);return <line key={degree} className={major?'major':''} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>;})}
   {[0,30,60,90].map(degree=>{const p=polar(cx,cy,facing,degree,28);return <text key={degree} x={p.x} y={p.y+2.4}>{degree}</text>;})}
   <polygon className="angle-gauge-needle" points={`${tip.x},${tip.y} ${left.x},${left.y} ${tail.x},${tail.y} ${right.x},${right.y}`} fill="url(#angle-gauge-needle)"/>
   <circle className="angle-gauge-hub" cx={cx} cy={cy} r="5.5"/>
  </svg>
  <div className="angle-gauge-readout"><strong>{angle}<small>°</small></strong><span>{slope?`TERRENO ${slope>0?'+':''}${slope}°`:'ÂNGULO'}</span></div>
 </div>;
}

/** Combat Power orb. The server zeroes the charge when Power is armed; the
 * liquid keeps the previous level for one frame and then drains visibly. */
export function PowerOrb({charge,armed,disabled,onActivate}:{charge:number;armed:boolean;disabled:boolean;onActivate:()=>void}){
 const level=Math.max(0,Math.min(100,armed?0:charge)),full=!armed&&level>=100;
 const [draining,setDraining]=useState(false),wasArmed=useRef(armed);
 useEffect(()=>{
  const started=armed&&!wasArmed.current;wasArmed.current=armed;
  if(!started)return;
  setDraining(true);const timer=setTimeout(()=>setDraining(false),1400);return()=>clearTimeout(timer);
 },[armed]);
 return <button type="button" className={`combat-power ${full?'power-full':''} ${armed?'power-armed':''} ${draining?'power-draining':''}`} style={{'--power-level':`${level}%`} as CSSProperties} disabled={disabled} aria-label={armed?'Power preparado':`Ativar Power, ${Math.floor(level)} de 100`} aria-pressed={armed} title="Acumule ao acertar e receber dano. Com 100, ative para fortalecer o próximo tiro. A carga é gasta na ativação; passar ou deixar o tempo acabar perde o tiro fortalecido." onClick={event=>{onActivate();if(event.detail>0)event.currentTarget.blur();}}>
  <span className="combat-power-rays" aria-hidden="true"/>
  <span className="combat-power-flames" aria-hidden="true"/>
  <span className="combat-power-glass" aria-hidden="true">
   <span className="combat-power-liquid"><i/><i/></span>
   <span className="combat-power-bubbles"><i/><i/><i/><i/></span>
  </span>
  <span className="combat-power-burst" aria-hidden="true"/>
  <span className="combat-power-core"><strong>POW</strong></span>
 </button>;
}
