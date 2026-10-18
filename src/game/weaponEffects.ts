import type {Projectile} from '../../shared/protocol';
import {WEAPONS,weaponPhaseTier} from '../../shared/catalog';
import {weaponEffectsPath,weaponKit,weaponPowPath} from '../../shared/weaponKit';
import {MATERIALS} from '../../shared/maps';
import type {MaterialId} from '../../shared/maps';

type Effect=Projectile['effect'];
/** A painted chunk cut from an impact cell: its own image, its center and width as shares of the cell width. */
type Piece={image:HTMLCanvasElement;x:number;y:number;width:number};
/** core: projectile row only, the painted object without its painted trail (the trail is animated in code), cropped
 * to itself; width is its share of the cell width. */
type Cell={solid:HTMLCanvasElement;energy:HTMLCanvasElement[];width:number;height:number;pieces:Piece[];body?:HTMLCanvasElement;core?:{image:HTMLCanvasElement;width:number}};
/** tilt: radians the painted projectiles point above horizontal, undone when drawing the top row. */
type Atlas={cells:Cell[];ready:Promise<void>;tilt:number};
/** `effects`: projectile / launch / impact rows. `pow`: the POW shot's own projectile / impact rows, so POW never looks like a normal shot. */
type Sheet='effects'|'pow';
const SHEET_ROWS:Record<Sheet,number>={effects:3,pow:2};
export interface WeaponEffectOptions {quality?:'high'|'low';reducedMotion?:boolean;}
export const VFX_LIMITS={high:{trailSamples:18,flightParticles:16,impactParticles:26,debris:14},low:{trailSamples:8,flightParticles:6,impactParticles:10,debris:6}} as const;
const TAU=Math.PI*2;
/** The POW sprite is painted bigger than the normal shot; this keeps it a notch larger on screen too. */
const POW_SPRITE_SCALE=1.3;
const FAMILY:Record<Effect,{hot:string;mid:string;dark:string;size:readonly number[];trail:readonly number[]}>= {
 fire:{hot:'#fff09a',mid:'#ff7920',dark:'#b72a20',size:[42,48,57,66],trail:[6,12,18,25]},
 electric:{hot:'#c1fdff',mid:'#25caff',dark:'#4154ea',size:[35,40,47,54],trail:[5,11,17,24]},
 dynamite:{hot:'#fff3b4',mid:'#ffaf24',dark:'#d84b2a',size:[30,36,42,48],trail:[8,12,16,21]},
 crystal:{hot:'#e6caff',mid:'#ed58ff',dark:'#7033d9',size:[51,58,65,73],trail:[5,10,15,21]},
 brick:{hot:'#ffdc9c',mid:'#ff6a2e',dark:'#9c2a1a',size:[36,42,50,58],trail:[7,10,14,18]}
};
const atlases=new Map<string,Atlas>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const reduced=(options:WeaponEffectOptions)=>options.reducedMotion??motionPreference?.matches??false;
const limits=(options:WeaponEffectOptions)=>VFX_LIMITS[options.quality==='low'||reduced(options)?'low':'high'];
function strength(level:number){return weaponPhaseTier(level);}
function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}
const noise=(n:number)=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const canvas=(width:number,height:number)=>{const out=document.createElement('canvas');out.width=Math.max(1,Math.round(width));out.height=Math.max(1,Math.round(height));return out;};

/** Cuts the solid chunks (bricks, shards: saturated or dark outlined paint) out of an impact painting, so they can
 * fly away on their own while the rest (dust, flash) pops and fades. Returns the pieces and that remaining body. */
