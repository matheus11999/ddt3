import type {Projectile} from '../../shared/protocol';
import {WEAPONS,weaponPhaseTier} from '../../shared/catalog';
import {weaponEffectsPath,weaponKit} from '../../shared/weaponKit';
import {MATERIALS} from '../../shared/maps';
import type {MaterialId} from '../../shared/maps';

type Effect=Projectile['effect'];
type Cell={solid:HTMLCanvasElement;energy:HTMLCanvasElement[];width:number;height:number};
/** tilt: radians the painted projectiles point above horizontal, undone when drawing the top row. */
type Atlas={cells:Cell[];ready:Promise<void>;tilt:number};
export interface WeaponEffectOptions {quality?:'high'|'low';reducedMotion?:boolean;}
export const VFX_LIMITS={high:{trailSamples:18,flightParticles:16,impactParticles:26,debris:14},low:{trailSamples:8,flightParticles:6,impactParticles:10,debris:6}} as const;
const TAU=Math.PI*2;
const FAMILY:Record<Effect,{hot:string;mid:string;dark:string;size:readonly number[];trail:readonly number[]}>= {
 fire:{hot:'#fff09a',mid:'#ff7920',dark:'#b72a20',size:[42,48,57,66],trail:[6,12,18,25]},
 electric:{hot:'#c1fdff',mid:'#25caff',dark:'#4154ea',size:[35,40,47,54],trail:[5,11,17,24]},
 dynamite:{hot:'#fff3b4',mid:'#ffaf24',dark:'#d84b2a',size:[30,36,42,48],trail:[8,12,16,21]},
 crystal:{hot:'#e6caff',mid:'#ed58ff',dark:'#7033d9',size:[51,58,65,73],trail:[5,10,15,21]},
 brick:{hot:'#ffdc9c',mid:'#ff6a2e',dark:'#9c2a1a',size:[36,42,50,58],trail:[7,10,14,18]}
};
const atlases=new Map<Effect,Atlas>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const reduced=(options:WeaponEffectOptions)=>options.reducedMotion??motionPreference?.matches??false;
const limits=(options:WeaponEffectOptions)=>VFX_LIMITS[options.quality==='low'||reduced(options)?'low':'high'];
function strength(level:number){return weaponPhaseTier(level);}
function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}
const noise=(n:number)=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const canvas=(width:number,height:number)=>{const out=document.createElement('canvas');out.width=Math.max(1,Math.round(width));out.height=Math.max(1,Math.round(height));return out;};

