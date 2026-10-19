import {petSkill} from '../../shared/petSkills';
import type {PetApplication} from '../../shared/petSkills';
import type {Projectile} from '../../shared/protocol';
/**
 * The art of pet skills in battle (shared/petSkills.ts `visual`): area effects where they rise, healing on the
 * fighter, and a special shot's own projectile and impact. Only registered art is drawn; without it, nothing.
 */
const images=new Map<string,HTMLImageElement>();
function image(src:string){let img=images.get(src);if(!img){img=new Image();img.decoding='async';img.src=src;images.set(src,img);}return img.complete&&img.naturalWidth?img:null;}
const art=(path:string|undefined,stage=0)=>path?image(path.replace('{stage}',String(stage))):null;
export const PET_EFFECT_MAX_MS=2000;
export const PET_IMPACT_MS=650;

/** One frame of a horizontal strip, bottom-centred on (x, y), `width` px wide. */
function strip(c:CanvasRenderingContext2D,img:HTMLImageElement,frames:number,progress:number,x:number,y:number,width:number,alpha=1){
 const frame=Math.min(frames-1,Math.floor(progress*frames)),cw=img.naturalWidth/frames,ch=img.naturalHeight,h=width*ch/cw;
 c.save();c.globalAlpha=alpha;c.drawImage(img,frame*cw,0,cw,ch,x-width/2,y-h,width,h);c.restore();
}
/** A pet application with art: the area attack rising from the ground where the shot landed, a heal on its target. Returns false when it is over. */
export function drawPetApplication(c:CanvasRenderingContext2D,app:PetApplication,age:number,target?:{x:number;y:number},groundAt?:(x:number,y:number)=>number){
 const visual=petSkill(app.skill)?.visual;if(!visual?.effect)return false;
 const duration=visual.duration??900;if(age<0||age>=duration)return age<0;
 const img=art(visual.effect,app.stage);if(!img)return true;
 const progress=age/duration,fade=progress>.8?1-(progress-.8)/.2:1;
 if(app.kind==='area-damage'&&app.x!==undefined&&app.y!==undefined){
  const floor=groundAt?.(app.x,app.y-20),onGround=floor!==undefined&&floor<app.y+160;
  if(visual.style==='whirl'){
   const size=Math.min(visual.size??180,(app.radius??100)*1.3);
   // The whirl sits on the target: centred at the hit, never sunk below the ground.
   whirl(c,img,art(visual.particles,app.stage),visual.pieces,progress,app.x,onGround?Math.min(app.y,floor!-size*.38):app.y,size);
   return true;
  }
  // A hit on a fighter lands at body height: the plant still grows from the ground under it.
  const base=onGround?floor!+8:app.y+14;
  strip(c,img,visual.frames??1,progress,app.x,base,Math.max(visual.size??200,(app.radius??0)*2.2),fade);return true;}
 if((app.kind==='hot'||app.kind==='heal')&&target){strip(c,img,visual.frames??1,progress,target.x,target.y+10,visual.size??140,fade);return true;}
 return false;
}
// A fixed pseudo-random number in [0, 1) for each seed, so every whirl differs but keeps its own shape while it plays.
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// The painted ring with its edge faded out, so the whirl never shows the outline of a disc.
const softRings=new Map<HTMLImageElement,HTMLCanvasElement>();
function softRing(img:HTMLImageElement){
 let soft=softRings.get(img);if(soft)return soft;
 soft=document.createElement('canvas');soft.width=img.naturalWidth;soft.height=img.naturalHeight;const g=soft.getContext('2d')!,cx=soft.width/2,cy=soft.height/2;
 g.drawImage(img,0,0);g.globalCompositeOperation='destination-in';
 const fade=g.createRadialGradient(cx,cy,0,cx,cy,Math.min(cx,cy));fade.addColorStop(0,'#000');fade.addColorStop(.4,'#000d');fade.addColorStop(.75,'#0005');fade.addColorStop(1,'#0000');
 g.fillStyle=fade;g.fillRect(0,0,soft.width,soft.height);softRings.set(img,soft);return soft;
}
/** A whirlwind with no clear outline: soft painted layers that wobble, drift and turn at different speeds, and loose pieces thrown out at random. */
function whirl(c:CanvasRenderingContext2D,ring:HTMLImageElement,pieces:HTMLImageElement|null,given:number|undefined,progress:number,x:number,y:number,size:number){
 const seed=Math.round(x)*.37+Math.round(y)*.11,open=1-(1-Math.min(1,progress/.3))**3,fade=progress>.6?1-(progress-.6)/.4:1,turn=(1-(1-progress)**2)*Math.PI*3;
 const soft=softRing(ring);
 c.save();c.translate(x+Math.sin(progress*5+seed)*size*.07,y-size*.12*progress);
 // Three layers, each off centre and squashed its own way, so the edge keeps changing shape.
 for(const [layer,scale,speed,alpha] of [[0,1.05,1,.8],[1,.72,1.7,.55],[2,.48,2.4,.45]] as const){
  const r=rand(seed+layer*7.3),wobble=progress*(6+layer*2)+r*6,s=size*scale*(.4+.6*open);
  c.save();c.globalAlpha=fade*alpha;c.translate(Math.cos(wobble)*size*.06,Math.sin(wobble*1.3)*size*.05);
  c.rotate(-turn*speed-r*Math.PI*2);c.scale(1+.16*Math.sin(wobble),1-.14*Math.cos(wobble*.8));
  c.drawImage(soft,-s/2,-s/2,s,s);c.restore();
 }
 if(pieces){
  // Square cells: without `pieces`, the strip's width tells how many there are. Each cell flies twice, on its own path.
  const cells=given??Math.max(1,Math.round(pieces.naturalWidth/pieces.naturalHeight)),cw=pieces.naturalWidth/cells,ch=pieces.naturalHeight;
  for(let i=0;i<cells*2;i++){
   const r1=rand(seed+i*3.1),r2=rand(seed+i*5.7),r3=rand(seed+i*9.3),start=r1*.25,t=Math.max(0,(progress-start)/(1-start));if(t<=0)continue;
   const a=r2*Math.PI*2-turn*(.8+r3)-t*(2+2*r1),r=size*(.08+.22*r3+(.3+.4*r2)*t**.8),piece=size*(.09+.1*r1);
   const alpha=Math.min(1,t*5)*(t>.7?1-(t-.7)/.3:1);
   c.save();c.globalAlpha=alpha;c.translate(Math.cos(a)*r,Math.sin(a)*r*(.45+.4*r1)-size*.25*r3*t);c.rotate(a+t*(5+4*r2));
   c.drawImage(pieces,i%cells*cw,0,cw,ch,-piece/2,-piece/2*ch/cw,piece,piece*ch/cw);c.restore();
  }
 }
 c.restore();
}
/** A pet's special projectile (2 frames that alternate, spinning). */
export function drawPetProjectile(c:CanvasRenderingContext2D,p:Projectile,index:number,t:number){
 const visual=p.pet&&petSkill(p.pet.skill)?.visual,img=art(visual?.projectile,p.pet?.stage);
 const point=p.points[Math.min(p.points.length-1,Math.floor(index))];if(!img||!point)return;
 const frames=2,cw=img.naturalWidth/frames,ch=img.naturalHeight,frame=Math.floor(t/110)%frames,size=48;
 c.save();c.translate(point[0],point[1]);c.rotate(t/260%(Math.PI*2));c.drawImage(img,frame*cw,0,cw,ch,-size/2,-size/2*ch/cw,size,size*ch/cw);c.restore();
}
/** The burst where a special projectile lands. */
export function drawPetProjectileImpact(c:CanvasRenderingContext2D,p:Projectile,age:number){
 if(age<0||age>=PET_IMPACT_MS)return;
 const visual=p.pet&&petSkill(p.pet.skill)?.visual,img=art(visual?.impact,p.pet?.stage);if(!img)return;
 const progress=age/PET_IMPACT_MS,size=90+90*progress;
 c.save();c.globalAlpha=1-progress**2;c.drawImage(img,p.impact.x-size/2,p.impact.y-size/2,size,size);c.restore();
}
