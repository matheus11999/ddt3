import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {buyFishingOffer,chooseFishingGear,settleFishing} from '../server/fishing';
import type {FishSettle} from '../server/fishing';
import {FISH,FISHING_LAKES,FISHING_SPOTS,onDeck,FISHING_SPAWN,ROD_BY_ID,FISH_BY_ID,FISHING_DAILY_CAPS,FISHING_WEAPON,rollRodDrops,fishingDay,autoChance,autoReward,fishChallenge,zoneAt,fishingBlocked,fishingFree,fishingLevel,fishingStep,gradePress,inLake,markerAt,pickFish,fishingXpFor,fishRarity,normalizeFishing,effectiveRod,FISHING_SHOP,FISHING_RODS,FISHING_HISTORY,HOOK_LEAD_MS,RESULT_MS} from '../shared/fishing';
import type {FishChallenge,FishingView} from '../shared/fishing';

test('every fishing spot stands on walkable ground and casts into its own lake',()=>{
 for(const spot of FISHING_SPOTS){
  assert.ok(!fishingBlocked(spot.x,spot.y),`${spot.id} fica em lugar bloqueado`);
  const lake=FISHING_LAKES.find(l=>l.id===spot.lake)!;
  assert.ok(inLake(lake,spot.bobX,spot.bobY),`a boia de ${spot.id} cai fora do lago`);
  assert.equal(Math.sign(spot.bobX-spot.x),spot.facing,`${spot.id} olha para o lado errado`);
  assert.ok(!onDeck(spot.bobX,spot.bobY),`a boia de ${spot.id} cai no píer`);
 }
 assert.equal(new Set(FISHING_SPOTS.map(s=>s.id)).size,FISHING_SPOTS.length);
 assert.ok(!fishingBlocked(FISHING_SPAWN.x,FISHING_SPAWN.y));
});

test('walkers go around the lakes and reach every spot from the gate',()=>{
 const center=FISHING_LAKES[1];assert.ok(fishingBlocked(center.x+5,center.y));
 const free=fishingFree(center.x+5,center.y);assert.ok(!fishingBlocked(free.x,free.y));
 for(const spot of FISHING_SPOTS){
  let p={...FISHING_SPAWN};
  for(let n=0;n<6000&&Math.hypot(p.x-spot.x,p.y-spot.y)>1;n++)p=fishingStep(p,spot,13);
  assert.ok(Math.hypot(p.x-spot.x,p.y-spot.y)<=1,`não chegou a ${spot.id} (parou em ${p.x.toFixed(0)},${p.y.toFixed(0)})`);
 }
});

test('the bar sweeps back and forth and grades presses by the target',()=>{
 const fish=FISH_BY_ID.get('carpa-lua')!,c=fishChallenge(fish,ROD_BY_ID.get('rod-bamboo')!,42);
 assert.equal(c.hits,2);assert.deepEqual(fishChallenge(fish,ROD_BY_ID.get('rod-bamboo')!,42),c);
 assert.equal(markerAt(c,0),0);assert.ok(Math.abs(markerAt(c,1000/c.speed)-1)<1e-9);assert.ok(Math.abs(markerAt(c,2000/c.speed))<1e-9);
 const at=(target:number)=>target/c.speed*1000;
 assert.equal(gradePress(c,0,at(c.zones[0])),'perfect');
 assert.equal(gradePress(c,0,at(Math.min(1,c.zones[0]+c.width*.4))),'hit');
 assert.equal(gradePress(c,0,at(c.zones[0]>.5?c.zones[0]-c.width*1.2:c.zones[0]+c.width*1.2)),'miss');
 const wide=fishChallenge(fish,ROD_BY_ID.get('rod-oak')!,42);assert.ok(wide.width>c.width);
});

