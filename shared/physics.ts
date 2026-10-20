import type {CraterShape, MapId, Weapon} from './catalog';
import {canonicalMap,cellBits,contains,getMap,MAP_CELL,MAP_DEFAULT} from './maps';
export {MAP_CELL};
import type {MaterialId,MapRegion} from './maps';
import {HOMING_MIN_SPEED,HOMING_RADIUS,HOMING_TURN_RATE} from './abilities';
/** Default arena; a map may be wider (`MapDefinition.dimensions.width`), never taller. */
/** Terrain is one cell per world pixel (19/10/2026, DDTank-style fine digging). Map data authored on the old
 * 3px grid (`cells` shapes, saved terrains) is expanded explicitly: see MAP_CELL and `upgradeTerrain`. */
export const WORLD={width:1536,height:864,cell:1,cols:1536,rows:864};
/** Rows of a terrain saved on the old 3px grid. */
const LEGACY_ROWS=WORLD.height/MAP_CELL;
/** Terrain arrays are always `rows` tall, so their length carries the map width. */
export function terrainCols(t:{length:number}){return t.length/WORLD.rows;}
export function terrainWidth(t:{length:number}){return terrainCols(t)*WORLD.cell;}
/** Shot ballistics follow DDTank 4.1 (docs/ballistics.md): the force bar 0–100 becomes a launch force
 * 0–2000, gravity and wind come from the map and the ball, linear air drag slows both axes and the
 * flight advances in fixed 0.04 s steps, with float32 state like the original server. */
export const PHYSICS_STEP_MS=40;
/** Launch force per point of the force bar (DDTank: 100 → 2000). */
export const FORCE_PER_POWER=20;
/** A shot that flies this long ends where it is. */
export const MAX_FLIGHT_MS=7500;
/** Map profile of the common DDTank maps (Map.cs Weight/DragIndex). */
export const MAP_PHYSICS={weight:10,drag:2} as const;
/** DDTank ball parameters (BallList.xml). */
export interface Ball {mass:number;weight:number;wind:number;drag:number;}
/** The common shots 381 (brick) and 461 (boomerang) share these: same flight, different look. */
export const COMMON_BALL:Ball={mass:10,weight:70,wind:240,drag:1};
/** Per-second accelerations: ax = windAccel·wind − drag·vx, ay = gravity − drag·vy. */
export interface BallMotion {launch:number;gravity:number;windAccel:number;drag:number;}
export function ballMotion(ball:Ball=COMMON_BALL,map:{weight:number;drag:number}=MAP_PHYSICS):BallMotion {
 return {launch:FORCE_PER_POWER,gravity:map.weight*ball.weight,windAccel:ball.wind/ball.mass,drag:map.drag*ball.drag/ball.mass};
}
const f32=Math.fround;
/** Player hit box, DDTank 4.1 Player.cs `m_rect=Rectangle(-15,-20,30,30)` around the logical origin O:
 * an axis-aligned 30×30 box, the same for every outfit, costume, head, hat, pose, facing and slope
 * (docs/hitbox-aim.md). Brasa ballistics use DDTank units 1:1 (docs/ballistics.md), so the scale is 1. */
export const FIGHTER_HIT_BOX={left:-15,top:-20,width:30,height:30} as const;
/** Brasa `fighter.y` is the feet; the box origin O sits this far above them. A Brasa adaptation, not a
 * DDTank constant: it keeps the body centre where the previous hit circle had it (31 px above the feet). */
export const FIGHTER_ORIGIN_LIFT=26;
/** Centre of the player box above the feet (homing aim). */
export const FIGHTER_BODY_CENTER=FIGHTER_ORIGIN_LIFT-FIGHTER_HIT_BOX.top-FIGHTER_HIT_BOX.height/2;
export interface HitBounds {left:number;top:number;right:number;bottom:number;originX:number;originY:number;}
/** World bounds of a player's hit box: the one contract shared by the server and the client debug. */
export function fighterHitBounds(fighter:{x:number;y:number}):HitBounds {
 const originX=fighter.x,originY=fighter.y-FIGHTER_ORIGIN_LIFT,left=originX+FIGHTER_HIT_BOX.left,top=originY+FIGHTER_HIT_BOX.top;
 return {left,top,right:left+FIGHTER_HIT_BOX.width,bottom:top+FIGHTER_HIT_BOX.height,originX,originY};
}
/** Where every shot leaves, relative to the shooter's feet (the dotted aim pivots here too). */
export const SHOT_ORIGIN={forward:27,up:40} as const;
/** A rival standing this close (horizontally) to the shooter shares its body: the shot
 * passes through him until it leaves his hit box. A little further aside, it hits. */
