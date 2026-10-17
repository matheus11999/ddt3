import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';

test('online-list is strict and returns every connected player, highest level first, rate limited',async()=>{
 assert.equal(commandSchema.safeParse({type:'online-list'}).success,true);
 assert.equal(commandSchema.safeParse({type:'online-list',channel:2}).success,false);
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),game=new Game({getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore);
 const players=[3,12,7].map((level,index)=>({...normalizeProfile({id:randomUUID(),name:`Online ${index}`,gender:index===1?'female':'male'}),level}));
 for(const profile of players){profiles.set(profile.id,profile);events.set(profile.id,[]);game.connect(profile,event=>events.get(profile.id)!.push(structuredClone(event)));}
 game.peers.get(players[2].id)!.channel=2;await game.command(players[2].id,{type:'create'});
 game.disconnect(players[0].id);
 const lists=()=>events.get(players[1].id)!.filter((event):event is Extract<ServerEvent,{type:'online-players'}>=>event.type==='online-players');
 await game.command(players[1].id,{type:'online-list'});
 const list=lists().at(-1)!;assert.equal(list.total,2);
 assert.deepEqual(list.players,[{id:players[1].id,name:'Online 1',level:12,gender:'female'},{id:players[2].id,name:'Online 2',level:7,gender:'male'}]);
 await game.command(players[1].id,{type:'online-list'});assert.equal(lists().length,1);
});
