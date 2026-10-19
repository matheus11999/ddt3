import {petVisual} from '../../shared/pets';
import type {PetSnapshot} from '../../shared/pets';
/**
 * Where a pet's art enters the renderer: beside its owner, in the plaza and in battle (docs/pets.md "Arte").
 * It draws only what the species registers (shared/pets.ts PetVisual): with no species, or no sprite yet, nothing.
 * Atlas animations read `visual.animations[name]` (row, frames, fps) from a sheet of square cells.
 */
const images=new Map<string,HTMLImageElement>();
function image(src:string){let img=images.get(src);if(!img){img=new Image();img.decoding='async';img.src=src;images.set(src,img);}return img.complete&&img.naturalWidth?img:null;}
export const petImages=()=>images.values();
const moving=(animation:string)=>animation==='walk';
/** Half the owner's width at size 100, from its center to the side the pet stands on: standing in the plaza, lying in battle (the body runs behind the head). */
const OWNER_EDGE={plaza:24,combat:34};

/** One beat of the idle routine of a single painted figure; the routine repeats every IDLE_ROUTINE.length beats. */
export const PET_IDLE_CYCLE=2200;
const IDLE_ROUTINE=['rest','hop','rest','look','rest','wiggle'] as const;
export type PetIdleBeat=typeof IDLE_ROUTINE[number];
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;};
export function petIdleBeat(time:number,seed=0):{beat:PetIdleBeat;progress:number}{
 const t=time+seed%(PET_IDLE_CYCLE*IDLE_ROUTINE.length),index=Math.floor(t/PET_IDLE_CYCLE);
 return {beat:IDLE_ROUTINE[((index%IDLE_ROUTINE.length)+IDLE_ROUTINE.length)%IDLE_ROUTINE.length],progress:t/PET_IDLE_CYCLE-index};
}
const smooth=(x:number)=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
/**
 * How a single painted figure moves while idle, anchored at its feet, like the plaza NPCs: it always breathes and
 * sways in the breeze, and along the routine it hops twice, turns to look away and back, or shakes happily.
 */
export function petIdlePose(time:number,seed=0){
 const {beat,progress:p}=petIdleBeat(time,seed),phase=seed%997;
 let lift=0,squash=Math.sin((time+phase)/520)*.03,skew=Math.sin((time+phase)/900)*.035,turn=1;
 if(beat==='hop'&&p<.6){const k=p/.3,arc=Math.sin(Math.PI*(k%1));lift=arc*10;squash+=arc>.15?.05*arc:-.08*(1-arc/.15);}
 if(beat==='look'){const away=smooth((p-.12)/.08)-smooth((p-.72)/.08);turn=Math.cos(Math.PI*away);}
 if(beat==='wiggle'&&p<.55){const env=Math.sin(Math.PI*p/.55);skew+=Math.sin(p*70)*.11*env;squash+=.04*env;}
 return {lift,squash,skew,turn};
}

export function drawPet(c:CanvasRenderingContext2D,pet:PetSnapshot|undefined,x:number,y:number,ownerSize:number,facing:1|-1,time:number,animation:'idle'|'walk'|'skill'|'hit'|'victory'='idle',combat=false){
 const visual=petVisual(pet);if(!visual||!pet)return;
 const sheet=visual.atlas??visual.sprite;if(!sheet)return;const img=image(sheet);if(!img)return;
 const unit=ownerSize/100,scale=(visual.scale??1)*unit,offset=visual.offset??{x:-8,y:0},anim=visual.atlas?visual.animations?.[animation]??visual.animations?.idle:undefined;
 const cell=anim?img.naturalHeight/Math.max(1,Object.keys(visual.animations??{}).length):img.naturalHeight,frame=anim?Math.floor(time/1000*anim.fps)%anim.frames:0;
 const sw=anim?cell:img.naturalWidth,sh=cell,w=sw*scale,h=sh*scale;
 // offset.x is the space between the owner's edge and the pet's near edge (negative: behind), so every stage stands as close.
 const side=Math.sign(offset.x)||-1,dx=side*((combat?OWNER_EDGE.combat:OWNER_EDGE.plaza)*unit+w/2)+offset.x*unit;
 const pose=anim?{lift:0,squash:0,skew:0,turn:1}:moving(animation)?{lift:Math.abs(Math.sin(time/140))*4,squash:0,skew:0,turn:1}:petIdlePose(time,pet.id?hash(pet.id):0);
 c.save();c.translate(x+dx*facing,y+offset.y*unit-pose.lift*unit);c.transform(1,0,-pose.skew,1,0,0);c.scale(facing*pose.turn*(1-pose.squash*.5),1+pose.squash);
 c.drawImage(img,anim?frame*cell:0,anim?anim.row*cell:0,sw,sh,-w/2,-h,w,h);c.restore();
}