export const FIGHTER_OVERLAP=16;
interface TerrainTemplate {solid:Uint8Array;regions:Int16Array;definition:readonly MapRegion[];cols:number;}
const templates=new Map<MapId,TerrainTemplate>();
export function terrainTemplate(map:MapId=MAP_DEFAULT.id):TerrainTemplate {
 // A map published from the admin panel brings new regions: rebuild its template.
 const id=canonicalMap(map),def=getMap(id),cached=templates.get(id);if(cached&&cached.definition===def.regions)return cached;
 const definition=def.regions,cols=def.dimensions.width/WORLD.cell,solid=new Uint8Array(cols*WORLD.rows),regions=new Int16Array(solid.length).fill(-1);
 // Scan-convert polygons once per row, not once per cell: large illustrated contours
 // remain cheap to initialise on both the server and lower-powered browsers.
 for(let r=0;r<definition.length;r++){
  const shape=definition[r].shape;
  if(shape.kind==='polygon'){
   const c=WORLD.cell,points=shape.points,minY=Math.max(0,Math.ceil(Math.min(...points.map(p=>p[1]))/c)),maxY=Math.min(WORLD.rows,Math.ceil(Math.max(...points.map(p=>p[1]))/c));
   for(let cy=minY;cy<maxY;cy++){const y=cy*c,intersections:number[]=[];
    for(let n=0,j=points.length-1;n<points.length;j=n++){const [ax,ay]=points[n],[bx,by]=points[j];if((ay>y)!==(by>y))intersections.push((bx-ax)*(y-ay)/(by-ay)+ax);}
    intersections.sort((a,b)=>a-b);
    for(let n=0;n<intersections.length;n+=2){const left=Math.max(0,Math.ceil(intersections[n]/c)),right=Math.min(cols,Math.ceil(intersections[n+1]/c));for(let cx=left;cx<right;cx++){const i=cy*cols+cx;solid[i]=1;regions[i]=r;}}
   }
  }else if(shape.kind==='cells'){
   // Each map cell (MAP_CELL px) fills its block of world pixels.
   const bits=cellBits(shape),k=MAP_CELL/WORLD.cell;
   for(let y=0;y<shape.rows;y++)for(let x=0;x<shape.cols;x++){const n=y*shape.cols+x;if(!(bits[n>>3]>>(n&7)&1))continue;
    for(let sy=0;sy<k;sy++)for(let sx=0;sx<k;sx++){const cx=(shape.col+x)*k+sx,cy=(shape.row+y)*k+sy;if(cx<0||cy<0||cx>=cols||cy>=WORLD.rows)continue;const i=cy*cols+cx;solid[i]=1;regions[i]=r;}}
  }else{
   const bounds=shape.kind==='rect'?[shape.x,shape.y,shape.x+shape.width,shape.y+shape.height]:[shape.x-shape.rx,shape.y-shape.ry,shape.x+shape.rx,shape.y+shape.ry];
   const c=WORLD.cell;
   for(let cy=Math.max(0,Math.floor(bounds[1]/c));cy<Math.min(WORLD.rows,Math.ceil(bounds[3]/c)+1);cy++)for(let cx=Math.max(0,Math.floor(bounds[0]/c));cx<Math.min(cols,Math.ceil(bounds[2]/c)+1);cx++)if(contains(shape,cx*c,cy*c)){const i=cy*cols+cx;solid[i]=1;regions[i]=r;}
  }
 }
 const value={solid,regions,definition,cols};templates.set(id,value);return value;
}
export function createTerrain(map:MapId=MAP_DEFAULT.id):Uint8Array{return terrainTemplate(map).solid.slice();}
export function terrainMaterial(map:MapId,x:number,y:number):{material:MaterialId;destructible:boolean;region?:string}{
 const template=terrainTemplate(map);const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
 if(cx<0||cx>=template.cols||cy<0||cy>=WORLD.rows)return {material:'earth',destructible:false};
 const r=template.definition[template.regions[cy*template.cols+cx]];return r?{material:r.material,destructible:r.destructible,region:r.id}:{material:'earth',destructible:false};
}
export function solid(t:Uint8Array,x:number,y:number){const cols=terrainCols(t);if(x<0||x>=cols*WORLD.cell||y<0||y>=WORLD.height)return false;return t[Math.floor(y/WORLD.cell)*cols+Math.floor(x/WORLD.cell)]===1;}
/** Top of the first solid pixel at or below `start` in the column of `x` (or past the bottom: the void). */
export function ground(t:Uint8Array,x:number,start=0){
 const cols=terrainCols(t),cx=Math.floor(x/WORLD.cell);if(cx<0||cx>=cols)return WORLD.height+80;
 for(let cy=Math.max(0,Math.floor(start/WORLD.cell));cy<WORLD.rows;cy++)if(t[cy*cols+cx]===1)return cy*WORLD.cell;
 return WORLD.height+80;
}
/** One walk command moves this far, one pixel at a time, so every bump and dip on the way is felt. */
export const WALK_STEP=8;
/** Highest lip the feet can step onto in one pixel (about a knee): taller walls stop the walk. */
export const WALK_STEP_UP=15;
/** Over this horizontal span the ground may rise at most WALK_MAX_RISE (about 60°): a single Quebra-Tijolos crater is the steepest hole that can still be walked out of; deeper or stacked pits trap. */
export const WALK_SLOPE_SPAN=12;
export const WALK_MAX_RISE=21;
/** A wall or lip up to about the prone body's height can be climbed in one pull (user, 19/10/2026: the
 * box a couple of direct hits dig, or its undercut rim, must not trap). Measured from the lowest ground
 * within WALK_CLIMB_SPAN behind, so a long steep ramp, two stacked craters or a pit three body hits deep still stops the walk. */
