import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Equipment} from '../shared/catalog';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {dropChance,expeditionStages,getExpedition,MONSTERS,partyHpScale} from '../shared/expeditions';
import {MONSTER_TURN_ID,nextInstanceActor,planMonsterTurn,strideOf} from '../shared/instanceTurn';
import type {MonsterBody} from '../shared/instanceTurn';
import {createTerrain,ground} from '../shared/physics';
import {getMap,INSTANCE_MAP_IDS,MAPS} from '../shared/maps';

class MemoryStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 profiles=new Map<string,Profile>();
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment=equipment;return structuredClone(p);}
 async rename(id:string,name:string){this.profiles.get(id)!.name=name;}
 matches:unknown[][]=[];expeditions:unknown[][]=[];
 async finishMatch(...args:unknown[]){this.matches.push(args);}
 async finishExpedition(...args:unknown[]){this.expeditions.push(structuredClone(args));}
}

function fixture(){
 const store=new MemoryStore(),game=new Game(store),events=new Map<string,ServerEvent[]>();
 const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){store.profiles.set(p.id,structuredClone(p));events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));}
 return {game,store,events,a:players[0],b:players[1]};
}
const stageOf=(room:{expedition?:{stage:number}|null})=>room.expedition?.stage;
const errors=(events:ServerEvent[])=>events.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').map(e=>e.message);

async function expedition(){
 const f=fixture();await f.game.command(f.a.id,{type:'create-expedition'});
 const roomId=f.game.peers.get(f.a.id)!.roomId!,room=f.game.rooms.get(roomId)!;
 await f.game.command(f.b.id,{type:'join',roomId});
 return {...f,roomId,room};
}

test('the instance turn: adventurers in order, then the monsters together',()=>{
 const order=[{id:'a',hp:10,team:0 as const},{id:'b',hp:0,team:0 as const},{id:'c',hp:10,team:0 as const}];
 assert.deepEqual(nextInstanceActor(order,{round:1,acted:[]}),{kind:'player',id:'a'});
 assert.deepEqual(nextInstanceActor(order,{round:1,acted:['a']}),{kind:'player',id:'c'});
 assert.deepEqual(nextInstanceActor(order,{round:1,acted:['a','c']}),{kind:'monsters'});
});

test('melee ants walk toward the nearest adventurer by their stride and bite only once beside them',()=>{
 const terrain=createTerrain('anthill-1'),y=(x:number)=>ground(terrain,x);
 const bodies:MonsterBody[]=[{id:'p',x:1300,y:y(1300),hp:100,team:0,facing:1},
  {id:'far',x:400,y:y(400),hp:10,team:1,monster:'ant-worker',facing:1},
  {id:'near',x:1250,y:y(1250),hp:10,team:1,monster:'ant-soldier',facing:1}];
 const plan=planMonsterTurn(terrain,bodies),far=plan.moves.find(m=>m.id==='far')!;
 assert.ok(far.to[0]>400&&far.to[0]-400<=MONSTERS['ant-worker'].stride*1.15+3,`andou ${far.to[0]-400}`);
 assert.deepEqual(plan.bites,[{id:'near',targetId:'p'}]);
 // Arriving within reach does not bite this turn.
 const close:MonsterBody[]=[bodies[0],{...bodies[1],x:1180,y:y(1180)}],arrive=planMonsterTurn(terrain,close);
 assert.equal(arrive.bites.length,0);assert.ok(arrive.moves[0].to[0]<1300-MONSTERS['ant-worker'].reach*.7+4);
});

test('heavier ants walk slower, and two of a kind rarely walk the same distance',()=>{
 assert.ok(MONSTERS['ant-worker'].stride>MONSTERS['ant-soldier'].stride&&MONSTERS['ant-soldier'].stride>MONSTERS['ant-brute'].stride);
 const steps=['a','b','c','d'].map(id=>strideOf({id,x:300,monster:'ant-worker'}));
 assert.ok(new Set(steps.map(Math.round)).size>1);
 for(const step of steps)assert.ok(step>=MONSTERS['ant-worker'].stride*.85&&step<=MONSTERS['ant-worker'].stride*1.15);
});

