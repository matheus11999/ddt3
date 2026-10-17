import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {CATALOG,DEFAULT_EQUIPMENT,SLOTS,SMITH_POSITION} from '../shared/catalog';
import type {Equipment} from '../shared/catalog';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ForgeOutcome,ProfileStore} from '../server/store';
import {withShrapnel} from './fixtures/weapons';
import {DIRECT_HIT_DIG,DIRECT_HIT_HALF_WIDTH} from '../shared/physics';

class MemoryStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 profiles=new Map<string,Profile>();forgeCalls=0;
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment={...equipment,upgrade:p.upgrades[equipment.weapon]};p.equippedOnce=true;return structuredClone(p);}
 async rename(id:string,name:string){this.profiles.get(id)!.name=name;}
 finishCalls:unknown[][]=[];failFinish=false;
 async finishMatch(...args:unknown[]){if(this.failFinish)throw Error('retry');this.finishCalls.push(structuredClone(args));}
 async forge(id:string,item:string,stones:Record<string,number>):Promise<ForgeOutcome>{
  this.forgeCalls++;const p=this.profiles.get(id)!;p.upgrades[item]++;p.equipment.upgrade=p.upgrades[p.equipment.weapon];
  for(const [tier,count] of Object.entries(stones))p.stones[tier]-=count;
  return {profile:structuredClone(p),result:{item,success:true,level:p.upgrades[item],chance:75,consumed:stones}};
 }
}

function fixture(){
 const store=new MemoryStore(),game=new Game(store),events=new Map<string,ServerEvent[]>();
 const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){store.profiles.set(p.id,structuredClone(p));events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));}
 return {game,store,events,players,a:players[0],b:players[1]};
}

async function battleFixture(){
 const f=fixture();await f.game.command(f.a.id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});
 const roomId=f.game.peers.get(f.a.id)!.roomId!;await f.game.command(f.b.id,{type:'join',roomId});await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 return {...f,roomId,match:f.game.matches.get(roomId)!};
}

