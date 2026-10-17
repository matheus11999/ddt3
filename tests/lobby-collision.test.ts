import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LOBBY_OBSTACLES,LOBBY_SPAWN,LOBBY_WALK_SPEED,lobbyFree,lobbyStep} from '../shared/lobby';

const insideAny=(x:number,y:number)=>LOBBY_OBSTACLES.some(o=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1);
const walk=(from:{x:number;y:number},to:{x:number;y:number})=>{
 let p=from;const path=[p];
 for(let i=0;i<2000&&Math.hypot(to.x-p.x,to.y-p.y)>1;i++){p=lobbyStep(p,to,LOBBY_WALK_SPEED*.05);path.push(p);}
 return path;
};

test('walking across the plaza goes around every structure, never through it',()=>{
 for(const o of LOBBY_OBSTACLES){
  // Straight through the middle of the base, both ways.
  for(const [a,b] of [[o.x-o.rx-60,o.x+o.rx+60],[o.x+o.rx+60,o.x-o.rx-60]]){
   const to={x:b,y:o.y},path=walk({x:a,y:o.y},to),end=path.at(-1)!;
   assert.ok(path.every(p=>!insideAny(p.x,p.y)),`${o.id}: path enters the footprint`);
   assert.ok(Math.hypot(end.x-to.x,end.y-to.y)<=1,`${o.id}: walker must reach the other side`);
  }
 }
});

test('a click on a structure walks up to its edge instead of into it',()=>{
 for(const o of LOBBY_OBSTACLES){
  const target=lobbyFree(o.x,o.y);
  assert.ok(!insideAny(target.x,target.y),o.id);
  assert.ok(target.y>o.y,`${o.id}: stops in front of the base`);
 }
 assert.ok(!insideAny(LOBBY_SPAWN.x,LOBBY_SPAWN.y),'spawn is walkable');
});
