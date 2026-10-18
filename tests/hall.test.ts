import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {comparePvp,DEFAULT_HALL_CONFIG,normalizeHallConfig,periodLabel,periodOf,rewardFor,topSum,unlockedAchievements,winRate,zonedMidnight} from '../shared/hall';
import type {HallBoard,PvpScore} from '../shared/hall';
import {commandSchema} from '../shared/protocol';
import type {Profile,RankingEntry,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import type {HallService} from '../server/game';
import type {MatchRecord} from '../server/hall';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

const SP='America/Sao_Paulo',T=(iso:string)=>new Date(iso).getTime();

test('days run from 00:00 to 00:00 in Brasília, as half-open intervals in UTC',()=>{
 const before=periodOf('day',T('2026-10-19T02:59:59.999Z'),SP),after=periodOf('day',T('2026-10-19T03:00:00Z'),SP);
 assert.equal(before.key,'2026-10-18');assert.equal(after.key,'2026-10-19');
 assert.equal(before.end,after.start);assert.equal(new Date(after.start).toISOString(),'2026-10-19T03:00:00.000Z');
 assert.equal(after.end-after.start,86_400_000);
});

test('weeks start on Monday 00:00 and the key is that Monday',()=>{
 const sunday=periodOf('week',T('2026-10-19T02:59:59Z'),SP),monday=periodOf('week',T('2026-10-19T03:00:00Z'),SP);
 assert.equal(sunday.key,'2026-10-12');assert.equal(monday.key,'2026-10-19');
 assert.equal(sunday.end,monday.start);assert.equal(monday.end-monday.start,7*86_400_000);
 // Across a month and a year.
 assert.equal(periodOf('week',T('2027-01-01T12:00:00Z'),SP).key,'2026-12-28');
 assert.equal(periodLabel('week','2026-12-28'),'28/12 a 03/01');assert.equal(periodLabel('day','2026-10-18'),'18/10');
});

test('a zone with daylight saving still starts each day at local midnight',()=>{
 // New York moves its clocks on 08/03/2026: that day has 23 hours.
 const day=periodOf('day',T('2026-03-08T12:00:00Z'),'America/New_York');
 assert.equal(new Date(day.start).toISOString(),'2026-03-08T05:00:00.000Z');assert.equal(day.end-day.start,23*3_600_000);
 assert.equal(zonedMidnight(2026,3,9,'America/New_York'),T('2026-03-09T04:00:00Z'));
});

test('PvP order: wins, distinct opponents, fewer losses, who got there first, then the id',()=>{
 const p=(id:string,wins:number,distinctWins:number,losses:number,reachedAt:number|null):PvpScore=>({id,wins,distinctWins,losses,reachedAt});
 const rows=[p('f',3,1,0,5),p('e',3,2,4,9),p('d',3,2,1,9),p('c',3,2,1,7),p('b',3,2,1,7),p('a',0,0,2,null),p('g',4,1,9,1)];
 assert.deepEqual(rows.sort(comparePvp).map(r=>r.id),['g','b','c','d','e','f','a']);
 assert.equal(winRate(16,9),64);assert.equal(winRate(0,0),0);
});

test('guild scores add only the best members, so size alone never wins',()=>{
 const crowd=Array.from({length:50},()=>100),elite=Array.from({length:10},()=>900);
 assert.equal(topSum(crowd,10),1000);assert.equal(topSum(elite,10),9000);
 assert.ok(topSum(elite,10)>topSum(crowd,10));assert.equal(topSum([5,1,9],2),14);
});

test('the stored config falls back to the defaults field by field, and bad values are refused',()=>{
 const merged=normalizeHallConfig({topSize:20,alerts:{pairPerDay:9}});
 assert.equal(merged.topSize,20);assert.equal(merged.alerts.pairPerDay,9);assert.equal(merged.alerts.leavesPerDay,DEFAULT_HALL_CONFIG.alerts.leavesPerDay);
 assert.deepEqual(normalizeHallConfig({timeZone:'Lua/Crateras'}),DEFAULT_HALL_CONFIG);
 assert.equal(rewardFor(DEFAULT_HALL_CONFIG.rewards['pvp-week'],7)?.gold,150);assert.equal(rewardFor(DEFAULT_HALL_CONFIG.rewards['pvp-week'],11),undefined);
 // Prestige first: no reward gives Poder, only currency.
 for(const tiers of Object.values(DEFAULT_HALL_CONFIG.rewards))for(const tier of tiers)assert.deepEqual(Object.keys(tier).filter(k=>!['from','to','gold','coupons','riqueza'].includes(k)),[]);
});

test('achievements come from real data only',()=>{
 const none=unlockedAchievements({level:1,power:3000,maxForge:0,pvpWins:0,inGuild:false,dayTitles:0,weekTitles:0});
 assert.deepEqual(none,[]);
 const some=unlockedAchievements({level:21,power:4100,maxForge:10,pvpWins:12,inGuild:true,dayTitles:1,weekTitles:0});
 assert.deepEqual(some.sort(),['champion-day','forge-10','guild','level-10','level-20','power-4000','pvp-1','pvp-10'].sort());
});

test('hall commands are validated and the client can never send a result',()=>{
 assert.ok(commandSchema.safeParse({type:'hall-board',category:'pvp',period:'week',page:2}).success);
 assert.ok(!commandSchema.safeParse({type:'hall-board',category:'pvp',page:11}).success);
 assert.ok(!commandSchema.safeParse({type:'hall-board',category:'pvp',wins:99}).success);
 assert.ok(!commandSchema.safeParse({type:'hall-win',playerId:randomUUID()}).success);
 assert.ok(commandSchema.safeParse({type:'hall-legends',board:'pvp-week',key:'2026-10-12'}).success);
});

class FakeStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 async saveEquipment():Promise<never>{throw Error('unused');}
 async rename(){}
 profiles=new Map<string,Profile>();records:MatchRecord[]=[];
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async finishMatch(_id:string,_w:string[],_p:string[],_b?:unknown,record?:MatchRecord){if(record)this.records.push(record);}
 async dailyRanking():Promise<RankingEntry[]>{return [];}
}
const until=async(ready:()=>boolean)=>{for(let i=0;i<200&&!ready();i++)await new Promise(resolve=>setTimeout(resolve,5));};

