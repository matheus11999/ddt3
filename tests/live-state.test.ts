import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Equipment} from '../shared/catalog';
import type {Battle,Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {LiveState} from '../server/liveState';
import type {LiveBackend} from '../server/liveState';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

class MemoryStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 profiles=new Map<string,Profile>();
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment=equipment;return structuredClone(p);}
 async rename(id:string,name:string){this.profiles.get(id)!.name=name;}
 async finishMatch(){}
 async finishExpedition(){}
}
class MemoryBackend implements LiveBackend {
 fields=new Map<string,string>();writes=0;
 constructor(public name:string){}
 async load(){return new Map(this.fields);}
 async write(set:Map<string,string>,remove:string[]){this.writes++;for(const [k,v] of set)this.fields.set(k,v);for(const k of remove)this.fields.delete(k);}
}

function server(store=new MemoryStore()){
 const game=new Game(store),events=new Map<string,ServerEvent[]>();
 const join=(p:Profile)=>{events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));};
 return {game,store,events,join};
}
async function duel(){
 const s=server();const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){s.store.profiles.set(p.id,structuredClone(p));s.join(p);}
 const [a,b]=players;await s.game.command(a.id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});
 const roomId=s.game.peers.get(a.id)!.roomId!;await s.game.command(b.id,{type:'join',roomId});await s.game.command(b.id,{type:'ready'});await s.game.command(a.id,{type:'start'});
 return {...s,a,b,roomId,match:[...s.game.matches.values()][0]};
}
const welcome=(events:ServerEvent[])=>events.filter((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome').at(-1)!;

test('a running match comes back after a restart and the player rejoins it',async()=>{
 const before=await duel(),redis=new MemoryBackend('redis'),postgres=new MemoryBackend('postgres');
 const shooter=before.match.state.players.find(f=>f.id===before.match.state.turnId)!;shooter.hp=123;before.match.terrain[5000]=1;
 const t0=Date.now();
 await new LiveState(before.game,[{backend:redis,every:500},{backend:postgres,every:3000}]).save(true,t0);
 assert.ok(redis.fields.has('meta')&&postgres.fields.has(`m:${before.match.key}`)&&postgres.fields.has(`t:${before.match.key}`));

 // The process dies; a new one loads the saved copy 20 s later.
 const after=server(before.store);const restored=await new LiveState(after.game,[{backend:redis,every:500},{backend:postgres,every:3000}]).restore(t0+20000);
 assert.deepEqual(restored,{rooms:1,matches:1});
 const match=after.game.matches.get(before.match.key)!;
 assert.equal(match.state.id,before.match.state.id);assert.equal(match.terrain[5000],1);assert.equal(match.terrain.length,before.match.terrain.length);
 assert.ok(match.state.deadline>=t0+20000+15000,'o turno volta com tempo');
 assert.ok(match.state.players.filter(f=>!f.bot).every(f=>!f.connected));

 after.join(structuredClone(before.store.profiles.get(before.a.id)!));
 const back=welcome(after.events.get(before.a.id)!);
 assert.equal(back.room?.id,before.roomId);
 const battle=back.battle as Battle;assert.equal(battle.id,before.match.state.id);assert.ok(battle.terrain,'recebe o terreno');
 assert.equal(battle.players.find(f=>f.id===shooter.id)!.hp,123);
 assert.equal(battle.players.find(f=>f.id===before.a.id)!.connected,true);
});

test('a shot in flight is never saved: the copy stays at the start of the turn',async()=>{
 const s=await duel(),backend=new MemoryBackend('redis'),live=new LiveState(s.game,[{backend,every:0}]);
 await live.save(true);const turn=s.match.state.turnNumber,saved=backend.fields.get(`m:${s.match.key}`);
 await s.game.command(s.match.state.turnId,{type:'fire',angle:45,power:60});
 assert.equal(s.match.state.phase,'resolving');
 await live.save(true);
 assert.equal(backend.fields.get(`m:${s.match.key}`),saved);assert.equal((JSON.parse(saved!) as {state:Battle}).state.turnNumber,turn);
});

test('the newest copy wins and finished rooms are deleted from storage',async()=>{
 const s=await duel(),redis=new MemoryBackend('redis'),postgres=new MemoryBackend('postgres');
 const live=new LiveState(s.game,[{backend:redis,every:0},{backend:postgres,every:0}]);await live.save(true,1000);
 // Redis was wiped (container restart): Postgres still has everything.
 redis.fields.clear();
 const after=server(s.store);assert.deepEqual(await new LiveState(after.game,[{backend:redis,every:0},{backend:postgres,every:0}]).restore(5000),{rooms:1,matches:1});
 for(const id of [s.a.id,s.b.id])await s.game.command(id,{type:'leave'});
 s.game.matches.clear();await live.save(true,2000);
 assert.deepEqual([...postgres.fields.keys()],['meta']);assert.deepEqual(JSON.parse(postgres.fields.get('meta')!).rooms,[]);
});

test('a dropped fighter keeps their place in a running match beyond 30 s',async()=>{
 const s=await duel(),now=Date.now();
 s.game.disconnect(s.b.id);s.game.tick(now+60000);
 assert.equal(s.game.peers.get(s.b.id)?.roomId,s.roomId);assert.ok(!s.match.state.players.find(f=>f.id===s.b.id)!.left);
 s.game.tick(now+400000);
 assert.equal(s.game.peers.get(s.b.id),undefined);
});

test('an expedition stage comes back with its monsters and round',async()=>{
 const s=server();const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){s.store.profiles.set(p.id,structuredClone(p));s.join(p);}
 const [a,b]=players;await s.game.command(a.id,{type:'create-expedition'});const roomId=s.game.peers.get(a.id)!.roomId!;
 await s.game.command(b.id,{type:'join',roomId});await s.game.command(a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy'});
 await s.game.command(b.id,{type:'ready'});await s.game.command(a.id,{type:'start'});
 const m=s.game.matches.get(roomId)!;m.state.players.find(f=>f.monster)!.hp=1;
 const backend=new MemoryBackend('postgres'),t0=Date.now();await new LiveState(s.game,[{backend,every:0}]).save(true,t0);
 const after=server(s.store);await new LiveState(after.game,[{backend,every:0}]).restore(t0+5000);
 const back=after.game.matches.get(roomId)!;
 assert.equal(back.state.map,'anthill-1');assert.equal(back.state.instance?.stage,1);
 assert.equal(back.state.players.filter(f=>f.monster).length,m.state.players.filter(f=>f.monster).length);
 assert.equal(back.state.players.find(f=>f.monster)!.hp,1);
 assert.equal(back.state.instance!.introUntil,m.state.instance!.introUntil+5000);
 assert.ok(back.instance&&back.instance.events.length===0&&back.instance.stages.length===m.instance!.stages.length);
 // Play goes on: the turn passes as usual after the restore.
 for(const p of players)after.join(structuredClone(s.store.profiles.get(p.id)!));
 back.state.instance!.introUntil=Date.now()-1;const turn=back.state.turnId;await after.game.command(turn,{type:'pass'});after.game.tick(back.resolveAt+1);
 assert.notEqual(back.state.turnId,turn);
});
