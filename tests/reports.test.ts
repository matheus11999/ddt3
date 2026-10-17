import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import type {Profile,ServerEvent} from '../shared/protocol';
import {commandSchema} from '../shared/protocol';
import {REPORT_CHAT_WINDOW_MS} from '../shared/reports';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {NewReport} from '../server/reports';

function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),sent:NewReport[]=[];
 const store={getProfile:async(id:string)=>structuredClone(profiles.get(id)??null),finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store);
 game.reports={submit:async report=>{if(sent.some(r=>r.reporterId===report.reporterId&&r.targetId===report.targetId))throw Error('Você já denunciou este jogador há pouco.');sent.push(report);}};
 const [a,b,offline]=['Ária','Bento','Ciro'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male',wins:3,matches:5}));
 for(const p of [a,b,offline])profiles.set(p.id,p);
 for(const p of [a,b]){events.set(p.id,[]);game.connect(structuredClone(p),event=>events.get(p.id)!.push(structuredClone(event)));}
 const last=(id:string,type:ServerEvent['type'])=>events.get(id)!.filter(event=>event.type===type).at(-1);
 return {game,sent,a,b,offline,last};
}

test('chat lines name their author so the name can open the player menu',async()=>{
 const {game,a,b,last}=fixture();
 await game.command(a.id,{type:'chat',text:'oi',channel:'world'});
 const chat=last(b.id,'chat') as Extract<ServerEvent,{type:'chat'}>;
 assert.equal(chat.message.playerId,a.id);
});

test('player info shows only what is worn, online or offline',async()=>{
 const {game,a,b,offline,last}=fixture();
 await game.command(a.id,{type:'player-info',playerId:b.id});
 const info=(last(a.id,'player-info') as Extract<ServerEvent,{type:'player-info'}>).info;
 assert.equal(info.name,'Bento');assert.equal(info.online,true);assert.equal(info.wins,3);assert.equal(info.equipment.weapon,b.equipment.weapon);
 assert.equal('inventory' in info,false);assert.equal('gold' in info,false);
 assert.deepEqual(Object.keys(info.upgrades),[b.equipment.weapon]);
 await new Promise(resolve=>setTimeout(resolve,320));
 await game.command(a.id,{type:'player-info',playerId:offline.id});
 const away=(last(a.id,'player-info') as Extract<ServerEvent,{type:'player-info'}>).info;
 assert.equal(away.name,'Ciro');assert.equal(away.online,false);
});

test('a report carries the target chat of the last 30 minutes and nobody else\'s',async()=>{
 const {game,sent,a,b,last}=fixture();
 await game.command(b.id,{type:'chat',text:'mensagem velha',channel:'world'});
 // Age the first line past the window.
 const log=game.recentChat(b.id);log[0].at-=REPORT_CHAT_WINDOW_MS+1000;
 await new Promise(resolve=>setTimeout(resolve,10));
 await game.command(b.id,{type:'chat',text:'xingamento',channel:'world'});
 await game.command(a.id,{type:'chat',text:'para com isso',channel:'world'});
 await game.command(a.id,{type:'report',playerId:b.id,reason:'offensive',details:'xingou',context:'chat'});
 assert.equal(sent.length,1);
 assert.equal(sent[0].targetName,'Bento');assert.equal(sent[0].reporterName,'Ária');assert.equal(sent[0].reason,'offensive');assert.equal(sent[0].context,'chat');
 assert.deepEqual(sent[0].chat.map(line=>line.text),['xingamento']);
 assert.equal((last(a.id,'report-result') as Extract<ServerEvent,{type:'report-result'}>).playerId,b.id);
 // The sink's anti-spam message reaches the player.
 await game.command(a.id,{type:'report',playerId:b.id,reason:'spam'});
 assert.match((last(a.id,'error') as Extract<ServerEvent,{type:'error'}>).message,/já denunciou/);
});

test('players cannot report themselves or bots, and reasons are a fixed list',async()=>{
 const {game,sent,a,last}=fixture();
 await game.command(a.id,{type:'report',playerId:a.id,reason:'other'});
 assert.match((last(a.id,'error') as Extract<ServerEvent,{type:'error'}>).message,/si mesmo/);
 assert.equal(sent.length,0);
 assert.equal(commandSchema.safeParse({type:'report',playerId:'bot-1',reason:'other'}).success,false);
 assert.equal(commandSchema.safeParse({type:'report',playerId:randomUUID(),reason:'qualquer'}).success,false);
 assert.equal(commandSchema.safeParse({type:'report',playerId:randomUUID(),reason:'other',details:'x'.repeat(301)}).success,false);
});

test('bots in a room show their info but can never be reported',async()=>{
 const {game,a,last}=fixture();
 await game.command(a.id,{type:'create',practice:true,name:'Treino',mode:'1v1',map:'sky'});
 await game.command(a.id,{type:'bot'});
 const bot=game.rooms.get(game.peers.get(a.id)!.roomId!)!.players.find(seat=>seat.bot)!;
 assert.equal(commandSchema.safeParse({type:'player-info',playerId:bot.id}).success,true);
 await game.command(a.id,{type:'player-info',playerId:bot.id});
 const info=(last(a.id,'player-info') as Extract<ServerEvent,{type:'player-info'}>).info;
 assert.equal(info.bot,true);assert.equal(info.name,bot.name);assert.equal(info.equipment.weapon,bot.equipment.weapon);
 assert.equal(commandSchema.safeParse({type:'report',playerId:bot.id,reason:'other'}).success,false);
});