export const WALK_CLIMB=45;
/** How far ahead of the feet the arms reach for a lip to pull up on (the prone body lies forward). */
export const WALK_REACH=16;
export const WALK_CLIMB_SPAN=36;
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
 const bodyBlocked=(nx:number,ny:number)=>{for(let px=0;px<=WALK_BODY_FRONT;px+=WORLD.cell)for(let py=ny-WALK_BODY_TOP;py<ny-WALK_BODY_WAIST;py+=WORLD.cell)if(solid(t,nx+direction*px,py))return true;return false;};
 for(let n=0;n<WALK_STEP;n++){
  const nx=x+direction;if(nx<min||nx>max)break;
  const top=y-WALK_STEP_UP;let ny=solid(t,nx,top)?-1:ground(t,nx,top);
  // Sustained slope: compare with the ground a span behind the new foot.
  if(ny>=0&&ny<y){const behind=ground(t,nx-direction*WALK_SLOPE_SPAN,ny);if(behind<=WORLD.height&&behind-ny>WALK_MAX_RISE)ny=-1;}
  if(ny>=0&&bodyBlocked(nx,ny))ny=-1;
  if(ny<0){
   // Blocked by a wall, a steep bit or an overhanging lip just ahead: pull up onto its top if it is low enough.
   const lid=y-WALK_CLIMB;let to=-1;
   for(let px=0;px<=WALK_REACH;px++){
    const cx=nx+direction*px;if(cx<min||cx>max||solid(t,cx,lid))break;
    const climb=ground(t,cx,lid);if(climb>=y)continue;
    let floor=y;for(let back=1;back<=WALK_CLIMB_SPAN;back+=WORLD.cell){const g=ground(t,cx-direction*back,climb);if(g<=WORLD.height)floor=Math.max(floor,g);}
    if(floor-climb>WALK_CLIMB||bodyBlocked(cx,climb))continue;
    to=cx;ny=climb;break;
   }
   if(to<0)break;
   n+=Math.abs(to-nx);x=to;y=ny;moved=true;continue;
  }
  const drop=ny-y;x=nx;y=ny;moved=true;
  if(drop>WALK_STEP_UP)break; // stepped off a ledge: the fall takes over
 }
 return moved?{x,y}:null;
}
export interface TerrainDig {x:number;y:number;radius:number;stretch?:number}
/** A projectile that strikes a body digs the weapon's mask at this share of its size, under the target's feet (`dig`). */
export const DIRECT_HIT_CRATER=.75;
/** Where an impact removes terrain: under the target's feet for a body hit, otherwise where the projectile struck. */
export function impactDig(impact:TerrainDig&{dig?:TerrainDig}):TerrainDig{return impact.dig??impact;}
/** Broken ground is never a perfect circle: by default the edge only grows, by up to this share, with a jagged profile seeded by the impact point (same result on server and clients). */
export const CRATER_ROUGHNESS=.14;
/** A weapon may set its own `craterRoughness` (0 = a clean circle); impacts carry it so clients dig the same hole. */
export function weaponRoughness(weapon:{craterRoughness?:number}){return weapon.craterRoughness??CRATER_ROUGHNESS;}
function roughness(angle:number,seed:number){const a=(seed&1023)/163,b=((seed>>10)&1023)/163,c=((seed>>20)&1023)/163;
 return (Math.sin(angle*5+a)*.45+Math.sin(angle*9+b)*.35+Math.sin(angle*17+c)*.2+1)/2;}