function errors(events:ServerEvent[]){return events.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error');}

test('customization broadcasts all layers to other players and remains locked during battle',async()=>{
 const f=fixture();const items=Object.fromEntries(SLOTS.map(slot=>[slot,f.a.equipment[slot]])) as Record<keyof typeof import('../shared/catalog').SLOT_NAMES,string>;
 items.hat='hat-cap';items.glasses='glasses-sport';items.hair='hair-undercut';items.face='face-taunt';
 await f.game.command(f.a.id,{type:'customize',selection:{items}});
 const other=f.events.get(f.b.id)!.filter((e):e is Extract<ServerEvent,{type:'lobby'}>=>e.type==='lobby').at(-1)!;
 assert.equal(other.players.find(p=>p.id===f.a.id)!.equipment.glasses,'glasses-sport');assert.equal(other.players.find(p=>p.id===f.a.id)!.equipment.face,'face-taunt');
 await f.game.command(f.a.id,{type:'create',practice:true,name:'Visual',mode:'1v1',map:'sky'});const roomId=f.game.peers.get(f.a.id)!.roomId!;
 await f.game.command(f.b.id,{type:'join',roomId});await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 const fighter=f.game.matches.get(roomId)!.state.players.find(p=>p.id===f.a.id)!;assert.equal(fighter.equipment.hair,'hair-undercut');
 await f.game.command(f.a.id,{type:'customize',selection:{items:{...items,hat:'hat-none'}}});assert.match(errors(f.events.get(f.a.id)!).at(-1)!.message,/entre as batalhas/);assert.equal(fighter.equipment.hat,'hat-cap');
});

test('a player cannot fire, walk, boost or pass during the opponent turn',async()=>{
 const f=await battleFixture(),before=structuredClone(f.match.state),other=before.turnId===f.a.id?f.b:f.a;
 await f.game.command(other.id,{type:'boost',boost:'damage50'});
 await f.game.command(other.id,{type:'walk',direction:-1});
 await f.game.command(other.id,{type:'fire',angle:45,power:60});
 await f.game.command(other.id,{type:'pass'});
 assert.deepEqual(f.match.state,before);assert.equal(errors(f.events.get(other.id)!).length,4);
 assert.ok(errors(f.events.get(other.id)!).every(e=>e.message==='Aguarde a sua vez.'));
});

test('boosts repeat while vigor lasts, reject overspending and keep trident unique',async()=>{
 const f=await battleFixture(),player=f.match.state.players.find(p=>p.id===f.match.state.turnId)!,stamina=player.stamina;
 await f.game.command(player.id,{type:'boost',boost:'extra1'});assert.equal(player.stamina,stamina-110);
 await f.game.command(player.id,{type:'boost',boost:'extra1'});await f.game.command(player.id,{type:'boost',boost:'extra2'});
 assert.equal(player.stamina,stamina-220);assert.deepEqual(player.boosts,['extra1','extra1']);
 await f.game.command(player.id,{type:'boost',boost:'trident'});assert.equal(player.stamina,stamina-220);
 await f.game.command(player.id,{type:'boost',boost:'damage20'});assert.equal(player.stamina,stamina-220);assert.deepEqual(player.boosts,['extra1','extra1']);
 assert.equal(errors(f.events.get(player.id)!).length,3);
 await f.game.command(player.id,{type:'pass'});await f.game.command(f.match.state.turnId,{type:'pass'});
 await f.game.command(player.id,{type:'boost',boost:'trident'});await f.game.command(player.id,{type:'boost',boost:'trident'});assert.equal(player.stamina,stamina-110);assert.deepEqual(player.boosts,['trident']);assert.match(errors(f.events.get(player.id)!).at(-1)!.message,/tridente já/);
});

test('+2 and trident produce nine authoritative projectiles and lock further input while resolving',async()=>{
 const f=await battleFixture(),player=f.match.state.players.find(p=>p.id===f.match.state.turnId)!;
 await f.game.command(player.id,{type:'boost',boost:'extra2'});await f.game.command(player.id,{type:'boost',boost:'trident'});await f.game.command(player.id,{type:'fire',angle:45,power:35});
 const shot=f.events.get(player.id)!.find((e):e is Extract<ServerEvent,{type:'shot'}>=>e.type==='shot')!.shot;
 assert.equal(shot.projectiles.length,9);assert.equal(f.match.state.phase,'resolving');
 assert.equal(shot.projectiles[0].delay,0);assert.ok(shot.projectiles[3].delay>0);assert.ok(shot.projectiles[6].delay>shot.projectiles[3].delay);
 await f.game.command(player.id,{type:'fire',angle:45,power:35});assert.equal(f.events.get(player.id)!.filter(e=>e.type==='shot').length,1);
 assert.equal(errors(f.events.get(player.id)!).at(-1)!.message,'Aguarde o próximo turno.');
});

test('turn changes restore vigor and clear previously used tools',async()=>{
 const f=await battleFixture(),first=f.match.state.players.find(p=>p.id===f.match.state.turnId)!;
 await f.game.command(first.id,{type:'boost',boost:'damage50'});await f.game.command(first.id,{type:'pass'});
 const second=f.match.state.turnId;assert.notEqual(second,first.id);await f.game.command(second,{type:'pass'});
 assert.equal(f.match.state.turnId,first.id);assert.equal(first.stamina,first.maxStamina);assert.deepEqual(first.boosts,[]);
});

test('forge checks actual server position and lobby presence before accessing materials',async()=>{
 const f=fixture(),p=f.game.peers.get(f.a.id)!;
 await f.game.command(f.a.id,{type:'move',...SMITH_POSITION});await f.game.command(f.a.id,{type:'forge',item:'ember',stones:{'1':1}});
 assert.equal(f.store.forgeCalls,0);assert.equal(errors(f.events.get(f.a.id)!).at(-1)!.message,'Aproxime-se do ferreiro.');
 p.x=SMITH_POSITION.x;p.y=SMITH_POSITION.y;
 await f.game.command(f.a.id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});await f.game.command(f.a.id,{type:'forge',item:'ember',stones:{'1':1}});
 assert.equal(f.store.forgeCalls,0);
 await f.game.command(f.a.id,{type:'leave'});await f.game.command(f.a.id,{type:'forge',item:'ember',stones:{'1':1}});
 assert.equal(f.store.forgeCalls,1);assert.equal(p.profile.equipment.upgrade,1);
 assert.ok(f.events.get(f.a.id)!.some(e=>e.type==='forge-result'&&e.result.level===1));
 const lobby=f.events.get(f.b.id)!.filter((e):e is Extract<ServerEvent,{type:'lobby'}>=>e.type==='lobby').at(-1)!;
 assert.equal(lobby.players.find(other=>other.id===f.a.id)!.equipment.upgrade,1);
});