/** First moment from `after` ms when the marker crosses the middle of the (maybe swimming) target. */
function centredAt(c:FishChallenge,press:number,after:number):number{
 for(let t=after;t<after+20000;t+=1)if(Math.abs(markerAt(c,t)-zoneAt(c,press,t))<c.perfect/4)return t;
 throw Error('o marcador nunca passou pelo alvo');
}
test('hard fish move the target: a press on its old place misses, one on the moving target lands',()=>{
 const easy=fishChallenge(FISH_BY_ID.get('lambari-dourado')!,ROD_BY_ID.get('rod-bamboo')!,7);assert.equal(easy.drift,0);
 const c=fishChallenge(FISH_BY_ID.get('carpa-dragao')!,ROD_BY_ID.get('rod-bamboo')!,7);assert.ok(c.drift>0);
 for(const z of c.zones){assert.ok(z-c.drift-c.width/2>=0&&z+c.drift+c.width/2<=1,'o alvo sai da barra');}
 assert.ok(Math.abs(zoneAt(c,0,c.driftMs/4)-zoneAt(c,0,0))>c.drift*.5);
 const t=centredAt(c,0,0);assert.equal(gradePress(c,0,t),'perfect');
 // Where the target is far from its resting place, pressing there misses.
 let away=-1;for(let k=0;k<20000;k++)if(Math.abs(markerAt(c,k)-c.zones[0])<.005&&Math.abs(zoneAt(c,0,k)-c.zones[0])>c.width){away=k;break;}
 assert.ok(away>=0);assert.equal(gradePress(c,0,away),'miss');
});

test('automatic fishing is always less reliable than a good manual player, and luck favors rare fish',()=>{
 for(const fish of FISH)for(const rod of ROD_BY_ID.values())assert.ok(autoChance(fish,rod)<=.85);
 const rare=(rod:string)=>{let n=0;for(let i=0;i<1000;i++)if(pickFish('profundo',ROD_BY_ID.get(rod)!,i/1000).difficulty>=4)n++;return n;};
 assert.ok(rare('rod-royal')>rare('rod-bamboo'));
 for(let i=0;i<50;i++)assert.ok(pickFish('cristal',ROD_BY_ID.get('rod-bamboo')!,i/50).lakes.includes('cristal'));
});

test('a catch adds points, fisher EXP and the collection',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Pescador'});
 assert.equal(p.fishing.rod,'rod-bamboo');assert.equal(fishingLevel(p.fishing.xp),1);
 const first=settleFishing(p,{fish:{id:'lambari-dourado',kg:.3,points:2,xp:fishingXpFor(2)}});
 assert.deepEqual({...first.catch},{fish:'lambari-dourado',kg:.3,points:2,xp:fishingXpFor(2),record:false,first:true,levelUp:2});
 const second=settleFishing(p,{fish:{id:'lambari-dourado',kg:.35,points:2,xp:20}});
 assert.equal(second.catch!.record,true);assert.equal(p.fishing.points,4);assert.equal(p.fishing.caught['lambari-dourado'],2);assert.equal(p.fishing.best['lambari-dourado'],.35);
 assert.throws(()=>chooseFishingGear(p,'rod-oak'),/não tem essa vara/);
});

test('fish rarity follows difficulty, from Comum to Lendário',()=>{
 assert.deepEqual(([1,2,3,4,5] as const).map(d=>fishRarity({difficulty:d}).id),['comum','normal','raro','epico','lendario']);
 assert.equal(fishRarity(FISH_BY_ID.get('carpa-dragao')!).name,'Lendário');
 assert.ok(FISH.every(f=>fishRarity(f)));
});

test('every catch goes to the history, newest first, keeping only the last ones',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Pescador'});
 settleFishing(p,{fish:{id:'lambari-dourado',kg:.3,points:2,xp:20},at:1000});
 settleFishing(p,{fish:{id:'carpa-lua',kg:2,points:1,xp:5},auto:true,at:2000});
 settleFishing(p,{});
 assert.deepEqual(p.fishing.history.slice(0,2),[{fish:'carpa-lua',kg:2,points:1,xp:5,at:2000,auto:true},{fish:'lambari-dourado',kg:.3,points:2,xp:20,at:1000}]);
 for(let i=0;i<FISHING_HISTORY+5;i++)settleFishing(p,{fish:{id:'lambari-dourado',kg:.2,points:2,xp:20},at:3000+i});
 assert.equal(p.fishing.history.length,FISHING_HISTORY);assert.equal(p.fishing.history[0].at,3000+FISHING_HISTORY+4);
 const saved=normalizeFishing({...p.fishing,history:[...p.fishing.history,{fish:'peixe-falso',kg:1,points:1,xp:1,at:1}] as never});
 assert.equal(saved.history.length,FISHING_HISTORY);assert.ok(saved.history.every(h=>FISH_BY_ID.has(h.fish)));
});