/** Every destructible region breaks the same way: the drawn material (crystal, stone, metal…) is only looks. */
/** DDTank-style hole masks, in units of the crater radius (half the width), centred on the impact and
 * never rotated or stretched by the shot. Proportions follow the DDTank 4.1 client masks: the Quebra-Tijolos
 * is a flattened hexagon with a flat floor (96×63), the Bumerangue an oval (107×72); each POW has its own. */
export const CRATER_MASKS:Record<CraterShape,{height:number;inside:(x:number,y:number)=>boolean}>={
 brick:{height:.66,inside:(x,y)=>Math.abs(y)<=.66&&Math.abs(x)<=1-.45*Math.abs(y)/.66},
 'brick-pow':{height:.66,inside:(x,y)=>Math.abs(y)<=.66&&Math.abs(x)<=1-.32*Math.abs(y)/.66&&Math.abs(x)+Math.abs(y)<=1.42},
 oval:{height:.67,inside:(x,y)=>x*x+(y/.67)**2<=1},
 'oval-pow':{height:.59,inside:(x,y)=>x*x+(y/.59)**2<=1},
};
/** A fixed hole mask compiled to world pixels: `bits[j*width+i]` is 1 where pixel (i,j) is cut.
 * Pixel (i,j) lands on world pixel (anchorX-pivotX+i, anchorY-pivotY+j), with the anchor at the impact point
 * rounded to the nearest pixel corner (`craterAnchor`). Built from the analytic shape alone (no images), so the
 * server and every client dig exactly the same pixels. */
export interface CraterMask {shape:CraterShape;radius:number;width:number;height:number;pivotX:number;pivotY:number;bits:Uint8Array;}
const compiledMasks=new Map<string,CraterMask>();
/** Sampling rule: the centre of each pixel, (i+.5-pivot)/radius in shape units, is tested once; inside cuts the
 * whole pixel (binary, no alpha). The box is ceil(radius) to each side and ceil(radius×height) up and down. */
