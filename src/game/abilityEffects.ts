import type {AbilityEffect} from '../../shared/abilities';
import type {Projectile} from '../../shared/protocol';
import type {WeaponEffectOptions} from './weaponEffects';

export type AbilityEffectOptions=WeaponEffectOptions;
export const ABILITY_EFFECT_DURATION=1300;
export const TELEPORT_EFFECT_DURATION=780;
export const ABILITY_VFX_LIMITS={high:{stars:13,motes:16,trail:15},low:{stars:6,motes:7,trail:8}} as const;
const TAU=Math.PI*2;
const clamp=(v:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const ease=(v:number)=>1-Math.pow(1-clamp(v),3);
const reduced=(o:AbilityEffectOptions)=>o.reducedMotion??(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const budget=(o:AbilityEffectOptions)=>ABILITY_VFX_LIMITS[o.quality==='low'?'low':'high'];
const visible=(x:number,y:number)=>Number.isFinite(x)&&Number.isFinite(y)&&x>-9999&&y>-9999;
const icons=new Map<string,HTMLImageElement>();
const lights=new Map<string,HTMLCanvasElement>();
const labels=new Map<number,HTMLCanvasElement>();
let preload:Promise<void>|undefined;

/** UI and world effects reuse the same paintings. No per-frame decoding/readback. */
export function preloadAbilityEffects():Promise<void>{
 if(preload)return preload;
 if(typeof Image==='undefined')return Promise.resolve();
 preload=Promise.all(['heal','homing','invisibility','flight'].map(id=>new Promise<void>(resolve=>{
  const image=new Image();image.onload=()=>{icons.set(id,image);resolve();};image.onerror=()=>resolve();image.src=`/assets/abilities/${id}.png`;
 }))).then(()=>undefined);return preload;
}
if(typeof Image!=='undefined')void preloadAbilityEffects();

function light(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,opacity:number){
 let sprite=lights.get(color);
 if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=96;const p=sprite.getContext('2d')!;const g=p.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,color+'8c');g.addColorStop(.24,color+'45');g.addColorStop(.64,color+'16');g.addColorStop(1,color+'00');p.fillStyle=g;p.fillRect(0,0,96,96);lights.set(color,sprite);}
 c.save();c.globalAlpha*=opacity;c.drawImage(sprite,x-r,y-r,r*2,r*2);c.restore();
}
function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,angle=0){
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(r*.16,-r*.16,r,0);c.quadraticCurveTo(r*.16,r*.16,0,r);c.quadraticCurveTo(-r*.16,r*.16,-r,0);c.quadraticCurveTo(-r*.16,-r*.16,0,-r);c.fill();c.restore();
}
function numberSprite(amount:number){
 const value=Math.round(amount);let image=labels.get(value);if(image)return image;
 image=document.createElement('canvas');image.width=180;image.height=70;const c=image.getContext('2d')!;
 c.font='900 35px "Trebuchet MS", sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=6;c.strokeStyle='#103b35';c.strokeText(`+${value}`,90,35);
 c.lineWidth=2;c.strokeStyle='#c5ffbc';c.strokeText(`+${value}`,90,34);const g=c.createLinearGradient(0,12,0,53);g.addColorStop(0,'#e4ffc3');g.addColorStop(.45,'#a0ff6b');g.addColorStop(1,'#1fce75');c.fillStyle=g;c.fillText(`+${value}`,90,34);
 if(labels.size>=16)labels.delete(labels.keys().next().value!);labels.set(value,image);return image;
}

