import type {MapId, Weapon} from './catalog';
import {canonicalMap,contains,getMap,MATERIALS} from './maps';
import type {CanonicalMapId,MaterialId,MapRegion} from './maps';
export const WORLD={width:1536,height:864,cell:3,cols:512,rows:288};
interface TerrainTemplate {solid:Uint8Array;regions:Int16Array;definition:readonly MapRegion[];}
const templates=new Map<CanonicalMapId,TerrainTemplate>();
export function terrainTemplate(map:MapId='garden'):TerrainTemplate {
 const id=canonicalMap(map),cached=templates.get(id);if(cached)return cached;
 const definition=getMap(id).regions,solid=new Uint8Array(WORLD.cols*WORLD.rows),regions=new Int16Array(solid.length).fill(-1);
 // Scan-convert polygons once per row, not once per cell: large illustrated contours
 // remain cheap to initialise on both the server and lower-powered browsers.
 for(let r=0;r<definition.length;r++){
  const shape=definition[r].shape;
  if(shape.kind==='polygon'){
   const points=shape.points,minY=Math.max(0,Math.ceil(Math.min(...points.map(p=>p[1]))/3)),maxY=Math.min(WORLD.rows,Math.ceil(Math.max(...points.map(p=>p[1]))/3));
   for(let cy=minY;cy<maxY;cy++){const y=cy*3,intersections:number[]=[];
    for(let n=0,j=points.length-1;n<points.length;j=n++){const [ax,ay]=points[n],[bx,by]=points[j];if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);}
    intersections.sort((a,b)=>a-b);
    for(let n=0;n<intersections.length;n+=2){const left=Math.max(0,Math.ceil(intersections[n]/3)),right=Math.min(WORLD.cols,Math.ceil(intersections[n+1]/3));for(let cx=left;cx<right;cx++){const i=cy*WORLD.cols+cx;solid[i]=1;regions[i]=r;}}
   }
  }else{
   const bounds=shape.kind==='rect'?[shape.x,shape.y,shape.x+shape.width,shape.y+shape.height]:[shape.x-shape.rx,shape.y-shape.ry,shape.x+shape.rx,shape.y+shape.ry];
   for(let cy=Math.max(0,Math.floor(bounds[1]/3));cy<Math.min(WORLD.rows,Math.ceil(bounds[3]/3)+1);cy++)for(let cx=Math.max(0,Math.floor(bounds[0]/3));cx<Math.min(WORLD.cols,Math.ceil(bounds[2]/3)+1);cx++)if(contains(shape,cx*3,cy*3)){const i=cy*WORLD.cols+cx;solid[i]=1;regions[i]=r;}
  }
 }
 const value={solid,regions,definition};templates.set(id,value);return value;
}
export function createTerrain(map:MapId='garden'):Uint8Array{return terrainTemplate(map).solid.slice();}
export function terrainMaterial(map:MapId,x:number,y:number):{material:MaterialId;destructible:boolean;region?:string}{
 const template=terrainTemplate(map);const cx=Math.floor(x/3),cy=Math.floor(y/3);
 if(cx<0||cx>=WORLD.cols||cy<0||cy>=WORLD.rows)return {material:'earth',destructible:false};
 const r=template.definition[template.regions[cy*WORLD.cols+cx]];return r?{material:r.material,destructible:r.destructible,region:r.id}:{material:'earth',destructible:false};
}
export function solid(t:Uint8Array,x:number,y:number){if(x<0||x>=WORLD.width||y<0||y>=WORLD.height)return false;return t[Math.floor(y/3)*WORLD.cols+Math.floor(x/3)]===1;}
export function ground(t:Uint8Array,x:number,start=0){for(let y=Math.max(0,Math.floor(start/3)*3);y<WORLD.height;y+=3){if(solid(t,x,y))return y;}return WORLD.height+80;}
/** A walk can climb a small ledge, but cannot start its ground search inside a wall. */
export function walkPosition(t:Uint8Array,origin:{x:number;y:number},direction:1|-1):{x:number;y:number}|null {
 const x=Math.max(30,Math.min(WORLD.width-30,origin.x+direction*8)),y=ground(t,x,origin.y-21);
 if(y<origin.y-21||solid(t,x,y-WORLD.cell))return null;
 // Feet may follow small slopes; the torso/head need clearance across their width.
 for(let px=x-9;px<=x+9;px+=WORLD.cell)for(let py=y-51;py<y-9;py+=WORLD.cell)if(solid(t,px,py))return null;
 return {x,y};
}
export function crater(t:Uint8Array,x:number,y:number,r:number,map:MapId='garden'){
 const template=terrainTemplate(map);let removed=0;const extent=r/Math.sqrt(.72);
 for(let cy=Math.max(0,Math.floor((y-extent)/3));cy<Math.min(WORLD.rows,Math.ceil((y+extent)/3));cy++)
 for(let cx=Math.max(0,Math.floor((x-extent)/3));cx<Math.min(WORLD.cols,Math.ceil((x+extent)/3));cx++){
  const i=cy*WORLD.cols+cx;if(!t[i])continue;const region=template.definition[template.regions[i]];
  if(!region?.destructible)continue;
  const radius=r/Math.sqrt(MATERIALS[region.material].resistance);
  if((cx*3-x)**2+(cy*3-y)**2<=radius*radius){t[i]=0;removed++;}
 }
 return removed;
}
export function packTerrain(t:Uint8Array):Uint8Array{const b=new Uint8Array(Math.ceil(t.length/8));for(let i=0;i<t.length;i++)if(t[i])b[i>>3]|=1<<(i%8);return b;}
export function unpackTerrain(b:Uint8Array){const t=new Uint8Array(WORLD.cols*WORLD.rows);for(let i=0;i<t.length;i++)t[i]=(b[i>>3]>>(i%8))&1;return t;}
interface ProjectileOrigin {x:number;y:number;facing:number;}
interface ProjectileTarget {id:string;x:number;y:number;hp:number;}
/** Points track the projectile center; x/y identify the contacted surface. */
export interface TrajectoryResult {points:number[][];x:number;y:number;hitId?:string;flightTime:number;}
interface Contact {fraction:number;x:number;y:number;centerX?:number;centerY?:number;hitId?:string;}

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
 const minX=Math.max(0,Math.ceil((Math.min(x,x+dx)-radius)/WORLD.cell)-1),maxX=Math.min(WORLD.cols-1,Math.floor((Math.max(x,x+dx)+radius)/WORLD.cell));
 const minY=Math.max(0,Math.ceil((Math.min(y,y+dy)-radius)/WORLD.cell)-1),maxY=Math.min(WORLD.rows-1,Math.floor((Math.max(y,y+dy)+radius)/WORLD.cell));
 let contact:Contact|undefined;
 for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
  if(!t[cy*WORLD.cols+cx])continue;
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
  const fraction=circleContact(x,y,dx,dy,target.x,target.y-31,24+radius);
  if(fraction===undefined||(contact&&fraction>contact.fraction))continue;
  const centerX=x+dx*fraction,centerY=y+dy*fraction,ox=centerX-target.x,oy=centerY-(target.y-31),distance=Math.hypot(ox,oy);
  contact={fraction,centerX,centerY,x:target.x+(distance?ox/distance*24:0),y:target.y-31+(distance?oy/distance*24:0),hitId:target.id};
 }
 // Arena exits are also swept, keeping impact coordinates bounded at every velocity.
 for(const [value,delta,limit,exiting] of [[x,dx,-80,x+dx<-80],[x,dx,WORLD.width+80,x+dx>WORLD.width+80],[y,dy,WORLD.height+50,y+dy>WORLD.height+50]] as const){
  if(!exiting)continue;const fraction=delta===0?0:Math.max(0,(limit-value)/delta);
  if(fraction<=1&&(!contact||fraction<contact.fraction))contact={fraction,x:x+dx*fraction,y:y+dy*fraction};
 }
 return contact;
}

