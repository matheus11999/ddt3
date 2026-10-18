import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {checkCreate,checkGuildPurchase,upgradeCost} from '../server/guilds';
import type {GuildHall,Membership} from '../server/guilds';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {attributes,DEFAULT_EQUIPMENT} from '../shared/catalog';
import {addMissionProgress,claimMission,dailyFor,guildRanks,rankCan,validRankName,GUILD_CREATE_COST,GUILD_LEVEL_COSTS,BUILDING_LEVEL_COSTS,GVG_CONTRIBUTION,guildChance,guildDay,smithBonus,validGuildName} from '../shared/guilds';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';

const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('founding a guild costs gold and checks the name',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Fundador',gold:GUILD_CREATE_COST+5});
 assert.equal(checkCreate(p,'  Brasa   Eterna '),'Brasa Eterna');assert.equal(p.gold,5);
 assert.throws(()=>checkCreate(p,'Outra'),/custa/);
 assert.throws(()=>validGuildName('ab'),/de 3 a 16/);assert.throws(()=>validGuildName('<script>'),/Use só/);
});

test('buildings never pass the guild level and every upgrade costs Riqueza',()=>{
 const guild={level:0,riqueza:10_000,buildings:{shop:0,smith:0,storage:0}};
 assert.throws(()=>upgradeCost(guild,'smith'),/não pode passar do nível da guilda \(0\)/);
 assert.deepEqual(upgradeCost(guild,'guild'),{cost:GUILD_LEVEL_COSTS[0],level:1});
 const level2={...guild,level:2,buildings:{shop:2,smith:1,storage:0}};
 assert.throws(()=>upgradeCost(level2,'shop'),/nível da guilda \(2\)/);
 assert.deepEqual(upgradeCost(level2,'smith'),{cost:BUILDING_LEVEL_COSTS[1],level:2});
 assert.throws(()=>upgradeCost({...level2,riqueza:10},'storage'),/Faltam 40 de Riqueza/);
});

test('the guild shop sells the level 1 necklace for gold, and it adds 5% Vida',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Membro',gold:1000});
 assert.throws(()=>checkGuildPurchase(p,'necklace-guild-1',0),/nível 1/);
 checkGuildPurchase(p,'necklace-guild-1',1);assert.equal(p.gold,200);assert.ok(p.inventory.includes('necklace-guild-1'));
 assert.throws(()=>checkGuildPurchase(p,'necklace-guild-1',1),/insuficiente/);
 assert.ok(!normalizeProfile({id:randomUUID(),name:'Novo'}).inventory.includes('necklace-guild-1'));
 const bare=attributes(DEFAULT_EQUIPMENT,10),worn=attributes({...DEFAULT_EQUIPMENT,necklace:'necklace-guild-1'},10);
 assert.equal(worn.hp,Math.floor(bare.hp*1.05));
});

test('the Ferreiro da Guilda adds its points to an existing chance, up to 100%',()=>{
 assert.equal(smithBonus(3),6);assert.equal(guildChance(40,6),46);assert.equal(guildChance(98,6),100);assert.equal(guildChance(0,6),0);
});

