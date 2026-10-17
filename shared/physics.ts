import type {MapId, Weapon} from './catalog';
import {canonicalMap,cellBits,contains,getMap} from './maps';
import type {CanonicalMapId,MaterialId,MapRegion} from './maps';
import {HOMING_MIN_SPEED,HOMING_RADIUS,HOMING_TURN_RATE} from './abilities';
/** Default arena; a map may be wider (`MapDefinition.dimensions.width`), never taller. */
export const WORLD={width:1536,height:864,cell:3,cols:512,rows:288};
/** Terrain arrays are always `rows` tall, so their length carries the map width. */
export function terrainCols(t:{length:number}){return t.length/WORLD.rows;}
export function terrainWidth(t:{length:number}){return terrainCols(t)*WORLD.cell;}
/** Time dilation preserves the original arcs while making their travel 18% faster. */
export const PROJECTILE_SPEED_SCALE=1.18;
export const FIGHTER_HIT_RADIUS=22;
interface TerrainTemplate {solid:Uint8Array;regions:Int16Array;definition:readonly MapRegion[];cols:number;}
const templates=new Map<CanonicalMapId,TerrainTemplate>();
export function terrainTemplate(map:MapId='garden'):TerrainTemplate {
 const id=canonicalMap(map),cached=templates.get(id);if(cached)return cached;
 const def=getMap(id),definition=def.regions,cols=def.dimensions.width/WORLD.cell,solid=new Uint8Array(cols*WORLD.rows),regions=new Int16Array(solid.length).fill(-1);
 // Scan-convert polygons once per row, not once per cell: large illustrated contours
 // remain cheap to initialise on both the server and lower-powered browsers.
 for(let r=0;r<definition.length;r++){
  const shape=definition[r].shape;
  if(shape.kind==='polygon'){
   const points=shape.points,minY=Math.max(0,Math.ceil(Math.min(...points.map(p=>p[1]))/3)),maxY=Math.min(WORLD.rows,Math.ceil(Math.max(...points.map(p=>p[1]))/3));
   for(let cy=minY;cy<maxY;cy++){const y=cy*3,intersections:number[]=[];
    for(let n=0,j=points.length-1;n<points.length;j=n++){const [ax,ay]=points[n],[bx,by]=points[j];if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);}
    intersections.sort((a,b)=>a-b);
    for(let n=0;n<intersections.length;n+=2){const left=Math.max(0,Math.ceil(intersections[n]/3)),right=Math.min(cols,Math.ceil(intersections[n+1]/3));for(let cx=left;cx<right;cx++){const i=cy*cols+cx;solid[i]=1;regions[i]=r;}}
   }
  }else if(shape.kind==='cells'){
   const bits=cellBits(shape);
   for(let y=0;y<shape.rows;y++)for(let x=0;x<shape.cols;x++){const n=y*shape.cols+x,cx=shape.col+x,cy=shape.row+y;if(!(bits[n>>3]>>(n&7)&1)||cx<0||cy<0||cx>=cols||cy>=WORLD.rows)continue;const i=cy*cols+cx;solid[i]=1;regions[i]=r;}
  }else{
   const bounds=shape.kind==='rect'?[shape.x,shape.y,shape.x+shape.width,shape.y+shape.height]:[shape.x-shape.rx,shape.y-shape.ry,shape.x+shape.rx,shape.y+shape.ry];
   for(let cy=Math.max(0,Math.floor(bounds[1]/3));cy<Math.min(WORLD.rows,Math.ceil(bounds[3]/3)+1);cy++)for(let cx=Math.max(0,Math.floor(bounds[0]/3));cx<Math.min(cols,Math.ceil(bounds[2]/3)+1);cx++)if(contains(shape,cx*3,cy*3)){const i=cy*cols+cx;solid[i]=1;regions[i]=r;}
  }
 }
 const value={solid,regions,definition,cols};templates.set(id,value);return value;
}
export function createTerrain(map:MapId='garden'):Uint8Array{return terrainTemplate(map).solid.slice();}
export function terrainMaterial(map:MapId,x:number,y:number):{material:MaterialId;destructible:boolean;region?:string}{
 const template=terrainTemplate(map);const cx=Math.floor(x/3),cy=Math.floor(y/3);
 if(cx<0||cx>=template.cols||cy<0||cy>=WORLD.rows)return {material:'earth',destructible:false};
 const r=template.definition[template.regions[cy*template.cols+cx]];return r?{material:r.material,destructible:r.destructible,region:r.id}:{material:'earth',destructible:false};
}
export function solid(t:Uint8Array,x:number,y:number){const cols=terrainCols(t);if(x<0||x>=cols*3||y<0||y>=WORLD.height)return false;return t[Math.floor(y/3)*cols+Math.floor(x/3)]===1;}
export function ground(t:Uint8Array,x:number,start=0){for(let y=Math.max(0,Math.floor(start/3)*3);y<WORLD.height;y+=3){if(solid(t,x,y))return y;}return WORLD.height+80;}
/** One walk command moves this far, one pixel at a time, so every bump and dip on the way is felt. */
export const WALK_STEP=8;
/** Highest lip the feet can step onto in one pixel (about a knee): taller walls stop the walk. */
export const WALK_STEP_UP=18;
/** Over this horizontal span the ground may rise at most WALK_MAX_RISE (about 63°): a steeper wall, such as a deep pit or stacked craters, cannot be climbed. */
export const WALK_SLOPE_SPAN=12;
export const WALK_MAX_RISE=24;
/** Torso and head (from the waist up) must stay clear just ahead, so low ceilings and overhangs stop the walk; the legs only need the ground rules above. */
const WALK_BODY_TOP=51,WALK_BODY_WAIST=21,WALK_BODY_FRONT=7;
/**
 * Walks up to WALK_STEP pixels along the ground. Going down follows the ground
 * (a drop taller than a step ends the walk and the fighter falls); going up is
 * limited by a knee-high lip and a maximum slope, so a steep crater traps its
 * occupant instead of letting them hop out. Returns null when no pixel was walked.
 */