function paintedPieces(image:ImageData):{pieces:Piece[];body:HTMLCanvasElement}{
 const {width,height,data}=image,size=width*height,solid=new Uint8Array(size);
 for(let i=0;i<size;i++){
  const r=data[i*4]/255,g=data[i*4+1]/255,b=data[i*4+2]/255,a=data[i*4+3],max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/2,saturation=max===min?0:(max-min)/(1-Math.abs(2*light-1));
  solid[i]=a>200&&((saturation>.45&&light<.62)||light<.3)?1:0;
 }
 // Thin painted lines (outlines, trails) join the bricks: erode them away, label the cores, then grow each core back
 // over its own outline and glowing cracks.
 const core=new Uint8Array(size);
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x;core[i]=solid[i]&solid[i-1]&solid[i+1]&solid[i-width]&solid[i+width];}
 const label=new Int32Array(size).fill(-1),stack=new Int32Array(size),islands:{x0:number;y0:number;x1:number;y1:number;n:number}[]=[];
 for(let start=0;start<size;start++){
  if(label[start]>=0||!core[start])continue;
  const id=islands.length;let top=0;stack[top++]=start;label[start]=id;
  while(top){const i=stack[--top],x=i%width,y=(i-x)/width;for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(j>=0&&label[j]<0&&core[j]){label[j]=id;stack[top++]=j;}}
  islands.push({x0:width,y0:height,x1:0,y1:0,n:0});
 }
 let front:number[]=[];for(let i=0;i<size;i++)if(label[i]>=0)front.push(i);
 for(let step=0;step<3;step++){const next:number[]=[];for(const i of front){const x=i%width;for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(j>=0&&j<size&&label[j]<0&&data[j*4+3]>120){label[j]=label[i];next.push(j);}}front=next;}
 for(let i=0;i<size;i++){const id=label[i];if(id<0)continue;const isle=islands[id],x=i%width,y=(i-x)/width;isle.n++;isle.x0=Math.min(isle.x0,x);isle.x1=Math.max(isle.x1,x);isle.y0=Math.min(isle.y0,y);isle.y1=Math.max(isle.y1,y);}
 const kept=islands.map((isle,id)=>({isle,id})).filter(({isle})=>isle.n>=10&&isle.n<size*.2).sort((a,b)=>b.isle.n-a.isle.n).slice(0,16),taken=new Set(kept.map(({id})=>id));
 const pieces=kept.map(({isle,id})=>{
  const w=isle.x1-isle.x0+1,h=isle.y1-isle.y0+1,piece=canvas(w,h),context=piece.getContext('2d')!,out=context.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(isle.y0+y)*width+isle.x0+x;if(label[i]===id)for(let n=0;n<4;n++)out.data[(y*w+x)*4+n]=data[i*4+n];}
  context.putImageData(out,0,0);
  return {image:piece,x:(isle.x0+w/2-width/2)/width,y:(isle.y0+h/2-height/2)/width,width:w/width};
 });
 const body=canvas(width,height),context=body.getContext('2d')!,rest=context.createImageData(width,height);rest.data.set(data);
 for(let i=0;i<size;i++)if(taken.has(label[i]))rest.data[i*4+3]=0;
 context.putImageData(rest,0,0);
 return {pieces,body};
}
/** The painted projectile without the trail painted behind it: the convex hull of its largest dark outline. The
 * outline closes around the object but not around the streaks, sparks and chips, so those fall outside the hull. */