function atlasFor(effect:Effect):Atlas{
 const cached=atlases.get(effect);if(cached)return cached;
 const image=new Image();const weapon=WEAPONS.find(item=>item.effect===effect),atlas:Atlas={cells:[],ready:Promise.resolve(),tilt:(weapon&&weaponKit(weapon.id)?.projectileTilt||0)*Math.PI/180};
 atlas.ready=new Promise(resolve=>{
  image.onload=()=>{
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
   // The generator leaves alpha 1 in empty cells. Clean it once at runtime,
   // retaining painted glows; the original RGBA artwork remains untouched.
   for(let i=3;i<data.length;i+=4)if(data[i]<=12)data[i]=0;
   context.putImageData(pixels,0,0);
   for(let row=0;row<3;row++)for(let column=0;column<4;column++){
    const left=Math.round(column*canvas.width/4),right=Math.round((column+1)*canvas.width/4),top=Math.round(row*canvas.height/3),bottom=Math.round((row+1)*canvas.height/3);
    let x0=right,x1=left,y0=bottom,y1=top;
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*canvas.width+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    x0=Math.max(left,x0-2);y0=Math.max(top,y0-2);x1=Math.min(right,x1+3);y1=Math.min(bottom,y1+3);
    const width=Math.max(1,x1-x0),height=Math.max(1,y1-y0),scale=Math.min(1,144/Math.max(width,height));
    const solid=document.createElement('canvas');solid.width=Math.max(1,Math.round(width*scale));solid.height=Math.max(1,Math.round(height*scale));
    const solidContext=solid.getContext('2d')!;solidContext.drawImage(canvas,x0,y0,width,height,0,0,solid.width,solid.height);
    const original=solidContext.getImageData(0,0,solid.width,solid.height),energy:HTMLCanvasElement[]=[];
    // Six precomputed erosion frames break painted flashes into translucent
    // fragments. No pixel readback, masks or particle allocations during play.
    for(let frame=0;frame<(row===0?1:6);frame++){
     const layer=document.createElement('canvas');layer.width=solid.width;layer.height=solid.height;const context=layer.getContext('2d')!,out=context.createImageData(layer.width,layer.height);out.data.set(original.data);
     for(let i=0;i<out.data.length;i+=4){const x=(i/4)%layer.width,y=Math.floor(i/4/layer.width),light=Math.max(out.data[i],out.data[i+1],out.data[i+2])/255;
      const field=.5+Math.sin(x*.19+y*.13)*.2+Math.sin(x*.071-y*.23)*.16+(noise(Math.floor(x/3)+Math.floor(y/3)*73)-.5)*.24;
      out.data[i+3]=Math.round(out.data[i+3]*(.12+light*.74)*(frame?clamp((field-frame*.13)/.18):1));
     }
     context.putImageData(out,0,0);energy.push(layer);
    }
    atlas.cells.push({solid:row===0?solid:energy[0],energy,width,height});
   }
   image.onload=null;image.onerror=null;resolve();
  };
  // Each weapon paints its own atlas (shared/weaponKit.ts); an effect no weapon uses keeps the drawn fallback.
  if(!weapon){resolve();return;}
  image.onerror=()=>resolve();image.src=weaponEffectsPath(weapon.id);
 });
 atlases.set(effect,atlas);return atlas;
}
/** Warms all paintings while the player chooses a room or prepares a shot. */
export function preloadWeaponEffects(){return Promise.all([...new Set(WEAPONS.map(weapon=>weapon.effect))].map(effect=>atlasFor(effect).ready));}
/** Diagnostics for the fixed renderer budget; caches contain no per-shot state. */
export function weaponEffectCacheStats(){const images=new Set<HTMLCanvasElement>(glowCache.values());for(const atlas of atlases.values())for(const cell of atlas.cells)for(const image of [cell.solid,...cell.energy])images.add(image);let rgbaBytes=0;for(const image of images)rgbaBytes+=image.width*image.height*4;return {families:atlases.size,surfaces:images.size,rgbaBytes};}
if(typeof Image!=='undefined')void preloadWeaponEffects();

