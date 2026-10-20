import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {createTerrain,crater,ground,solid,walkPosition,WALK_CLIMB,WALK_LEDGE,WALK_STEP,weaponRoughness,WORLD} from '../shared/physics';

const COLS=WORLD.cols,SURFACE=600,BRICK_CRATER=22;
function flat(){const t=new Uint8Array(COLS*WORLD.rows);for(let r=SURFACE;r<WORLD.rows;r++)t.fill(1,r*COLS,(r+1)*COLS);return t;}
/** A round hole like the Quebra-Tijolos digs; map craters only cut the map's own destructible regions. */
function dig(t:Uint8Array,x:number,y:number,r:number){for(let cy=0;cy<WORLD.rows;cy++)for(let cx=0;cx<COLS;cx++){const dx=cx-x,dy=cy-y;if(dx*dx+dy*dy<=r*r)t[cy*COLS+cx]=0;}}
function walk(t:Uint8Array,from:{x:number;y:number},direction:1|-1,commands:number){const path=[from];for(let n=0;n<commands;n++){const next=walkPosition(t,path.at(-1)!,direction);if(!next)break;path.push(next);}return path;}
const centers=Array.from({length:20},(_,n)=>320+n*43);

test('a walk follows the ground pixel by pixel and never rises more than a step at once',()=>{
 for(const x of centers){const t=flat();dig(t,x,SURFACE,BRICK_CRATER);
  const path=walk(t,{x:x-60,y:SURFACE},1,30);
  for(let n=1;n<path.length;n++){assert.ok(path[n].x-path[n-1].x<=WALK_STEP);assert.ok(path[n-1].y-path[n].y<=WALK_CLIMB,'no teleport up a wall');assert.ok(solid(t,path[n].x,path[n].y),'feet stay on the ground');}
 }
});

test('a single brick crater is the steepest hole a fighter can still walk into and out of',()=>{
 for(const x of centers){const t=flat();dig(t,x,SURFACE,BRICK_CRATER);
  for(const direction of [1,-1] as const){
   const path=walk(t,{x:x-direction*60,y:SURFACE},direction,30),end=path.at(-1)!;
   assert.ok(Math.max(...path.map(p=>p.y))>=SURFACE+18,`entered the crater at ${x}`);
   assert.ok(end.y===SURFACE&&Math.abs(end.x-x)>BRICK_CRATER*1.3,`climbed out at ${x} going ${direction}`);
  }
 }
});

test('on Sonho Nevado a fighter walks through a real Quebra-Tijolos crater but not out of a pit deeper than a body',()=>{
 const brick=WEAPONS.find(weapon=>weapon.id==='brick')!,x=1110,once=createTerrain('snow'),surface=ground(once,x);
 assert.ok(crater(once,x,surface,brick.crater,'snow',weaponRoughness(brick))>0);
 const through=walk(once,{x:x-70,y:ground(once,x-70)},1,30);
 assert.ok(Math.max(...through.map(p=>p.y))>surface+12&&through.at(-1)!.x>x+brick.crater*1.3,'walked in and out');
 // Round holes 22 px deep: two stacked are about the 45 px a body climbs (1px terrain), three are not.
 const twice=createTerrain('snow');for(let n=0;n<3;n++)crater(twice,x,ground(twice,x),brick.crater,'snow',weaponRoughness(brick));
 const end=walk(twice,{x:x-70,y:ground(twice,x-70)},1,30).at(-1)!;
 assert.ok(end.y>surface&&Math.abs(end.x-x)<brick.crater*1.3,`trapped at ${end.x},${end.y}`);
});

test('three stacked craters make a pit too deep to climb, in either direction',()=>{
 for(const x of centers){const t=flat();for(let n=0;n<3;n++)dig(t,x,ground(t,x),BRICK_CRATER);
  const bottom={x,y:ground(t,x)};assert.ok(bottom.y>SURFACE+55);
  for(const direction of [1,-1] as const){const end=walk(t,bottom,direction,30).at(-1)!;assert.ok(end.y>SURFACE,`trapped at ${x} going ${direction}`);assert.ok(Math.abs(end.x-x)<BRICK_CRATER*1.3);}
 }
});

test('on open ground a knee-high lip is climbed; a 33 px box, taller walls and low ceilings stop the walk',()=>{
 const low=flat();for(let r=SURFACE-WALK_LEDGE;r<SURFACE;r++)low.fill(1,r*COLS+600,r*COLS+660);
 assert.equal(walk(low,{x:560,y:SURFACE},1,10).at(-1)!.y,SURFACE-WALK_LEDGE,'a ledge-high wall is climbed');
 const box=flat();for(let r=SURFACE-33;r<SURFACE;r++)box.fill(1,r*COLS+600,r*COLS+660);
 const stopped=walk(box,{x:560,y:SURFACE},1,10).at(-1)!;assert.ok(stopped.x<600&&stopped.y===SURFACE,'a 33 px box is a wall');
 const wall=flat();for(let r=SURFACE-48;r<SURFACE;r++)wall.fill(1,r*COLS+600,r*COLS+660);
 const blocked=walk(wall,{x:560,y:SURFACE},1,10).at(-1)!;assert.ok(blocked.x<600&&blocked.y===SURFACE);
 const ceiling=flat();for(let r=SURFACE-48;r<SURFACE-33;r++)ceiling.fill(1,r*COLS+600,r*COLS+720);
 assert.ok(walk(ceiling,{x:560,y:SURFACE},1,10).at(-1)!.x<600,'the head hits the overhang');
 const ledge=flat();for(let r=SURFACE-9;r<SURFACE;r++)ledge.fill(1,r*COLS+600,r*COLS+780);
 assert.equal(walk(ledge,{x:570,y:SURFACE},1,10).at(-1)!.y,SURFACE-9,'a low ledge is stepped onto');
});

test('the gift boxes on Sonho Nevado cannot be climbed from either side (user, 20/10/2026)',()=>{
 const t=createTerrain('snow');
 for(const [from,direction] of [[850,1],[1060,-1],[2032,1],[2252,-1]] as const){const path=walk(t,{x:from,y:ground(t,from)},direction,40);
  assert.ok(Math.min(...path.map(p=>p.y))>=ground(t,from)-WALK_LEDGE,`stays at the box foot going ${direction}`);}
});

test('two or three Quebra-Tijolos holes dug into each other can be climbed out of (user, 19/10/2026)',()=>{
 const x=1110,brick=WEAPONS.find(weapon=>weapon.id==='brick')!;
 for(const shots of [2,3]){const t=createTerrain('snow'),surface=ground(t,x);
  for(let n=0;n<shots;n++)crater(t,x,ground(t,x),brick.crater,'snow',weaponRoughness(brick),1,brick.craterShape);
  assert.ok(ground(t,x)>surface+20);
  for(const direction of [1,-1] as const){const end=walk(t,{x,y:ground(t,x)},direction,30).at(-1)!;assert.ok(end.y<=surface+6&&Math.abs(end.x-x)>40,`${shots} holes, going ${direction}: ${end.x},${end.y}`);}
 }
});