test('baits are gone: leftover Iscas Brilhantes come back as Pontos de Pesca',()=>{
 const f=normalizeFishing({rod:'rod-bamboo',bait:'bait-glow',rods:['rod-bamboo'],baits:{'bait-glow':7},points:10});
 assert.equal(f.points,10+7*6);assert.equal('bait' in f,false);assert.equal('baits' in f,false);
});

test('rods bring their own prizes: gold, Cupons and fragments, a quarter in automatic, never past the daily caps',()=>{
 assert.deepEqual(rollRodDrops(ROD_BY_ID.get('rod-bamboo')!,false,()=>0),[]);
 const royal=ROD_BY_ID.get('rod-royal')!;
 assert.deepEqual(rollRodDrops(royal,false,()=>0).map(d=>d.kind),['gold','coupons','fragments']);
 // A roll just under the manual chance lands by hand but not in automatic.
 const fragment=royal.drops!.find(d=>d.kind==='fragment')!.chance,justUnder=()=>fragment*.9;
 assert.ok(rollRodDrops(royal,false,justUnder).some(d=>d.kind==='fragments'));
 assert.ok(!rollRodDrops(royal,true,justUnder).some(d=>d.kind==='fragments'));
 const p=normalizeProfile({id:randomUUID(),name:'Pescador',gold:0}),coupons=p.coupons,day=Date.UTC(2026,9,20,15);
 const catchWith=(drops:Parameters<typeof settleFishing>[1]['drops'],at=day)=>settleFishing(p,{fish:{id:'lambari-dourado',kg:.3,points:2,xp:20},drops,at});
 const first=catchWith([{kind:'gold',amount:150},{kind:'coupons',amount:1},{kind:'fragments',amount:1,weapon:FISHING_WEAPON}]);
 assert.deepEqual(first.catch!.drops,[{kind:'gold',amount:150},{kind:'coupons',amount:1},{kind:'fragments',amount:1,weapon:FISHING_WEAPON}]);
 assert.equal(p.gold,150);assert.equal(p.coupons,coupons+1);assert.equal(p.fragments[FISHING_WEAPON],1);
 assert.deepEqual(p.fishing.history[0].drops,first.catch!.drops);
 for(let i=0;i<20;i++)catchWith([{kind:'gold',amount:150},{kind:'coupons',amount:1},{kind:'fragments',amount:1,weapon:FISHING_WEAPON}]);
 assert.equal(p.gold,FISHING_DAILY_CAPS.gold);assert.equal(p.coupons,coupons+FISHING_DAILY_CAPS.coupons);assert.equal(p.fragments[FISHING_WEAPON],FISHING_DAILY_CAPS.fragments);
 assert.equal(catchWith([{kind:'coupons',amount:1}]).catch!.drops,undefined);
 // The next Brasília day starts over.
 const tomorrow=day+24*3600_000;assert.notEqual(fishingDay(tomorrow),fishingDay(day));
 assert.deepEqual(catchWith([{kind:'coupons',amount:1}],tomorrow).catch!.drops,[{kind:'coupons',amount:1}]);
});

test('the fisher level gates every rod in the Casa de Pesca and never helps the rod prizes',()=>{
 const rods=FISHING_SHOP.filter(o=>o.prize.kind==='rod');
 assert.equal(rods.length,FISHING_RODS.length-1);
 assert.ok(rods.every((o,i)=>o.level&&(i===0||o.level>rods[i-1].level!)));
 assert.deepEqual(effectiveRod(ROD_BY_ID.get('rod-royal')!,50).drops,ROD_BY_ID.get('rod-royal')!.drops);
});

