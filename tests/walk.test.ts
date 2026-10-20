import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {createTerrain,crater,ground,supported,walkPosition,walkStep,WALK_HEADROOM,WALK_STEP,WALK_STEP_X,WALK_STEP_Y,weaponRoughness,WORLD} from '../shared/physics';

const COLS=WORLD.cols,SURFACE=600;
function flat(){const t=new Uint8Array(COLS*WORLD.rows);for(let r=SURFACE;r<WORLD.rows;r++)t.fill(1,r*COLS,(r+1)*COLS);return t;}
function fill(t:Uint8Array,x0:number,x1:number,y0:number,y1:number,value=1){for(let y=y0;y<=y1;y++)t.fill(value,y*COLS+x0,y*COLS+x1+1);}
function walk(t:Uint8Array,from:{x:number;y:number},direction:1|-1,commands:number){const path=[from];for(let n=0;n<commands;n++){const next=walkPosition(t,path.at(-1)!,direction);if(!next)break;path.push({x:next.x,y:next.y});if(next.fell)break;}return path;}
const brick=WEAPONS.find(weapon=>weapon.id==='brick')!;
const dig=(t:Uint8Array,x:number)=>crater(t,x,ground(t,x),brick.crater,'snow',weaponRoughness(brick),1,brick.craterShape);

test('a walk command is three DDTank steps of 3 px on flat ground, both ways',()=>{
 for(const direction of [1,-1] as const){const path=walk(flat(),{x:700,y:SURFACE},direction,4);
  assert.equal(path.length,5);for(let n=1;n<path.length;n++){assert.equal(path[n].x-path[n-1].x,direction*WALK_STEP);assert.equal(path[n].y,SURFACE);}}
 assert.equal(WALK_STEP,3*WALK_STEP_X);
});

test('a ramp is followed support by support; a steeper slope than 7 px per step is a wall',()=>{
 for(const direction of [1,-1] as const){
  // 2 px up every 3 px: walked up to the top.
  const ramp=flat();for(let n=0;n<30;n++){const x=direction===1?620+n*3:780-n*3;fill(ramp,direction===1?x:x-200,direction===1?x+200:x,SURFACE-2*(n+1),SURFACE-1);}
  const up=walk(ramp,{x:direction===1?600:800,y:SURFACE},direction,20);
  assert.ok(up.at(-1)!.y<=SURFACE-50,`climbed the ramp going ${direction}: ${up.at(-1)!.y}`);
  // 3 px up every 1 px: no support within 7 px of the feet.
  const cliff=flat();for(let n=0;n<20;n++){const x=direction===1?620+n:780-n;fill(cliff,direction===1?x:0,direction===1?COLS-1:x,SURFACE-3*(n+1),SURFACE-1);}
  const stopped=walk(cliff,{x:direction===1?600:800,y:SURFACE},direction,20).at(-1)!;
  assert.ok(stopped.y>=SURFACE-WALK_STEP_Y,`the steep slope stops the walk going ${direction}`);
 }
});

test('a 7 px step is climbed and an abrupt 8 px wall stops the walk, in both directions',()=>{
 for(const direction of [1,-1] as const){
  const wallX=direction===1?620:580,from={x:direction===1?600:600,y:SURFACE};
  for(const [height,passes] of [[7,true],[8,false]] as const){
   const t=flat();fill(t,direction===1?wallX:wallX-200,direction===1?wallX+200:wallX,SURFACE-height,SURFACE-1);
   const end=walk(t,from,direction,6).at(-1)!;
   if(passes)assert.equal(end.y,SURFACE-height,`${height} px is one step going ${direction}`);
   else{assert.equal(end.y,SURFACE,`${height} px is a wall going ${direction}`);assert.ok(direction===1?end.x<wallX:end.x>wallX);
    const probe=walkStep(t,end,direction);assert.equal(probe.reject,'wall');assert.equal(probe.rise,WALK_STEP_Y+1);}
  }
 }
});

