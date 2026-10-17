import type {ShotHit} from '../../shared/protocol';
import type {WeaponEffectOptions} from './weaponEffects';

export const HIT_FEEDBACK_DURATION=1100;
const textCache=new Map<string,HTMLCanvasElement>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

function textFor(hit:ShotHit){
 const critical=hit.critical===true,kind=hit.kind,key=`${critical}:${kind}:${Math.max(0,Math.round(hit.damage))}`;
 const known=textCache.get(key);if(known)return known;
 const art=document.createElement('canvas');art.width=240;art.height=112;const c=art.getContext('2d')!;
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 const label=critical?'CRÍTICO!':kind==='graze'?'RASPÃO':kind==='fall'?'QUEDA':'';
 if(label){c.font=`900 ${critical?15:10}px "Nunito",sans-serif`;c.lineWidth=4;c.strokeStyle=critical?'#531b28':'#1a2943';c.strokeText(label,120,22);c.fillStyle=critical?'#ffe7a3':'#b9def3';c.fillText(label,120,22);}
 const value=String(Math.max(0,Math.round(hit.damage))),y=critical?61:57;
 c.font=`900 ${critical?42:30}px "Nunito",sans-serif`;
 c.lineWidth=critical?8:6;c.strokeStyle=critical?'#4c1727':'#13243b';c.strokeText(value,120,y);
 c.lineWidth=critical?3:1;c.strokeStyle=critical?'#ffdc98':'#fbf6dc';c.strokeText(value,120,y);
 const fill=c.createLinearGradient(0,y-23,0,y+22);fill.addColorStop(0,critical?'#fff8cf':kind==='graze'?'#eaf6ff':'#ffffff');fill.addColorStop(.45,critical?'#ffc94e':'#fff3bd');fill.addColorStop(1,critical?'#ff593e':kind==='graze'?'#8ab7db':'#f1c66b');c.fillStyle=fill;c.fillText(value,120,y);
 textCache.set(key,art);if(textCache.size>96)textCache.delete(textCache.keys().next().value!);return art;
}

/** Read-only feedback: damage, critical and hit kind always come from the server.
 * Call in world coordinates at the matching authoritative impact's visual age. */
export function drawHitFeedback(c:CanvasRenderingContext2D,hit:ShotHit,age:number,options:WeaponEffectOptions={}){
 const critical=hit.critical===true,duration=critical?HIT_FEEDBACK_DURATION:900;if(age<0||age>=duration||!Number.isFinite(hit.damage)||hit.damage<=0)return;
 const progress=age/duration,motion=options.reducedMotion??motionPreference?.matches??false,entrance=clamp(age/(critical?150:100)),fade=1-clamp((progress-.57)/.43),pop=motion?1:1+Math.sin(entrance*Math.PI)*.18-(1-entrance)*.25;
 const lane=(hit.projectileIndex%3)-1,x=hit.x+(motion?0:lane*(critical?12:8)*Math.min(1,progress*2)),y=hit.y-24-(motion?0:Math.min(52,progress*65));
 c.save();c.translate(x,y);c.scale(pop,pop);if(critical&&!motion)c.rotate(-.055*Math.exp(-progress*8));c.globalAlpha*=fade;
 if(critical){
  // A compact translucent burst frames the numeral without hiding the fighter.
  c.save();c.globalAlpha*=.52*(1-progress*.65);c.fillStyle='#5f1b36';c.strokeStyle='#ffb957';c.lineWidth=1.3;
  c.beginPath();for(let n=0;n<16;n++){const theta=n*Math.PI/8,outer=n%2===0,r=outer?1:.76,px=Math.cos(theta)*r*76,py=Math.sin(theta)*r*35;if(n===0)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fill();c.stroke();c.restore();
  const burst=clamp(age/320),rays=options.quality==='low'||motion?4:8;
  if(burst<1){c.save();c.globalAlpha*=(1-burst)*.8;c.strokeStyle='#ffe5a0';c.lineWidth=1.4;c.lineCap='round';for(let n=0;n<rays;n++){const theta=n*Math.PI*2/rays+.2,rx=72+burst*24,ry=35+burst*15;c.beginPath();c.moveTo(Math.cos(theta)*rx,Math.sin(theta)*ry);c.lineTo(Math.cos(theta)*(rx+6),Math.sin(theta)*(ry+4));c.stroke();}c.restore();}
 }
 c.drawImage(textFor(hit),-120,-57);c.restore();
}