function sprite(c:CanvasRenderingContext2D,effect:Effect,row:number,tier:number,x:number,y:number,width:number,angle=0,anchor=.5,alpha=1,dissolve=0,energy=row!==0){
 const atlas=atlasFor(effect),cell=atlas.cells[row*4+tier];if(!cell)return false;
 if(row===0)angle+=atlas.tilt;
 const height=width*cell.height/cell.width;
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;c.drawImage(energy?cell.energy[Math.min(cell.energy.length-1,Math.floor(clamp(dissolve)*6))]:cell.solid,-width*anchor,-height*.5,width,height);c.restore();return true;
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.fill();}
const glowCache=new Map<string,HTMLCanvasElement>();
function glow(c:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string,opacity:number){
 let art=glowCache.get(color);if(!art){art=canvas(96,96);const ctx=art.getContext('2d')!,gradient=ctx.createRadialGradient(48,48,0,48,48,48);gradient.addColorStop(0,color+'cc');gradient.addColorStop(.22,color+'66');gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);glowCache.set(color,art);}
 c.save();c.globalCompositeOperation='screen';c.globalAlpha*=opacity;c.drawImage(art,x-radius,y-radius,radius*2,radius*2);c.restore();
}
function trace(c:CanvasRenderingContext2D,points:number[][],start:number,index:number,effect:Effect,tier:number,time:number,lane=0,tip?:readonly[number,number]){
 c.beginPath();
 for(let j=start;j<=index;j++){
  const point=points[j],age=(index-j)/Math.max(1,index-start),previous=points[Math.max(0,j-1)],angle=Math.atan2(point[1]-previous[1],point[0]-previous[0]);
  let offset=0;
  if(effect==='electric')offset=j===index?0:Math.sin(j*13.17+Math.floor(time/55))*((tier+1)*1.25+lane*1.5);
  else if(lane)offset=Math.sin(j*.8-time/(effect==='fire'?95:150)+lane*1.7)*(3+tier*2)*age*lane;
  const x=point[0]-Math.sin(angle)*offset,y=point[1]+Math.cos(angle)*offset;
  if(j===start)c.moveTo(x,y);else c.lineTo(x,y);
 }
 if(tip)c.lineTo(tip[0],tip[1]);c.stroke();
}
function materialDebris(c:CanvasRenderingContext2D,material:string,elapsed:number,radius:number,tier:number,options:WeaponEffectOptions){
 const id=(material in MATERIALS?material:'earth') as MaterialId,palette=MATERIALS[id],age=clamp(elapsed/660),count=Math.min(limits(options).debris,7+tier*2);
 c.save();c.globalAlpha*=Math.pow(1-age,.8);c.lineCap='round';
 for(let n=0;n<count;n++){
  const theta=n*2.399963+.25,speed=.48+n%4*.16,distance=radius*(.2+age*2.6)*speed;
  const x=Math.cos(theta)*distance,y=Math.sin(theta)*distance*.7-age*(1-age)*radius*.6+age*age*43,size=(3+n%3)*(1-age*.3);
  c.save();c.translate(x,y);c.rotate(theta+age*(n%2?3:-4));
  if(id==='metal'){
   c.strokeStyle=n%3===0?'#ffcb69':palette.highlight;c.lineWidth=n%3===0?1.2:2;c.beginPath();c.moveTo(-size*1.5,0);c.lineTo(size*.7,0);c.stroke();
   if(n%3===0){c.strokeStyle='#ff8e30';c.lineWidth=.7;c.beginPath();c.moveTo(-size*3,0);c.lineTo(-size*1.4,0);c.stroke();}
  }else if(id==='ice'||id==='magic'){
   c.fillStyle=n%2?palette.debris:id==='ice'?'#48cfff':'#c154f1';c.strokeStyle=id==='ice'?'#d8fcff':'#f4c7ff';c.lineWidth=.6;c.beginPath();c.moveTo(0,-size*1.7);c.lineTo(size*.55,0);c.lineTo(0,size);c.lineTo(-size*.55,size*.2);c.closePath();c.fill();c.stroke();
  }else if(id==='sand'){
   ellipse(c,0,0,size*.6,size*.4,n%2?palette.debris:'#b67b31');ellipse(c,-size*1.8,size*.9,.8,.7,palette.highlight);
  }else{
   c.fillStyle=n%2?palette.debris:palette.color;c.strokeStyle=id==='stone'?'#546078':'#613b24';c.lineWidth=.7;c.beginPath();c.moveTo(-size,-size*.4);c.lineTo(size*.2,-size);c.lineTo(size,size*.1);c.lineTo(size*.4,size*.7);c.lineTo(-size*.7,size);c.closePath();c.fill();c.stroke();
   c.fillStyle=palette.highlight;c.beginPath();c.moveTo(-size,-size*.4);c.lineTo(size*.2,-size);c.lineTo(0,0);c.closePath();c.fill();
  }
  c.restore();
 }
 c.restore();
}