test('the fishing shop trades points for rewards, checks level and never sells a rod twice',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Pescador',gold:0});p.fishing.points=1000;
 const gold=buyFishingOffer(p,'gold-100',3);assert.equal(gold.spent,150);assert.equal(p.gold,300);assert.equal(p.fishing.points,850);
 assert.throws(()=>buyFishingOffer(p,'rod-oak',1),/nível de pescador 5/);
 p.fishing.xp=fishingXpFor(5);p.fishing.points=900;buyFishingOffer(p,'rod-oak',1);assert.ok(p.fishing.rods.includes('rod-oak'));
 assert.throws(()=>buyFishingOffer(p,'rod-oak',1),/já tem/);
 assert.throws(()=>buyFishingOffer(p,'rod-coral',1),/nível de pescador 12/);
 p.fishing.xp=fishingXpFor(12);assert.throws(()=>buyFishingOffer(p,'rod-coral',1),/insuficientes/);
});

class FishStore implements ProfileStore {
 profiles=new Map<string,Profile>();
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 async saveEquipment():Promise<never>{throw Error('unused');}
 async rename(){}
 async finishMatch(){}
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async fishSettle(id:string,settle:FishSettle){const outcome=settleFishing(this.profiles.get(id)!,settle);return {...outcome,profile:structuredClone(outcome.profile)};}
 async fishGear(id:string,rod:string){return structuredClone(chooseFishingGear(this.profiles.get(id)!,rod));}
 async fishBuy(id:string,offer:string,quantity:number){const outcome=buyFishingOffer(this.profiles.get(id)!,offer,quantity);return {...outcome,profile:structuredClone(outcome.profile)};}
}
function fixture(){
 const store=new FishStore(),game=new Game(store),events=new Map<string,ServerEvent[]>();
 const players=['Iara','Tomé'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male'}));
 for(const p of players){store.profiles.set(p.id,structuredClone(p));events.set(p.id,[]);game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));}
 return {store,game,events,a:players[0],b:players[1]};
}
const last=<T extends ServerEvent['type']>(events:ServerEvent[],type:T)=>events.filter((e):e is Extract<ServerEvent,{type:T}>=>e.type===type).at(-1);
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('the Pescaria is its own zone: walkers only see each other there and rooms wait for the plaza',async()=>{
 const f=fixture();
 await f.game.command(f.a.id,{type:'zone',zone:'fishing'});
 const zone=last(f.events.get(f.a.id)!,'zone')!;assert.equal(zone.zone,'fishing');assert.deepEqual(zone.players.map(p=>p.id),[f.a.id]);
 assert.ok(!last(f.events.get(f.b.id)!,'lobby')!.players.some(p=>p.id===f.a.id));
 await f.game.command(f.a.id,{type:'create',name:'Sala'});assert.match(last(f.events.get(f.a.id)!,'error')!.message,/Praça Celeste/);
 assert.equal(f.game.peers.get(f.a.id)!.roomId,null);
 await f.game.command(f.a.id,{type:'zone',zone:'plaza'});assert.ok(last(f.events.get(f.b.id)!,'lobby')!.players.some(p=>p.id===f.a.id));
});

test('manual fishing: bite, presses on the target land the fish; walking away reels in',async()=>{
 const f=fixture(),spot=FISHING_SPOTS[0],peer=f.game.peers.get(f.a.id)!;f.game.fishRoll=()=>0;
 await f.game.command(f.a.id,{type:'zone',zone:'fishing'});
 await f.game.command(f.a.id,{type:'fish-cast',spot:spot.id});assert.match(last(f.events.get(f.a.id)!,'error')!.message,/mais perto/);
 peer.x=spot.x;peer.y=spot.y;
 await f.game.command(f.a.id,{type:'fish-cast',spot:spot.id});
 assert.equal(last(f.events.get(f.a.id)!,'fishing')!.fishing!.phase,'waiting');
 // Someone else cannot take the same spot.
 await f.game.command(f.b.id,{type:'zone',zone:'fishing'});const other=f.game.peers.get(f.b.id)!;other.x=spot.x+10;other.y=spot.y;
 await f.game.command(f.b.id,{type:'fish-cast',spot:spot.id});assert.match(last(f.events.get(f.b.id)!,'error')!.message,/já está pescando/);
 const session=peer.fishing!;f.game.tick(session.biteAt+1);
 const view=last(f.events.get(f.a.id)!,'fishing')!.fishing as FishingView;assert.equal(view.phase,'bite');
 const c=view.challenge!;
 for(let n=0;n<c.hits;n++){
  const at=c.start+centredAt(c,n,n*1500);
  const realNow=Date.now;Date.now=()=>at+50;try{await f.game.command(f.a.id,{type:'fish-press',at});}finally{Date.now=realNow;}
 }
 await flush();
 const done=last(f.events.get(f.a.id)!,'fishing')!.fishing!;assert.equal(done.phase,'result');assert.equal(done.result!.success,true);
 assert.equal(done.result!.catch!.first,true);assert.ok(f.store.profiles.get(f.a.id)!.fishing.points>0);
 // Others see the catch on the lakeside.
 assert.equal(last(f.events.get(f.b.id)!,'lobby')!.players.find(p=>p.id===f.a.id)!.fishing!.success,true);
 f.game.tick(done.since+RESULT_MS+1);assert.equal(last(f.events.get(f.a.id)!,'fishing')!.fishing!.phase,'idle');
 await f.game.command(f.a.id,{type:'move',x:FISHING_SPAWN.x,y:FISHING_SPAWN.y});assert.equal(last(f.events.get(f.a.id)!,'fishing')!.fishing,null);
});