function paintedCore(source:HTMLCanvasElement,image:ImageData):{image:HTMLCanvasElement;width:number}|undefined{
 const {width,height,data}=image,size=width*height,dark=new Uint8Array(size),near=new Uint8Array(size);
 for(let i=0;i<size;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];dark[i]=data[i*4+3]>200&&(Math.max(r,g,b)+Math.min(r,g,b))/510<.33?1:0;}
 // Bridge small gaps in the outline before choosing its largest piece.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(dark[y*width+x])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<width&&ny<height)near[ny*width+nx]=1;}
 const label=new Int32Array(size).fill(-1),stack=new Int32Array(size);let best=-1,bestSize=0;
 for(let start=0,id=0;start<size;start++){
  if(label[start]>=0||!near[start])continue;let top=0,count=0;stack[top++]=start;label[start]=id;
  while(top){const i=stack[--top],x=i%width;count++;for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(j>=0&&j<size&&label[j]<0&&near[j]){label[j]=id;stack[top++]=j;}}
  if(count>bestSize){best=id;bestSize=count;}id++;
 }
 const points:[number,number][]=[];for(let i=0;i<size;i++)if(label[i]===best&&dark[i])points.push([i%width,(i-i%width)/width]);
 if(points.length<3)return undefined;
 // Monotone chain hull.
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o:number[],a:number[],b:number[])=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower:number[][]=[],upper:number[][]=[];
 for(const point of points){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],point)<=0)lower.pop();lower.push(point);}
 for(let n=points.length-1;n>=0;n--){const point=points[n];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],point)<=0)upper.pop();upper.push(point);}
 const hull=[...lower.slice(0,-1),...upper.slice(0,-1)],x0=Math.min(...hull.map(p=>p[0])),x1=Math.max(...hull.map(p=>p[0]))+1,y0=Math.min(...hull.map(p=>p[1])),y1=Math.max(...hull.map(p=>p[1]))+1;
 const out=canvas(x1-x0,y1-y0),context=out.getContext('2d')!;
 context.beginPath();hull.forEach(([x,y],n)=>n?context.lineTo(x-x0+.5,y-y0+.5):context.moveTo(x-x0+.5,y-y0+.5));context.closePath();context.clip();context.drawImage(source,-x0,-y0);
 const pixels=context.getImageData(0,0,out.width,out.height);for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<=60)pixels.data[i]=0;context.putImageData(pixels,0,0);
 return {image:out,width:out.width/width};
}
function atlasFor(effect:Effect,sheet:Sheet='effects'):Atlas{
 const key=`${effect}:${sheet}`,rows=SHEET_ROWS[sheet],cached=atlases.get(key);if(cached)return cached;
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
   for(let row=0;row<rows;row++)for(let column=0;column<4;column++){
    const left=Math.round(column*canvas.width/4),right=Math.round((column+1)*canvas.width/4),top=Math.round(row*canvas.height/rows),bottom=Math.round((row+1)*canvas.height/rows);
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
    const cut=row===rows-1?paintedPieces(original):undefined;
    atlas.cells.push({solid,energy,width,height,pieces:cut?.pieces??[],body:cut?.body,core:row===0?paintedCore(solid,original):undefined});
   }
   image.onload=null;image.onerror=null;resolve();
  };
  // Each weapon paints its own atlas (shared/weaponKit.ts); an effect no weapon uses keeps the drawn fallback.
  if(!weapon){resolve();return;}
  image.onerror=()=>resolve();image.src=sheet==='pow'?weaponPowPath(weapon.id):weaponEffectsPath(weapon.id);
 });
 atlases.set(key,atlas);return atlas;
}
/** Warms all paintings while the player chooses a room or prepares a shot. */
export function preloadWeaponEffects(){return Promise.all([...new Set(WEAPONS.map(weapon=>weapon.effect))].flatMap(effect=>[atlasFor(effect).ready,atlasFor(effect,'pow').ready]));}
/** Diagnostics for the fixed renderer budget; caches contain no per-shot state. */
export function weaponEffectCacheStats(){const images=new Set<HTMLCanvasElement>(glowCache.values());for(const atlas of atlases.values())for(const cell of atlas.cells)for(const image of [cell.solid,...cell.energy])images.add(image);let rgbaBytes=0;for(const image of images)rgbaBytes+=image.width*image.height*4;return {families:atlases.size,surfaces:images.size,rgbaBytes};}
if(typeof Image!=='undefined')void preloadWeaponEffects();

function sprite(c:CanvasRenderingContext2D,effect:Effect,row:number,tier:number,x:number,y:number,width:number,angle=0,anchor=.5,alpha=1,dissolve=0,energy=row!==0,sheet:Sheet='effects'){
 const atlas=atlasFor(effect,sheet),cell=atlas.cells[row*4+tier];if(!cell)return false;
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
 if(p.effect==='brick'){drawBrickProjectile(c,p,clamp(index,0,p.points.length-1),strength(level),reduced(options)?0:time,options);return;}
 const sample=clamp(index,0,p.points.length-1),floor=Math.floor(sample),point=p.points[floor],next=p.points[Math.min(p.points.length-1,floor+1)],fraction=sample-floor;
 const tip:readonly[number,number]=[point[0]+(next[0]-point[0])*fraction,point[1]+(next[1]-point[1])*fraction];
 const tier=strength(level),family=FAMILY[p.effect],clock=reduced(options)?0:time,length=Math.min(limits(options).trailSamples,family.trail[tier]),start=Math.max(0,floor-length),previous=p.points[Math.max(0,floor-1)],angle=floor===0?Math.atan2(next[1]-point[1],next[0]-point[0]):Math.atan2(tip[1]-previous[1],tip[0]-previous[0]);
 c.save();c.lineCap='round';c.lineJoin='round';
 const from=p.points[start],gradient=c.createLinearGradient(from[0],from[1],tip[0]+.01,tip[1]+.01);gradient.addColorStop(0,family.dark+'00');gradient.addColorStop(.65,family.mid+'75');gradient.addColorStop(1,family.hot+'c4');
 c.strokeStyle=gradient;c.lineWidth=(p.effect==='electric'?.8:1.2)+tier*.35;c.globalAlpha*=p.effect==='dynamite'?.28:.8;
 trace(c,p.points,start,floor,p.effect,tier,clock,0,tip);
 if(tier>=2&&p.effect!=='dynamite'){c.globalAlpha*=.45;c.lineWidth=.8;trace(c,p.points,start,floor,p.effect,tier,clock,1,tip);trace(c,p.points,start,floor,p.effect,tier,clock,-1,tip);}
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
 const solid=p.effect==='dynamite'||p.effect==='crystal',spin=p.effect==='dynamite'?(reduced(options)?0:clock/170):pulse*.035;
 c.save();c.rotate(spin);if(!solid)c.scale(1,1+pulse*.09);
 const anchor=p.effect==='dynamite'?.5:p.effect==='fire'?.76:p.effect==='electric'?.77:.72;
 // POW flies its own painted object (pow.png); the normal projectile only stands in while that art is missing.
 const painted=(p.powered&&sprite(c,p.effect,0,tier,0,0,size*POW_SPRITE_SCALE,0,anchor,.92,0,false,'pow'))||sprite(c,p.effect,0,tier,0,0,size,0,anchor,solid?.86:.82,0,!solid);c.restore();
 if(p.effect==='dynamite'){
  const x=-Math.cos(spin)*size*.35,y=-Math.sin(spin)*size*.35;glow(c,x,y,5+tier*.6,family.hot,.55);
  c.save();c.globalCompositeOperation='screen';c.strokeStyle='#ffeab4';c.lineWidth=.8;const count=Math.min(limits(options).flightParticles,2+tier);
  for(let n=0;n<count;n++){const phase=(clock/270+n/count)%1,a=n*2.39996+spin,r=2+phase*(5+tier*2);c.globalAlpha=(1-phase)*.75;c.beginPath();c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*(r+2),y+Math.sin(a)*(r+2));c.stroke();}c.restore();
 }
 if(p.powered){c.save();c.globalCompositeOperation='screen';c.globalAlpha*=.45;c.strokeStyle=family.hot;c.lineWidth=1;c.beginPath();c.ellipse(-4,0,5,12+tier*2,clock/230,0,Math.PI*1.6);c.stroke();glow(c,0,0,18+tier*3,family.mid,.28);c.restore();}
 if(!painted)ellipse(c,0,0,p.effect==='crystal'?7:3,2,family.hot);
 c.restore();
}