/** Solid clay debris keeps the weapon's identity at every upgrade stage. */
function brickChunk(c:CanvasRenderingContext2D,x:number,y:number,width:number,angle:number,tier:number,time:number){
 const height=width*.52;c.save();c.translate(x,y);c.rotate(angle);
 if(tier>=3){c.shadowColor='#ffb347';c.shadowBlur=6;}
 c.fillStyle=tier>=3?'#e2402a':tier>=1?'#c8432b':'#b84a2e';c.strokeStyle='#4a1810';c.lineWidth=Math.max(.8,width*.07);
 c.beginPath();c.moveTo(-width/2,-height/2);c.lineTo(width/2-width*.12,-height/2);c.lineTo(width/2,-height*.1);c.lineTo(width/2-width*.05,height/2);c.lineTo(-width/2+width*.08,height/2);c.closePath();c.fill();c.shadowBlur=0;c.stroke();
 c.fillStyle='#ffb07a';c.globalAlpha*=.75;c.fillRect(-width/2+width*.1,-height/2+height*.12,width*.6,height*.18);
 c.fillStyle='#e9d3ae';c.fillRect(-width*.08,-height/2,width*.07,height);
 if(tier>=3){c.strokeStyle='#ffe58a';c.lineWidth=.8;c.globalAlpha*=.6+Math.sin(time/90+x)*.3;c.beginPath();c.moveTo(-width*.35,0);c.lineTo(-width*.1,height*.18);c.lineTo(width*.2,-height*.05);c.stroke();}c.restore();
}
function drawBrickFragment(c:CanvasRenderingContext2D,p:Projectile,index:number,tier:number,time:number,options:WeaponEffectOptions){
 const sample=clamp(index,0,p.points.length-1),i=Math.floor(sample),point=p.points[i],next=p.points[Math.min(p.points.length-1,i+1)],tip:[number,number]=[point[0]+(next[0]-point[0])*(sample-i),point[1]+(next[1]-point[1])*(sample-i)];
 const start=Math.max(0,i-8);c.save();for(let j=start;j<i;j+=options.quality==='low'?3:2){const trail=p.points[j],age=(i-j)/Math.max(1,i-start);c.globalAlpha=(1-age)*.4;ellipse(c,trail[0],trail[1]-age*4,1.2+age*2.6,1+age*1.8,j%4?'#d9b48a':'#b9805c');}
 c.globalAlpha=1;if(tier>=2)glow(c,tip[0],tip[1],7+tier*2,FAMILY.brick.mid,.35);
 brickChunk(c,tip[0],tip[1],(p.powered?13:10)+tier*1.5,reduced(options)?0:sample*.32+(p.points[0][0]%3),tier,time);
 if(tier>=3&&!reduced(options))for(let n=0;n<2;n++)ellipse(c,tip[0]-Math.cos(time/60+n*3)*5,tip[1]+Math.sin(time/70+n*3)*4,.9,.9,'#ffe08a');c.restore();
}
function drawBrickFragmentImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,tier:number,material:string,options:WeaponEffectOptions){
 const age=elapsed/460;if(age<0||age>=1)return;const radius=p.impact.radius,open=1-Math.pow(1-clamp(age*2),3);
 c.save();c.translate(p.impact.x,p.impact.y);c.globalAlpha*=Math.pow(1-age,.9);
 if(tier>=1)glow(c,0,0,radius*(.6+open*.8),tier>=3?'#ffb347':FAMILY.brick.mid,.3*(1-age));
 for(let n=0;n<(options.quality==='low'?3:5);n++){const a=-Math.PI/2+(n-2)*.55,r=radius*(.2+open*.9);ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.6-age*radius*.4,radius*(.25+open*.35),radius*(.18+open*.25),n%2?'#e5cba3':'#c99a72');}
 for(let n=0;n<Math.min(limits(options).debris,3+tier);n++){const a=n*2.39996,r=radius*(.2+age*1.6);brickChunk(c,Math.cos(a)*r,Math.sin(a)*r*.6-age*(1-age)*28,3.5+tier*.5,a+age*7,tier,elapsed);}
 materialDebris(c,material,elapsed,radius*.6,0,options);c.restore();
}

