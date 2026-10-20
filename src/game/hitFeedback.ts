import type {ShotHit} from '../../shared/protocol';
import type {WeaponEffectOptions} from './weaponEffects';

export const HIT_FEEDBACK_DURATION=1200;
/** Vertical gap between numbers stacked on the same fighter by one shot (one number per hit). */
export const HIT_STACK_GAP=40;
/** Stack slots per fighter: a long burst (+1/+2 repeated, Tridente) reuses slots freed by numbers that faded instead of climbing the screen. */
export const HIT_STACK_SLOTS=4;

interface StackImpact {shotId:string;at:number;projectileIndex:number;hits:readonly ShotHit[]}
/** Slot of `hit` above its fighter: the lowest slot no earlier number of the same shot still holds when it appears
 * (all slots busy: the one whose number fades first). Fixed for the number's whole life. */
export function hitStackSlot(impacts:readonly StackImpact[],impact:StackImpact,hit:ShotHit){
 const order=impacts.filter(other=>other.shotId===impact.shotId).sort((a,b)=>a.at-b.at||a.projectileIndex-b.projectileIndex);
 const until=Array<number>(HIT_STACK_SLOTS).fill(-Infinity);
 for(const other of order)for(const h of other.hits){
  if(h.id!==hit.id||h.hidden||!(h.damage>0))continue;
  let slot=until.findIndex(end=>end<=other.at);if(slot<0)slot=until.indexOf(Math.min(...until));
  if(h===hit)return slot;
  until[slot]=other.at+HIT_FEEDBACK_DURATION;
 }
 return 0;
}
/** Numbers are drawn at this fraction of the sprite size so they don't cover the fighters. */
const NUMBER_SCALE=.78;
// Padded so the longest spikes and their miter joins never touch the sprite edge.
const W=440,H=200,CX=W/2,CY=H/2;
const FONT='"Lilita One","Nunito",sans-serif';
const textCache=new Map<string,HTMLCanvasElement>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Fixed spike lengths so the critical burst keeps the same hand-cut silhouette every time.
const SPIKES=[1,.78,1.12,.86,.95,1.18,.8,1.04,.9,1.15,.76,1.08,.93,1.2,.84,1.02,.88,1.1];