test('equipping cosmetics broadcasts appearance and changing weapon restores that weapon upgrade',async()=>{
 const f=fixture();f.store.profiles.get(f.a.id)!.upgrades.volt=10;
 await f.game.command(f.a.id,{type:'equip',item:'volt'});await f.game.command(f.a.id,{type:'equip',item:'hat-cap'});
 const p=f.game.peers.get(f.a.id)!.profile;assert.equal(p.equipment.upgrade,10);assert.equal(p.equipment.hat,'hat-cap');assert.equal(CATALOG[p.equipment.hat].slot,'hat');
 const lastLobby=f.events.get(f.b.id)!.filter((e):e is Extract<ServerEvent,{type:'lobby'}>=>e.type==='lobby').at(-1)!;
 assert.equal(lastLobby.players.find(other=>other.id===f.a.id)!.equipment.hat,'hat-cap');
 await f.game.command(f.a.id,{type:'equip',item:DEFAULT_EQUIPMENT.weapon});assert.equal(f.game.peers.get(f.a.id)!.profile.equipment.upgrade,0);
});

test('battle equipment and host-only room actions cannot be changed by another player',async()=>{
 const f=await battleFixture(),before=structuredClone(f.match.state.players.find(p=>p.id===f.b.id)!.equipment);
 await f.game.command(f.b.id,{type:'equip',item:'hat-mage'});await f.game.command(f.b.id,{type:'start'});await f.game.command(f.b.id,{type:'bot'});
 assert.deepEqual(f.match.state.players.find(p=>p.id===f.b.id)!.equipment,before);assert.equal(errors(f.events.get(f.b.id)!).length,3);
});