test('a training battle reaches the hall as practice, with every human and the moment it ended',async()=>{
 const store=new FakeStore(),game=new Game(store),events:ServerEvent[]=[];
 const me=normalizeProfile({id:randomUUID(),name:'Ária',gender:'male',gold:500});store.profiles.set(me.id,structuredClone(me));
 game.connect(me,event=>events.push(structuredClone(event)));
 await game.command(me.id,{type:'create',practice:true,name:'Treino',mode:'1v1',map:'sky'});
 const roomId=game.peers.get(me.id)!.roomId!;await game.command(me.id,{type:'bot'});await game.command(me.id,{type:'start'});
 const match=game.matches.get(roomId)!;
 match.state.players.find(p=>p.bot)!.hp=0;await game.command(match.state.turnId,{type:'pass'});
 const card=match.state.rewards!.cards.find(card=>!card.playerId)!.index;match.state.rewards!.opensAt=Date.now()-1;
 const ended=Date.now();await game.command(me.id,{type:'reward-pick',card});
 await until(()=>store.records.length>0);
 const [record]=store.records;
 assert.equal(record.kind,'practice');assert.equal(record.winnerTeam,0);assert.equal(record.mode,'1v1');
 assert.deepEqual(record.participants,[{id:me.id,team:0,left:false}]);
 assert.ok(record.finishedAt<=ended+5,'filed under the moment the battle ended, not when the rewards were saved');
});

test('the hall answers each player with their own board and closed hall says so',async()=>{
 const store=new FakeStore(),game=new Game(store),events:ServerEvent[]=[];
 const me=normalizeProfile({id:randomUUID(),name:'Bento',gender:'female',gold:500});store.profiles.set(me.id,structuredClone(me));
 game.connect(me,event=>events.push(structuredClone(event)));
 await game.command(me.id,{type:'hall-board',category:'power'});
 assert.match((events.at(-1) as {message:string}).message,/fechado/);
 const asked:string[]=[];
 const hall:HallService={
  async board(viewer,q){asked.push(viewer);const board:HallBoard={category:q.category,period:'all',rows:[],page:1,pages:1,total:0,topSize:50,me:null,updatedAt:Date.now()};return board;},
  async profile(){return null;},async guildProfile(){return null;},async legends(board){return {board,periods:[],key:null,rows:[],leaders:[]};},
 };
 game.hall=hall;
 await new Promise(resolve=>setTimeout(resolve,160));
 await game.command(me.id,{type:'hall-board',category:'power'});
 assert.equal(events.at(-1)!.type,'hall-board');assert.deepEqual(asked,[me.id]);
 // Too fast: no error, only the latest ask is answered a moment later.
 const before=events.length;
 await game.command(me.id,{type:'hall-board',category:'power'});await game.command(me.id,{type:'hall-board',category:'pvp'});
 assert.equal(events.length,before);
 await until(()=>events.length>before);
 assert.equal((events.at(-1) as {board:HallBoard}).board.category,'pvp');assert.equal(asked.length,2);
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(events.length,before+1,'answered once');
 game.hallChanged(['pvp']);assert.deepEqual(events.at(-1),{type:'hall-changed',categories:['pvp']});
});
