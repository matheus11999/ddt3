import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {createTerrain,crater,DIRECT_HIT_DIG,ground,solid,walkPosition,WALK_STEP,WALK_STEP_UP,weaponRoughness,WORLD} from '../shared/physics';

const COLS=512,SURFACE=600,BRICK_CRATER=22;
function flat(){const t=new Uint8Array(COLS*WORLD.rows);for(let r=SURFACE/3;r<WORLD.rows;r++)t.fill(1,r*COLS,(r+1)*COLS);return t;}
/** A round hole like the Quebra-Tijolos digs; map craters only cut the map's own destructible regions. */
function dig(t:Uint8Array,x:number,y:number,r:number){for(let cy=0;cy<WORLD.rows;cy++)for(let cx=0;cx<COLS;cx++){const dx=cx*3-x,dy=cy*3-y;if(dx*dx+dy*dy<=r*r)t[cy*COLS+cx]=0;}}
function walk(t:Uint8Array,from:{x:number;y:number},direction:1|-1,commands:number){const path=[from];for(let n=0;n<commands;n++){const next=walkPosition(t,path.at(-1)!,direction);if(!next)break;path.push(next);}return path;}
const centers=Array.from({length:20},(_,n)=>320+n*43);

test('a walk follows the ground pixel by pixel and never rises more than a step at once',()=>{
 for(const x of centers){const t=flat();dig(t,x,SURFACE,BRICK_CRATER);
  const path=walk(t,{x:x-60,y:SURFACE},1,30);
  for(let n=1;n<path.length;n++){assert.ok(path[n].x-path[n-1].x<=WALK_STEP);assert.ok(path[n-1].y-path[n].y<=WALK_STEP_UP*2,'no teleport up a wall');assert.ok(solid(t,path[n].x,path[n].y),'feet stay on the ground');}
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

test('the shallow dent of a direct hit can still be walked out of',()=>{
 for(const x of centers){const t=flat();dig(t,x,SURFACE,BRICK_CRATER*DIRECT_HIT_DIG);
  const end=walk(t,{x,y:ground(t,x)},1,30).at(-1)!;assert.ok(end.x>x+20&&end.y===SURFACE,`left the dent at ${x}`);
 }
});

test('on Sonho Nevado a fighter walks through a real Quebra-Tijolos crater but not out of two stacked ones',()=>{
 const brick=WEAPONS.find(weapon=>weapon.id==='brick')!,x=1110,once=createTerrain('snow'),surface=ground(once,x);
 assert.ok(crater(once,x,surface,brick.crater,'snow',weaponRoughness(brick))>0);
 const through=walk(once,{x:x-70,y:ground(once,x-70)},1,30);
 assert.ok(Math.max(...through.map(p=>p.y))>surface+12&&through.at(-1)!.x>x+brick.crater*1.3,'walked in and out');
 const twice=createTerrain('snow');crater(twice,x,surface,brick.crater,'snow',weaponRoughness(brick));crater(twice,x,ground(twice,x),brick.crater,'snow',weaponRoughness(brick));
 const end=walk(twice,{x:x-70,y:ground(twice,x-70)},1,30).at(-1)!;
 assert.ok(end.y>surface&&Math.abs(end.x-x)<brick.crater*1.3,`trapped at ${end.x},${end.y}`);
});

test('stacked craters make an even deeper pit that also traps, in either direction',()=>{
 for(const x of centers){const t=flat();dig(t,x,SURFACE,BRICK_CRATER);dig(t,x,ground(t,x),BRICK_CRATER);
  const bottom={x,y:ground(t,x)};assert.ok(bottom.y>SURFACE+35);
  for(const direction of [1,-1] as const){const end=walk(t,bottom,direction,30).at(-1)!;assert.ok(end.y>SURFACE+20,`trapped at ${x} going ${direction}`);assert.ok(Math.abs(end.x-x)<BRICK_CRATER*1.3);}
 }
});

test('walls taller than a step and low ceilings stop the walk',()=>{
 const wall=flat();for(let r=(SURFACE-30)/3;r<SURFACE/3;r++)wall.fill(1,r*COLS+200,r*COLS+220);
 const blocked=walk(wall,{x:560,y:SURFACE},1,10).at(-1)!;assert.ok(blocked.x<600&&blocked.y===SURFACE);
 const ceiling=flat();for(let r=(SURFACE-45)/3;r<(SURFACE-33)/3;r++)ceiling.fill(1,r*COLS+200,r*COLS+240);
 assert.ok(walk(ceiling,{x:560,y:SURFACE},1,10).at(-1)!.x<600,'the head hits the overhang');
 const ledge=flat();for(let r=(SURFACE-9)/3;r<SURFACE/3;r++)ledge.fill(1,r*COLS+200,r*COLS+260);
 assert.equal(walk(ledge,{x:570,y:SURFACE},1,10).at(-1)!.y,SURFACE-9,'a low ledge is stepped onto');
});
