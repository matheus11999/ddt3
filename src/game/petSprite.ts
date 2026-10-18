import {petVisual} from '../../shared/pets';
import type {PetSnapshot} from '../../shared/pets';
/**
 * Where a pet's art enters the renderer: beside its owner, in the plaza and in battle (docs/pets.md "Arte").
 * It draws only what the species registers (shared/pets.ts PetVisual): with no species, or no sprite yet, nothing.
 * Atlas animations read `visual.animations[name]` (row, frames, fps) from a sheet of square cells.
 */
const images=new Map<string,HTMLImageElement>();
function image(src:string){let img=images.get(src);if(!img){img=new Image();img.decoding='async';img.src=src;images.set(src,img);}return img.complete&&img.naturalWidth?img:null;}
export function drawPet(c:CanvasRenderingContext2D,pet:PetSnapshot|undefined,x:number,y:number,ownerSize:number,facing:1|-1,time:number,animation:'idle'|'walk'|'skill'|'hit'|'victory'='idle'){
 const visual=petVisual(pet);if(!visual)return;
 const sheet=visual.atlas??visual.sprite;if(!sheet)return;const img=image(sheet);if(!img)return;
 const scale=(visual.scale??1)*ownerSize/100,offset=visual.offset??{x:-70,y:0},anim=visual.atlas?visual.animations?.[animation]??visual.animations?.idle:undefined;
 const cell=anim?img.naturalHeight/Math.max(1,Object.keys(visual.animations??{}).length):img.naturalHeight,frame=anim?Math.floor(time/1000*anim.fps)%anim.frames:0;
 const sw=anim?cell:img.naturalWidth,sh=cell,w=sw*scale,h=sh*scale;
 c.save();c.translate(x+offset.x*facing*ownerSize/100,y+offset.y*ownerSize/100);c.scale(facing,1);
 c.drawImage(img,anim?frame*cell:0,anim?anim.row*cell:0,sw,sh,-w/2,-h,w,h);c.restore();
}