export function craterMask(shape:CraterShape,radius:number):CraterMask{
 const key=`${shape}@${radius}`,cached=compiledMasks.get(key);if(cached)return cached;
 const def=CRATER_MASKS[shape],pivotX=Math.ceil(radius),pivotY=Math.ceil(radius*def.height),width=pivotX*2,height=pivotY*2,bits=new Uint8Array(width*height);
 for(let j=0;j<height;j++)for(let i=0;i<width;i++)if(def.inside((i+.5-pivotX)/radius,(j+.5-pivotY)/radius))bits[j*width+i]=1;
 const mask={shape,radius,width,height,pivotX,pivotY,bits};compiledMasks.set(key,mask);return mask;
}
/** The pixel corner a mask is pinned to: the impact point rounded (half up), the same on every machine. */
export function craterAnchor(x:number,y:number):[number,number]{return [Math.floor(x+.5),Math.floor(y+.5)];}
/** Removes the destructible pixels a mask covers; returns how many went. */
export function digMask(t:Uint8Array,mask:CraterMask,x:number,y:number,map:MapId=MAP_DEFAULT.id){
 const template=terrainTemplate(map),cols=template.cols,[ax,ay]=craterAnchor(x,y),left=ax-mask.pivotX,top=ay-mask.pivotY;let removed=0;
 for(let j=Math.max(0,-top);j<mask.height&&top+j<WORLD.rows;j++){const row=(top+j)*cols;
  for(let i=Math.max(0,-left);i<mask.width&&left+i<cols;i++){
   if(!mask.bits[j*mask.width+i])continue;const n=row+left+i;if(!t[n]||!template.definition[template.regions[n]]?.destructible)continue;t[n]=0;removed++;
  }
 }
 return removed;
}
/** `stretch` widens the hole sideways (an ellipse `r*stretch` wide and `r` deep); `shape` digs that weapon's fixed mask (`craterMask`) instead of the circle. */
export function crater(t:Uint8Array,x:number,y:number,r:number,map:MapId=MAP_DEFAULT.id,rough=CRATER_ROUGHNESS,stretch=1,shape?:CraterShape){
 if(shape)return r>0?digMask(t,craterMask(shape,r),x,y,map):0;
 const template=terrainTemplate(map),cols=template.cols,c=WORLD.cell,seed=Math.floor(x)*73856093^Math.floor(y)*19349663;let removed=0;const extent=r*(1+rough),reach=r*(1+rough)*stretch;
 for(let cy=Math.max(0,Math.floor((y-extent)/c));cy<Math.min(WORLD.rows,Math.ceil((y+extent)/c));cy++)
 for(let cx=Math.max(0,Math.floor((x-reach)/c));cx<Math.min(cols,Math.ceil((x+reach)/c));cx++){
  const i=cy*cols+cx;if(!t[i])continue;const region=template.definition[template.regions[i]];
  if(!region?.destructible)continue;
  const dx=((cx+.5)*c-x)/stretch,dy=(cy+.5)*c-y,edge=r*(1+rough*roughness(Math.atan2(dy,dx),seed));
  if(dx*dx+dy*dy<=edge*edge){t[i]=0;removed++;}
 }
 return removed;
}
/** Wire/save format: the run lengths of alternating empty/solid cells (starting with empty) as LEB128 varints,
 * after the cell count. A fine terrain is millions of cells but only a few thousand runs. */
export function packTerrain(t:Uint8Array):Uint8Array{
 const out:number[]=[],varint=(v:number)=>{while(v>=128){out.push(v&127|128);v=Math.floor(v/128);}out.push(v);};
 varint(t.length);let value=0,run=0;
 for(let i=0;i<t.length;i++){const bit=t[i]?1:0;if(bit===value)run++;else{varint(run);value=bit;run=1;}}
 varint(run);return Uint8Array.from(out);
}
export function unpackTerrain(b:Uint8Array){
 let at=0;const read=()=>{let v=0,scale=1,byte;do{byte=b[at++];v+=(byte&127)*scale;scale*=128;}while(byte&128);return v;};
 const length=read(),t=new Uint8Array(length);let i=0,value=0;
 while(i<length&&at<b.length){const run=read();if(value)t.fill(1,i,i+run);i+=run;value^=1;}
 return t;
}
/** A terrain saved on the old 3px grid (`MAP_CELL`) expanded to world pixels; a fine terrain is returned as is. */
export function upgradeTerrain(t:Uint8Array,width:number):Uint8Array{
 const legacyCols=width/MAP_CELL;if(t.length!==legacyCols*LEGACY_ROWS||t.length===width/WORLD.cell*WORLD.rows)return t;
 const cols=width/WORLD.cell,k=MAP_CELL/WORLD.cell,out=new Uint8Array(cols*WORLD.rows);
 for(let y=0;y<WORLD.rows;y++)for(let x=0;x<cols;x++)out[y*cols+x]=t[Math.floor(y/k)*legacyCols+Math.floor(x/k)];
 return out;
}
interface ProjectileOrigin {x:number;y:number;facing:number;}
/** Monsters bring their own body circle; players use the fixed box of `fighterHitBounds`. */
interface ProjectileTarget {id:string;x:number;y:number;hp:number;hitRadius?:number;hitHeight?:number;}
/** Homing guidance. Without `projectileIndex` every projectile of the volley is guided. */
export interface ProjectileGuidance {projectileIndex?:number;targets:ProjectileTarget[];}
/** Flight puts the fighter exactly where the plane touched. Against a wall it is set just outside the
 * wall on the side the plane came from; against an underside, just below it. From there the fighter
 * drops to the first ground under it (`y`), or into the void (`y` past the bottom) and dies.
 * Only a plane that leaves the map leaves the shooter in place. */
