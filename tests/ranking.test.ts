import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Profile,RankingEntry,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

/** Counts wins the way the database does: every saved match, bots included. */
class RankingStore implements ProfileStore {
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 async saveEquipment():Promise<never>{throw Error('unused');}
 async rename(){}
 profiles=new Map<string,Profile>();wins=new Map<string,number>();
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async finishMatch(_id:string,winners:string[]){for(const id of winners)this.wins.set(id,(this.wins.get(id)??0)+1);}
 async dailyRanking():Promise<RankingEntry[]>{
  return [...this.wins].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,wins],i)=>{const p=this.profiles.get(id)!;return {rank:(i+1) as 1|2|3,id,name:p.name,level:p.level,wins,equipment:p.equipment};});
 }
}
const until=async(ready:()=>boolean)=>{for(let i=0;i<200&&!ready();i++)await new Promise(resolve=>setTimeout(resolve,5));};

test('a win against a bot puts the player on the lobby podium',async()=>{
 const store=new RankingStore(),game=new Game(store),events:ServerEvent[]=[];
 const me=normalizeProfile({id:randomUUID(),name:'Ária',gender:'male',gold:500});store.profiles.set(me.id,structuredClone(me));
 game.connect(me,event=>events.push(structuredClone(event)));
 await game.command(me.id,{type:'create',practice:true,name:'Treino',mode:'1v1',map:'sky'});
 const roomId=game.peers.get(me.id)!.roomId!;await game.command(me.id,{type:'bot'});await game.command(me.id,{type:'start'});
 const match=game.matches.get(roomId)!;assert.ok(match.state.players.some(p=>p.bot));
 match.state.players.find(p=>p.bot)!.hp=0;await game.command(match.state.turnId,{type:'pass'});assert.equal(match.state.phase,'finished');
 // The bot already holds a random card; pick one that is still free.
 const card=match.state.rewards!.cards.find(card=>!card.playerId)!.index;
 match.state.rewards!.opensAt=Date.now()-1;await game.command(me.id,{type:'reward-pick',card});
 assert.deepEqual(events.filter(e=>e.type==='error'),[]);
 await until(()=>events.some(e=>e.type==='ranking'));
 assert.equal(match.state.rewards!.saved,true);
 const update=events.filter((e):e is Extract<ServerEvent,{type:'ranking'}>=>e.type==='ranking').at(-1);
 assert.ok(update);assert.deepEqual(update.ranking.map(entry=>[entry.rank,entry.id,entry.wins]),[[1,me.id,1]]);
 assert.equal(update.ranking[0].equipment.outfit,me.equipment.outfit);
 // A player arriving later sees the podium straight away.
 const other=normalizeProfile({id:randomUUID(),name:'Bento',gender:'female',gold:500}),seen:ServerEvent[]=[];
 game.connect(other,event=>seen.push(event));
 const welcome=seen.find((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome')!;
 assert.equal(welcome.ranking?.[0]?.id,me.id);
});