export function walkPosition(t:Uint8Array,origin:{x:number;y:number},direction:1|-1):{x:number;y:number}|null {
 const min=30,max=terrainWidth(t)-30;let x=Math.max(min,Math.min(max,origin.x)),y=origin.y,moved=false;
 for(let n=0;n<WALK_STEP;n++){
  const nx=x+direction;if(nx<min||nx>max)break;
  const top=y-WALK_STEP_UP;if(solid(t,nx,top))break;
  const ny=ground(t,nx,top);
  if(ny<y){
   // Sustained slope: compare with the ground a span behind the new foot.
   const behind=ground(t,nx-direction*WALK_SLOPE_SPAN,ny);if(behind<=WORLD.height&&behind-ny>WALK_MAX_RISE)break;
  }
  let blocked=false;
  for(let px=0;px<=WALK_BODY_FRONT&&!blocked;px+=WORLD.cell)for(let py=ny-WALK_BODY_TOP;py<ny-WALK_BODY_WAIST;py+=WORLD.cell)if(solid(t,nx+direction*px,py)){blocked=true;break;}
  if(blocked)break;
  const drop=ny-y;x=nx;y=ny;moved=true;
  if(drop>WALK_STEP_UP)break; // stepped off a ledge: the fall takes over
 }
 return moved?{x,y}:null;
}
/** A projectile that hits a fighter in full digs only this share of its crater, under the target's feet. */
export const DIRECT_HIT_DIG=.45;
/** Where an impact removes terrain: under the target on a direct hit, else at the explosion. */
export function impactDig(impact:{x:number;y:number;radius:number;dig?:{x:number;y:number;radius:number}}){return impact.dig??impact;}
/** Broken ground is never a perfect circle: the edge only grows, by up to this share, with a jagged profile seeded by the impact point (same result on server and clients). */
export const CRATER_ROUGHNESS=.14;
function roughness(angle:number,seed:number){const a=(seed&1023)/163,b=((seed>>10)&1023)/163,c=((seed>>20)&1023)/163;
 return (Math.sin(angle*5+a)*.45+Math.sin(angle*9+b)*.35+Math.sin(angle*17+c)*.2+1)/2;}