/** Simultaneous shots share a clock. The callback applies authoritative impact changes
 * before the remaining shots are checked again against the changed terrain/players. */
export function volley(terrain:Uint8Array,origin:ProjectileOrigin,angles:readonly number[],power:number,wind:number,weapon:Weapon,targets:ProjectileTarget[]=[],onImpact?:(result:TrajectoryResult,index:number)=>void):TrajectoryResult[] {
 const speed=power*9.8,shots=angles.map(angle=>{const rad=angle*Math.PI/180,x=origin.x+origin.facing*27,y=origin.y-40;return {x,y,vx:Math.cos(rad)*speed*origin.facing,vy:-Math.sin(rad)*speed,points:[[x,y]],active:true};}),results:TrajectoryResult[]=new Array(angles.length);
 const finish=(index:number,contact:Contact,flightTime:number)=>{const shot=shots[index];shot.active=false;shot.points.push([contact.centerX??contact.x,contact.centerY??contact.y]);const result={points:shot.points,x:contact.x,y:contact.y,hitId:contact.hitId,flightTime};results[index]=result;onImpact?.(result,index);};
 for(let frame=0;frame<900&&shots.some(shot=>shot.active);frame++){
  let elapsed=0;
  while(true){
   let earliest:{index:number;contact:Contact}|undefined;
   for(let index=0;index<shots.length;index++){
    const shot=shots[index];if(!shot.active)continue;const dx=shot.vx/120,dy=shot.vy/120,contact=projectileContact(terrain,shot.x+dx*elapsed,shot.y+dy*elapsed,dx*(1-elapsed),dy*(1-elapsed),weapon.projectileRadius,targets);
    if(contact){contact.fraction=elapsed+contact.fraction*(1-elapsed);if(!earliest||contact.fraction<earliest.contact.fraction)earliest={index,contact};}
   }
   if(!earliest)break;
   elapsed=earliest.contact.fraction;finish(earliest.index,earliest.contact,(frame+elapsed)*1000/120);
  }
  for(let index=0;index<shots.length;index++){
   const shot=shots[index];if(!shot.active)continue;shot.x+=shot.vx/120;shot.y+=shot.vy/120;shot.vx+=wind*7/120;shot.vy+=weapon.gravity/120;
   if((frame+1)%2===0)shot.points.push([Math.round(shot.x*10)/10,Math.round(shot.y*10)/10]);
   if(frame===899)finish(index,{x:shot.x,y:shot.y,fraction:1},7500);
  }
 }
 return results;
}
export function trajectory(terrain:Uint8Array,origin:ProjectileOrigin,angle:number,power:number,wind:number,weapon:Weapon,targets:ProjectileTarget[]=[]):TrajectoryResult {
 return volley(terrain,origin,[angle],power,wind,weapon,targets)[0];
}
