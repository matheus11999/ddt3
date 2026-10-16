import type {Projectile} from '../../shared/protocol';
import {weaponVisualStage} from '../../shared/catalog';
import {MATERIALS} from '../../shared/maps';
import type {MaterialId} from '../../shared/maps';

type Effect=Projectile['effect'];
type Cell={x:number;y:number;width:number;height:number};
type Atlas={image:HTMLImageElement;canvas:HTMLCanvasElement|ImageBitmap|null;cells:Cell[];ready:Promise<void>};
const TAU=Math.PI*2;
const FAMILY:Record<Effect,{asset:string;hot:string;mid:string;dark:string;size:readonly number[];trail:readonly number[]}>= {
 fire:{asset:'ember',hot:'#fff09a',mid:'#ff7920',dark:'#b72a20',size:[42,48,57,66],trail:[6,12,18,25]},
 electric:{asset:'volt',hot:'#c1fdff',mid:'#25caff',dark:'#4154ea',size:[35,40,47,54],trail:[5,11,17,24]},
 dynamite:{asset:'dynamite',hot:'#fff3b4',mid:'#ffaf24',dark:'#d84b2a',size:[30,36,42,48],trail:[8,12,16,21]},
 crystal:{asset:'crystal',hot:'#e6caff',mid:'#ed58ff',dark:'#7033d9',size:[51,58,65,73],trail:[5,10,15,21]},
 brick:{asset:'brick',hot:'#ffdc9c',mid:'#ff6a2e',dark:'#9c2a1a',size:[36,42,50,58],trail:[7,10,14,18]}
};
const atlases=new Map<Effect,Atlas>();
const reducedMotion=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function strength(level:number){const stage=weaponVisualStage(level);return stage===12?3:stage===10?2:stage===9?1:0;}
function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}

function atlasFor(effect:Effect):Atlas{
 const cached=atlases.get(effect);if(cached)return cached;
 const image=new Image();const atlas:Atlas={image,canvas:null,cells:[],ready:Promise.resolve()};
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
    atlas.cells.push({x:x0,y:y0,width:Math.max(1,x1-x0),height:Math.max(1,y1-y0)});
   }
   if(typeof createImageBitmap==='function')void createImageBitmap(canvas).then(bitmap=>{atlas.canvas=bitmap;resolve();},()=>{atlas.canvas=canvas;resolve();});
   else{atlas.canvas=canvas;resolve();}
  };
  image.onerror=()=>resolve();image.src=`/assets/vfx/${FAMILY[effect].asset}-effects.png`;
 });
 atlases.set(effect,atlas);return atlas;
}
/** Warms all paintings while the player chooses a room or prepares a shot. */
export function preloadWeaponEffects(){return Promise.all((['fire','electric','crystal','dynamite','brick'] as const).map(effect=>atlasFor(effect).ready));}
if(typeof Image!=='undefined')void preloadWeaponEffects();