/** Every destructible region breaks the same way: the drawn material (crystal, stone, metal…) is only looks. */
export function crater(t:Uint8Array,x:number,y:number,r:number,map:MapId='garden'){
 const template=terrainTemplate(map),cols=template.cols,seed=Math.floor(x)*73856093^Math.floor(y)*19349663;let removed=0;const extent=r*(1+CRATER_ROUGHNESS);
 for(let cy=Math.max(0,Math.floor((y-extent)/3));cy<Math.min(WORLD.rows,Math.ceil((y+extent)/3));cy++)
 for(let cx=Math.max(0,Math.floor((x-extent)/3));cx<Math.min(cols,Math.ceil((x+extent)/3));cx++){
  const i=cy*cols+cx;if(!t[i])continue;const region=template.definition[template.regions[i]];
  if(!region?.destructible)continue;
  const dx=cx*3-x,dy=cy*3-y,edge=r*(1+CRATER_ROUGHNESS*roughness(Math.atan2(dy,dx),seed));if(dx*dx+dy*dy<=edge*edge){t[i]=0;removed++;}
 }
 return removed;
}
export function packTerrain(t:Uint8Array):Uint8Array{const b=new Uint8Array(Math.ceil(t.length/8));for(let i=0;i<t.length;i++)if(t[i])b[i>>3]|=1<<(i%8);return b;}
export function unpackTerrain(b:Uint8Array){const t=new Uint8Array(b.length*8);for(let i=0;i<t.length;i++)t[i]=(b[i>>3]>>(i%8))&1;return t;}
interface ProjectileOrigin {x:number;y:number;facing:number;}
interface ProjectileTarget {id:string;x:number;y:number;hp:number;}
/** Homing guidance. Without `projectileIndex` every projectile of the volley is guided. */
export interface ProjectileGuidance {projectileIndex?:number;targets:ProjectileTarget[];}
/** Flight can only land near its first contact, with solid support and room for
 * the entire fighter. A miss or an enclosed wall leaves the shooter in place. */
export function flightLanding(terrain:Uint8Array,impact:{x:number;y:number},targets:ProjectileTarget[]=[]):{x:number;y:number}|null {
 const width=terrainWidth(terrain);if(impact.x<24||impact.x>width-24||impact.y<0||impact.y>=WORLD.height)return null;
 for(let distance=0;distance<=48;distance+=WORLD.cell)for(const direction of distance?[1,-1]:[1]){
  const x=impact.x+distance*direction;if(x<24||x>width-24)continue;
  const y=ground(terrain,x,impact.y-54);if(y>WORLD.height||Math.abs(y-impact.y)>54)continue;
  if(targets.some(target=>target.hp>0&&Math.abs(target.x-x)<30&&Math.abs(target.y-y)<60))continue;
  let clear=true;for(let px=x-12;px<=x+12&&clear;px+=WORLD.cell){if(Math.abs(ground(terrain,px,y-6)-y)>9){clear=false;break;}for(let py=y-63;py<y-3;py+=WORLD.cell)if(solid(terrain,px,py)){clear=false;break;}}
  if(clear)return {x,y};
 }
 return null;
}
/** Points track the projectile center; x/y identify the contacted surface. */
export interface TrajectoryResult {points:number[][];x:number;y:number;hitId?:string;hitQuality?:number;flightTime:number;}
interface Contact {fraction:number;x:number;y:number;centerX?:number;centerY?:number;hitId?:string;hitQuality?:number;}

