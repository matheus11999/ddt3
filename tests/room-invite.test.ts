import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRoomInvite,roomInviteUrl} from '../src/roomInvite';
const room='12345678-1234-1234-1234-123456789abc';
test('room invitation strips unrelated query data and includes only the public room ID',()=>{
 assert.equal(roomInviteUrl(room,'https://game.example/play/?dev=live&token=private#profile'),`https://game.example/play/?room=${room}`);
 assert.throws(()=>roomInviteUrl('not-a-room','https://game.example/'));
});
test('invitation parsing removes the one-shot parameter without touching unrelated navigation',()=>{
 assert.deepEqual(readRoomInvite(`https://game.example/?room=${room}&dev=live#game`),{roomId:room,cleanUrl:'https://game.example/?dev=live#game'});
 assert.deepEqual(readRoomInvite('https://game.example/?room=javascript%3Aalert(1)'),{roomId:null,cleanUrl:'https://game.example/'});
});