function sprite(c:CanvasRenderingContext2D,effect:Effect,row:number,tier:number,x:number,y:number,width:number,angle=0,anchor=.5,alpha=1){
 const atlas=atlasFor(effect),cell=atlas.cells[row*4+tier];if(!atlas.canvas||!cell)return false;
 const height=width*cell.height/cell.width;
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;c.drawImage(atlas.canvas,cell.x,cell.y,cell.width,cell.height,-width*anchor,-height*.5,width,height);c.restore();return true;
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,angle=0){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.fill();}
function glow(c:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string,opacity:number){
 c.save();c.globalAlpha*=opacity;const gradient=c.createRadialGradient(x,y,0,x,y,radius);gradient.addColorStop(0,color);gradient.addColorStop(.28,color+'9c');gradient.addColorStop(1,color+'00');c.fillStyle=gradient;c.fillRect(x-radius,y-radius,radius*2,radius*2);c.restore();
}
function trace(c:CanvasRenderingContext2D,points:number[][],start:number,index:number,effect:Effect,tier:number,time:number,lane=0){
 c.beginPath();
 for(let j=start;j<=index;j++){
  const point=points[j],age=(index-j)/Math.max(1,index-start),previous=points[Math.max(0,j-1)],angle=Math.atan2(point[1]-previous[1],point[0]-previous[0]);
  let offset=0;
  if(effect==='electric')offset=j===index?0:Math.sin(j*13.17+Math.floor(time/55))*((tier+1)*1.25+lane*1.5);
  else if(lane)offset=Math.sin(j*.8-time/(effect==='fire'?95:150)+lane*1.7)*(3+tier*2)*age*lane;
  const x=point[0]-Math.sin(angle)*offset,y=point[1]+Math.cos(angle)*offset;
  if(j===start)c.moveTo(x,y);else c.lineTo(x,y);
 }
 c.stroke();
}
function materialDebris(c:CanvasRenderingContext2D,material:string,elapsed:number,radius:number,tier:number){
 const id=(material in MATERIALS?material:'earth') as MaterialId,palette=MATERIALS[id],age=clamp(elapsed/660),count=reducedMotion?6:12+tier*3;
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

/** One fired-clay brick chunk: lit top face, mortar seam and a darker underside. */
function brickChunk(c:CanvasRenderingContext2D,x:number,y:number,width:number,angle:number,tier:number,time:number){
 const height=width*.52;
 c.save();c.translate(x,y);c.rotate(angle);
 if(tier>=3){c.shadowColor='#ffb347';c.shadowBlur=6;}
 c.fillStyle=tier>=3?'#e2402a':tier>=1?'#c8432b':'#b84a2e';c.strokeStyle='#4a1810';c.lineWidth=Math.max(.8,width*.07);
 c.beginPath();c.moveTo(-width/2,-height/2);c.lineTo(width/2-width*.12,-height/2);c.lineTo(width/2,-height*.1);c.lineTo(width/2-width*.05,height/2);c.lineTo(-width/2+width*.08,height/2);c.closePath();c.fill();c.shadowBlur=0;c.stroke();
 c.fillStyle='#ffb07a';c.globalAlpha*=.75;c.fillRect(-width/2+width*.1,-height/2+height*.12,width*.6,height*.18);c.globalAlpha/=.75;
 c.fillStyle='#e9d3ae';c.fillRect(-width*.08,-height/2,width*.07,height);
 if(tier>=3){c.strokeStyle='#ffe58a';c.lineWidth=.8;c.globalAlpha*=.6+Math.sin(time/90+x)*.3;c.beginPath();c.moveTo(-width*.35,0);c.lineTo(-width*.1,height*.18);c.lineTo(width*.2,-height*.05);c.stroke();}
 c.restore();
}
/** A small shard: tumbling chunk, dust wake and, in late stages, ember sparks. */
function drawFragment(c:CanvasRenderingContext2D,p:Projectile,index:number,tier:number,time:number){
 const tip=p.points[index],start=Math.max(0,index-8);
 c.save();
 for(let j=start;j<index;j+=2){const point=p.points[j],age=(index-j)/Math.max(1,index-start);c.globalAlpha=(1-age)*.45;ellipse(c,point[0],point[1]-age*4,1.2+age*2.6,1+age*1.8,j%4?'#d9b48a':'#b9805c');}
 c.globalAlpha=1;
 if(tier>=2)glow(c,tip[0],tip[1],7+tier*2,FAMILY.brick.mid,.35);
 brickChunk(c,tip[0],tip[1],(p.powered?13:10)+tier*1.5,reducedMotion?0:index*.32+(p.points[0][0]%3),tier,time);
 if(tier>=3&&!reducedMotion)for(let n=0;n<2;n++)ellipse(c,tip[0]-Math.cos(time/60+n*3)*5,tip[1]+Math.sin(time/70+n*3)*4,.9,.9,'#ffe08a');
 c.restore();
}
export function drawProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number,level:number,time:number){
 const tip=p.points[index];if(!tip)return;
 if(p.fragment){drawFragment(c,p,index,strength(level),time);return;}
 const tier=strength(level),family=FAMILY[p.effect],length=family.trail[tier]*(reducedMotion ? .65 : 1),start=Math.max(0,index-Math.round(length)),previous=p.points[Math.max(0,index-1)];
 const angle=Math.atan2(tip[1]-previous[1],tip[0]-previous[0]);
 c.save();c.lineCap='round';c.lineJoin='round';
 const from=p.points[start],gradient=c.createLinearGradient(from[0],from[1],tip[0]+.01,tip[1]+.01);gradient.addColorStop(0,family.dark+'00');gradient.addColorStop(.55,family.mid+'8a');gradient.addColorStop(1,family.hot);
 c.strokeStyle=gradient;c.lineWidth=p.effect==='electric'?1.3+tier*.25:2+tier*.65;c.shadowColor=family.mid;c.shadowBlur=tier?5:2;
 trace(c,p.points,start,index,p.effect,tier,time);
 // Higher stages gain new spatial structures: paired fire ribbons, induction
 // coils, or refracted prism tracks. The four painted cores also differ.
 if(tier>=2&&p.effect!=='dynamite'&&p.effect!=='brick'){c.lineWidth=1.2;c.globalAlpha=.65;trace(c,p.points,start,index,p.effect,tier,time,1);trace(c,p.points,start,index,p.effect,tier,time,-1);}
 c.shadowBlur=0;c.globalAlpha=1;
 for(let j=start;j<index;j+=p.effect==='electric'?5:4){
  const point=p.points[j],age=(index-j)/Math.max(1,index-start),localAngle=j>0?Math.atan2(point[1]-p.points[j-1][1],point[0]-p.points[j-1][0]):angle;
  c.save();c.globalAlpha=(1-age)*(.28+tier*.09);
  if(p.effect==='fire'){
   // Painted tongues carried down the smoke/plasma wake.
   if(tier>0)sprite(c,p.effect,1,tier,point[0],point[1],12+tier*4,localAngle,.65,.65);
   ellipse(c,point[0],point[1]-age*(6+tier*2),2+age*3,1.6+age*2,j%3?family.mid:family.dark,localAngle);
  }else if(p.effect==='electric'){
   if(tier>=2){c.translate(point[0],point[1]);c.rotate(localAngle);c.strokeStyle=family.hot;c.lineWidth=.8;c.beginPath();c.ellipse(0,0,2.3,4+tier*1.5,0,0,TAU);c.stroke();}
   else{c.strokeStyle=family.hot;c.lineWidth=1;c.beginPath();c.moveTo(point[0]-3,point[1]+3);c.lineTo(point[0]+2,point[1]-1);c.stroke();}
  }else if(p.effect==='dynamite'){
   // A tumbling bundle sheds fuse sparks and rising powder smoke, never crystal shards.
   const drift=Math.sin(j*2.17)*age*(9+tier*2);
   ellipse(c,point[0]+drift,point[1]-age*12,1.5+age*3,1+age*2,'#ebe2c7',localAngle);
   c.strokeStyle=j%2?family.hot:'#ff6329';c.lineWidth=1.1;c.beginPath();c.moveTo(point[0]+drift,point[1]+Math.cos(j*4.1)*age*8);c.lineTo(point[0]+drift-3,point[1]-age*4);c.stroke();
  }else if(p.effect==='brick'){
   // A heavy bundle sheds clay dust and loose chips; it never leaves a magic ribbon.
   const drift=Math.sin(j*1.73)*age*(6+tier*2);
   ellipse(c,point[0]+drift,point[1]-age*8,2+age*4,1.5+age*3,j%3?'#dcbc94':'#c98b62',localAngle);
   if(j%8===0)brickChunk(c,point[0]-drift,point[1]+age*10,4+tier,j*.9+time/120,tier,time);
  }else{
   // The actual painted lance, reduced and rotated, leaves glass splinters.
   sprite(c,p.effect,0,0,point[0]+Math.sin(time/150+j)*age*5,point[1]+age*4,9+tier*2,localAngle+Math.sin(j)*.4,.5,.8);
  }
  c.restore();
 }
 if(tier===3&&!reducedMotion){
  c.save();c.translate(tip[0],tip[1]);c.rotate(angle);c.strokeStyle=family.hot;c.lineWidth=.7;c.globalAlpha=.6;
  if(p.effect==='electric'){c.beginPath();c.ellipse(-4,0,5,13+Math.sin(time/80)*2,0,0,TAU);c.stroke();}
  else if(p.effect==='brick'){c.rotate(-angle);for(let n=0;n<3;n++){const phase=time/240+n*TAU/3;brickChunk(c,Math.cos(phase)*22,Math.sin(phase)*15,7,phase*2,3,time);}}
  else if(p.effect==='crystal'){for(let n=0;n<3;n++){const phase=time/210+n*TAU/3;sprite(c,'crystal',0,0,-13+Math.cos(phase)*7,Math.sin(phase)*13,10,phase,.5,.9);}}
  c.restore();
 }
 if(p.powered){
  c.save();c.globalCompositeOperation='screen';c.strokeStyle=family.hot;c.shadowColor=family.mid;c.shadowBlur=12;c.lineWidth=2.2;
  trace(c,p.points,Math.max(0,start-8),index,p.effect,Math.max(2,tier),time,1);trace(c,p.points,Math.max(0,start-8),index,p.effect,Math.max(2,tier),time,-1);
  glow(c,tip[0],tip[1],24,family.mid,.38);
  c.translate(tip[0],tip[1]);c.rotate(angle);c.beginPath();c.ellipse(-4,0,9,18,0,0,TAU);c.stroke();c.restore();
 }
 const size=family.size[tier]*(p.powered?1.24:1);glow(c,tip[0],tip[1],9+tier*2,family.mid,.2);
 const spin=p.effect==='dynamite'?angle+(reducedMotion?0:index*.14):p.effect==='brick'?(reducedMotion?0:Math.sin(index*.09)*.55):angle;
 const painted=sprite(c,p.effect,0,tier,tip[0],tip[1],size,spin,p.effect==='dynamite'||p.effect==='brick'?.5:p.effect==='fire'?.76:p.effect==='electric'?.77:.72);
 if(p.effect==='dynamite'){
  const fuseX=tip[0]-Math.cos(spin)*size*.36,fuseY=tip[1]-Math.sin(spin)*size*.36;glow(c,fuseX,fuseY,5+tier,family.hot,.6);
  if(!reducedMotion)for(let n=0;n<3+tier;n++){const a=time/90+n*TAU/(3+tier),r=3+(time/35+n*2)%6;ellipse(c,fuseX+Math.cos(a)*r,fuseY+Math.sin(a)*r,.9,.9,n%2?'#fff6c4':'#ff931f');}
 }
 // Preserve visibility while the first network image is decoding. This small
 // luminous core is a loading fallback, never the final artwork.
 if(!painted)ellipse(c,tip[0],tip[1],p.effect==='crystal'?9:p.effect==='electric'?3:6,p.effect==='crystal'?4:3,family.hot,angle);
 c.restore();
}