/** Earliest contact of a moving point and circle, including an exact tangent. */
function circleContact(x:number,y:number,dx:number,dy:number,cx:number,cy:number,radius:number):number|undefined {
 const ox=x-cx,oy=y-cy,outside=ox*ox+oy*oy-radius*radius;
 if(outside<=0)return 0;
 const length2=dx*dx+dy*dy;if(length2===0)return;
 const dot=ox*dx+oy*dy,discriminant=dot*dot-length2*outside;
 // Round-off may put a geometric tangent a few ulps below zero.
 const tolerance=Number.EPSILON*16*(dot*dot+Math.abs(length2*outside)+1);
 if(discriminant < -tolerance)return;
 const fraction=(-dot-Math.sqrt(Math.max(0,discriminant)))/length2;
 if(fraction>=-1e-9&&fraction<=1+1e-9)return Math.max(0,Math.min(1,fraction));
}

/** Sweeping a disk against a cell is a point against a rectangle with rounded
 * corners. A square expansion alone would incorrectly catch near-corner shots. */
function cellContact(x:number,y:number,dx:number,dy:number,left:number,top:number,radius:number):number|undefined {
 const right=left+WORLD.cell,bottom=top+WORLD.cell;
 let enter=0,exit=1;
 for(const [value,delta,min,max] of [[x,dx,left-radius,right+radius],[y,dy,top-radius,bottom+radius]]){
  if(delta===0){if(value<min||value>max)return;continue;}
  const a=(min-value)/delta,b=(max-value)/delta;
  enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return;
 }
 const px=x+dx*enter,py=y+dy*enter;
 if((px>=left&&px<=right)||(py>=top&&py<=bottom))return enter;
 return circleContact(x,y,dx,dy,px<left?left:right,py<top?top:bottom,radius);
}

/** Test every solid cell touched by the swept disk, even a single 3px crater lip. */
function terrainContact(t:Uint8Array,x:number,y:number,dx:number,dy:number,radius:number):Contact|undefined {
 const cols=terrainCols(t),minX=Math.max(0,Math.ceil((Math.min(x,x+dx)-radius)/WORLD.cell)-1),maxX=Math.min(cols-1,Math.floor((Math.max(x,x+dx)+radius)/WORLD.cell));
 const minY=Math.max(0,Math.ceil((Math.min(y,y+dy)-radius)/WORLD.cell)-1),maxY=Math.min(WORLD.rows-1,Math.floor((Math.max(y,y+dy)+radius)/WORLD.cell));
 let contact:Contact|undefined;
 for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
  if(!t[cy*cols+cx])continue;
  const left=cx*WORLD.cell,top=cy*WORLD.cell,fraction=cellContact(x,y,dx,dy,left,top,radius);
  if(fraction===undefined||(contact&&fraction>=contact.fraction))continue;
  const centerX=x+dx*fraction,centerY=y+dy*fraction,inset=.00001;
  // Impact/material/crater use the actual surface cell; animation retains the
  // disk center, so a larger projectile never visually buries itself in a wall.
  contact={fraction,centerX,centerY,x:Math.max(left+inset,Math.min(left+WORLD.cell-inset,centerX)),y:Math.max(top+inset,Math.min(top+WORLD.cell-inset,centerY))};
 }
 return contact;
}
function projectileContact(terrain:Uint8Array,x:number,y:number,dx:number,dy:number,radius:number,targets:ProjectileTarget[]):Contact|undefined {
 let contact=terrainContact(terrain,x,y,dx,dy,radius);
 for(const target of targets){
  if(target.hp<=0)continue;
  const fraction=circleContact(x,y,dx,dy,target.x,target.y-31,FIGHTER_HIT_RADIUS+radius);
  if(fraction===undefined||(contact&&fraction>contact.fraction))continue;
  const centerX=x+dx*fraction,centerY=y+dy*fraction,ox=centerX-target.x,oy=centerY-(target.y-31),distance=Math.hypot(ox,oy);
  const travel=Math.hypot(dx,dy),lineOffset=travel?Math.abs((target.x-x)*dy-(target.y-31-y)*dx)/travel:distance;
  const hitQuality=Math.sqrt(Math.max(0,1-(lineOffset/(FIGHTER_HIT_RADIUS+radius))**2));
  contact={fraction,centerX,centerY,x:target.x+(distance?ox/distance*FIGHTER_HIT_RADIUS:0),y:target.y-31+(distance?oy/distance*FIGHTER_HIT_RADIUS:0),hitId:target.id,hitQuality};
 }
 // Arena exits are also swept, keeping impact coordinates bounded at every velocity.
 for(const [value,delta,limit,exiting] of [[x,dx,-80,x+dx<-80],[x,dx,terrainWidth(terrain)+80,x+dx>terrainWidth(terrain)+80],[y,dy,WORLD.height+50,y+dy>WORLD.height+50]] as const){
  if(!exiting)continue;const fraction=delta===0?0:Math.max(0,(limit-value)/delta);
  if(fraction<=1&&(!contact||fraction<contact.fraction))contact={fraction,x:x+dx*fraction,y:y+dy*fraction};
 }
 return contact;
}