test('the support is looked up from 8 px above the feet in x−1 and x+1, never from the top of the map',()=>{
 const t=flat();fill(t,560,840,SURFACE-80,SURFACE-76);// a platform overhead, above the search start and the body
 const probe=walkStep(t,{x:700,y:SURFACE},1);
 assert.equal(probe.searchY,SURFACE-WALK_STEP_Y-1);assert.equal(probe.support,SURFACE);assert.deepEqual(probe.to,{x:703,y:SURFACE});
 // A single solid pixel beside the new x is support (DDTank canStand); the column itself is not tested.
 const thin=new Uint8Array(COLS*WORLD.rows);fill(thin,0,598,SURFACE,SURFACE);fill(thin,600,600,SURFACE,SURFACE);
 assert.ok(!supported(thin,598,SURFACE-1));assert.equal(walkStep(thin,{x:596,y:SURFACE},1).to?.y,SURFACE);assert.ok(supported(thin,599,SURFACE));
});

test('a step down of up to 7 px is walked; a taller drop or no ground ends the command in a fall',()=>{
 for(const direction of [1,-1] as const){
  const edge=direction===1?640:560,from={x:direction===1?620:580,y:SURFACE};
  const low=flat();fill(low,direction===1?edge:0,direction===1?COLS-1:edge,SURFACE,SURFACE+6,0);
  const down=walk(low,from,direction,4);assert.ok(down.some(p=>p.y===SURFACE+7));assert.ok(down.every(p=>p.y<=SURFACE+7));
  const ledge=flat();fill(ledge,direction===1?edge:0,direction===1?COLS-1:edge,SURFACE,SURFACE+59,0);
  const at={x:edge-direction,y:SURFACE};
  assert.equal(walkStep(ledge,at,direction).reject,'drop');
  const fell=walkPosition(ledge,at,direction)!;assert.ok(fell.fell);assert.equal(fell.y,SURFACE+60);
  const voidMap=flat();fill(voidMap,direction===1?edge:0,direction===1?COLS-1:edge,SURFACE,WORLD.rows-1,0);
  const gone=walkPosition(voidMap,at,direction)!;assert.ok(gone.fell);assert.ok(gone.y>WORLD.height,'no ground: the existing void rule applies');
 }
});

test('a deep crater with a sloped rim is walked into and out of, step by step, both ways',()=>{
 // A bowl 30 px deep whose sides rise 2 px per 3 px: far deeper than one step, walkable all the way.
 const t=flat(),cx=700;for(let x=cx-45;x<=cx+45;x++){const depth=Math.max(0,30-Math.floor(Math.abs(x-cx)*2/3));if(depth)fill(t,x,x,SURFACE,SURFACE+depth-1,0);}
 for(const direction of [1,-1] as const){const path=walk(t,{x:cx-direction*70,y:SURFACE},direction,20),end=path.at(-1)!;
  assert.ok(Math.max(...path.map(p=>p.y))>=SURFACE+27,'reached the bottom');assert.equal(end.y,SURFACE);assert.ok((end.x-cx)*direction>45,`out going ${direction}`);
  for(let n=1;n<path.length;n++)assert.ok(supported(t,path[n].x,path[n].y),'feet stay on support');}
});

test('a single Quebra-Tijolos crater on Sonho Nevado is walked through; craters side by side too',()=>{
 for(const x of [1150,1950]){const t=createTerrain('snow'),surface=ground(t,x);dig(t,x);
  for(const direction of [1,-1] as const){const path=walk(t,{x:x-direction*60,y:ground(t,x-direction*60)},direction,16);
   assert.ok(Math.max(...path.map(p=>p.y))>surface+10,`entered at ${x} going ${direction}`);assert.ok((path.at(-1)!.x-x)*direction>brick.crater*1.3,`left the crater at ${x} going ${direction}`);}}
 const row=createTerrain('snow');for(const x of [1120,1150,1180])dig(row,x);
 const across=walk(row,{x:1070,y:ground(row,1070)},1,20).at(-1)!;assert.ok(across.x>1210,`walked across overlapping craters: ${across.x}`);
});

