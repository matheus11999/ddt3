import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Equipment} from '../shared/catalog';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {CHARGE_HOLD_MS,FORCE_BAR_STEP_MS,FORCE_EARLY_MS,FORCE_LATE_MS,forceMatchesHold} from '../shared/forceBar';
import {POWER_MAX} from '../shared/power';

/** A03 (auditoria 21/10/2026): the force of a shot is timed by the server, never taken from the client. */
class MemoryStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 profiles=new Map<string,Profile>();
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment={...equipment};return structuredClone(p);}
 async rename(){}
 async finishMatch(){}
}

async function duel(){
 const store=new MemoryStore(),game=new Game(store),events=new Map<string,ServerEvent[]>();
 const players=['Ária','Bento'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500}));
 for(const p of players){store.profiles.set(p.id,structuredClone(p));events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));}
 await game.command(players[0].id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});
 const roomId=game.peers.get(players[0].id)!.roomId!;await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.turnId;
 const shots=()=>events.get(shooter)!.filter(e=>e.type==='shot').length;
 const lastError=()=>events.get(shooter)!.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1);
 const charge=(charging=true)=>game.command(shooter,{type:'aim',angle:45,power:1,charging});
 const fire=(power:number)=>game.command(shooter,{type:'fire',angle:45,power});
 return {game,match,shooter,shots,lastError,charge,fire,fighter:match.state.players.find(f=>f.id===shooter)!};
}
/** The bar's hold that first shows `power` on the way up. */
const rise=(power:number)=>(power-1)*FORCE_BAR_STEP_MS;

test('the bar values the server accepts follow the rising and falling holds within the network tolerance',()=>{
 assert.equal(forceMatchesHold(100,5),false);
 assert.equal(forceMatchesHold(100,rise(100)),true);
 assert.equal(forceMatchesHold(100,rise(100)-FORCE_EARLY_MS),true);assert.equal(forceMatchesHold(100,rise(100)-FORCE_EARLY_MS-1),false);
 assert.equal(forceMatchesHold(60,rise(60)+FORCE_LATE_MS+FORCE_BAR_STEP_MS-1),true);
 // 60 shows again on the way down, at 140 updates.
 assert.equal(forceMatchesHold(60,140*FORCE_BAR_STEP_MS+10),true);
 for(const bad of [0,101,50.5,Number.NaN])assert.equal(forceMatchesHold(bad,rise(50)),false,String(bad));
 assert.equal(forceMatchesHold(50,-1),false);
});

test('a shot without a charge, or with force 100 a few milliseconds after it, is refused and the turn goes on',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const f=await duel(),turn=f.match.state.turnNumber;
 await f.fire(100);
 assert.equal(f.shots(),0);assert.equal(f.lastError()?.retryShot,true);assert.match(f.lastError()!.message,/Segure a barra/);
 await f.charge();now+=5;await f.fire(100);
 assert.equal(f.shots(),0);assert.match(f.lastError()!.message,/não confere/);assert.equal(f.fighter.charging,false);
 assert.equal(f.match.state.turnNumber,turn);assert.equal(f.match.state.phase,'aiming');
 // The same release after holding the bar to the top goes through.
 await f.charge();now+=rise(100)+10;await f.fire(100);assert.equal(f.shots(),1);
});

test('a charge from another turn and a dropped charge do not open a shot',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const f=await duel();
 await f.charge();now+=rise(40);f.match.chargeTurn=f.match.state.turnNumber-1;await f.fire(40);
 assert.equal(f.shots(),0);assert.match(f.lastError()!.message,/Segure a barra/);
 await f.charge();now+=200;await f.charge(false);now+=rise(40);await f.fire(40);
 assert.equal(f.shots(),0);assert.match(f.lastError()!.message,/Segure a barra/);
});

test('normal releases pass under reasonable latency, even when the aim sync just went out',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 for(const [power,skew] of [[35,0],[80,-(FORCE_EARLY_MS-50)],[70,FORCE_LATE_MS-100],[20,180*FORCE_BAR_STEP_MS-rise(20)+10]] as const){
  const f=await duel();
  // An aim sync a moment before must not swallow the charge start (the 100 ms aim throttle).
  await f.game.command(f.shooter,{type:'aim',angle:45,power:1,charging:false});now+=20;await f.charge();
  now+=rise(power)+skew;await f.fire(power);assert.equal(f.shots(),1,`${power} ${skew}`);
 }
});

test('a charge started before the clock ran out still fires in overtime, and POW keeps the timed force',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 const f=await duel();
 now=f.match.state.deadline-100;await f.charge();now+=rise(90);assert.ok(now>f.match.state.deadline&&now<f.match.state.deadline+CHARGE_HOLD_MS);
 await f.fire(90);assert.equal(f.shots()+(f.match.pendingPower?1:0),1);
 const g=await duel();g.fighter.powerCharge=POWER_MAX;await g.game.command(g.shooter,{type:'power'});
 await g.charge();now+=rise(55);await g.fire(55);assert.equal(g.match.pendingPower?.power,55);
});