/** A projectile that flew out of the arena (sides or bottom) ends past the world edge: no collision there. */
export function leftArena(impact:{x:number;y:number},width:number=WORLD.width){return impact.x<0||impact.x>width||impact.y>=WORLD.height;}

/** Simultaneous shots share a clock. The callback applies authoritative impact changes
 * before the remaining shots are checked again against the changed terrain/players. */
export function volley(terrain:Uint8Array,origin:ProjectileOrigin,angles:readonly number[],power:number,wind:number,weapon:Weapon,targets:ProjectileTarget[]=[],onImpact?:(result:TrajectoryResult,index:number)=>void,launchDelays:readonly number[]=[],guidance?:ProjectileGuidance):TrajectoryResult[] {
 const speed=power*9.8,step=1000/120,shots=angles.map((angle,index)=>({angle,launchAt:Math.max(0,launchDelays[index]??0)*PROJECTILE_SPEED_SCALE,x:0,y:0,vx:0,vy:0,points:[] as number[][],launched:false,done:false,nextSample:0,lockId:undefined as string|undefined})),results:TrajectoryResult[]=new Array(angles.length);
 const finish=(index:number,contact:Contact,at:number)=>{const shot=shots[index];shot.done=true;shot.points.push([contact.centerX??contact.x,contact.centerY??contact.y]);const result={points:shot.points,x:contact.x,y:contact.y,hitId:contact.hitId,hitQuality:contact.hitQuality,flightTime:(at-shot.launchAt)/PROJECTILE_SPEED_SCALE};results[index]=result;onImpact?.(result,index);};
 let time=0;
 while(shots.some(shot=>!shot.done)){
  for(const shot of shots)if(!shot.launched&&shot.launchAt<=time+1e-7){const rad=shot.angle*Math.PI/180;shot.x=origin.x+origin.facing*27;shot.y=origin.y-40;shot.vx=Math.cos(rad)*speed*origin.facing;shot.vy=-Math.sin(rad)*speed;shot.points.push([shot.x,shot.y]);shot.launched=true;shot.nextSample=time+1000/60;}
  const nextLaunch=Math.min(Infinity,...shots.filter(shot=>!shot.launched).map(shot=>shot.launchAt));
  if(!shots.some(shot=>shot.launched&&!shot.done)){time=nextLaunch;continue;}
  const duration=Math.min(step,nextLaunch-time);let elapsed=0;
  while(elapsed<duration-1e-9){
   const remaining=(duration-elapsed)/1000;let earliest:{index:number;contact:Contact}|undefined;
   for(let index=0;index<shots.length;index++){const shot=shots[index];if(!shot.launched||shot.done)continue;const contact=projectileContact(terrain,shot.x,shot.y,shot.vx*remaining,shot.vy*remaining,weapon.projectileRadius,targets);if(contact&&(!earliest||contact.fraction<earliest.contact.fraction))earliest={index,contact};}
   const advance=(duration-elapsed)*(earliest?.contact.fraction??1);
   for(const shot of shots)if(shot.launched&&!shot.done){shot.x+=shot.vx*advance/1000;shot.y+=shot.vy*advance/1000;}
   elapsed+=advance;if(!earliest)break;finish(earliest.index,earliest.contact,time+elapsed);
  }
  time+=duration;
  for(let index=0;index<shots.length;index++){const shot=shots[index];if(!shot.launched||shot.done)continue;
   const locked=guidance&&(guidance.projectileIndex??index)===index?homingTarget(shot,guidance):undefined;
   if(locked){
    // Magnet lock: pure pursuit that ignores wind/gravity. The turn rate grows as the
    // distance shrinks (turn radius <= half the distance), so it always closes in.
    const dx=locked.x-shot.x,dy=locked.y-31-shot.y,distance=Math.max(1,Math.hypot(dx,dy)),speed=Math.max(HOMING_MIN_SPEED,Math.hypot(shot.vx,shot.vy)),heading=Math.atan2(shot.vy,shot.vx),desired=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading)),limit=Math.max(HOMING_TURN_RATE,2*speed/distance)*duration/1000,next=heading+Math.max(-limit,Math.min(limit,delta));
    shot.vx=Math.cos(next)*speed;shot.vy=Math.sin(next)*speed;
   }else{shot.vx+=wind*7*duration/1000;shot.vy+=weapon.gravity*duration/1000;}
   if(time>=shot.nextSample-1e-7){shot.points.push([Math.round(shot.x*10)/10,Math.round(shot.y*10)/10]);shot.nextSample+=1000/60;}if(time-shot.launchAt>=7500-1e-7)finish(index,{x:shot.x,y:shot.y,fraction:1},time);}
 }
 return results;
}
/** Acquires the nearest living enemy within HOMING_RADIUS and keeps that lock while it lives. */
function homingTarget(shot:{x:number;y:number;lockId?:string},guidance:ProjectileGuidance):ProjectileTarget|undefined {
 const current=shot.lockId?guidance.targets.find(target=>target.id===shot.lockId&&target.hp>0):undefined;if(current)return current;
 const distance=(target:ProjectileTarget)=>Math.hypot(target.x-shot.x,target.y-31-shot.y);
 const target=guidance.targets.filter(target=>target.hp>0&&distance(target)<=HOMING_RADIUS).sort((a,b)=>distance(a)-distance(b))[0];
 shot.lockId=target?.id;return target;
}
export function trajectory(terrain:Uint8Array,origin:ProjectileOrigin,angle:number,power:number,wind:number,weapon:Weapon,targets:ProjectileTarget[]=[]):TrajectoryResult {
 return volley(terrain,origin,[angle],power,wind,weapon,targets)[0];
}
/** Secondary brick chunks use the same swept collision physics as regular shots. */
export function shatter(terrain:Uint8Array,origin:{x:number;y:number},count:number,facing:1|-1,weapon:Weapon,wind:number,targets:ProjectileTarget[]=[],onImpact?:(result:TrajectoryResult,index:number)=>void):TrajectoryResult[] {
 const fragments=weapon.fragments;if(!fragments||count<1)return [];
 const angles=Array.from({length:count},(_,index)=>count===1?80:32+index*116/(count-1));
 const launch={x:origin.x-facing*27,y:origin.y+40-fragments.radius-2,facing};
 return volley(terrain,launch,angles,fragments.speed/9.8,wind*.5,{...weapon,projectileRadius:fragments.radius,gravity:fragments.gravity},targets,onImpact);
}