async function finishedFixture(){
 const f=await battleFixture();f.match.state.players.find(p=>p.id===f.b.id)!.hp=0;
 await f.game.command(f.match.state.turnId,{type:'pass'});assert.equal(f.match.state.phase,'finished');return f;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('reward picks open after the result, remain exclusive and reveal together once all humans choose',async()=>{
 const f=await finishedFixture();
 const rewards=f.match.state.rewards!;assert.equal(rewards.deadline-rewards.opensAt!,5000);assert.ok(rewards.opensAt!>Date.now());
 await f.game.command(f.a.id,{type:'reward-pick',card:2});assert.match(errors(f.events.get(f.a.id)!).at(-1)!.message,/abertura/);assert.ok(rewards.cards.every(card=>!card.playerId));
 rewards.opensAt=Date.now()-1;
 await Promise.all([f.game.command(f.a.id,{type:'reward-pick',card:2}),f.game.command(f.b.id,{type:'reward-pick',card:2})]);
 assert.equal(f.match.state.rewards!.cards[2].playerId,f.a.id);assert.match(errors(f.events.get(f.b.id)!).at(-1)!.message,/já foi escolhida/);
 await f.game.command(f.a.id,{type:'reward-pick',card:3});assert.match(errors(f.events.get(f.a.id)!).at(-1)!.message,/já está reservada/);
 assert.ok(f.match.state.rewards!.cards.every(card=>!card.prize));
 f.game.disconnect(f.a.id);f.game.connect(f.a,event=>f.events.get(f.a.id)!.push(structuredClone(event)));
 const welcome=f.events.get(f.a.id)!.at(-1)!; // lobby notifications may follow; locate welcome explicitly.
 const reconnect=f.events.get(f.a.id)!.filter((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome').at(-1)!;
 assert.ok(reconnect.battle!.rewards!.cards.every(card=>!card.prize));assert.equal(reconnect.battle!.rewards!.cards[2].playerId,f.a.id);
 assert.equal(f.store.finishCalls.length,0);
 await f.game.command(f.a.id,{type:'rematch'});assert.match(errors(f.events.get(f.a.id)!).at(-1)!.message,/revelação/);
 await f.game.command(f.b.id,{type:'reward-pick',card:4});await flush();assert.equal(rewards.phase,'revealed');assert.equal(rewards.saved,true);assert.ok(rewards.revealedAt!<rewards.deadline);
 assert.ok(rewards.cards[2].prize);assert.ok(rewards.cards[4].prize);assert.equal(rewards.cards.filter(c=>c.prize).length,8);
 assert.equal(f.store.finishCalls.length,1);f.game.tick(rewards.revealedAt!+1999);assert.equal(f.game.rooms.get(f.roomId)!.status,'playing');
 f.game.tick(rewards.revealedAt!+2000);await flush();assert.equal(f.game.matches.size,0);assert.equal(f.game.rooms.get(f.roomId)!.status,'waiting');assert.equal(f.store.finishCalls.length,1);
 await f.game.command(f.a.id,{type:'rematch'});assert.equal(f.game.matches.size,0);
});
test('unselected players receive distinct automatic cards and abandoned rooms still settle once',async()=>{
 const f=await finishedFixture();await f.game.command(f.a.id,{type:'leave'});await f.game.command(f.b.id,{type:'leave'});
 assert.equal(f.game.rooms.size,0);assert.equal(f.game.matches.size,1);
 f.game.tick(f.match.state.rewards!.deadline+1);await flush();
 const cards=f.match.state.rewards!.cards.filter(c=>c.playerId);assert.equal(cards.length,2);assert.ok(cards.every(c=>c.automatic&&c.prize));assert.equal(new Set(cards.map(c=>c.playerId)).size,2);
 assert.equal(f.store.finishCalls.length,1);f.game.tick(Date.now()+60000);assert.equal(f.game.matches.size,0);
});
test('late and foreign reward picks are rejected; failed saves retry without unlocking a rematch',async()=>{
 const f=await finishedFixture(),original=f.match.state.rewards!.deadline;f.match.state.rewards!.deadline=Date.now()-1;
 await f.game.command(f.a.id,{type:'reward-pick',card:0});assert.match(errors(f.events.get(f.a.id)!).at(-1)!.message,/terminou/);
 f.match.state.rewards!.deadline=original;f.store.failFinish=true;f.game.tick(original+1);await flush();
 assert.equal(f.match.state.rewards!.saved,false);await f.game.command(f.a.id,{type:'rematch'});assert.ok(f.game.matches.has(f.roomId));
 f.game.tick(original+3000);await flush();assert.equal(f.game.rooms.get(f.roomId)!.status,'playing');assert.equal(f.match.state.rewards!.saved,false);
 f.store.failFinish=false;f.game.tick(Date.now()+60000);await flush();assert.equal(f.match.state.rewards!.saved,true);assert.equal(f.store.finishCalls.length,1);
 f.game.tick(Date.now()+60001);assert.equal(f.game.rooms.get(f.roomId)!.status,'waiting');assert.equal(f.game.matches.size,0);assert.equal(f.store.finishCalls.length,1);
});
test('terrain marks are not exposed before impact and survive later snapshots',async()=>{
 const f=await battleFixture();await f.game.command(f.match.state.turnId,{type:'fire',angle:45,power:30});
 const immediate=f.events.get(f.a.id)!.filter((e):e is Extract<ServerEvent,{type:'battle'}>=>e.type==='battle').at(-1)!.battle!;
 assert.equal(immediate.terrainMarks!.length,0);assert.ok(f.match.pendingImpacts!.length);
 f.game.tick(Math.max(...f.match.pendingImpacts!.map(impact=>impact.at))+1);assert.ok(f.match.state.terrainMarks!.length);
});

test('a shrapnel shot sends authoritative shards after the main impact without muzzle residue marks',async()=>{
 await withShrapnel(async()=>{
  const f=await battleFixture(),player=f.match.state.players.find(p=>p.id===f.match.state.turnId)!;
  player.equipment={...player.equipment,weapon:'shrapnel',upgrade:10};
  await f.game.command(player.id,{type:'fire',angle:45,power:30});
  const shot=f.events.get(player.id)!.find((e):e is Extract<ServerEvent,{type:'shot'}>=>e.type==='shot')!.shot;
  const main=shot.projectiles.filter(p=>!p.fragment),shards=shot.projectiles.filter(p=>p.fragment);
  assert.equal(main.length,1);assert.equal(shards.length,3);
  const landed=main[0].delay+main[0].flightTime;
  for(const shard of shards){assert.equal(shard.effect,'brick');assert.equal(shard.delay,landed);assert.ok(shard.impact.radius<main[0].impact.radius);assert.ok(shard.delay+shard.flightTime<=shot.duration);}
  assert.ok(shot.hits.every(h=>h.projectileIndex!==undefined&&h.projectileIndex<shot.projectiles.length));
  assert.equal(f.match.pendingImpacts?.filter(impact=>!impact.fragment).length,1,'only the main impact leaves a residue mark');
 });
});

async function teamBattleFixture(){
 const f=fixture();await f.game.command(f.a.id,{type:'create',practice:true,name:'Lápide',mode:'2v2',map:'sky'});
 const roomId=f.game.peers.get(f.a.id)!.roomId!;await f.game.command(f.b.id,{type:'join',roomId});await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'bot'});await f.game.command(f.a.id,{type:'bot'});await f.game.command(f.a.id,{type:'start'});
 const match=f.game.matches.get(roomId)!,fallen=match.state.players.find(p=>p.id===f.a.id)!;
 assert.equal(match.state.players.length,4);assert.ok(match.state.players.some(p=>p.team===fallen.team&&p.id!==fallen.id));
 return {...f,roomId,match,fallen};
}
const nextTurn=(f:{game:Game;match:unknown})=>(f.game as unknown as {nextTurn:(m:unknown)=>void}).nextTurn(f.match);
// Bots claim random cards the moment the match ends; humans must pick a card still free.
const freeCard=(f:{match:{state:{rewards?:{cards:{index:number;playerId?:string}[]}}}})=>f.match.state.rewards!.cards.find(card=>!card.playerId)!.index;
const finishAgainst=async(f:Awaited<ReturnType<typeof teamBattleFixture>>)=>{
 for(const p of f.match.state.players)if(p.team!==f.fallen.team)p.hp=0;
 nextTurn(f);assert.equal(f.match.state.phase,'finished');
};
test('a fallen fighter stays to watch, never gets a turn and still earns the end-of-match reward',async()=>{
 const f=await teamBattleFixture();f.fallen.hp=0;
 for(let n=0;n<8;n++){nextTurn(f);assert.equal(f.match.state.phase,'aiming');assert.notEqual(f.match.state.turnId,f.a.id);}
 await f.game.command(f.a.id,{type:'walk',direction:1});assert.ok(errors(f.events.get(f.a.id)!).length>0);
 assert.equal(f.game.peers.get(f.a.id)!.roomId,f.roomId);
 await finishAgainst(f);f.game.tick(f.match.state.rewards!.deadline+1);await flush();
 const [,,players,bonuses]=f.store.finishCalls[0] as [string,string[],string[],Record<string,unknown>];
 assert.ok(players.includes(f.a.id));assert.ok(bonuses[f.a.id]);
});
test('a fighter who leaves mid-match becomes a tombstone and forfeits the end-of-match reward',async()=>{
 const f=await teamBattleFixture();f.fallen.hp=0;await f.game.command(f.a.id,{type:'leave'});
 assert.equal(f.fallen.left,true);assert.equal(f.match.state.phase,'aiming');assert.ok(f.match.state.players.includes(f.fallen));
 await finishAgainst(f);f.match.state.rewards!.opensAt=Date.now()-1;
 await f.game.command(f.b.id,{type:'reward-pick',card:freeCard(f)});await flush();assert.deepEqual(errors(f.events.get(f.b.id)!),[]);assert.equal(f.match.state.rewards!.phase,'revealed');
 assert.ok(!f.match.state.rewards!.cards.some(card=>card.playerId===f.a.id));
 const [,winners,players,bonuses]=f.store.finishCalls[0] as [string,string[],string[],Record<string,unknown>];
 assert.ok(!players.includes(f.a.id));assert.ok(!winners.includes(f.a.id));assert.equal(bonuses[f.a.id],undefined);assert.ok(players.includes(f.b.id));
});

test('a direct hit still digs a little under the target, less than a shot on the ground',async()=>{
 let direct:Extract<ServerEvent,{type:'shot'}>['shot']['projectiles'][number]|undefined,crater=0;
 for(let power=20;power<=100&&!direct;power+=2){
  const f=await battleFixture(),shooter=f.match.state.players.find(p=>p.id===f.match.state.turnId)!,target=f.match.state.players.find(p=>p.id!==shooter.id)!;
  shooter.equipment={...shooter.equipment,weapon:'brick',upgrade:0};crater=(CATALOG.brick as unknown as {crater:number}).crater;
  f.match.state.wind=0;target.x=shooter.x+shooter.facing*260;target.y=shooter.y;
  await f.game.command(shooter.id,{type:'fire',angle:45,power});
  const shot=f.events.get(shooter.id)!.find((e):e is Extract<ServerEvent,{type:'shot'}>=>e.type==='shot')?.shot;
  // Hits are revealed at impact; the planned hole already says whether the brick struck the target.
  direct=shot?.projectiles.find(p=>p.impact.dig);
 }
 assert.ok(direct,'some power lands a direct hit');
 const dig=direct.impact.dig!;
 assert.ok(dig.radius>0&&dig.radius<direct.impact.radius,'digs less than a ground shot');
 assert.ok(Math.abs(dig.radius-crater*DIRECT_HIT_DIG)<1e-6);assert.ok(dig.y>direct.impact.y,'the hole is under the target, not in the air');
 assert.ok(dig.radius*(dig.stretch??1)>=DIRECT_HIT_HALF_WIDTH-1e-6,'the hole reaches past the body so it shows');
});

test('turning in place is free, works on the opponent turn and never moves anyone or changes the active aim',async()=>{
 const f=await battleFixture(),s=f.match.state,active=s.players.find(p=>p.id===s.turnId)!,idle=s.players.find(p=>p.id!==s.turnId)!;
 const activeAim={angle:active.aimAngle,slope:active.aimSlope,facing:active.facing,x:active.x},spot={x:idle.x,y:idle.y,stamina:idle.stamina};
 idle.stamina=0;const direction=(idle.facing===1?-1:1) as 1|-1;
 await f.game.command(idle.id,{type:'face',direction});
 assert.equal(idle.facing,direction);assert.equal(idle.stamina,0);assert.equal(idle.x,spot.x);assert.equal(idle.y,spot.y);
 assert.deepEqual({angle:active.aimAngle,slope:active.aimSlope,facing:active.facing,x:active.x},activeAim);
 const seen=f.events.get(active.id)!.filter((e):e is Extract<ServerEvent,{type:'battle'}>=>e.type==='battle').at(-1)!;assert.equal(seen.battle!.players.find(p=>p.id===idle.id)!.facing,direction);
 assert.equal(errors(f.events.get(idle.id)!).length,0);
});

test('on your own turn the first press to the other side only turns, without spending stamina',async()=>{
 const f=await battleFixture(),s=f.match.state,me=s.players.find(p=>p.id===s.turnId)!,x=me.x,stamina=me.stamina,direction=(me.facing===1?-1:1) as 1|-1;
 await f.game.command(me.id,{type:'walk',direction});
 assert.equal(me.facing,direction);assert.equal(me.x,x);assert.equal(me.stamina,stamina);
 f.game.peers.get(me.id)!.lastWalk=0;await f.game.command(me.id,{type:'walk',direction});assert.notEqual(me.x,x);assert.equal(me.stamina,stamina-3);
});