export function flightLanding(terrain:Uint8Array,impact:{x:number;y:number;points?:number[][]}):{x:number;y:number;fromY:number}|null {
 const width=terrainWidth(terrain);if(impact.x<0||impact.x>=width||impact.y<0||impact.y>=WORLD.height)return null;
 const last=impact.points?.at(-1),before=impact.points?.at(-2),travel=last&&before&&last[0]!==before[0]?Math.sign(last[0]-before[0]):0;
 const blocked=(x:number)=>{for(let px=x-9;px<=x+9;px+=WORLD.cell)for(let py=impact.y-51;py<impact.y-6;py+=WORLD.cell)if(solid(terrain,px,py))return true;return false;};
 let x=Math.max(24,Math.min(width-24,impact.x));
 // Only a wall in the plane's way pushes the fighter back; under a ceiling it simply hangs below the contact.
 if(travel&&solid(terrain,impact.x+travel*4,impact.y))for(let back=0;back<=36&&blocked(x);back+=WORLD.cell)x=Math.max(24,Math.min(width-24,impact.x-travel*back));
 let fromY=impact.y-6;while(fromY<impact.y+6&&solid(terrain,x,fromY))fromY+=WORLD.cell;
 return {x,y:ground(terrain,x,fromY),fromY:Math.min(fromY,impact.y)};
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

/** Sweeping a disk against a rectangle is a point against the rectangle with rounded
 * corners (Minkowski sum). A square expansion alone would incorrectly catch near-corner shots.
 * Edges are inclusive: an exact tangent counts as contact, as with the terrain cells. */
function rectContact(x:number,y:number,dx:number,dy:number,left:number,top:number,right:number,bottom:number,radius:number):number|undefined {
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
  const left=cx*WORLD.cell,top=cy*WORLD.cell,fraction=rectContact(x,y,dx,dy,left,top,left+WORLD.cell,top+WORLD.cell,radius);
  if(fraction===undefined||(contact&&fraction>=contact.fraction))continue;
  const centerX=x+dx*fraction,centerY=y+dy*fraction,inset=.00001;
  // Impact/material/crater use the actual surface cell; animation retains the
  // disk center, so a larger projectile never visually buries itself in a wall.
  contact={fraction,centerX,centerY,x:Math.max(left+inset,Math.min(left+WORLD.cell-inset,centerX)),y:Math.max(top+inset,Math.min(top+WORLD.cell-inset,centerY))};
 }
 return contact;
}
/** Monsters and bosses keep their own hit circle; players use the fixed box of `fighterHitBounds`. */
function targetContact(x:number,y:number,dx:number,dy:number,target:ProjectileTarget,radius:number):Contact|undefined {
 const travel=Math.hypot(dx,dy);
 if(target.hitRadius!==undefined){
  const body=target.hitRadius,cy=target.y-(target.hitHeight??FIGHTER_BODY_CENTER);
  const fraction=circleContact(x,y,dx,dy,target.x,cy,body+radius);if(fraction===undefined)return;
  const centerX=x+dx*fraction,centerY=y+dy*fraction,ox=centerX-target.x,oy=centerY-cy,distance=Math.hypot(ox,oy);
  const lineOffset=travel?Math.abs((target.x-x)*dy-(cy-y)*dx)/travel:distance;
  const hitQuality=Math.sqrt(Math.max(0,1-(lineOffset/(body+radius))**2));
  return {fraction,centerX,centerY,x:target.x+(distance?ox/distance*body:0),y:cy+(distance?oy/distance*body:0),hitId:target.id,hitQuality};
 }
 const box=fighterHitBounds(target),fraction=rectContact(x,y,dx,dy,box.left,box.top,box.right,box.bottom,radius);if(fraction===undefined)return;
 const centerX=x+dx*fraction,centerY=y+dy*fraction,mx=(box.left+box.right)/2,my=(box.top+box.bottom)/2;
 // Quality: how far the path line passes from the box centre, over the widest offset that still touches the
 // rounded box in that direction (its support: half extents projected on the normal, plus the disk radius).
 // 1 through the centre, 0 at a tangent, whichever face or corner is struck.
 const nx=travel?-dy/travel:0,ny=travel?dx/travel:1,lineOffset=Math.abs((mx-x)*nx+(my-y)*ny);
 const support=FIGHTER_HIT_BOX.width/2*Math.abs(nx)+FIGHTER_HIT_BOX.height/2*Math.abs(ny)+radius;
 const hitQuality=travel?Math.sqrt(Math.max(0,1-(lineOffset/support)**2)):1;
 // The surface point is the box point nearest to the disk centre, kept apart from the centre itself.
 return {fraction,centerX,centerY,x:Math.max(box.left,Math.min(box.right,centerX)),y:Math.max(box.top,Math.min(box.bottom,centerY)),hitId:target.id,hitQuality};
}
function projectileContact(terrain:Uint8Array,x:number,y:number,dx:number,dy:number,radius:number,targets:ProjectileTarget[],ignored?:ReadonlySet<string>):Contact|undefined {
 let contact=terrainContact(terrain,x,y,dx,dy,radius);
 for(const target of targets){
  if(target.hp<=0||ignored?.has(target.id))continue;
  const hit=targetContact(x,y,dx,dy,target,radius);
  if(!hit||(contact&&hit.fraction>contact.fraction))continue;
  contact=hit;
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
export function volley(terrain:Uint8Array,origin:ProjectileOrigin,angles:readonly number[],power:number,wind:number,weapon:Weapon,targets:ProjectileTarget[]=[],onImpact?:(result:TrajectoryResult,index:number)=>void,launchDelays:readonly number[]=[],guidance?:ProjectileGuidance,passOverlapping=true,motion:BallMotion=ballMotion(weapon.ball)):TrajectoryResult[] {
 const force=power*motion.launch,dt=f32(PHYSICS_STEP_MS/1000),sampleMs=1000/60,eps=1e-7;
 const shots=angles.map((angle,index)=>({angle,launchAt:Math.max(0,launchDelays[index]??0),x:0,y:0,vx:0,vy:0,stepX:0,stepY:0,nextStep:0,points:[] as number[][],launched:false,done:false,nextSample:0,lockId:undefined as string|undefined,ignored:new Set<string>()})),results:TrajectoryResult[]=new Array(angles.length);
 const finish=(index:number,contact:Contact,at:number)=>{const shot=shots[index];shot.done=true;shot.points.push([contact.centerX??contact.x,contact.centerY??contact.y]);const result={points:shot.points,x:contact.x,y:contact.y,hitId:contact.hitId,hitQuality:contact.hitQuality,flightTime:at-shot.launchAt};results[index]=result;onImpact?.(result,index);};
 let time=0;
 while(shots.some(shot=>!shot.done)){
  for(const shot of shots)if(!shot.launched&&shot.launchAt<=time+eps){
   // DDTank Living.cs: the launch velocity is the force split by the angle and truncated toward zero.
   const rad=shot.angle*Math.PI/180;shot.x=shot.stepX=origin.x+origin.facing*SHOT_ORIGIN.forward;shot.y=shot.stepY=origin.y-SHOT_ORIGIN.up;
   shot.vx=f32(Math.trunc(force*Math.cos(rad))*origin.facing);shot.vy=f32(-Math.trunc(force*Math.sin(rad)));
   shot.points.push([shot.x,shot.y]);shot.launched=true;shot.nextStep=time;shot.nextSample=time+sampleMs;
   if(passOverlapping)for(const target of targets)if(Math.abs(target.x-origin.x)<FIGHTER_OVERLAP&&insideTarget(shot,target,weapon.projectileRadius))shot.ignored.add(target.id);}
  // Each shot runs its own fixed 0.04 s clock (semi-implicit Euler, DDTank EulerVector.cs):
  // at the start of a step the velocity changes, then the shot moves in a straight line for the whole step.
  for(let index=0;index<shots.length;index++){const shot=shots[index];if(!shot.launched||shot.done||shot.nextStep>time+eps)continue;
   if(shot.nextStep>shot.launchAt+eps){shot.x=shot.stepX=f32(shot.stepX+shot.vx*dt);shot.y=shot.stepY=f32(shot.stepY+shot.vy*dt);}
   if(time-shot.launchAt>=MAX_FLIGHT_MS-eps){finish(index,{x:shot.x,y:shot.y,fraction:1},time);continue;}
   const locked=guidance&&(guidance.projectileIndex??index)===index?homingTarget(shot,guidance):undefined;
   if(locked){
    // Magnet lock: pure pursuit that ignores wind/gravity. The turn rate grows as the
    // distance shrinks (turn radius <= half the distance), so it always closes in.
    const dx=locked.x-shot.x,dy=locked.y-FIGHTER_BODY_CENTER-shot.y,distance=Math.max(1,Math.hypot(dx,dy)),speed=Math.max(HOMING_MIN_SPEED,Math.hypot(shot.vx,shot.vy)),heading=Math.atan2(shot.vy,shot.vx),desired=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading)),limit=Math.max(HOMING_TURN_RATE,2*speed/distance)*dt,next=heading+Math.max(-limit,Math.min(limit,delta));
    shot.vx=f32(Math.cos(next)*speed);shot.vy=f32(Math.sin(next)*speed);
   }else{
    const ax=f32(motion.windAccel*wind-motion.drag*shot.vx),ay=f32(motion.gravity-motion.drag*shot.vy);
    shot.vx=f32(shot.vx+ax*dt);shot.vy=f32(shot.vy+ay*dt);
   }
   shot.nextStep+=PHYSICS_STEP_MS;
  }
  const active=shots.filter(shot=>shot.launched&&!shot.done),nextLaunch=Math.min(Infinity,...shots.filter(shot=>!shot.launched).map(shot=>shot.launchAt));
  if(!active.length){time=nextLaunch;continue;}
  const until=Math.min(nextLaunch,...active.map(shot=>Math.min(shot.nextStep,shot.nextSample)));let elapsed=0;const duration=until-time;
  while(elapsed<duration-1e-9){
   const remaining=(duration-elapsed)/1000;let earliest:{index:number;contact:Contact}|undefined;
   for(let index=0;index<shots.length;index++){const shot=shots[index];if(!shot.launched||shot.done)continue;const contact=projectileContact(terrain,shot.x,shot.y,shot.vx*remaining,shot.vy*remaining,weapon.projectileRadius,targets,shot.ignored);if(contact&&(!earliest||contact.fraction<earliest.contact.fraction))earliest={index,contact};}
   const advance=(duration-elapsed)*(earliest?.contact.fraction??1);
   for(const shot of shots)if(shot.launched&&!shot.done){shot.x+=shot.vx*advance/1000;shot.y+=shot.vy*advance/1000;}
   elapsed+=advance;
   // Once a shot has left an overlapping body, that body can be hit again (e.g. on the way down).
   for(const shot of shots)for(const id of shot.ignored){const target=targets.find(target=>target.id===id);if(!target||!insideTarget(shot,target,weapon.projectileRadius))shot.ignored.delete(id);}
   if(!earliest)break;finish(earliest.index,earliest.contact,time+elapsed);
  }
  time=until;
  for(const shot of shots)if(shot.launched&&!shot.done&&time>=shot.nextSample-eps){shot.points.push([Math.round(shot.x*10)/10,Math.round(shot.y*10)/10]);shot.nextSample+=sampleMs;}
 }
 return results;
}
function insideTarget(shot:{x:number;y:number},target:ProjectileTarget,radius:number){
 if(target.hitRadius!==undefined)return Math.hypot(shot.x-target.x,shot.y-(target.y-(target.hitHeight??FIGHTER_BODY_CENTER)))<=target.hitRadius+radius;
 const box=fighterHitBounds(target);return Math.hypot(shot.x-Math.max(box.left,Math.min(box.right,shot.x)),shot.y-Math.max(box.top,Math.min(box.bottom,shot.y)))<=radius;
}
/** Acquires the nearest living enemy within HOMING_RADIUS and keeps that lock while it lives. */
function homingTarget(shot:{x:number;y:number;lockId?:string},guidance:ProjectileGuidance):ProjectileTarget|undefined {
 const current=shot.lockId?guidance.targets.find(target=>target.id===shot.lockId&&target.hp>0):undefined;if(current)return current;
 const distance=(target:ProjectileTarget)=>Math.hypot(target.x-shot.x,target.y-FIGHTER_BODY_CENTER-shot.y);
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
 const launch={x:origin.x-facing*SHOT_ORIGIN.forward,y:origin.y+SHOT_ORIGIN.up-fragments.radius-2,facing};
 // Brasa's own brick chunks (not a DDTank ball): no drag, their own gravity and half the wind.
 return volley(terrain,launch,angles,1,wind,{...weapon,projectileRadius:fragments.radius},targets,onImpact,[],undefined,false,{launch:fragments.speed,gravity:fragments.gravity,windAccel:3.5,drag:0});
}
