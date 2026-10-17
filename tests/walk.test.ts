import assert from 'node:assert/strict';
import {test} from 'node:test';
import {crater,ground,solid,walkPosition,WALK_STEP,WALK_STEP_UP,WORLD} from '../shared/physics';

const COLS=512,SURFACE=600,BRICK_CRATER=22;
function flat(){const t=new Uint8Array(COLS*WORLD.rows);for(let r=SURFACE/3;r<WORLD.rows;r++)t.fill(1,r*COLS,(r+1)*COLS);return t;}
function walk(t:Uint8Array,from:{x:number;y:number},direction:1|-1,commands:number){const path=[from];for(let n=0;n<commands;n++){const next=walkPosition(t,path.at(-1)!,direction);if(!next)break;path.push(next);}return path;}
const centers=Array.from({length:20},(_,n)=>320+n*43);

test('a walk follows the ground pixel by pixel and never rises more than a step at once',()=>{
 for(const x of centers){const t=flat();crater(t,x,SURFACE,BRICK_CRATER,'garden');
  const path=walk(t,{x:x-60,y:SURFACE},1,30);
  for(let n=1;n<path.length;n++){assert.ok(path[n].x-path[n-1].x<=WALK_STEP);assert.ok(path[n-1].y-path[n].y<=WALK_STEP_UP*2,'no teleport up a wall');assert.ok(solid(t,path[n].x,path[n].y),'feet stay on the ground');}
 }
});

test('a fighter walks into a single brick crater and climbs back out on the other side',()=>{
 for(const x of centers){const t=flat();crater(t,x,SURFACE,BRICK_CRATER,'garden');
  const path=walk(t,{x:x-60,y:SURFACE},1,30);
  assert.ok(Math.max(...path.map(p=>p.y))>=SURFACE+12,`entered the crater at ${x}`);
  assert.ok(path.at(-1)!.x>x+BRICK_CRATER*1.3&&path.at(-1)!.y===SURFACE,`left the crater at ${x}`);
 }
});

test('stacked craters make a pit too steep to walk out of, in either direction',()=>{
 for(const x of centers){const t=flat();crater(t,x,SURFACE,BRICK_CRATER,'garden');crater(t,x,ground(t,x),BRICK_CRATER,'garden');
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
