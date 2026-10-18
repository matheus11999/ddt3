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

/** One frame of a horizontal strip, `width` px wide: bottom-centred on (x, y), or centred on it with `centred`. */
function strip(c:CanvasRenderingContext2D,img:HTMLImageElement,frames:number,progress:number,x:number,y:number,width:number,alpha=1,centred=false){
 const frame=Math.min(frames-1,Math.floor(progress*frames)),cw=img.naturalWidth/frames,ch=img.naturalHeight,h=width*ch/cw;
 c.save();c.globalAlpha=alpha;c.drawImage(img,frame*cw,0,cw,ch,x-width/2,centred?y-h/2:y-h,width,h);c.restore();
}
/** A pet application with art: the area attack (a round whirlwind of leaves) where the shot landed, a heal on its target. Returns false when it is over. */
export function drawPetApplication(c:CanvasRenderingContext2D,app:PetApplication,age:number,target?:{x:number;y:number},groundAt?:(x:number,y:number)=>number){
 const visual=petSkill(app.skill)?.visual;if(!visual?.effect)return false;
 const duration=visual.duration??900;if(age<0||age>=duration)return age<0;
 const img=art(visual.effect,app.stage);if(!img)return true;
 const progress=age/duration,fade=progress>.8?1-(progress-.8)/.2:1;
 if(app.kind==='area-damage'&&app.x!==undefined&&app.y!==undefined){
  // The whirlwind spins centred a little above the point where the shot landed; its painting grows with the stage.
  strip(c,img,visual.frames??1,progress,app.x,app.y-24,visual.size??200,fade,true);return true;}
 if((app.kind==='hot'||app.kind==='heal')&&target){strip(c,img,visual.frames??1,progress,target.x,target.y+10,visual.size??140,fade);return true;}
 return false;
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