test('craters dug one inside the other leave walls taller than a step: the pit traps, as in DDTank',()=>{
 for(const x of [1150,1950]){const t=createTerrain('snow');dig(t,x);dig(t,x);const bottom={x,y:ground(t,x)};
  for(const direction of [1,-1] as const){const end=walk(t,bottom,direction,14).at(-1)!;assert.ok(Math.abs(end.x-x)<brick.crater*1.3&&end.y>ground(t,x-60)+10,`trapped at ${x} going ${direction}: ${end.x},${end.y}`);
   const reject=walkStep(t,end,direction).reject;assert.ok(reject==='wall'||reject==='ceiling',reject);}}
});

test('platforms, passages, low ceilings and thin bridges',()=>{
 // A passage under a platform with room for the lying body is walked through; a lower one stops at its mouth.
 for(const [gap,passes] of [[WALK_HEADROOM+2,true],[WALK_HEADROOM-6,false]] as const)for(const direction of [1,-1] as const){
  const t=flat();fill(t,640,760,SURFACE-gap-20,SURFACE-gap-1);
  const end=walk(t,{x:direction===1?600:800,y:SURFACE},direction,20).at(-1)!;
  if(passes)assert.ok(direction===1?end.x>760:end.x<640,`passage ${gap} px going ${direction}`);
  else{assert.ok(direction===1?end.x<640:end.x>760,`ceiling ${gap} px going ${direction}`);assert.equal(walkStep(t,end,direction).reject,'ceiling');}
 }
 // A 3 px bridge over the void: crossed on top, and walking off its end with nothing under it is the void.
 const bridge=new Uint8Array(COLS*WORLD.rows);fill(bridge,0,500,SURFACE,WORLD.rows-1);fill(bridge,500,800,SURFACE,SURFACE+2);
 const crossed=walk(bridge,{x:480,y:SURFACE},1,40);assert.ok(crossed.some(p=>p.x>780&&p.y===SURFACE),'stays on the thin bridge');
 assert.ok(crossed.at(-1)!.y>WORLD.height,'off the end: the void');
 const landing=new Uint8Array(COLS*WORLD.rows);fill(landing,0,800,SURFACE,SURFACE+2);fill(landing,0,COLS-1,SURFACE+150,WORLD.rows-1);
 assert.equal(walk(landing,{x:780,y:SURFACE},1,10).at(-1)!.y,SURFACE+150,'falls to the floor under the bridge end');
});

test('the walk reads the terrain as it is now: a fresh crater ahead is walked into',()=>{
 const t=flat(),from={x:600,y:SURFACE};assert.equal(walkPosition(t,from,1)!.y,SURFACE);
 fill(t,602,640,SURFACE,SURFACE+5,0);// destroyed after the first look
 const next=walkPosition(t,from,1)!;assert.equal(next.y,SURFACE+6);assert.equal(next.fell,false);
 fill(t,602,640,SURFACE+6,SURFACE+40,0);
 const fall=walkPosition(t,from,1)!;assert.equal(fall.fell,true);assert.equal(fall.y,SURFACE+41);
});

test('the gift boxes on Sonho Nevado cannot be climbed from either side (user, 20/10/2026)',()=>{
 const t=createTerrain('snow');
 for(const [from,direction] of [[850,1],[1060,-1],[2032,1],[2252,-1]] as const){const path=walk(t,{x:from,y:ground(t,from)},direction,40);
  assert.ok(Math.min(...path.map(p=>p.y))>=ground(t,from)-WALK_STEP_Y,`stays at the box foot going ${direction}`);}
});

test('the map edge stops the walk without a step to pay for',()=>{
 const t=flat();assert.equal(walkPosition(t,{x:31,y:SURFACE},-1),null);assert.equal(walkStep(t,{x:31,y:SURFACE},-1).reject,'edge');
});