function heal(c:CanvasRenderingContext2D,event:AbilityEffect,age:number,o:AbilityEffectOptions){
 const t=age/ABILITY_EFFECT_DURATION,quiet=reduced(o),travel=quiet?0:ease(t),fade=clamp(t/.07)*Math.pow(1-t,.65),count=budget(o).stars;
 c.save();c.translate(event.x,event.y);c.globalAlpha*=fade;c.globalCompositeOperation='screen';
 light(c,0,-43,47,'#39ec9e',.46*(1-t));
 // Two open spirals wrap the body, without a solid disc under its feet.
 c.strokeStyle='#71ffae';c.lineWidth=1.1;c.globalAlpha*=.55;
 for(let side=-1;side<=1;side+=2){c.beginPath();for(let n=0;n<=17;n++){const q=n/17,a=q*TAU+side*.9+travel*2.4,x=Math.sin(a)*27*side,y=-12-q*69-travel*12;if(n===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 c.restore();c.save();c.translate(event.x,event.y);c.globalCompositeOperation='screen';
 for(let n=0;n<count;n++){const seed=n*2.399963,q=quiet?.42:clamp(t*1.3-n/count*.28),a=seed+(quiet?0:t*1.2),radius=18+(n%4)*7,x=Math.cos(a)*radius,y=-17-(n%5)*13-q*34,alpha=Math.sin(Math.PI*q)*fade;c.save();c.globalAlpha*=alpha;star(c,x,y,2.2+n%3*.8,n%3===0?'#e4ffc1':'#64ffb4',quiet?seed:t+seed);c.restore();}
 c.restore();
 if(Number.isFinite(event.amount)&&event.amount!>0){c.save();c.globalAlpha*=fade;const pop=quiet?1:.9+.12*Math.sin(clamp(t/.3)*Math.PI);c.translate(event.x,event.y-106-travel*19);c.scale(pop,pop);c.drawImage(numberSprite(Math.min(9999,event.amount!)),-90,-35);c.restore();}
}

function homing(c:CanvasRenderingContext2D,event:AbilityEffect,age:number,o:AbilityEffectOptions){
 const duration=950,t=age/duration;if(t>=1)return;const quiet=reduced(o),arrive=quiet?1:ease(t*3),fade=clamp(t/.06)*Math.pow(1-t,.5),radius=22+(1-arrive)*21;
 c.save();c.translate(event.x,event.y-52);c.globalAlpha*=fade;c.globalCompositeOperation='screen';light(c,0,0,48,'#ffb34b',.32);c.lineWidth=1.6;c.strokeStyle='#ffcf71';
 for(let n=0;n<4;n++){const a=n*Math.PI/2+(quiet?0:(1-arrive)*.6);c.beginPath();c.arc(0,0,radius,a+.19,a+Math.PI/2-.19);c.stroke();c.save();c.rotate(a);c.fillStyle='#fff5c8';c.beginPath();c.moveTo(radius-7,0);c.lineTo(radius+2,-3);c.lineTo(radius+2,3);c.closePath();c.fill();c.restore();}
 c.strokeStyle='#ff6c4b';c.lineWidth=1.1;c.beginPath();c.arc(0,0,6+2*(1-arrive),0,TAU);c.stroke();star(c,0,0,4,'#fff0ac');
 if(o.quality!=='low')for(let n=0;n<4;n++){const a=n*Math.PI/2+.5+(quiet?0:t),r=quiet?34:34+8*t;star(c,Math.cos(a)*r,Math.sin(a)*r,1.5,'#ffe1a0',a);}
 c.restore();
}

function invisibility(c:CanvasRenderingContext2D,event:AbilityEffect,age:number,o:AbilityEffectOptions){
 const duration=1050,t=age/duration;if(t>=1)return;const quiet=reduced(o),fade=clamp(t/.06)*Math.pow(1-t,.9),count=budget(o).motes;
 c.save();c.translate(event.x,event.y);c.globalAlpha*=fade;c.globalCompositeOperation='screen';light(c,0,-50,44,'#9c7dff',.23*(1-t));
 // Vanishing light surrounds the authorized position. It never stores a body clone.
 c.lineWidth=.9;c.strokeStyle='#96e7ff';
 for(let n=0;n<(o.quality==='low'?2:3);n++){const y=-16-n*27-(quiet?0:t*16),r=24-n*3+(quiet?0:Math.sin(t*7+n)*3);c.beginPath();c.moveTo(-r,y);c.bezierCurveTo(-r-5,y-18,r-10,y-5,r,y-23);c.stroke();}
 for(let n=0;n<count;n++){const phase=n*2.399963,travel=quiet?.2:t,r=19+n%4*5+travel*12,x=Math.cos(phase+travel*.35)*r,y=-11-(n%6)*14-travel*(10+n%3*8);c.save();c.globalAlpha*=quiet?.65:.35+.55*(.5+.5*Math.sin(n*3+t*7));star(c,x,y,1.3+n%3*.7,n%2?'#b6f5ff':'#bb9fff',phase+travel);c.restore();}
 c.restore();
}

/** Coordinates are feet in world space. 'hidden' must never reveal enemy positions. */
export function drawAbilityEffect(c:CanvasRenderingContext2D,event:AbilityEffect,age:number,options:AbilityEffectOptions={}){
 if(event.hidden||!visible(event.x,event.y)||!Number.isFinite(age)||age<0||age>=ABILITY_EFFECT_DURATION)return;
 if(event.ability==='heal')heal(c,event,age,options);
 else if(event.ability==='homing')homing(c,event,age,options);
 else if(event.ability==='invisibility')invisibility(c,event,age,options);
 else if(event.ability==='flight')drawTeleportEffect(c,event.x,event.y,age,options);
}

/** Actual motion follows the server trajectory even under reduced-motion settings. */
export function drawFlightProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number,time:number,options:AbilityEffectOptions={}){
 if(!p.points.length||!Number.isFinite(index))return;
 const sample=clamp(index,0,p.points.length-1),i=Math.floor(sample),a=p.points[i],b=p.points[Math.min(i+1,p.points.length-1)],fraction=sample-i,x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction;if(!visible(x,y))return;
 const previous=p.points[Math.max(0,i-1)],angle=Math.atan2(b[1]-previous[1],b[0]-previous[0]),start=Math.max(0,i-budget(options).trail),quiet=reduced(options),clock=quiet?0:time;
 c.save();c.lineCap='round';c.lineJoin='round';const from=p.points[start],g=c.createLinearGradient(from[0],from[1],x+.01,y+.01);g.addColorStop(0,'#70dfff00');g.addColorStop(.7,'#89efff35');g.addColorStop(1,'#e7fffa9c');c.strokeStyle=g;c.lineWidth=1.4;c.beginPath();for(let n=start;n<=i;n++){const point=p.points[n];if(n===start)c.moveTo(point[0],point[1]);else c.lineTo(point[0],point[1]);}c.lineTo(x,y);c.stroke();
 c.globalCompositeOperation='screen';const count=options.quality==='low'?3:6;
 for(let n=0;n<count;n++){const phase=(clock/900+n/count)%1,j=Math.max(0,Math.floor(sample-phase*budget(options).trail)),point=p.points[j];c.save();c.globalAlpha*=(1-phase)*.5;star(c,point[0],point[1]+Math.sin(n*2.4+clock/350)*phase*4,1.2,'#c5faff',clock/700+n);c.restore();}
 c.globalCompositeOperation='source-over';c.translate(x,y);c.rotate(angle+Math.PI/4+(quiet?0:Math.sin(clock/210)*.035));
 const plane=icons.get('flight');if(plane)c.drawImage(plane,-24,-24,48,48);c.restore();
}

/** A short vertical refraction flash, not an opaque portal or lasting pedestal. */
export function drawTeleportEffect(c:CanvasRenderingContext2D,x:number,y:number,age:number,options:AbilityEffectOptions={}){
 const t=age/TELEPORT_EFFECT_DURATION;if(!visible(x,y)||!Number.isFinite(age)||t<0||t>=1)return;
 const quiet=reduced(options),open=quiet?.7:ease(t*3),fade=clamp(t/.04)*Math.pow(1-t,.8),count=budget(options).motes;
 c.save();c.translate(x,y);c.globalAlpha*=fade;c.globalCompositeOperation='screen';light(c,0,-43,54,'#69e2ff',.35*(1-t));
 c.strokeStyle='#b7fbff';c.lineWidth=1.2;
 for(let n=0;n<(options.quality==='low'?2:3);n++){const width=9+n*11+open*10;c.beginPath();c.moveTo(-width,-7);c.bezierCurveTo(-width+6,-40,-width+4,-68,0,-93-open*8);c.bezierCurveTo(width-4,-68,width-6,-40,width,-7);c.stroke();}
 for(let n=0;n<count;n++){const phase=n*2.399963,r=(12+n%4*5)*(quiet?1:.6+open),px=Math.cos(phase)*r,py=-14-(n%6)*14-(quiet?0:t*20);c.save();c.globalAlpha*=.3+(1-t)*.5;star(c,px,py,1.6+n%3*.6,n%3?'#a9f6ff':'#fff2b1',phase+(quiet?0:t*2));c.restore();}
 c.restore();
}

export function abilityEffectCacheStats(){return {icons:icons.size,lights:lights.size,labels:labels.size,rgbaBytes:[...icons.values()].reduce((sum,image)=>sum+image.naturalWidth*image.naturalHeight*4,0)+lights.size*96*96*4+labels.size*180*70*4};}