/** Path samples per millisecond of flight (the server samples the arc at 60 per second). A particle emitted `age` ms
 * ago sits `age*FLIGHT_SAMPLES_PER_MS` samples behind the tip, so trails stay where they were left, like real ones. */
const FLIGHT_SAMPLES_PER_MS=.06;
function pathAt(points:readonly number[][],position:number):[number,number,number]|undefined{
 if(position<0||!points.length)return undefined;if(points.length===1)return [points[0][0],points[0][1],0];
 const i=Math.min(points.length-2,Math.floor(position)),a=points[i],b=points[i+1],f=Math.min(1,position-i);
 return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[1]-a[1],b[0]-a[0])];
}
/** Soft fire blobs drawn with normal blending, so flames stay orange over snow and sky alike. */
const FLAME_STOPS={
 hot:[[0,'#ffffff',1],[.2,'#fff3a6',1],[.48,'#ffac30',.95],[.76,'#ff6316',.55],[1,'#e0320a',0]],
 ember:[[0,'#ffc04a',1],[.4,'#ff7a1e',.9],[.75,'#d8401a',.45],[1,'#8c1a0a',0]],
 brass:[[0,'#fff4c4',1],[.35,'#ffd062',.9],[1,'#d98a1c',0]]
} as const;
type Flame=keyof typeof FLAME_STOPS;
const flameCache=new Map<Flame,HTMLCanvasElement>();
function flame(c:CanvasRenderingContext2D,x:number,y:number,radius:number,kind:Flame,opacity:number,angle=0,stretch=1){
 if(opacity<=0||radius<=0)return;
 let art=flameCache.get(kind);if(!art){art=canvas(64,64);const ctx=art.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);for(const [stop,color,alpha] of FLAME_STOPS[kind])gradient.addColorStop(stop,color+Math.round(alpha*255).toString(16).padStart(2,'0'));ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);flameCache.set(kind,art);}
 c.save();c.globalAlpha*=opacity;c.translate(x,y);if(stretch!==1){c.rotate(angle);c.scale(stretch,1);}c.drawImage(art,-radius,-radius,radius*2,radius*2);c.restore();
}
/** One stream of trail particles: `count` live at once, each `life` ms long, emitted from the tip as it passes. */
function emitted(p:Projectile,sample:number,clock:number,count:number,life:number,salt:number,draw:(x:number,y:number,angle:number,age:number,n:number)=>void){
 for(let n=0;n<count;n++){
  const age=(clock/life+n/count+noise(n*17+salt)/count)%1,at=pathAt(p.points,sample-age*life*FLIGHT_SAMPLES_PER_MS);
  if(at)draw(at[0],at[1],at[2],age,n);
 }
}
/** Per upgrade, the brick's trail is drawn live, never painted: +0 clay dust, +10 dust and brass sparks,
 * +12 a short ember comet, +15 a full fire tail with smoke and rising embers. POW doubles down, and its +0
 * shot spins inside a white wind spiral. The painted brick itself (trail cut away) tumbles at the tip. */
