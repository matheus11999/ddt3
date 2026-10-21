import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {POWER_MAX,powerFull,powerPercent} from '../../shared/power';

const polar=(cx:number,cy:number,facing:1|-1,degree:number,radius:number)=>({x:cx+facing*Math.cos(degree*Math.PI/180)*radius,y:cy-Math.sin(degree*Math.PI/180)*radius});
const arcPath=(cx:number,cy:number,facing:1|-1,start:number,end:number,radius:number)=>{
 const a=polar(cx,cy,facing,start,radius),b=polar(cx,cy,facing,end,radius);
 return `M${a.x.toFixed(2)} ${a.y.toFixed(2)}A${radius} ${radius} 0 0 ${facing===1?0:1} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

/** Artillery gauge: the quadrant faces the same side as the fighter and the
 * band shows the weapon limits already shifted by the ground under the feet.
 * Gold bezel with rivets over a glass face; the scale fills the upper quarter
 * and the reading sits on its own plaque in the lower half, clear of the needle. */
export function AngleGauge({angle,minAngle,maxAngle,facing,slope}:{angle:number;minAngle:number;maxAngle:number;facing:1|-1;slope:number}){
 const cx=60,cy=60,shown=Math.max(0,Math.min(90,angle));
 const tip=polar(cx,cy,facing,shown,47),left=polar(cx,cy,facing,shown+90,4.2),right=polar(cx,cy,facing,shown-90,4.2),tail=polar(cx,cy,facing,shown+180,10);
 const shine=polar(cx,cy,facing,shown,30),shineLeft=polar(cx,cy,facing,shown+90,1.6);
 return <div className="angle-gauge" data-facing={facing}>
  <svg viewBox="0 0 120 120" aria-hidden="true">
   <defs>
    <linearGradient id="angle-gauge-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3b8"/><stop offset=".28" stopColor="#f2c25a"/><stop offset=".62" stopColor="#c27a22"/><stop offset="1" stopColor="#6e3a0c"/></linearGradient>
    <radialGradient id="angle-gauge-face" cx="50%" cy="34%" r="70%"><stop offset="0" stopColor="#2f6a98"/><stop offset=".55" stopColor="#123557"/><stop offset="1" stopColor="#06162b"/></radialGradient>
    <radialGradient id="angle-gauge-plaque" cx="50%" cy="0%" r="100%"><stop offset="0" stopColor="#071629" stopOpacity=".2"/><stop offset="1" stopColor="#030b18" stopOpacity=".85"/></radialGradient>
    <linearGradient id="angle-gauge-range" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff7a2a"/><stop offset="1" stopColor="#e2261b"/></linearGradient>
    <linearGradient id="angle-gauge-needle" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff2a0"/><stop offset=".5" stopColor="#ffb22e"/><stop offset="1" stopColor="#d4541a"/></linearGradient>
    <radialGradient id="angle-gauge-hub" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fff6c8"/><stop offset=".5" stopColor="#f0b444"/><stop offset="1" stopColor="#7a4210"/></radialGradient>
   </defs>
   <circle className="angle-gauge-shadow" cx="60" cy="62" r="58"/>
   <circle className="angle-gauge-bezel" cx="60" cy="60" r="57" fill="url(#angle-gauge-gold)"/>
   <circle className="angle-gauge-bevel" cx="60" cy="60" r="54.5"/>
   {[30,90,150,210,270,330].map(degree=>{const p=polar(cx,cy,1,degree,55.6);return <g key={degree} className="angle-gauge-rivet"><circle cx={p.x} cy={p.y} r="1.9"/><circle cx={p.x-.5} cy={p.y-.6} r=".7"/></g>;})}
   <circle className="angle-gauge-face" cx="60" cy="60" r="52" fill="url(#angle-gauge-face)"/>
   <path className="angle-gauge-plaque" d="M10 63H110A50 50 0 0 1 10 63Z" fill="url(#angle-gauge-plaque)"/>
   <path className="angle-gauge-quarter" d={`M${cx} ${cy}L${polar(cx,cy,facing,0,48).x} ${polar(cx,cy,facing,0,48).y}${arcPath(cx,cy,facing,0,90,48).replace(/^M[^A]+/,'')}Z`}/>
   <path className="angle-gauge-range" d={arcPath(cx,cy,facing,minAngle,maxAngle,46.5)} stroke="url(#angle-gauge-range)"/>
   {Array.from({length:19},(_,index)=>{const degree=index*5,major=degree%30===0,mid=!major&&degree%15===0,a=polar(cx,cy,facing,degree,major?37:mid?40:42),b=polar(cx,cy,facing,degree,45);return <line key={degree} className={major?'major':mid?'mid':''} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>;})}
   {[30,60].map(degree=>{const p=polar(cx,cy,facing,degree,30);return <text key={degree} x={p.x} y={p.y+2.6}>{degree}</text>;})}
   <polygon className="angle-gauge-needle" points={`${tip.x},${tip.y} ${left.x},${left.y} ${tail.x},${tail.y} ${right.x},${right.y}`} fill="url(#angle-gauge-needle)"/>
   <polygon className="angle-gauge-needle-shine" points={`${tip.x},${tip.y} ${shineLeft.x},${shineLeft.y} ${shine.x},${shine.y}`}/>
   <circle className="angle-gauge-hub" cx={cx} cy={cy} r="5.8" fill="url(#angle-gauge-hub)"/>
   <ellipse className="angle-gauge-glass" cx="52" cy="30" rx="30" ry="15"/>
  </svg>
  <div className="angle-gauge-readout"><strong>{angle}<small>°</small></strong><span>{slope?`TERRENO ${slope>0?'+':''}${slope}°`:'ÂNGULO'}</span></div>
 </div>;
}

/** Gold arrow of the angle buttons: a bevelled triangle with a lit top face. */
export function AngleArrow({up}:{up:boolean}){
 return <svg viewBox="0 0 24 20" aria-hidden="true" className="angle-arrow" style={up?undefined:{transform:'scaleY(-1)'}}>
  <path className="angle-arrow-body" d="M10.4 2.9Q12 .9 13.6 2.9L22.6 15.8Q23.6 18 21.2 18H2.8Q.4 18 1.4 15.8Z"/>
  <path className="angle-arrow-face" d="M12 5.4 18.6 15.3H5.4Z"/>
  <path className="angle-arrow-shine" d="M12 5.4 15.2 10.2Q12 9.2 8.8 10.2Z"/>
 </svg>;
}

/** Combat Power orb. The server zeroes the charge when Power is armed; the
 * liquid keeps the previous level for one frame and then drains visibly.
 * While it can't be used (`blocked`) a click shows why instead of doing nothing. */
export function PowerOrb({charge,armed,blocked,onActivate}:{charge:number;armed:boolean;blocked?:string;onActivate:()=>void}){
 // Raiva is 0–200 on the server; the orb shows the percentage and is full only at the real 200.
 const level=armed?0:powerPercent(charge),full=!armed&&powerFull(charge),ready=full&&!blocked;
 const [draining,setDraining]=useState(false),wasArmed=useRef(armed);
 const [notice,setNotice]=useState<{text:string;key:number}|null>(null);
 useEffect(()=>{
  const started=armed&&!wasArmed.current;wasArmed.current=armed;
  if(!started)return;
  setDraining(true);const timer=setTimeout(()=>setDraining(false),1400);return()=>clearTimeout(timer);
 },[armed]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),1800);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{if(!blocked)setNotice(null);},[blocked]);
 return <button type="button" className={`combat-power ${full?'power-full':''} ${ready?'power-ready':''} ${armed?'power-armed':''} ${draining?'power-draining':''}`} style={{'--power-level':`${level}%`} as CSSProperties} aria-disabled={!!blocked} aria-label={armed?'POW preparado':`Ativar POW, ${level}%`} aria-pressed={armed} title={`Enche ao atacar (+10%), passar a vez (+20%) e receber dano. Cheia, ative na sua vez (clique ou B) para o especial da arma no próximo tiro. A carga é gasta na ativação; passar ou deixar o tempo acabar perde o especial. (${POWER_MAX} pontos = 100%)`} onClick={event=>{if(event.detail>0)event.currentTarget.blur();if(blocked){setNotice(current=>({text:blocked,key:(current?.key??0)+1}));return;}onActivate();}}>
  <span className="combat-power-rays" aria-hidden="true"/>
  <span className="combat-power-flames" aria-hidden="true"/>
  <span className="combat-power-glass" aria-hidden="true">
   <span className="combat-power-liquid"><i/><i/></span>
   <span className="combat-power-bubbles"><i/><i/><i/><i/></span>
  </span>
  <span className="combat-power-burst" aria-hidden="true"/>
  <span className="combat-power-core"><strong>POW</strong>{!full&&!armed&&<small data-testid="power-charge">{level}%</small>}</span>
  {notice&&<span key={notice.key} className="combat-power-notice" role="status">{notice.text}</span>}
 </button>;
}

/** Wind reaches ±3.5 (server `wind()`); the arrow's motion grows with it. */
const WIND_MAX=3.5;
const windStrength=(wind:number)=>Math.min(1,Math.abs(wind)/WIND_MAX);
function WindArrow({wind}:{wind:number}){
 const k=windStrength(wind),calm=Math.abs(wind)<.05;
 // A quiet drift (matheus, 17/10: the streaks were too loud): weak wind 1px every 2.6s, strong wind 4px every 1.4s.
 const style={'--wind-amp':`${1+k*3}px`,'--wind-speed':`${2.6-k*1.2}s`} as CSSProperties;
 return <span className={`wind-arrow ${wind<0?'wind-left':''} ${calm?'wind-calm':''}`} style={style} aria-hidden="true">
  <svg viewBox="0 0 48 28"><path d="M3 9h22V3a1 1 0 0 1 1.6-.8l18.6 11a1.1 1.1 0 0 1 0 1.8L26.6 26a1 1 0 0 1-1.6-.8V19H3l5-5z" fill="url(#battle-wind-arrow)" stroke="#133954" strokeWidth="2" strokeLinejoin="round"/><path d="M10 11.5h14M29 8l9 5.5" fill="none" stroke="#fff8cc" strokeWidth="1.8" strokeLinecap="round"/></svg>
 </span>;
}
/** Battle wind: no plate, outlined number, an arrow that drifts a little more the stronger the wind,
 * and the wind of my last shot underneath (beside "Último" force it helps repeat a shot). */
export function WindGauge({wind,last}:{wind:number;last:number|null}){
 const direction=(value:number)=>Math.abs(value)<.05?'sem vento':value<0?'para a esquerda':'para a direita';
 return <div className="wind-gauge" role="status" aria-label={`Vento ${Math.abs(wind).toFixed(1)} ${direction(wind)}${last===null?'':`; no seu último tiro ${Math.abs(last).toFixed(1)} ${direction(last)}`}`}>
  <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true"><defs><linearGradient id="battle-wind-arrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3fcff"/><stop offset=".5" stopColor="#a0ebff"/><stop offset="1" stopColor="#319dd1"/></linearGradient></defs></svg>
  <small className="wind-title">VENTO</small>
  <div className={`wind-now ${wind<0?'wind-now-left':''}`}><strong data-testid="wind-value">{Math.abs(wind).toFixed(1)}</strong><WindArrow wind={wind}/></div>
  {last!==null&&<div className="wind-last" data-testid="last-wind"><small>ÚLTIMO</small><b>{Math.abs(last).toFixed(1)}</b><WindArrow wind={last}/></div>}
 </div>;
}
