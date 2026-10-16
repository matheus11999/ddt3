import assert from 'node:assert/strict';
import {createSession,TestClient,pause} from './integration';
import {trajectory,unpackTerrain} from '../shared/physics';
import {WEAPONS,weaponStats} from '../shared/catalog';
import type {Battle} from '../shared/protocol';
const sessions=await Promise.all([createSession(),createSession()]),clients=sessions.map(s=>new TestClient(s));
try{
 await Promise.all(clients.map(c=>c.wait('welcome')));
 for(const [i,c] of clients.entries())await c.request({type:'rename',name:`TEST Power Real ${i+1}`},'profile');
 const room=(await clients[0].request({type:'create',name:'TEST Power Natural',mode:'1v1',map:'celestial'},'room',e=>!!e.room)).room!;
 await clients[1].request({type:'join',roomId:room.id},'room');await clients[1].request({type:'ready'},'room');
 let battle=(await clients[0].request({type:'start'},'battle',e=>e.battle?.phase==='aiming')).battle!;
 let shots=0,verified=false;const charges:number[][]=[];
 while(battle.phase!=='finished'&&shots<10){
  const actor=clients.find(c=>c.profile.id===battle.turnId)!,fighter=battle.players.find(p=>p.id===battle.turnId)!,target=battle.players.find(p=>p.team!==fighter.team&&p.hp>0)!;
  const terrain=unpackTerrain(Buffer.from(battle.terrain!,'base64')),weapon=weaponStats(WEAPONS.find(w=>w.id===fighter.equipment.weapon)!,fighter.equipment.upgrade);
  let best={score:Infinity,angle:45,power:60};
  for(let angle=weapon.minAngle;angle<=weapon.maxAngle;angle+=2)for(let power=10;power<=100;power+=2){const r=trajectory(terrain,fighter,angle,power,battle.wind,weapon,[target]),score=Math.hypot(r.x-target.x,r.y-(target.y-25));if(score<best.score)best={score,angle,power};}
  const powered=(fighter.powerCharge??0)>=100;
  if(powered){const armed=(await actor.request({type:'power'},'battle',e=>e.battle?.players.some(p=>p.id===fighter.id&&p.powerArmed)===true)).battle!;assert.equal(armed.players.find(p=>p.id===fighter.id)!.powerCharge,0);}
  const mark=actor.send({type:'fire',angle:best.angle,power:best.power});
  if(powered){const cut=(await actor.wait('battle',e=>!!e.battle?.powerCutIn,mark)).battle!;assert.equal(actor.events.filter(e=>e.sequence>mark&&e.event.type==='shot').length,0);assert.deepEqual(cut.players.map(p=>p.hp),battle.players.map(p=>p.hp));}
  const shot=(await actor.wait('shot',()=>true,mark,15000)).shot;assert.equal(shot.powered,powered);assert.ok(shot.hits.some(hit=>hit.id===target.id),'ballistic search must hit the enemy');
  const next=(await actor.wait('battle',e=>e.battle?.phase==='finished'||e.battle?.phase==='aiming'&&e.battle.turnNumber>battle.turnNumber,mark,shot.duration+10000)).battle!;
  charges.push(next.players.map(p=>p.powerCharge??0));shots++;battle=next as Battle;
  if(powered){assert.ok(shot.projectiles.every(p=>p.powered));verified=true;break;}
 }
 assert.ok(verified,'players must charge and fire Power through actual enemy damage');
 console.log(JSON.stringify({ok:true,realWebSocket:true,naturalCharge:true,shots,charges,cutInBeforeDamage:true,poweredProjectiles:true}));
}finally{for(const client of clients){if(client.socket.readyState===1){client.send({type:'leave'});await pause(100);}await client.close();}}