/** Flight particles sample the real trajectory; only their light drifts away. */
function trailParticles(c:CanvasRenderingContext2D,p:Projectile,index:number,tier:number,time:number,options:WeaponEffectOptions){
 const family=FAMILY[p.effect],count=Math.min(limits(options).flightParticles,3+tier*4),span=Math.min(limits(options).trailSamples,6+tier*6),clock=reduced(options)?0:time;
 for(let n=0;n<count;n++){
  const age=(clock/(p.effect==='electric'?480:820)+n/count)%1,position=Math.max(0,index-age*span),i=Math.floor(position),next=p.points[Math.min(p.points.length-1,i+1)],point=p.points[i];if(!point||!next)continue;
  const fraction=position-i,angle=Math.atan2(next[1]-point[1],next[0]-point[0]),spread=Math.sin(n*2.4+clock/170)*age*(3+tier*2),x=point[0]+(next[0]-point[0])*fraction-Math.sin(angle)*spread,y=point[1]+(next[1]-point[1])*fraction+Math.cos(angle)*spread;
  c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=Math.pow(1-age,1.4)*(.32+tier*.07);c.strokeStyle=n%3?family.mid:family.hot;c.fillStyle=family.hot;c.lineWidth=1;
  if(p.effect==='fire'){
   c.rotate(Math.sin(clock/160+n)*.2);c.beginPath();c.moveTo(2,0);c.quadraticCurveTo(-4-age*6,Math.sin(clock/120+n)*4,-9-age*8,-age*3);c.stroke();if(n%3===0)glow(c,0,0,4+tier,family.mid,.3);
  }else if(p.effect==='electric'){
   const flip=Math.sin(clock/45+n*5)>0?1:-1;c.beginPath();c.moveTo(-6,flip*2);c.lineTo(-1,-flip*3);c.lineTo(1,flip*2);c.lineTo(5,-flip*2);c.stroke();
  }else if(p.effect==='crystal'){
   c.rotate(clock/330+n);const r=1.2+tier*.45;c.beginPath();c.moveTo(-r*2,0);c.lineTo(0,-r);c.lineTo(r*2,0);c.lineTo(0,r);c.closePath();c.globalAlpha*=.7;c.fill();
  }else if(p.effect==='brick'){
   c.globalAlpha*=.72;glow(c,-age*5,-age*9,3+age*5,'#d4ae83',.28);if(n%3===0)brickChunk(c,-age*5,age*6,2+tier*.5,n+clock/300,tier,clock);
  }else{
   // Powder has drifting smoke and falling fuse sparks, not a plasma ribbon.
   c.globalAlpha*=.6;glow(c,-age*6,-age*12,3+age*5,'#dac8ac',.35);c.strokeStyle=n%2?'#ffc064':'#ff682c';c.beginPath();c.moveTo(-age*4,age*6);c.lineTo(-age*4-3,age*6-2);c.stroke();
  }
  c.restore();
 }
}

/** Finite local energy for an equipped +9/+10/+12 weapon. Draw around its center
 * in the weapon's existing transform, before its painting. No avatar motion. */
export function drawWeaponEnergy(c:CanvasRenderingContext2D,effect:Effect,level:number,time:number,options:WeaponEffectOptions={}){
 const tier=strength(level);if(!tier)return;const family=FAMILY[effect],clock=reduced(options)?0:time,radius=14+tier*4;
 c.save();c.globalCompositeOperation='screen';glow(c,0,0,radius*1.35,family.mid,.09+tier*.025);c.lineWidth=.7;c.strokeStyle=family.mid;c.globalAlpha*=.28;
 for(let n=0;n<(options.quality==='low'?1:2);n++){const phase=clock/950+n*Math.PI;c.beginPath();c.ellipse(0,0,radius,radius*.48,Math.sin(phase)*.35,phase,phase+1.4);c.stroke();}
 const count=options.quality==='low'?2:2+tier;
 for(let n=0;n<count;n++){const phase=clock/(effect==='electric'?390:780)+n*TAU/count,r=radius*(.65+Math.sin(phase*1.8)*.15),x=Math.cos(phase)*r,y=Math.sin(phase)*r*.5;c.globalAlpha=.16+.18*(.5+.5*Math.sin(phase*2));ellipse(c,x,y,effect==='crystal'?1.4:1,effect==='crystal'?2.5:1,family.hot,phase);}
 c.restore();
}