/** Stable pseudo-random value in [0,1) per hit, so a number keeps its spot every frame but hits don't all land on the same spot. */
function jitter(hit:ShotHit,salt:number){let h=2166136261^salt;for(const ch of `${hit.id}:${hit.projectileIndex}:${Math.round(hit.damage)}:${Math.round(hit.x)}:${Math.round(hit.y)}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;}

function fontReady(){try{return typeof document==='undefined'||!document.fonts||document.fonts.check(`40px ${FONT}`);}catch{return true;}}

/** Red jagged starburst painted behind critical numbers, DDTank style. */
function drawBurst(c:CanvasRenderingContext2D,rx:number,ry:number){
 const star=(scale:number)=>{c.beginPath();SPIKES.forEach((length,n)=>{const theta=n*Math.PI/SPIKES.length*2-Math.PI/2+.08,tip=n%2===0;const r=tip?length*scale:.62*scale;const px=Math.cos(theta)*rx*r,py=Math.sin(theta)*ry*r;if(n===0)c.moveTo(px,py);else c.lineTo(px,py);});c.closePath();};
 c.save();c.translate(CX,CY);c.lineJoin='miter';c.miterLimit=4;
 star(1);c.lineWidth=7;c.strokeStyle='#3a0404';c.stroke();
 const fill=c.createRadialGradient(0,-ry*.15,4,0,0,rx*1.1);fill.addColorStop(0,'#ff6a3a');fill.addColorStop(.38,'#ec2414');fill.addColorStop(.8,'#b60b0b');fill.addColorStop(1,'#7c0505');
 c.fillStyle=fill;c.fill();
 star(1);c.lineWidth=2;c.strokeStyle='#ff8a52';c.globalAlpha=.55;c.stroke();c.globalAlpha=1;
 // Inner glow keeps the digits readable on the red.
 const glow=c.createRadialGradient(0,0,2,0,0,rx*.6);glow.addColorStop(0,'rgba(255,190,90,.55)');glow.addColorStop(1,'rgba(255,120,40,0)');c.fillStyle=glow;star(.66);c.fill();
 c.restore();
}

/** Chunky yellow-orange numerals with a dark outline and a dropped 3D edge. */
// Damage numbers are yellow-orange; healing numbers use the same shape in green.
const PALETTES={damage:{edge:'#2e1002',side:'#5c2203',outline:'#3a1403',stops:['#fffbc4','#ffe236','#ffaa12','#f0600c'],rim:'rgba(255,246,190,.7)'},
 heal:{edge:'#062a10',side:'#0e5a22',outline:'#08371a',stops:['#eaffd6','#8ff25a','#3fcf2e','#159a22'],rim:'rgba(220,255,200,.7)'}};
function drawDigits(c:CanvasRenderingContext2D,value:string,size:number,y:number,palette=PALETTES.damage){
 c.font=`${size}px ${FONT}`;
 const depth=Math.round(size*.09);
 c.lineWidth=size*.24;c.strokeStyle=palette.edge;c.strokeText(value,CX,y+depth);c.fillStyle=palette.side;c.fillText(value,CX,y+depth);
 c.lineWidth=size*.22;c.strokeStyle=palette.outline;c.strokeText(value,CX,y);
 const fill=c.createLinearGradient(0,y-size*.5,0,y+size*.45);palette.stops.forEach((color,i)=>fill.addColorStop([0,.3,.62,1][i],color));
 c.fillStyle=fill;c.fillText(value,CX,y);
 // Glossy bevel on the upper half of each digit.
 c.save();c.beginPath();c.rect(0,y-size*.6,W,size*.48);c.clip();c.globalAlpha=.4;c.fillStyle='#ffffff';c.fillText(value,CX,y-size*.035);c.restore();
 c.lineWidth=1.2;c.strokeStyle=palette.rim;c.strokeText(value,CX,y);
}

function textFor(hit:ShotHit,heal=false){
 const critical=hit.critical===true&&!heal,kind=hit.kind,value=`${heal?'+':''}${Math.max(0,Math.round(hit.damage))}`,key=`${heal?'heal':critical}:${kind}:${value}`;
 const known=textCache.get(key);if(known)return known;
 const art=document.createElement('canvas');art.width=W;art.height=H;const c=art.getContext('2d')!;
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 const size=critical?50:42;
 if(critical){c.font=`${size}px ${FONT}`;const width=c.measureText(value).width;drawBurst(c,Math.min(160,width/2+30),54);}
 const label=heal?'':kind==='graze'?'RASPÃO':kind==='fall'?'QUEDA':'';
 if(label&&!critical){c.font=`17px ${FONT}`;c.lineWidth=5;c.strokeStyle='#14233a';c.strokeText(label,CX,CY-38);c.fillStyle='#bfe4fa';c.fillText(label,CX,CY-38);}
 drawDigits(c,value,size,CY,heal?PALETTES.heal:PALETTES.damage);
 // Text drawn before the webfont arrives would be frozen in the fallback face: only cache once it is ready.
 if(fontReady()){textCache.set(key,art);if(textCache.size>96)textCache.delete(textCache.keys().next().value!);}
 return art;
}

/** Read-only feedback: damage, critical and hit kind always come from the server. With `heal`, the same number in green with a plus: HP restored.
 * Call in world coordinates at the matching authoritative impact's visual age.
 * `stack` is how many earlier hits of the same shot landed on this fighter, so each hit gets its own number above the last. */
export function drawHitFeedback(c:CanvasRenderingContext2D,hit:ShotHit,age:number,options:WeaponEffectOptions&{stack?:number;heal?:boolean}={}){
 const heal=options.heal===true,critical=hit.critical===true&&!heal,duration=HIT_FEEDBACK_DURATION;if(age<0||age>=duration||!Number.isFinite(hit.damage)||hit.damage<=0)return;
 const progress=age/duration,motion=options.reducedMotion??motionPreference?.matches??false,stack=Math.max(0,options.stack??0);
 // Pop in oversized, settle with a small bounce, hold, then drift up while fading.
 const entrance=clamp(age/(critical?170:130)),settle=clamp((age-(critical?170:130))/140),fade=1-clamp((progress-.7)/.3);
 const scale=motion?1:entrance<1?.35+entrance*1.05:1.4-.4*settle-Math.sin(settle*Math.PI)*.06;
 // Each hit lands somewhere around the fighter's head and drifts a little sideways, instead of always on the same spot.
 const offsetX=(jitter(hit,1)-.5)*70,offsetY=(jitter(hit,2)-.5)*8,drift=(jitter(hit,3)-.5)*24,tilt=(jitter(hit,4)-.5)*.14;
 const x=hit.x+offsetX+(motion?0:drift*progress),y=hit.y-26+offsetY-stack*HIT_STACK_GAP-(motion?0:Math.max(0,progress-.55)*34);
 c.save();c.translate(x,y);c.scale(scale*NUMBER_SCALE,scale*NUMBER_SCALE);c.rotate(motion?0:tilt+(critical?-.06+.06*settle:0));c.globalAlpha*=fade*(motion?1:Math.min(1,entrance*1.6));
 c.drawImage(textFor(hit,heal),-W/2,-H/2);c.restore();
}
