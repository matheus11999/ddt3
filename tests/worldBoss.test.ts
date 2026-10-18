import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Equipment} from '../shared/catalog';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {WorldBossCommit,WorldBossDamage,WorldBossRealm} from '../server/worldBoss';
import {DRAGON_ACTIONS,DRAGON_FIGHTER_ID,DRAGON_TURN_ID,nextScheduleStart,pickDragonAction,scheduleWindowAt,sweepReachAt,WORLD_BOSS_RESULTS_MS} from '../shared/worldBoss';
import type {DragonAction,WorldBossRanking,WorldBossStatus} from '../shared/worldBoss';

class MemoryStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 profiles=new Map<string,Profile>();
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment=equipment;return structuredClone(p);}
 async rename(id:string,name:string){this.profiles.get(id)!.name=name;}
 async finishMatch(){throw Error('a world boss attempt never pays a match');}
}
/** The event in memory, with the same rules as Postgres: one ledger entry per key, the life only goes down. */
class FakeRealm implements WorldBossRealm {
 current:WorldBossStatus={phase:'active',occurrenceId:randomUUID(),name:'Dragão Ancestral',hp:100_000,maxHp:100_000,startsAt:Date.now(),endsAt:Date.now()+3600_000,fighters:0};
 ledger=new Map<string,WorldBossDamage>();attempts:string[]=[];onChange?:(s:WorldBossStatus)=>void;
 status(){return this.current;}
 async attempt(_o:string,playerId:string){this.attempts.push(playerId);}
 async commit(entry:WorldBossDamage):Promise<WorldBossCommit>{
  const key=`${entry.occurrenceId}:${entry.battleId}:${entry.turn}:${entry.playerId}`;
  if(this.current.phase!=='active'||entry.occurrenceId!==this.current.occurrenceId||this.ledger.has(key))return {applied:0,hp:this.current.hp,defeated:false};
  const applied=Math.min(this.current.hp,entry.damage);this.ledger.set(key,entry);
  this.set({hp:this.current.hp-applied,...(this.current.hp-applied===0?{phase:'results' as const,endReason:'defeated' as const,finishedAt:Date.now(),resultsUntil:Date.now()+WORLD_BOSS_RESULTS_MS,finalBlow:entry.name}:{})});
  return {applied,hp:this.current.hp,defeated:this.current.hp===0};
 }
 async ranking():Promise<WorldBossRanking>{return {occurrenceId:this.current.occurrenceId??null,rows:[],me:null};}
 set(patch:Partial<WorldBossStatus>){this.current={...this.current,...patch};this.onChange?.(this.current);}
}
function fixture(){
 const store=new MemoryStore(),game=new Game(store),realm=new FakeRealm(),events=new Map<string,ServerEvent[]>();
 game.worldBoss=realm;realm.onChange=status=>game.worldBossChanged(status);
 const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){store.profiles.set(p.id,structuredClone(p));events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));}
 return {game,store,realm,events,a:players[0],b:players[1]};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const matchOf=(game:Game,id:string)=>{const roomId=game.peers.get(id)!.roomId!;return game.matches.get(roomId)!;};

test('the dragon never repeats a kind of move twice in a row, and every move can come up',()=>{
 let previous:DragonAction|undefined;const seen=new Set<DragonAction>();
 for(let n=0;n<400;n++){const next=pickDragonAction(previous,(n*0.618)%1);if(previous)assert.notEqual(DRAGON_ACTIONS[next].family,DRAGON_ACTIONS[previous].family);seen.add(next);previous=next;}
 for(const action of ['claw','grab','breath','firesweep'] as const)assert.ok(seen.has(action),action);
 // The sweeping flames reach the dragon's side first and the far side last.
 assert.ok(sweepReachAt(1800,2240,0)<sweepReachAt(600,2240,0));
});

test('a daily schedule opens at the same Brasília hour every day and a one-off only once',()=>{
 const start=Date.UTC(2026,9,18,23,0),end=start+3600_000,day=86_400_000;
 const daily={startsAt:start,endsAt:end,repeat:'daily' as const};
 assert.equal(nextScheduleStart(daily,start-1000),start);
 assert.equal(nextScheduleStart(daily,end+1),start+day);
 assert.deepEqual(scheduleWindowAt(daily,start+day+60_000),{startsAt:start+day,endsAt:end+day});
 assert.equal(scheduleWindowAt(daily,start+day-60_000),null);
 const once={startsAt:start,endsAt:end,repeat:'none' as const};
 assert.equal(nextScheduleStart(once,end+1),null);assert.ok(scheduleWindowAt(once,start+10));
});

