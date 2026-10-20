import {petVisual} from '../../shared/pets';
import type {PetSnapshot} from '../../shared/pets';
import {WORLD} from '../../shared/physics';
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
/**
 * How a single painted figure moves while idle, anchored at its feet, like the plaza NPCs: it always breathes and
 * sways in the breeze, and along the routine it hops twice, hops round to look away and back, or shakes happily.
 */
export function petIdlePose(time:number,seed=0){
 const {beat,progress:p}=petIdleBeat(time,seed),phase=seed%997;
 let lift=0,squash=Math.sin((time+phase)/520)*.03,skew=Math.sin((time+phase)/900)*.035,turn=1;
 if(beat==='hop'&&p<.6){const k=p/.3,arc=Math.sin(Math.PI*(k%1));lift=arc*10;squash+=arc>.15?.05*arc:-.08*(1-arc/.15);}
 // Turning is a snap at the top of a little hop, as painted figures turn in DDTank: never squeezing flat like paper.
 if(beat==='look'){for(const at of [.12,.72]){const k=(p-at)/.14;if(k>=0&&k<1){const arc=Math.sin(Math.PI*k);lift=arc*7;squash+=arc>.2?.03*arc:-.06;}}turn=p>=.19&&p<.79?-1:1;}
 if(beat==='wiggle'&&p<.55){const env=Math.sin(Math.PI*p/.55);skew+=Math.sin(p*70)*.11*env;squash+=.04*env;}
 return {lift,squash,skew,turn};
}

/** The ground under a battle pet: the first solid pixel at or below `start` (shared/physics.ts `ground`). */
export type PetFloor=(x:number,start:number)=>number;
/** A battle pet sits on the terrain like its owner (20/10, matheus): it rests on the ground under itself, tilts with
 * the slope and falls into a hole with gravity. Its spot is beside the owner; a wall or a drop off the map there puts
 * it on the owner's other side, and with no floor on either side it stays level with the owner. */
/** How far above the owner's feet the pet looks for its own floor. */
const PET_REACH=45;
const PET_GRAVITY=2200,PET_FOOT=10;
const grounds=new Map<string,{x:number;y:number;vy:number;tilt:number;at:number}>();
function petGround(key:string,floor:PetFloor,x:number,mirror:number,y:number,time:number){
 const spot=(px:number)=>{const g=floor(px,y-PET_REACH);return g<=y-PET_REACH+1||g>=WORLD.height?undefined:g;};
 let px=x,target=spot(x);if(target===undefined){const other=spot(mirror);if(other!==undefined){px=mirror;target=other;}}
 target??=y;
 let state=grounds.get(key);const dt=state?Math.min(.1,Math.max(0,(time-state.at)/1000)):0;
 if(!state||Math.abs(state.x-px)>60||time-state.at>500){state={x:px,y:target,vy:0,tilt:0,at:time};grounds.set(key,state);if(grounds.size>32)grounds.delete(grounds.keys().next().value!);}
 if(target>state.y){state.vy+=PET_GRAVITY*dt;state.y=Math.min(target,state.y+state.vy*dt);}
 else{state.vy=0;state.y+=(target-state.y)*(1-Math.exp(-dt*1000/60));}
 const landed=state.y>=target-1,left=floor(px-PET_FOOT,target-PET_REACH),right=floor(px+PET_FOOT,target-PET_REACH);
 const slope=landed&&left<WORLD.height&&right<WORLD.height?Math.max(-.5,Math.min(.5,Math.atan2(right-left,PET_FOOT*2))):0;
 state.tilt+=(slope-state.tilt)*(1-Math.exp(-dt*1000/110));state.x=px;state.at=time;
 return {x:px,y:state.y,tilt:state.tilt};
}

export function drawPet(c:CanvasRenderingContext2D,pet:PetSnapshot|undefined,x:number,y:number,ownerSize:number,facing:1|-1,time:number,animation:'idle'|'walk'|'skill'|'hit'|'victory'='idle',combat=false,floor?:PetFloor,owner=''){
 const visual=petVisual(pet);if(!visual||!pet)return;
 const sheet=visual.atlas??visual.sprite;if(!sheet)return;const img=image(sheet);if(!img)return;
 const unit=ownerSize/100,scale=(visual.scale??1)*unit,offset=visual.offset??{x:-8,y:0},anim=visual.atlas?visual.animations?.[animation]??visual.animations?.idle:undefined;
 const cell=anim?img.naturalHeight/Math.max(1,Object.keys(visual.animations??{}).length):img.naturalHeight,frame=anim?Math.floor(time/1000*anim.fps)%anim.frames:0;
 const sw=anim?cell:img.naturalWidth,sh=cell,w=sw*scale,h=sh*scale;
 // offset.x is the space between the owner's edge and the pet's near edge (negative: behind), so every stage stands as close.
 const side=Math.sign(offset.x)||-1,dx=side*((combat?OWNER_EDGE.combat:OWNER_EDGE.plaza)*unit+w/2)+offset.x*unit;
 const pose=anim?{lift:0,squash:0,skew:0,turn:1}:moving(animation)?{lift:Math.abs(Math.sin(time/140))*4,squash:0,skew:0,turn:1}:petIdlePose(time,pet.id?hash(pet.id):0);
 const at=floor?petGround(`${owner}:${pet.id}`,floor,x+dx*facing,x-dx*facing,y,time):{x:x+dx*facing,y,tilt:0};
 c.save();c.translate(at.x,at.y+offset.y*unit);c.rotate(at.tilt);c.translate(0,-pose.lift*unit);c.transform(1,0,-pose.skew,1,0,0);c.scale(facing*pose.turn*(1-pose.squash*.5),1+pose.squash);
 c.drawImage(img,anim?frame*cell:0,anim?anim.row*cell:0,sw,sh,-w/2,-h,w,h);c.restore();
}
