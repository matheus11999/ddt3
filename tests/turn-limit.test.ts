import assert from 'node:assert/strict';
import test from 'node:test';
import {PVP_TURN_LIMIT,turnLimitWinner} from '../shared/combat';

test('PvP turn cap is 1000 turns in all', () => {assert.equal(PVP_TURN_LIMIT,1000);});

test('at the turn cap the side with more life left wins, only an exact tie draws', () => {
 const f=(team:0|1,hp:number,maxHp=1000)=>({team,hp,maxHp});
 assert.equal(turnLimitWinner([f(0,300),f(1,700)]),1);
 assert.equal(turnLimitWinner([f(0,900,1000),f(0,0,1000),f(1,400,1000),f(1,400,1000)]),0);
 assert.equal(turnLimitWinner([f(0,500,1000),f(1,1000,2000)]),null);
 assert.equal(turnLimitWinner([f(0,0),f(1,0)]),null);
});