/** A shard landing: a low clay puff and a few chips, small enough to read as secondary. */
function drawFragmentImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,tier:number,material:string){
 const age=elapsed/460;if(age<0||age>=1)return;
 const radius=p.impact.radius,ease=1-Math.pow(1-clamp(age*2),3);
 c.save();c.translate(p.impact.x,p.impact.y);c.globalAlpha=Math.pow(1-age,.9);
 if(tier>=1)glow(c,0,0,radius*(.6+ease*.8),tier>=3?'#ffb347':FAMILY.brick.mid,.3*(1-age));
 for(let n=0;n<5;n++){const a=-Math.PI/2+(n-2)*.55,r=radius*(.2+ease*.9);ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.6-age*radius*.4,radius*(.25+ease*.35),radius*(.18+ease*.25),n%2?'#e5cba3':'#c99a72');}
 for(let n=0;n<3+tier;n++){const a=n*2.39996,r=radius*(.2+age*1.6);brickChunk(c,Math.cos(a)*r,Math.sin(a)*r*.6-age*(1-age)*28,3.5+tier*.5,a+age*7,tier,0);}
 materialDebris(c,material,elapsed,radius*.6,0);c.restore();
}
export function drawImpact(c:CanvasRenderingContext2D,p:Projectile,elapsed:number,level:number,material='earth'){
 if(p.fragment){drawFragmentImpact(c,p,elapsed,strength(level),material);return;}
 const tier=strength(level),duration=620+tier*20,age=elapsed/duration;if(age<0||age>=1)return;
 const family=FAMILY[p.effect],radius=p.impact.radius,ease=1-Math.pow(1-clamp(age*2.4),3),fade=age<.14?clamp(age/.06):Math.pow(1-age,.8);
 c.save();c.translate(p.impact.x,p.impact.y);c.globalAlpha=fade;
 const size=radius*(p.powered?1.2:1)*(p.effect==='electric'?1.75:p.effect==='crystal'?2.2:p.effect==='brick'?2.3:2.05)*(.5+ease*.55)*(1+tier*.09);
 glow(c,0,0,radius*(.35+ease*.85),family.mid,.36*(1-age));
 // Heat rises; a thunder cage stays centered; the hard crystal blossom opens
 // upward then shards fall. None of these shapes alters authoritative terrain.
 const lift=p.effect==='brick'?-radius*age*.12:p.effect==='dynamite'?-radius*age*.18:p.effect==='fire'?-radius*age*.28:p.effect==='crystal'?-radius*.1:0;
 const rotation=p.effect==='electric'?(tier>=2?age*.55:-age*.25):p.effect==='fire'&&tier===2?age*.18:0;
 sprite(c,p.effect,2,tier,0,lift,size,rotation,.5,1);
 if(p.effect==='dynamite'){
  // Paper fragments and a flat pressure wave distinguish powder from magical fire.
  c.save();c.globalAlpha*=Math.pow(1-age,1.4);c.strokeStyle='#ffe9a5';c.lineWidth=2.5*(1-age);c.beginPath();c.ellipse(0,radius*.12,radius*(.18+ease*1.2),radius*(.06+ease*.29),0,0,TAU);c.stroke();
  for(let n=0;n<(reducedMotion?4:10+tier*2);n++){const a=n*2.39996,r=radius*(.12+age*2)*( .7+n%3*.15);c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r*.7-age*(1-age)*35);c.rotate(a+age*8);c.fillStyle=n%3?'#ee4934':'#fff0bc';c.fillRect(-2,-1,4+tier,2.5);c.restore();}c.restore();
 }
 if(p.effect==='brick'){
  // Masonry, not fire: a heavy ground-hugging dust ring and whole bricks tumbling out.
  c.save();c.globalAlpha*=Math.pow(1-age,1.2);
  for(let n=0;n<9;n++){const a=Math.PI+n*Math.PI/8,r=radius*(.3+ease*1.15);ellipse(c,Math.cos(a)*r,radius*.18+Math.sin(a)*r*.22,radius*(.2+ease*.28),radius*(.12+ease*.16),n%2?'#ead2ac':'#cf9f74');}
  for(let n=0;n<(reducedMotion?3:6+tier*2);n++){const a=n*2.39996+.4,r=radius*(.15+age*1.9)*(.75+n%3*.12);brickChunk(c,Math.cos(a)*r,Math.sin(a)*r*.55-age*(1-age)*48,6+tier*1.5+n%2*2,a+age*(n%2?6:-5),tier,elapsed);}
  c.restore();
 }
 if(tier>=1){
  c.save();c.globalAlpha*=Math.max(0,1-age*1.45);c.lineWidth=(1-age)*(p.effect==='electric'?2:1.2);c.strokeStyle=family.hot;
  const ring=radius*(.15+ease*.95);
  if(p.effect==='electric'){
   c.beginPath();for(let n=0;n<=16;n++){const theta=n*TAU/16,r=ring*(n%2?.83:1),x=Math.cos(theta)*r,y=Math.sin(theta)*r*.75;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.stroke();
  }else if(p.effect==='crystal'){
   c.beginPath();for(let n=0;n<=6;n++){const theta=n*TAU/6,x=Math.cos(theta)*ring,y=Math.sin(theta)*ring*.55;if(!n)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
  }else{c.beginPath();c.ellipse(0,radius*.13,ring,ring*.31,0,0,TAU);c.stroke();}
  c.restore();
 }
 if(p.powered){
  c.save();c.globalCompositeOperation='screen';c.globalAlpha*=1-age;c.strokeStyle=family.hot;c.shadowColor=family.mid;c.shadowBlur=9;c.lineWidth=(1-age)*4;
  for(let ring=0;ring<2;ring++){const r=radius*(.3+age*1.7+ring*.22);c.beginPath();c.ellipse(0,0,r,r*(p.effect==='electric'?.85:.55),0,0,TAU);c.stroke();}
  for(let n=0;n<(reducedMotion?6:14);n++){const theta=n*2.39996,r=radius*(.4+age*1.6);c.beginPath();c.moveTo(Math.cos(theta)*r*.7,Math.sin(theta)*r*.7);c.lineTo(Math.cos(theta)*r,Math.sin(theta)*r);c.stroke();}c.restore();
 }
 materialDebris(c,material,elapsed,radius,tier);c.restore();
}

export function drawMuzzle(c:CanvasRenderingContext2D,x:number,y:number,effect:Effect,elapsed:number,level:number,facing:number,directionRadians?:number,powered=false){
 const tier=strength(level),duration=effect==='electric'?190:effect==='crystal'?255:230,age=elapsed/duration;if(age<0||age>=1)return;
 const angle=directionRadians??(facing<0?Math.PI:0),family=FAMILY[effect],pulse=Math.sin(Math.PI*age),size=(effect==='electric'?33:effect==='crystal'?43:39)+tier*14;
 c.save();c.translate(x+27*facing,y-40);c.globalAlpha=Math.pow(1-age,.65);
 glow(c,0,0,12+tier*3,family.hot,.25);
 sprite(c,effect,1,tier,0,0,size*(powered?1.5:1)*(.68+pulse*.45),angle,.17,1);
 c.restore();
}