function drawBrickProjectile(c:CanvasRenderingContext2D,p:Projectile,sample:number,tier:number,clock:number,options:WeaponEffectOptions){
 const pow=!!p.powered,low=options.quality==='low'||reduced(options),more=(n:number)=>Math.max(1,Math.round(n*(low?.45:1)*(pow?1.4:1)));
 const sheet:Sheet=pow&&atlasFor(p.effect,'pow').cells[tier]?'pow':'effects',atlas=atlasFor(p.effect,sheet),cell=atlas.cells[tier];
 const size=FAMILY.brick.size[tier]*1.2*(pow?1.16*POW_SPRITE_SCALE:1),brick=size*(cell?.core?.width??.5),tip=pathAt(p.points,sample);if(!tip)return;
 const side=(angle:number,offset:number):[number,number]=>[-Math.sin(angle)*offset,Math.cos(angle)*offset];
 c.save();
 // A tapered streak along the path: what reads as the trail at a glance, longer and warmer each upgrade.
 {const [inner,outer]=([['#fff4dc','#e8c9a0'],['#fff1c0','#ffc45a'],['#ffe6a0','#ff7a2a'],['#fff4c0','#ff6a1a']] as const)[tier],span=Math.round([12,15,18,22][tier]*(pow?1.3:1)*(low?.7:1));
  for(const [color,width,alpha] of [[outer,.5,tier?.55:.45],[inner,.22,.75]] as const){
   c.strokeStyle=color;c.lineCap='round';
   for(let j=0;j<span;j++){const a=pathAt(p.points,sample-j),b=pathAt(p.points,sample-j-1);if(!a||!b)break;const fade=1-j/span;c.globalAlpha=fade*fade*alpha;c.lineWidth=brick*width*(.35+fade*.65);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
  }
  c.globalAlpha=1;}
 // Smoke behind the fire (+15, POW from +12).
 if(tier>=3)emitted(p,sample,clock,more(6),700,1,(x,y,angle,age,n)=>{const [ox,oy]=side(angle,(noise(n*5)-.5)*brick*.5*(1+age));puff(c,x+ox,y+oy-age*brick*.7,brick*(.18+age*.4),n%2?'#9a8a82':'#b3a198',(1-age)*Math.min(1,age*4)*.16);});
 // Clay dust: the whole trail at +0, a lighter haze from +10.
 if(tier<3)emitted(p,sample,clock,more(tier?6:10),tier?420:520,2,(x,y,angle,age,n)=>{const [ox,oy]=side(angle,(noise(n*3)-.5)*brick*.45*(1+age));puff(c,x+ox,y+oy-age*brick*.25,brick*(.16+age*.4),n%3?'#d9b08a':'#efd9bb',Math.pow(1-age,1.2)*(tier?.4:.62));});
 // Fire: from a flicker of embers at +10 to a full tail at +15.
 if(tier>=1){
  const count=more([0,5,16,26][tier]),life=[0,200,320,440][tier],reach=[0,.22,.3,.36][tier]*(pow?.9:1);
  emitted(p,sample,clock,count,life,4,(x,y,angle,age,n)=>{
   const wobble=Math.sin(clock/45+n*2.1)*.12,[ox,oy]=side(angle,(noise(n*11)-.5)*brick*.28*(1+age)),r=brick*reach*(1-age*.65)*(.75+noise(n*13)*.5)*(1+wobble);
   // Flames sit just behind the brick, never ahead of it.
   const back=brick*.22*(1-age),fx=x+ox-Math.cos(angle)*back,fy=y+oy-Math.sin(angle)*back-age*age*brick*.6;
   // Young flames stretch along the path; older ones round off as they cool.
   const stretch=1.9-age*.8;
   flame(c,fx,fy,r*1.2,'ember',(1-age)*.8,angle,stretch);
   if(age<.55)flame(c,fx,fy,r*.85,tier===1?'brass':'hot',1-age/.55,angle,stretch);
  });
 }
 c.restore();
 // Sparks and embers glow over the fire.
 c.save();c.globalCompositeOperation='screen';c.lineCap='round';
 if(tier>=1||pow)emitted(p,sample,clock,more(tier>=3?10:6),tier>=3?620:420,5,(x,y,angle,age,n)=>{
  const spread=(noise(n*19)-.5)*2.2,dir=angle+Math.PI+spread,speed=brick*(.5+noise(n*23)*.9),sx=x+Math.cos(dir)*speed*age,sy=y+Math.sin(dir)*speed*age-(tier>=3?age*brick*.9:-age*age*brick*.5);
  const flicker=.6+.4*Math.sin(clock/30+n*5),length=brick*.12*(1-age);
  c.globalAlpha=(1-age)*flicker;c.strokeStyle=n%3?'#ffd47a':'#fff3c0';c.lineWidth=tier>=3?1.6:1.2;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx-Math.cos(dir)*length,sy-Math.sin(dir)*length);c.stroke();
 });
 c.restore();
 // POW: a spiral wrapped around the path, white wind at +0, sparks of the phase's fire above that.
 if(pow){
  const color=tier?'#ffd47a':'#ffffff',span=Math.round(28*(low?.7:1)),step=.5;
  c.save();c.lineCap='round';if(tier)c.globalCompositeOperation='screen';
  for(const phase of [0,Math.PI])for(let j=0;j<span;j++){
   const a=pathAt(p.points,sample-j*step),b=pathAt(p.points,sample-(j+1)*step);if(!a||!b)break;
   const fade=1-j/span,turn=(k:number)=>k*step*.75-clock/55+phase,offset=(k:number)=>Math.sin(turn(k))*brick*.42*(.5+fade*.5),[ax,ay]=side(a[2],offset(j)),[bx,by]=side(b[2],offset(j+1));
   // The half of the spiral behind the path is fainter, so it reads as wrapping around it.
   c.globalAlpha=fade*(tier?.75:.7)*(Math.cos(turn(j))>0?1:.3);c.strokeStyle=color;c.lineWidth=(tier?1.8:2.4)*fade+.4;
   c.beginPath();c.moveTo(a[0]+ax,a[1]+ay);c.lineTo(b[0]+bx,b[1]+by);c.stroke();
  }
  c.restore();
 }
 // Heat around the brick.
 const pulse=Math.sin(clock/70)*.5+.5;
 if(tier>=1)glow(c,tip[0],tip[1],brick*(.5+tier*.12),tier>=3?'#ff9a2a':FAMILY.brick.mid,.12+tier*.07+pulse*.05);
 // The brick tumbles end over end; the atlas tilt is undone so it starts level with its path.
 const spin=reduced(options)?0:(sample*(pow?.11:.16)+noise(Math.floor(p.points[0][0]))*TAU);
 c.save();c.translate(tip[0],tip[1]);c.rotate(tip[2]+atlas.tilt+spin);
 if(cell?.core){const h=brick*cell.core.image.height/cell.core.image.width;c.drawImage(cell.core.image,-brick/2,-h/2,brick,h);}
 else ellipse(c,0,0,brick*.4,brick*.22,'#b84a2e');
 // Lava cracks breathe at +15.
 if(tier>=3&&cell?.core){c.globalCompositeOperation='screen';c.globalAlpha=.18+pulse*.22;const h=brick*cell.core.image.height/cell.core.image.width;c.drawImage(cell.core.image,-brick/2,-h/2,brick,h);}
 c.restore();
}