function fixture(count:number){
 const missions:{ids:string[];mission:string}[]=[],profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),forged:number[]=[],won:{matchId:string;guildId:number;winners:string[];amount:number}[]=[];
 const store:ProfileStore={
  saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,
  saveEquipment:async()=>{throw Error('unused');},rename:async()=>{},finishMatch:async()=>{},
  forge:async(id,item,_stones,bonus=0)=>{forged.push(bonus);return {profile:profiles.get(id)!,result:{item,success:true,level:1,chance:50+bonus,consumed:{}}};},compose:async()=>{throw Error('unused');}
 };
 const members=new Map<string,Membership>();
 const unused=async()=>{throw Error('unused');};
 const guilds:GuildHall={membership:async id=>members.get(id)??null,state:async()=>({guild:null,applied:[]}),list:async()=>[],memberIds:async guildId=>[...members].filter(([,m])=>m.guildId===guildId).map(([id])=>id),
  create:unused,apply:unused,cancelApply:unused,answer:unused,kick:unused,leave:unused,upgrade:unused,buy:unused,deposit:unused,withdraw:unused,
  gvgWin:async(matchId,guildId,winners,amount)=>{won.push({matchId,guildId,winners,amount});return true;},
  missionProgress:async(ids,mission)=>{missions.push({ids:[...ids],mission});return ids;},claimMission:unused,setRank:unused,saveRanks:unused,disband:unused};
 const game=new Game(store);game.guilds=guilds;
 const players=Array.from({length:count},(_,i)=>normalizeProfile({id:randomUUID(),name:`Jogador ${i}`}));
 const join=(p:Profile,guildId:number,name:string)=>members.set(p.id,{guildId,name,role:'member',smith:guildId});
 const connect=async()=>{for(const p of players){profiles.set(p.id,p);events.set(p.id,[]);game.connect(p,e=>events.get(p.id)!.push(structuredClone(e)));}await flush();};
 const roomFor=(p:Profile)=>game.rooms.get(game.peers.get(p.id)!.roomId!)!;
 const error=(p:Profile)=>events.get(p.id)!.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1)?.message;
 const party=async(team:Profile[],gvg=false)=>{
  await game.command(team[0].id,{type:'create',name:'Guilda'});const r=roomFor(team[0]);
  for(let slot=1;slot<team.length;slot++)await game.command(team[0].id,{type:'room-slot',slot,open:true});
  for(const p of team.slice(1))await game.command(p.id,{type:'join',roomId:r.id});
  if(gvg)await game.command(team[0].id,{type:'room-gvg',active:true});
  for(const p of team.slice(1))await game.command(p.id,{type:'ready'});
  return r;
 };
 return {game,players,events,forged,won,missions,join,connect,party,roomFor,error};
}

test('room cards carry the guild name and GvG only meets parties of another guild',async()=>{
 const f=fixture(8),[a1,a2,b1,b2,c1,c2,d1,d2]=f.players;
 f.join(a1,1,'Lobos');f.join(a2,1,'Lobos');f.join(b1,2,'Corvos');f.join(b2,2,'Corvos');f.join(c1,1,'Lobos');f.join(c2,1,'Lobos');
 await f.connect();
 const ra=await f.party([a1,a2],true);
 assert.deepEqual(ra.players.map(s=>s.guild),['Lobos','Lobos']);assert.equal(ra.gvg,true);
 // Without a guild, no GvG; and a stranger cannot join a GvG room.
 await f.game.command(d1.id,{type:'create'});await f.game.command(d1.id,{type:'room-gvg',active:true});assert.match(f.error(d1)!,/Entre em uma guilda/);
 await f.game.command(d1.id,{type:'leave'});
 await f.game.command(ra.hostId,{type:'room-slot',slot:2,open:true});await f.game.command(d2.id,{type:'join',roomId:ra.id});assert.match(f.error(d2)!,/GvG/);
 await f.game.command(ra.hostId,{type:'room-slot',slot:2,open:false});if(!ra.players[1].ready)await f.game.command(a2.id,{type:'ready'});
 await f.game.command(a1.id,{type:'queue'});assert.equal(ra.status,'searching');
 // A normal party and a party of the same guild never meet a GvG search.
 const plain=await f.party([d1,d2]);await f.game.command(d1.id,{type:'queue'});assert.equal(plain.status,'searching');assert.equal(f.game.matches.size,0);
 const same=await f.party([c1,c2],true);await f.game.command(c1.id,{type:'queue'});assert.equal(same.status,'searching');assert.equal(f.game.matches.size,0);
 const rb=await f.party([b1,b2],true);await f.game.command(b1.id,{type:'queue'});assert.equal(f.game.matches.size,1);
 const m=[...f.game.matches.values()][0];assert.ok(m.roomIds.includes(rb.id));assert.equal(rb.status,'playing');assert.equal(plain.status,'searching');
 // The winners add Riqueza to their guild once the result is saved.
 for(const fighter of m.state.players)if([b1.id,b2.id].includes(fighter.id))fighter.hp=0;
 await f.game.command(m.state.turnId,{type:'pass'});assert.equal(m.state.phase,'finished');
 const winnerRoom=m.roomIds.indexOf(ra.id)===-1?same:ra,winners=winnerRoom.players.map(s=>s.id).sort();
 f.game.tick(m.state.rewards!.deadline+1);await flush();await flush();
 assert.equal(f.won.length,1);assert.equal(f.won[0].guildId,1);assert.equal(f.won[0].amount,GVG_CONTRIBUTION);assert.deepEqual([...f.won[0].winners].sort(),winners);
 assert.ok(f.events.get(winners[0])!.some(e=>e.type==='guild-result'&&/Vitória GvG/.test(e.message)));
 // Daily missions: everyone in the battle played, the winners won, and won a GvG.
 const counted=(mission:string)=>f.missions.filter(x=>x.mission===mission).flatMap(x=>x.ids).sort();
 assert.deepEqual(counted('play'),[...m.state.players.map(x=>x.id)].sort());assert.deepEqual(counted('win'),winners);assert.deepEqual(counted('gvg'),winners);
});