export function drawProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number,level:number,time:number,options:WeaponEffectOptions={}){
 if(!p.points.length||!Number.isFinite(index))return;
 if(p.fragment){drawBrickFragment(c,p,index,strength(level),time,options);return;}
 const sample=clamp(index,0,p.points.length-1),floor=Math.floor(sample),point=p.points[floor],next=p.points[Math.min(p.points.length-1,floor+1)],fraction=sample-floor;
 const tip:readonly[number,number]=[point[0]+(next[0]-point[0])*fraction,point[1]+(next[1]-point[1])*fraction];
 const tier=strength(level),family=FAMILY[p.effect],clock=reduced(options)?0:time,length=Math.min(limits(options).trailSamples,family.trail[tier]),start=Math.max(0,floor-length),previous=p.points[Math.max(0,floor-1)],angle=floor===0?Math.atan2(next[1]-point[1],next[0]-point[0]):Math.atan2(tip[1]-previous[1],tip[0]-previous[0]);
 c.save();c.lineCap='round';c.lineJoin='round';
 const from=p.points[start],gradient=c.createLinearGradient(from[0],from[1],tip[0]+.01,tip[1]+.01);gradient.addColorStop(0,family.dark+'00');gradient.addColorStop(.65,family.mid+'75');gradient.addColorStop(1,family.hot+'c4');
 c.strokeStyle=gradient;c.lineWidth=(p.effect==='electric'?.8:1.2)+tier*.35;c.globalAlpha*=p.effect==='dynamite'||p.effect==='brick'?.28:.8;
 trace(c,p.points,start,floor,p.effect,tier,clock,0,tip);
 if(tier>=2&&p.effect!=='dynamite'&&p.effect!=='brick'){c.globalAlpha*=.45;c.lineWidth=.8;trace(c,p.points,start,floor,p.effect,tier,clock,1,tip);trace(c,p.points,start,floor,p.effect,tier,clock,-1,tip);}
 c.restore();
 c.save();c.globalCompositeOperation='screen';trailParticles(c,p,sample,tier,clock,options);c.restore();
 c.save();c.translate(tip[0],tip[1]);c.rotate(angle);
 const pulse=reduced(options)?0:Math.sin(clock/(p.effect==='electric'?70:140)),size=family.size[tier]*(p.powered?1.16:1)*(1+pulse*(tier?.045:.02));
 glow(c,0,0,8+tier*3,family.mid,.18+tier*.025);
 if(tier||p.powered){
  c.save();c.globalCompositeOperation='screen';c.lineWidth=.8;c.strokeStyle=family.hot;c.globalAlpha*=.38;
  if(p.effect==='electric'){
   for(let n=0;n<(tier>=2?2:1);n++){const phase=clock/210+n*Math.PI;c.beginPath();c.ellipse(-4-n*6,0,2.4+Math.cos(phase)*1.2,5+tier*2,phase*.13,phase,phase+Math.PI*1.5);c.stroke();}
  }else if(p.effect==='fire'){
   for(const side of [-1,1]){c.beginPath();c.moveTo(4,side*2);c.bezierCurveTo(-7,side*(6+tier*2+pulse*2),-18,side*3,-25-tier*3,side*(2+Math.sin(clock/120+side)*3));c.stroke();}
  }else if(p.effect==='crystal'&&tier>=2){
   for(let n=0;n<(tier===3?3:2);n++){const phase=clock/270+n*TAU/3,x=-10+Math.cos(phase)*9,y=Math.sin(phase)*(8+tier*2);c.save();c.translate(x,y);c.rotate(phase);c.beginPath();c.moveTo(-4,0);c.lineTo(0,-1.5);c.lineTo(4,0);c.lineTo(0,1.5);c.closePath();c.stroke();c.restore();}
  }
  c.restore();
 }
 const solid=p.effect==='dynamite'||p.effect==='crystal'||p.effect==='brick',spin=p.effect==='dynamite'?(reduced(options)?0:clock/170):p.effect==='brick'?(reduced(options)?0:Math.sin(sample*.09)*.55):pulse*.035;
 c.save();c.rotate(spin);if(!solid)c.scale(1,1+pulse*.09);
 const painted=sprite(c,p.effect,0,tier,0,0,size,0,p.effect==='dynamite'||p.effect==='brick'?.5:p.effect==='fire'?.76:p.effect==='electric'?.77:.72,solid?.86:.82,0,!solid);c.restore();
 if(p.effect==='dynamite'){
  const x=-Math.cos(spin)*size*.35,y=-Math.sin(spin)*size*.35;glow(c,x,y,5+tier*.6,family.hot,.55);
  c.save();c.globalCompositeOperation='screen';c.strokeStyle='#ffeab4';c.lineWidth=.8;const count=Math.min(limits(options).flightParticles,2+tier);
  for(let n=0;n<count;n++){const phase=(clock/270+n/count)%1,a=n*2.39996+spin,r=2+phase*(5+tier*2);c.globalAlpha=(1-phase)*.75;c.beginPath();c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*(r+2),y+Math.sin(a)*(r+2));c.stroke();}c.restore();
 }
 if(p.powered){c.save();c.globalCompositeOperation='screen';c.globalAlpha*=.45;c.strokeStyle=family.hot;c.lineWidth=1;c.beginPath();c.ellipse(-4,0,5,12+tier*2,clock/230,0,Math.PI*1.6);c.stroke();glow(c,0,0,18+tier*3,family.mid,.28);c.restore();}
 if(!painted)ellipse(c,0,0,p.effect==='crystal'?7:3,2,family.hot);
 c.restore();
}

