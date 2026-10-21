import assert from 'node:assert/strict';
import test from 'node:test';
import {pvpTurnLimit,turnLimitWinner} from '../shared/combat';

test('PvP turn cap grows with the number of fighters', () => {
 assert.equal(pvpTurnLimit(2),80);assert.equal(pvpTurnLimit(4),80);assert.equal(pvpTurnLimit(6),120);assert.equal(pvpTurnLimit(8),160);
});

test('at the turn cap the side with more life left wins, only an exact tie draws', () => {
 const f=(team:0|1,hp:number,maxHp=1000)=>({team,hp,maxHp});
 assert.equal(turnLimitWinner([f(0,300),f(1,700)]),1);
 assert.equal(turnLimitWinner([f(0,900,1000),f(0,0,1000),f(1,400,1000),f(1,400,1000)]),0);
 assert.equal(turnLimitWinner([f(0,500,1000),f(1,1000,2000)]),null);
 assert.equal(turnLimitWinner([f(0,0),f(1,0)]),null);
});