test('instance maps stay out of the PvP draw and place monsters on ground',()=>{
 for(const id of INSTANCE_MAP_IDS){
  assert.ok(!MAPS.some(m=>m.id===id));const map=getMap(id),terrain=createTerrain(id);
  assert.ok((map.monsters??[]).length>0);
  for(const spot of [...map.spawns[0],...(map.monsters??[]).map(m=>m.x)])assert.ok(ground(terrain,spot)<864,`${id}: sem chão em ${spot}`);
 }
 assert.ok(getMap('anthill-2').monsters!.some(m=>m.kind==='ant-queen'));
});

test('an expedition room picks an expedition, starts both stages and pays without touching the PvP ranking',async()=>{
 const f=await expedition();
 await f.game.command(f.b.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy'});
 assert.match(errors(f.events.get(f.b.id)!).at(-1)!,/líder/);
 await f.game.command(f.a.id,{type:'expedition-select',expedition:'anthill',difficulty:'hero'});
 assert.equal(f.room.expedition,null);
 await f.game.command(f.a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy'});
 assert.deepEqual(f.room.expedition,{id:'anthill',difficulty:'easy',stage:0});
 await f.game.command(f.a.id,{type:'start'});assert.match(errors(f.events.get(f.a.id)!).at(-1)!,/prontos/);
 await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 const m=f.game.matches.get(f.roomId)!,s=m.state;
 assert.equal(s.map,'anthill-1');assert.equal(s.instance?.stage,1);
 const ants=s.players.filter(p=>p.monster);assert.equal(ants.length,getMap('anthill-1').monsters!.length);
 assert.equal(ants[0].maxHp,Math.round(MONSTERS[ants[0].monster!].hp*partyHpScale(2)));
 // Nobody plays while the ants walk in.
 const first=s.turnId===f.a.id?f.a:f.b,second=first===f.a?f.b:f.a;
 await f.game.command(first.id,{type:'pass'});assert.match(errors(f.events.get(first.id)!).at(-1)!,/monstros chegarem/);
 s.instance!.introUntil=Date.now()-1;
 await f.game.command(first.id,{type:'pass'});f.game.tick(m.resolveAt+1);
 assert.equal(s.turnId,second.id);
 await f.game.command(second.id,{type:'pass'});
 assert.equal(s.turnId,MONSTER_TURN_ID);assert.ok(s.instance!.monsterTurn!.moves.length>0);
 const before=new Map(ants.map(a=>[a.id,a.x]));
 assert.ok(ants.some(a=>a.x!==before.get(a.id))||s.instance!.monsterTurn!.moves.every(move=>move.to[0]===ants.find(a=>a.id===move.id)!.x));
 f.game.tick(m.resolveAt+1);assert.equal(s.turnId,first.id);assert.equal(s.instance!.round,2);
 // Clearing every ant ends stage 1 with its cards; then stage 2 opens on the queen's chamber.
 for(const ant of ants)ant.hp=0;
 await f.game.command(first.id,{type:'pass'});f.game.tick(m.resolveAt+1);
 assert.equal(s.phase,'finished');assert.equal(s.winner,0);assert.equal(s.rewards!.cards.length,4);
 f.game.tick(s.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.store.expeditions.length,1);assert.equal(f.store.matches.length,0);
 // Back in the room after the stage; the choice now points at stage 2 and the party starts it again.
 f.game.tick(s.rewards!.revealedAt!+60000);
 assert.equal(f.room.status,'waiting');assert.equal(f.game.matches.get(f.roomId),undefined);assert.equal(stageOf(f.room),1);
 await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 const stage2=f.game.matches.get(f.roomId)!.state;
 assert.equal(stage2.map,'anthill-2');assert.equal(stage2.instance?.stage,2);assert.ok(stage2.instance?.boss);assert.ok(stage2.instance?.nest);
 assert.ok(stage2.instance!.introUntil-Date.now()<=1600,'sem a chegada das formigas no estágio 2');
 // The queen falls: the boss reward has more cards.
 stage2.instance!.introUntil=Date.now()-1;stage2.players.find(p=>p.id===stage2.instance!.boss)!.hp=0;
 const turn=stage2.turnId;await f.game.command(turn,{type:'pass'});f.game.tick(f.game.matches.get(f.roomId)!.resolveAt+1);
 assert.equal(stage2.phase,'finished');assert.equal(stage2.rewards!.cards.length,8);
 // The last stage won: back to the room, starting over at stage 1.
 const last=f.game.matches.get(f.roomId)!;f.game.tick(stage2.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));f.game.tick(stage2.rewards!.revealedAt!+60000);
 assert.equal(last.state.rewards!.saved,true);assert.equal(f.room.status,'waiting');assert.equal(stageOf(f.room),0);
});

test('the leader can pick the stage to start on (testing aid) and a lost stage keeps the choice',async()=>{
 const f=await expedition();
 await f.game.command(f.a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy',stage:5});
 assert.match(errors(f.events.get(f.a.id)!).at(-1)!,/Estágio/);
 await f.game.command(f.a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy',stage:1});
 await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 const m=f.game.matches.get(f.roomId)!;assert.equal(m.state.map,'anthill-2');
 for(const p of m.state.players)if(!p.monster)p.hp=0;
 (f.game as unknown as {checkInstanceEnd:(match:typeof m)=>boolean}).checkInstanceEnd(m);
 assert.equal(m.state.phase,'finished');assert.equal(m.state.winner,1);
 f.game.tick(m.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));f.game.tick((m.state.rewards!.revealedAt??Date.now())+60000);
 assert.equal(f.room.status,'waiting');assert.equal(stageOf(f.room),1);
});

test('the queen shoots and summons ants from the nest on her turn',async()=>{
 const f=await expedition();
 await f.game.command(f.a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy',stage:1});await f.game.command(f.b.id,{type:'ready'});await f.game.command(f.a.id,{type:'start'});
 const m=f.game.matches.get(f.roomId)!;
 const s=f.game.matches.get(f.roomId)!.state;s.instance!.introUntil=Date.now()-1;
 for(let n=0;n<2;n++)await f.game.command(s.turnId,{type:'pass'});
 assert.equal(s.turnId,MONSTER_TURN_ID);
 const turn=s.instance!.monsterTurn!;assert.ok(turn.arrowAt);
 const events:number[]=[];while(m.instance!.events.length){const at=m.instance!.events[0].at;events.push(at);f.game.tick(at);}
 assert.ok(m.activeShot?.projectiles[0].monster==='arrow');
 // Round 1 is not a summoning round (every 2); round 2 is.
 f.game.tick(m.resolveAt+1);for(let n=0;n<2;n++)await f.game.command(s.turnId,{type:'pass'});
 assert.notEqual(s.phase,'finished');
 assert.equal(s.turnId,MONSTER_TURN_ID);const summons=s.instance!.monsterTurn!.summons;assert.ok(summons.length>0);
 const minion=s.players.find(p=>p.id===summons[0].id)!;assert.equal(minion.hp,0);
 while(m.instance!.events.length)f.game.tick(m.instance!.events[0].at);
 assert.equal(minion.hp,minion.maxHp);assert.ok(Math.abs(minion.x-s.instance!.nest!.x)<80);
});

test('the drop chances shown on the board come from the stage reward cards',()=>{
 const [first,queen]=expeditionStages('anthill','easy'),drop=getExpedition('anthill')!.drops[0];
 assert.equal(dropChance(first,drop),1/first.prizes.length);
 assert.equal(dropChance(queen,drop),queen.prizes.filter(prize=>prize.kind==='stone'&&prize.level===1).length/queen.prizes.length);
});