test('daily guild missions count up to the goal, pay once and renew each day in Brasília',()=>{
 const day=guildDay(Date.UTC(2026,9,18,2,30));assert.equal(day,'2026-10-17');
 const d=dailyFor(null,day);addMissionProgress(d,'play',2);assert.throws(()=>claimMission(d,'play'),/Termine/);
 addMissionProgress(d,'play',5);assert.equal(d.progress.play,3);assert.equal(claimMission(d,'play'),5);assert.equal(d.today,5);
 assert.throws(()=>claimMission(d,'play'),/já recebeu/);
 assert.deepEqual(dailyFor(d,day),d);assert.deepEqual(dailyFor(d,'2026-10-18'),{day:'2026-10-18',progress:{},claimed:[],today:0});
}); 

test('guild members reach the forge from the guild window and get the Ferreiro bonus',async()=>{
 const f=fixture(3),[member,loner,unbuilt]=f.players;f.join(member,7,'Ferreiros');f.join(unbuilt,0,'Sem Ferreiro');await f.connect();
 await f.game.command(member.id,{type:'forge',item:'brick',stones:{'1':1}});assert.deepEqual(f.forged,[smithBonus(7)]);
 assert.deepEqual(f.missions,[{ids:[member.id],mission:'forge'}]);
 await f.game.command(loner.id,{type:'forge',item:'brick',stones:{'1':1}});assert.match(f.error(loner)!,/Aproxime-se/);
 // A guild whose Ferreiro is still level 0 gives no remote forge.
 await f.game.command(unbuilt.id,{type:'forge',item:'brick',stones:{'1':1}});assert.match(f.error(unbuilt)!,/Aproxime-se/);
});

test('guild commands are validated by the protocol',()=>{
 assert.equal(commandSchema.safeParse({type:'guild-upgrade',target:'smith'}).success,true);
 assert.equal(commandSchema.safeParse({type:'guild-upgrade',target:'castle'}).success,false);
 assert.equal(commandSchema.safeParse({type:'guild-buy',item:'necklace-star'}).success,false);
 assert.equal(commandSchema.safeParse({type:'room-gvg',active:true}).success,true);
 assert.equal(commandSchema.safeParse({type:'guild-mission',mission:'forge'}).success,true);assert.equal(commandSchema.safeParse({type:'guild-mission',mission:'sleep'}).success,false);
});

test('ranks keep the leader with every permission and fill missing ranks with the defaults',()=>{
 const ranks=guildRanks([{id:0,name:'Rei',permissions:[]},{id:2,name:'Comandante',permissions:['recruit','bogus'] as never}]);
 assert.equal(ranks.length,5);assert.equal(ranks[0].name,'Rei');assert.equal(ranks[0].permissions.length,5);
 assert.deepEqual(ranks[2],{id:2,name:'Comandante',permissions:['recruit']});assert.equal(ranks[1].name,'Vice-Líder');
 assert.equal(rankCan(ranks,2,'recruit'),true);assert.equal(rankCan(ranks,2,'kick'),false);assert.equal(rankCan(ranks,0,'kick'),true);
 assert.throws(()=>validRankName('a'),/de 2 a 16/);
 assert.equal(commandSchema.safeParse({type:'guild-rank-set',playerId:randomUUID(),rank:0}).success,false);
});