test('an attempt is a hidden solo battle: entrance, then my turn, then the dragon acts and hits me',async()=>{
 const f=fixture();
 await f.game.command(f.a.id,{type:'world-boss-enter'});
 const m=matchOf(f.game,f.a.id),s=m.state,room=f.game.rooms.get(s.roomId)!;
 assert.equal(room.kind,'world-boss');assert.deepEqual(f.realm.attempts,[f.a.id]);
 // Nobody else sees the attempt in the room lists.
 const listed=f.events.get(f.b.id)!.filter((e):e is Extract<ServerEvent,{type:'rooms'}>=>e.type==='rooms').flatMap(e=>e.rooms);
 assert.ok(!listed.some(r=>r.id===room.id));
 const dragon=s.players.find(p=>p.boss)!;assert.equal(dragon.id,DRAGON_FIGHTER_ID);assert.equal(dragon.hp,100_000);
 assert.equal(s.turnId,DRAGON_TURN_ID);assert.equal(s.worldBoss!.act!.action,'entrance');
 await f.game.command(f.a.id,{type:'pass'});assert.match(f.events.get(f.a.id)!.filter(e=>e.type==='error').at(-1)!.type,/error/);
 f.game.tick(m.resolveAt+1);assert.equal(s.turnId,f.a.id);assert.equal(s.phase,'aiming');assert.equal(s.worldBoss!.round,1);
 const hero=s.players.find(p=>p.id===f.a.id)!,hp=hero.hp;
 await f.game.command(f.a.id,{type:'pass'});
 assert.equal(s.turnId,DRAGON_TURN_ID);const act=s.worldBoss!.act!;assert.ok(['claw','grab','breath','firesweep'].includes(act.action));
 const hit=act.hits[0];assert.ok(hit&&hit.damage>0);
 f.game.tick(hit.at);assert.equal(hero.hp,hp-hit.damage);
 assert.ok(f.events.get(f.a.id)!.some(e=>e.type==='impact'&&e.shotId===`dragon:${act.id}`));
 f.game.tick(m.resolveAt+1);assert.equal(s.turnId,f.a.id);assert.equal(s.worldBoss!.round,2);
});

test('damage goes to the global life once per turn, survives a retry and the attempt ends with no reward screen',async()=>{
 const f=fixture();await f.game.command(f.a.id,{type:'world-boss-enter'});
 const m=matchOf(f.game,f.a.id),s=m.state;f.game.tick(m.resolveAt+1);
 // As if the player's shot had landed on the dragon for 1234.
 const run=(m as unknown as {worldBoss:{pending:number}}).worldBoss;run.pending=1234;s.worldBoss!.attemptDamage=1234;
 await f.game.command(f.a.id,{type:'pass'});await settle();
 assert.equal(f.realm.current.hp,100_000-1234);assert.equal(f.realm.ledger.size,1);
 assert.equal(s.players.find(p=>p.boss)!.hp,100_000-1234);
 // The same entry again changes nothing.
 const [entry]=[...f.realm.ledger.values()];assert.equal((await f.realm.commit(entry)).applied,0);
 // The dragon kills the player: back to the plaza with the event window, nothing else.
 const hero=s.players.find(p=>p.id===f.a.id)!,hit=s.worldBoss!.act!.hits[0];hero.hp=1;
 f.game.tick(hit.at);assert.equal(hero.hp,0);assert.equal(s.phase,'finished');assert.ok(!s.rewards);
 f.game.tick(s.worldBoss!.closesAt!+1);
 assert.equal(f.game.peers.get(f.a.id)!.roomId,null);assert.equal(f.game.matches.size,0);assert.equal(f.game.rooms.size,0);
 assert.ok(f.events.get(f.a.id)!.some(e=>e.type==='world-boss-closed'));
});

test('when the event ends mid-attempt the dragon flies away (time) or falls (killed) and everyone goes back',async()=>{
 const f=fixture();
 await f.game.command(f.a.id,{type:'world-boss-enter'});await f.game.command(f.b.id,{type:'world-boss-enter'});
 const ma=matchOf(f.game,f.a.id),mb=matchOf(f.game,f.b.id);f.game.tick(Math.max(ma.resolveAt,mb.resolveAt)+1);
 // B lands the killing blow; A's battle hears it at once.
 (mb as unknown as {worldBoss:{pending:number}}).worldBoss.pending=200_000;await f.game.command(f.b.id,{type:'pass'});await settle();
 assert.equal(f.realm.current.phase,'results');assert.equal(f.realm.current.finalBlow,'Bento');
 for(const m of [ma,mb]){assert.equal(m.state.worldBoss!.over,'defeated');assert.equal(m.state.worldBoss!.act!.action,'death');assert.equal(m.state.phase,'finished');}
 assert.equal(ma.state.players.find(p=>p.boss)!.hp,0);
 f.game.tick(ma.state.worldBoss!.closesAt!+1);assert.equal(f.game.matches.size,0);
 // A finished event cannot be entered; a new one can, and running out of time makes the dragon retreat.
 await f.game.command(f.a.id,{type:'world-boss-enter'});assert.match((f.events.get(f.a.id)!.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1))!.message,/terminou/);
 f.realm.set({phase:'active',occurrenceId:randomUUID(),hp:5000,maxHp:5000,endReason:undefined,finalBlow:undefined});
 await f.game.command(f.a.id,{type:'world-boss-enter'});const again=matchOf(f.game,f.a.id);
 f.realm.set({phase:'results',endReason:'time',finishedAt:Date.now()});
 assert.equal(again.state.worldBoss!.act!.action,'retreat');assert.equal(again.state.worldBoss!.over,'time');
});

test('leaving an attempt keeps its damage and a restart never saves it',async()=>{
 const f=fixture();await f.game.command(f.a.id,{type:'world-boss-enter'});
 const m=matchOf(f.game,f.a.id);f.game.tick(m.resolveAt+1);
 (m as unknown as {worldBoss:{pending:number}}).worldBoss.pending=777;
 const saved=f.game.savedState();assert.equal(saved.game.rooms.length,0);assert.equal(saved.matches.length,0);assert.equal(saved.game.peers.length,0);
 await f.game.command(f.a.id,{type:'leave'});await settle();
 assert.equal(f.realm.current.hp,100_000-777);assert.equal(f.game.matches.size,0);
 assert.ok(f.events.get(f.a.id)!.some(e=>e.type==='world-boss-closed'));
});
