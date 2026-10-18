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
/** A round whirlwind: the painted ring opens and spins (fast, then slowing), loose pieces spiral out and fade. */
function whirl(c:CanvasRenderingContext2D,ring:HTMLImageElement,pieces:HTMLImageElement|null,given:number|undefined,progress:number,x:number,y:number,size:number){
 const open=1-(1-Math.min(1,progress/.35))**3,fade=progress>.65?1-(progress-.65)/.35:1,turn=(1-(1-progress)**2)*Math.PI*3;
 c.save();c.translate(x,y);
 c.save();c.globalAlpha=fade*.9;c.rotate(-turn);const s=size*(.45+.55*open);c.drawImage(ring,-s/2,-s/2*ring.naturalHeight/ring.naturalWidth,s,s*ring.naturalHeight/ring.naturalWidth);c.restore();
 // A smaller inner copy turning faster gives the whirl its depth.
 c.save();c.globalAlpha=fade*.4;c.rotate(-turn*1.6+.8);const inner=s*.55;c.drawImage(ring,-inner/2,-inner/2*ring.naturalHeight/ring.naturalWidth,inner,inner*ring.naturalHeight/ring.naturalWidth);c.restore();
 if(pieces){
  // Square cells: without `pieces`, the strip's width tells how many there are.
  const count=given??Math.max(1,Math.round(pieces.naturalWidth/pieces.naturalHeight)),cw=pieces.naturalWidth/count,ch=pieces.naturalHeight,piece=size*.16;
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2-turn*1.2,r=size*(.22+.42*progress),alpha=fade*Math.min(1,progress*4);
   c.save();c.globalAlpha=alpha;c.translate(Math.cos(a)*r,Math.sin(a)*r*.8);c.rotate(a+progress*6);
   c.drawImage(pieces,i%count*cw,0,cw,ch,-piece/2,-piece/2*ch/cw,piece,piece*ch/cw);c.restore();
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