test('two misses lose the fish but the cast still counts as used',async()=>{
 const f=fixture(),spot=FISHING_SPOTS[2],peer=f.game.peers.get(f.a.id)!;
 await f.game.command(f.a.id,{type:'zone',zone:'fishing'});peer.x=spot.x;peer.y=spot.y;
 await f.game.command(f.a.id,{type:'fish-cast',spot:spot.id});f.game.tick(peer.fishing!.biteAt);
 const c=peer.fishing!.challenge!,start=peer.fishing!.start,wrong=c.zones[0]>.5?.0:1;
 for(let n=0;n<2;n++){const at=start+wrong/c.speed*1000+n*2000/c.speed;const realNow=Date.now;Date.now=()=>at;try{await f.game.command(f.a.id,{type:'fish-press',at});}finally{Date.now=realNow;}}
 await flush();
 const done=last(f.events.get(f.a.id)!,'fishing')!.fishing!;assert.equal(done.phase,'result');assert.equal(done.result!.success,false);
 assert.equal(f.store.profiles.get(f.a.id)!.fishing.total,0);
});

test('automatic fishing lands fish by chance and casts again by itself (AFK)',async()=>{
 const f=fixture(),spot=FISHING_SPOTS[4],peer=f.game.peers.get(f.a.id)!;f.game.fishRoll=()=>0;
 await f.game.command(f.a.id,{type:'zone',zone:'fishing'});peer.x=spot.x;peer.y=spot.y;
 await f.game.command(f.a.id,{type:'fish-auto',on:true});
 await f.game.command(f.a.id,{type:'fish-cast',spot:spot.id});
 for(let round=0;round<3;round++){
  const s=peer.fishing!;assert.equal(s.phase,'waiting');
  f.game.tick(s.biteAt);assert.equal(peer.fishing!.phase,'bite');
  // Presses are ignored in automatic mode.
  await f.game.command(f.a.id,{type:'fish-press',at:Date.now()});assert.equal(peer.fishing!.press,0);
  f.game.tick(peer.fishing!.resolveAt);await flush();
  assert.equal(peer.fishing!.phase,'result');assert.equal(peer.fishing!.result!.success,true);
  // Automatic yields a quarter of a manual catch.
  const c=peer.fishing!.result!.catch!,fish=FISH_BY_ID.get(c.fish)!;
  assert.deepEqual({points:c.points,xp:c.xp},autoReward(fish));assert.ok(c.points<=Math.ceil(fish.points/4));
  f.game.tick(peer.fishing!.since+RESULT_MS);
 }
 assert.equal(f.store.profiles.get(f.a.id)!.fishing.total,3);
 assert.ok(HOOK_LEAD_MS>0);
 // Leaving the Pescaria stops the line and turns automatic mode off (the HUD comes back in manual).
 await f.game.command(f.a.id,{type:'zone',zone:'plaza'});assert.equal(peer.fishing,undefined);assert.equal(peer.fishAuto,undefined);
});