export const WEAPON_IMPACT_DURATION=690;
export function drawImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,level:number,material='earth',options:WeaponEffectOptions={}){
 if(p.fragment){drawBrickFragmentImpact(c,p,elapsed,strength(level),material,options);return;}
 const tier=strength(level),duration=630+tier*20,age=elapsed/duration;if(age<0||age>=1)return;
 const family=FAMILY[p.effect],radius=Math.min(130,Math.max(10,p.impact.radius))*(p.powered?1.18:1),open=1-Math.pow(1-clamp(age*3),3),fade=clamp(age/.045)*Math.pow(1-age,.68),motion=reduced(options)?age*.4:age;
 c.save();c.translate(p.impact.x,p.impact.y);c.globalAlpha*=fade;c.lineCap='round';c.lineJoin='round';
 glow(c,0,0,radius*(.35+open*.7),family.mid,.24*(1-age));
 const lift=p.effect==='fire'?-radius*age*.36:p.effect==='dynamite'?-radius*age*.15:p.effect==='brick'?-radius*age*.12:0,rotation=p.effect==='electric'?motion*.8:p.effect==='fire'?motion*.3:p.effect==='crystal'?motion*.08:0;
 // The painting becomes a light layer, then erodes; particles continue its motion.
 const size=radius*(p.effect==='crystal'?2.05:p.effect==='brick'?2.2:1.9)*(.48+open*.52)*(1+tier*.06);
 sprite(c,p.effect,2,tier,0,lift,size,rotation,.5,.98,clamp((age-.04)/.84));
 if(tier>=2&&options.quality!=='low'&&p.effect!=='dynamite')sprite(c,p.effect,2,tier,0,lift*.55,size*1.13,-rotation*.7,.5,.16*(1-age),clamp((age+.1)/.9));
 c.save();c.globalCompositeOperation='screen';
 if(age<.23)glow(c,0,0,radius*(.15+age*.8),family.hot,(1-age/.23)*.65);
 const ring=radius*(.2+open*.95);c.strokeStyle=family.mid;c.lineWidth=1.2*(1-age);c.globalAlpha*=.48*(1-age);
 if(p.effect==='electric'){
  c.beginPath();for(let n=0;n<=18;n++){const theta=n*TAU/18,r=ring*(.78+noise(n+Math.floor(elapsed/50)*31)*.22),x=Math.cos(theta)*r,y=Math.sin(theta)*r*.72;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
 }else if(p.effect==='crystal'){
  for(let side=0;side<(tier>=2?2:1);side++){c.beginPath();for(let n=0;n<=6;n++){const theta=n*TAU/6+motion*.2,r=ring*(1-side*.23),x=Math.cos(theta)*r,y=Math.sin(theta)*r*.6;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 }else if(p.effect==='dynamite'||p.effect==='brick'){c.strokeStyle=p.effect==='brick'?'#e5b981':'#ffd88b';c.beginPath();c.ellipse(0,radius*.1,ring,ring*.25,0,0,TAU);c.stroke();}
 else{for(let n=0;n<2+tier;n++){const theta=n*TAU/(2+tier)+motion*2;c.beginPath();c.ellipse(0,-radius*age*.2,ring*(.8+n*.035),ring*.5,theta,theta,theta+.7);c.stroke();}}
 c.restore();
 const count=Math.min(limits(options).impactParticles,7+tier*6);
 for(let n=0;n<count;n++){
  const seed=noise(n*3+7),start=(n%4)*.026,life=clamp((age-start)/(1-start));if(age<start)continue;
  const theta=n*2.399963+seed*.45,distance=radius*(.12+life*(1.1+seed*.85)),x=Math.cos(theta)*distance,y=Math.sin(theta)*distance*.66+(p.effect==='crystal'||p.effect==='dynamite'?life*life*28:-life*16),length=(4+tier*2)*(1-life)+1;
  c.save();c.translate(x,y);c.rotate(theta+life*(p.effect==='crystal'?2:0));c.globalAlpha*=Math.pow(1-life,1.2)*(.45+seed*.25);c.globalCompositeOperation='screen';c.strokeStyle=n%3?family.mid:family.hot;c.fillStyle=family.hot;c.lineWidth=1;
  if(p.effect==='electric'){c.beginPath();c.moveTo(-length*1.8,0);c.lineTo(-length*.7,2);c.lineTo(-length*.3,-2);c.lineTo(length*.4,0);c.stroke();}
  else if(p.effect==='crystal'){c.beginPath();c.moveTo(-length,0);c.lineTo(0,-length*.25);c.lineTo(length*.6,0);c.lineTo(0,length*.25);c.closePath();c.globalAlpha*=.75;c.fill();c.stroke();}
  else if(p.effect==='fire'){c.beginPath();c.moveTo(-length*2,Math.sin(life*12+n)*3);c.quadraticCurveTo(-length*.5,-length*.35,length*.5,0);c.stroke();if(n%5===0)glow(c,0,0,length*.8,family.mid,.2);}
   else if(p.effect==='brick'){c.globalCompositeOperation='source-over';if(n%3===0)brickChunk(c,0,0,2+length*.7,theta+life*4,tier,elapsed);else{c.strokeStyle=n%2?'#c1744d':'#e5c599';c.beginPath();c.moveTo(-length,0);c.lineTo(length*.5,0);c.stroke();}}
   else{if(n%3===0){c.globalCompositeOperation='source-over';c.fillStyle=n%2?'#ef6a45':'#d8bb89';c.fillRect(-length*.3,-1,length*.7,2);}else{c.beginPath();c.moveTo(-length,0);c.lineTo(length*.5,0);c.stroke();}}
  c.restore();
 }
 if(p.effect==='dynamite'&&age>.12){const count=options.quality==='low'?2:4;for(let n=0;n<count;n++){const theta=n*TAU/count+.4;glow(c,Math.cos(theta)*radius*age*.55,-radius*age*.4+Math.sin(theta)*radius*age*.3,radius*(.13+age*.2),'#c9b7a2',.07*(1-age));}}
 if(p.effect==='brick'&&age>.1){const count=options.quality==='low'?3:7;for(let n=0;n<count;n++){const theta=Math.PI+n*Math.PI/(count-1),r=radius*(.3+open*1.15);glow(c,Math.cos(theta)*r,radius*.18+Math.sin(theta)*r*.22,radius*(.2+open*.28),n%2?'#ead2ac':'#cf9f74',.11*(1-age));}}
 c.save();c.globalAlpha*=.48;materialDebris(c,material,elapsed,radius,tier,options);c.restore();c.restore();
}

export function drawMuzzle(c:CanvasRenderingContext2D,x:number,y:number,effect:Effect,elapsed:number,level:number,facing:number,directionRadians?:number,powered=false,options:WeaponEffectOptions={}){
 const tier=strength(level),duration=(effect==='electric'?185:245)+tier*12,age=elapsed/duration;if(age<0||age>=1)return;
 const angle=directionRadians??(facing<0?Math.PI:0),family=FAMILY[effect],open=1-Math.pow(1-age,3),fade=Math.pow(1-age,1.4),size=(30+tier*10)*(powered?1.3:1);
 c.save();c.translate(x+27*facing,y-40);c.rotate(angle);c.globalAlpha*=fade;
 glow(c,0,0,8+tier*2,family.hot,.4);
 sprite(c,effect,1,tier,size*age*.14,0,size*(.55+open*.5),0,.17,.8,age*.85);
 c.save();c.globalCompositeOperation='screen';c.strokeStyle=family.hot;c.lineWidth=.8;c.globalAlpha*=.5;
 if(tier>=1){c.beginPath();c.ellipse(size*age*.12,0,2+age*3,(4+tier*2)*(1+age*.35),0,0,TAU);c.stroke();}
 const count=Math.min(limits(options).flightParticles,3+tier*3);
 for(let n=0;n<count;n++){const direction=(noise(n*3)-.5)*1.4,r=(4+age*size)*(.4+noise(n+11)*.6),px=Math.cos(direction)*r,py=Math.sin(direction)*r;c.globalAlpha=fade*(.35+noise(n)*.3);c.beginPath();c.moveTo(px-3,py*.8);c.lineTo(px,py);c.stroke();}
 c.restore();c.restore();
}