export const WEAPON_IMPACT_DURATION=690;
const puffCache=new Map<string,HTMLCanvasElement>();
/** A soft opaque dust puff (normal blending, unlike `glow`, which only lightens). */
function puff(c:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string,opacity:number){
 let art=puffCache.get(color);if(!art){art=canvas(96,96);const ctx=art.getContext('2d')!,gradient=ctx.createRadialGradient(48,44,0,48,48,48);gradient.addColorStop(0,color+'f0');gradient.addColorStop(.55,color+'b0');gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);puffCache.set(color,art);}
 c.save();c.globalAlpha*=opacity;c.drawImage(art,x-radius,y-radius,radius*2,radius*2);c.restore();
}
const easeOut=(k:number)=>1-Math.pow(1-clamp(k),3);
/** Brick impact: the painted burst pops, then breaks into wedges that fly out and fall under gravity,
 * over a flash, a ground shock ring and clay dust that lingers. POW uses its own painting (pow.png) and hits harder. */
function drawBrickImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,tier:number,options:WeaponEffectOptions){
 const pow=!!p.powered,duration=pow?1000:800,t=elapsed;if(t<0||t>=duration)return;
 const k=t/duration,still=reduced(options),radius=Math.min(130,Math.max(10,p.impact.radius))*(pow?1.18:1);
 const atlas=pow&&atlasFor(p.effect,'pow').cells[4+tier]?atlasFor(p.effect,'pow'):atlasFor(p.effect),cell=atlas.cells[(atlas===atlasFor(p.effect)?8:4)+tier];
 const size=radius*2.2*(1+tier*.06)*(pow?POW_SPRITE_SCALE:1);
 c.save();c.translate(p.impact.x,p.impact.y);
 // Dust first, so the burst sits on top of it.
 const puffs=options.quality==='low'?(pow?5:3):(pow?9:6);
 for(let n=0;n<puffs;n++){
  const start=30+n*14,life=clamp((t-start)/(duration-start));if(t<start)continue;
  const angle=Math.PI+(n+.5)/puffs*Math.PI+(noise(n*5+1)-.5)*.4,reach=radius*(.35+easeOut(life)*(pow?1.6:1.2))*(.8+noise(n*7)*.4),x=Math.cos(angle)*reach,y=radius*.2+Math.sin(angle)*reach*.45-life*radius*.35;
  puff(c,x,y,radius*(.28+easeOut(life)*(pow?.6:.45)),n%3?'#d9b08a':'#efd9bb',(1-life)*(pow?.6:.5));
 }
 // Ground shock ring.
 for(let ring=0;ring<(pow?2:1);ring++){
  const life=clamp((t-ring*90)/(pow?380:300));if(life>0&&life<1){c.save();c.globalAlpha*=(1-life)*.8;c.strokeStyle=ring?'#fff1c8':'#f6dcae';c.lineWidth=(pow?3:2)*(1-life)+.5;c.beginPath();c.ellipse(0,radius*.2,radius*(.5+easeOut(life)*(pow?2.6:1.9)),radius*(.14+easeOut(life)*(pow?.6:.42)),0,0,TAU);c.stroke();c.restore();}
 }
 // Hot core flash.
 const flash=pow?170:120;if(t<flash){glow(c,0,-radius*.1,radius*(.7+t/flash*(pow?2:1.4)),'#fff3c4',(1-t/flash)*(pow?1:.85));glow(c,0,-radius*.1,radius*(.5+t/flash*.9),'#ffffff',(1-t/flash)*.7);}
 if(cell){
  // The painting pops with a slight overshoot and fades; its loose chunks keep flying out and drop under gravity.
  const pop=t<110?.45+.75*easeOut(t/110):1.2+.12*easeOut((t-110)/300),fade=1-clamp((t-70)/(pow?190:140)),width=size*pop,height=width*cell.height/cell.width;
  // Whole painting while the chunks still sit in it, then only the dust and flash around them.
  const whole=1-clamp((t-40)/50);
  if(fade>0){c.save();c.globalAlpha*=fade;if(whole<1)c.drawImage(cell.body??cell.solid,-width/2,-height/2,width,height);if(whole>0){c.globalAlpha*=whole;c.drawImage(cell.solid,-width/2,-height/2,width,height);}c.restore();}
  const flight=Math.max(0,t)/1000,seed=Math.floor(p.impact.x*7+p.impact.y*13);
  cell.pieces.forEach((piece,n)=>{
   const x=piece.x*width,y=piece.y*width,length=Math.hypot(x,y)||1,speed=size*(pow?2.4:1.9)*(.7+noise(seed+n)*.6),life=clamp((t-60)/(duration-60));
   const px=still?x:x+x/length*speed*flight,py=still?y:y+(y/length*speed*.75-size*.9)*flight+size*(pow?5.5:4.5)*flight*flight,spin=still?0:(noise(seed+n*3)-.5)*flight*14;
   // Chunks that drop below the impact sink into the ground instead of falling over it.
   c.save();c.globalAlpha*=(1-clamp((life-.6)/.4))*(1-clamp((py-radius*.4)/(radius*.7)));c.translate(px,py);c.rotate(spin);const w=piece.width*width,h=w*piece.image.height/piece.image.width;c.drawImage(piece.image,-w/2,-h/2,w,h);c.restore();
  });
 }
 // Sparks from +10 on, and always on POW.
 if(tier||pow){c.save();c.globalCompositeOperation='screen';c.strokeStyle='#ffd47a';c.lineCap='round';
  const sparks=options.quality==='low'?4:(pow?12:6+tier);
  for(let n=0;n<sparks;n++){const life=clamp(t/(pow?520:420));if(life>=1)break;const a=n*2.39996+.3,d=radius*(.3+easeOut(life)*(pow?3:2.2)*(.7+noise(n*9)*.5)),x=Math.cos(a)*d,y=Math.sin(a)*d*.75+life*life*radius;c.globalAlpha=(1-life)*.9;c.lineWidth=1.4;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(a)*6*(1-life),y-Math.sin(a)*6*(1-life));c.stroke();}
  c.restore();}
 c.restore();
}
export function drawImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,level:number,material='earth',options:WeaponEffectOptions={}){
 if(p.fragment){drawBrickFragmentImpact(c,p,elapsed,strength(level),material,options);return;}
 if(p.effect==='brick'){drawBrickImpact(c,p,elapsed,strength(level),options);return;}
 const tier=strength(level),duration=630+tier*20,age=elapsed/duration;if(age<0||age>=1)return;
 const family=FAMILY[p.effect],radius=Math.min(130,Math.max(10,p.impact.radius))*(p.powered?1.18:1),open=1-Math.pow(1-clamp(age*3),3),fade=clamp(age/.045)*Math.pow(1-age,.68),motion=reduced(options)?age*.4:age;
 c.save();c.translate(p.impact.x,p.impact.y);c.globalAlpha*=fade;c.lineCap='round';c.lineJoin='round';
 glow(c,0,0,radius*(.35+open*.7),family.mid,.24*(1-age));
 const lift=p.effect==='fire'?-radius*age*.36:p.effect==='dynamite'?-radius*age*.15:0,rotation=p.effect==='electric'?motion*.8:p.effect==='fire'?motion*.3:p.effect==='crystal'?motion*.08:0;
 // The painting becomes a light layer, then erodes; particles continue its motion.
 const size=radius*(p.effect==='crystal'?2.05:1.9)*(.48+open*.52)*(1+tier*.06);
 const pow=!!p.powered&&sprite(c,p.effect,1,tier,0,lift,size*POW_SPRITE_SCALE,rotation,.5,.98,clamp((age-.04)/.84),true,'pow');
 if(!pow)sprite(c,p.effect,2,tier,0,lift,size,rotation,.5,.98,clamp((age-.04)/.84));
 if(tier>=2&&options.quality!=='low'&&p.effect!=='dynamite')sprite(c,p.effect,pow?1:2,tier,0,lift*.55,size*1.13*(pow?POW_SPRITE_SCALE:1),-rotation*.7,.5,.16*(1-age),clamp((age+.1)/.9),true,pow?'pow':'effects');
 c.save();c.globalCompositeOperation='screen';
 if(age<.23)glow(c,0,0,radius*(.15+age*.8),family.hot,(1-age/.23)*.65);
 const ring=radius*(.2+open*.95);c.strokeStyle=family.mid;c.lineWidth=1.2*(1-age);c.globalAlpha*=.48*(1-age);
 if(p.effect==='electric'){
  c.beginPath();for(let n=0;n<=18;n++){const theta=n*TAU/18,r=ring*(.78+noise(n+Math.floor(elapsed/50)*31)*.22),x=Math.cos(theta)*r,y=Math.sin(theta)*r*.72;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
 }else if(p.effect==='crystal'){
  for(let side=0;side<(tier>=2?2:1);side++){c.beginPath();for(let n=0;n<=6;n++){const theta=n*TAU/6+motion*.2,r=ring*(1-side*.23),x=Math.cos(theta)*r,y=Math.sin(theta)*r*.6;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}
 }else if(p.effect==='dynamite'){c.strokeStyle='#ffd88b';c.beginPath();c.ellipse(0,radius*.1,ring,ring*.25,0,0,TAU);c.stroke();}
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
   else{if(n%3===0){c.globalCompositeOperation='source-over';c.fillStyle=n%2?'#ef6a45':'#d8bb89';c.fillRect(-length*.3,-1,length*.7,2);}else{c.beginPath();c.moveTo(-length,0);c.lineTo(length*.5,0);c.stroke();}}
  c.restore();
 }
 if(p.effect==='dynamite'&&age>.12){const count=options.quality==='low'?2:4;for(let n=0;n<count;n++){const theta=n*TAU/count+.4;glow(c,Math.cos(theta)*radius*age*.55,-radius*age*.4+Math.sin(theta)*radius*age*.3,radius*(.13+age*.2),'#c9b7a2',.07*(1-age));}}
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
