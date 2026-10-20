import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {WEAPONS} from '../shared/catalog';
import {adjustAimToTerrain,clampAimAngle,terrainAimOffset,weaponAimLimits} from '../shared/aim';
import {crater,createTerrain,ground,supportBelow,trajectory,WORLD} from '../shared/physics';
import type {Profile,ServerEvent,Shot} from '../shared/protocol';
import {recoveredImpacts} from '../src/game/shotPlayback';
import {HIDDEN_POSITION} from '../shared/abilities';

test('a concealed active shot can reconnect after impacts without revealing or dereferencing absent projectiles',()=>{
 const shot:Shot={id:'concealed',shooterId:'hidden-enemy',hidden:true,startedAt:1000,duration:4000,projectiles:[],impacted:[0,1],hits:[{id:'victim',damage:20,x:400,y:300,projectileIndex:0,critical:false,kind:'splash',quality:.5}]};
 assert.doesNotThrow(()=>recoveredImpacts(shot));assert.deepEqual(recoveredImpacts(shot),[]);
});

test('a real authoritative crater changes supported aim only at contact and clamps to the weapon limits',async()=>{
 const profiles=new Map<string,Profile>(),events:ServerEvent[]=[],game=new Game({getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore,()=>{},()=>.99),players=['Slope A','Slope B'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const p of players){profiles.set(p.id,p);game.connect(p,event=>{if(p.id===players[0].id)events.push(structuredClone(event));});}
 await game.command(players[0].id,{type:'create',practice:true,name:'Crater slope',mode:'1v1',map:'garden'});const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const m=game.matches.get(roomId)!,actor=m.state.players.find(f=>f.id===m.state.turnId)!,other=m.state.players.find(f=>f.id!==actor.id)!,weapon=WEAPONS[0];m.state.wind=0;actor.hp=actor.maxHp=5000;other.hp=other.maxHp=5000;other.x=1400;other.y=ground(m.terrain,other.x);
 let input:{x:number;y:number;angle:number;power:number;before:number;after:number;expectedY:number}|undefined;
 for(let x=250;x<1100&&!input;x+=12){const y=ground(m.terrain,x);if(y>=WORLD.height)continue;const before=terrainAimOffset(m.terrain,{x,y,facing:1});
  for(let power=5;power<=25;power+=2){const angle=clampAimAngle(weapon,before,20),path=trajectory(m.terrain,{x,y,facing:1},angle,power,0,weapon,[other]),copy=m.terrain.slice();crater(copy,path.x,path.y,weapon.crater,'garden');const expectedY=supportBelow(copy,x,y-3),after=terrainAimOffset(copy,{x,y:expectedY,facing:1});if(expectedY<WORLD.height&&Math.abs(after-before)>=5){input={x,y,angle,power,before,after,expectedY};break;}}
 }
 assert.ok(input,'the map has an asymmetric crater rim which tilts its supported player');Object.assign(actor,{x:input.x,y:input.y,facing:1,aimAngle:input.angle,aimSlope:input.before});
 const beforeTerrain=m.terrain.slice();await game.command(actor.id,{type:'fire',angle:input.angle,power:input.power});const contact=m.pendingImpacts![0].at;
 assert.equal(actor.aimSlope,input.before);assert.deepEqual(m.terrain,beforeTerrain);game.tick(contact-.001);assert.equal(actor.aimSlope,input.before);
 game.tick(contact);assert.equal(actor.y,input.expectedY);assert.equal(actor.aimSlope,input.after);assert.equal(actor.aimAngle,clampAimAngle(weapon,input.after,input.angle+input.after-input.before));assert.notDeepEqual(m.terrain,beforeTerrain);
 const limits=weaponAimLimits(weapon,actor.aimSlope),broadcast=events.filter((event):event is Extract<ServerEvent,{type:'battle'}>=>event.type==='battle').at(-1)!.battle!,published=broadcast.players.find(player=>player.id===actor.id)!;
 assert.ok(actor.aimAngle!>=limits.minAngle&&actor.aimAngle!<=limits.maxAngle);assert.equal(published.aimSlope,actor.aimSlope);assert.equal(published.aimAngle,actor.aimAngle);
 const saved=actor.aimAngle;adjustAimToTerrain(actor,m.terrain);assert.equal(actor.aimAngle,saved,'repeated snapshots do not accumulate a slope offset');
});

test('an invisible fighter keeps its real collision, while nearer terrain blocks damage and hit coordinates stay private',async()=>{
 for(const wallFirst of [false,true]){
  const profiles=new Map<string,Profile>(),events:ServerEvent[]=[],game=new Game({getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore,()=>{},()=>.99),players=['Visible','Concealed'].map(name=>normalizeProfile({id:randomUUID(),name}));
  for(const p of players){profiles.set(p.id,p);game.connect(p,event=>{if(p.id===players[0].id)events.push(structuredClone(event));});}
  await game.command(players[0].id,{type:'create',practice:true,name:'First contact',mode:'1v1',map:'garden'});const roomId=game.peers.get(players[0].id)!.roomId!;
  await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
  const match=game.matches.get(roomId)!,actor=match.state.players.find(f=>f.id===players[0].id)!,target=match.state.players.find(f=>f.id===players[1].id)!;
  match.state.turnId=actor.id;match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,600*WORLD.cols);const wallX=wallFirst?450:519;for(let row=0;row<WORLD.rows;row++)match.terrain[row*WORLD.cols+wallX]=1;
  Object.assign(actor,{x:300,y:600,hp:5000,maxHp:5000,facing:1,aimSlope:0});Object.assign(target,{x:wallFirst?650:430,y:600,hp:5000,maxHp:5000,invisibleTurns:3});events.length=0;
  await game.command(actor.id,{type:'fire',angle:15,power:20});const shot=match.activeShot!,at=match.pendingImpacts![0].at;assert.equal(target.hp,5000);game.tick(at-.001);assert.equal(target.hp,5000);game.tick(at);
  const impact=events.find((event):event is Extract<ServerEvent,{type:'impact'}>=>event.type==='impact')!,hit=impact.hits.find(hit=>hit.id===target.id);
  if(wallFirst){assert.ok(shot.projectiles[0].impact.x>=wallX);assert.equal(target.hp,5000);assert.equal(hit,undefined);}
  else{assert.ok(shot.projectiles[0].impact.x<wallX);assert.ok(target.hp<5000);assert.ok(hit);assert.ok(hit.kind==='direct'||hit.kind==='graze');assert.equal(hit.hidden,true);assert.equal(hit.x,HIDDEN_POSITION);assert.equal(hit.y,HIDDEN_POSITION);}
 }
});
