/**
 * Chefão Mundial against a real Postgres (DATABASE_URL, default the local dev database):
 * start/stop idempotency, schedules, the damage ledger under concurrent commits, the final blow and the 20-minute results.
 * Run: npm run test:worldboss:integration
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {WorldBossService} from '../server/worldBoss';
import {WORLD_BOSS_RESULTS_MS} from '../shared/worldBoss';

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa'});
await pool.query('DROP TABLE IF EXISTS world_boss_damage,world_boss_ranking,world_boss_occurrences,world_boss_schedules,world_boss_settings CASCADE');
let clock=Date.now();
const boss=new WorldBossService(pool,()=>clock);const changes:string[]=[];boss.onChange=s=>changes.push(s.phase);
await boss.init();
assert.equal(boss.status().phase,'idle');

// Iniciar agora: one request id opens one event, a second start while active is refused.
const request=randomUUID(),first=await boss.startNow(request,clock+30*60_000,'matheus',{maxHp:10_000});
const again=await boss.startNow(request,clock+30*60_000,'matheus',{maxHp:10_000});
assert.equal(again.id,first.id);assert.equal(again.repeated,true);
await assert.rejects(boss.startNow(randomUUID(),clock+30*60_000,'matheus'),/ativo/);
assert.equal(boss.status().phase,'active');assert.equal(boss.status().hp,10_000);

// Damage: 40 commits at once from 4 players; a retry of the same key counts once.
const players=Array.from({length:4},(_,n)=>({id:randomUUID(),name:`Herói ${n+1}`}));
const battle=randomUUID();
await Promise.all(Array.from({length:40},(_,n)=>{const p=players[n%4];return boss.commit({occurrenceId:first.id,battleId:battle,turn:n,playerId:p.id,name:p.name,level:10,damage:100});}));
await boss.commit({occurrenceId:first.id,battleId:battle,turn:0,playerId:players[0].id,name:players[0].name,level:10,damage:100});
assert.equal(boss.status().hp,10_000-4000);
const ranking=await boss.ranking(players[2].id);
assert.equal(ranking.rows.length,4);assert.ok(ranking.rows.every(r=>r.damage===1000));assert.equal(ranking.me?.playerId,players[2].id);

// The final blow: never below 0, the event ends as defeated and stays visible 20 minutes.
const big=await boss.commit({occurrenceId:first.id,battleId:battle,turn:999,playerId:players[1].id,name:players[1].name,level:10,damage:999_999});
assert.deepEqual(big,{applied:6000,hp:0,defeated:true});
assert.equal(boss.status().phase,'results');assert.equal(boss.status().endReason,'defeated');assert.equal(boss.status().finalBlow,'Herói 2');
const late=await boss.commit({occurrenceId:first.id,battleId:battle,turn:1000,playerId:players[3].id,name:players[3].name,level:10,damage:50});
assert.equal(late.applied,0);
assert.equal((await boss.ranking(null)).rows[0].playerId,players[1].id);
clock+=WORLD_BOSS_RESULTS_MS+60_000;await boss.tick();assert.equal(boss.status().phase,'idle');

// A schedule opens its window by itself, closes on time, and a stopped window does not open again.
const start=clock+5*60_000;const scheduleId=await boss.addSchedule({startsAt:start,endsAt:start+15*60_000,repeat:'daily',enabled:true},'matheus');
await boss.tick();assert.equal(boss.status().phase,'idle');
clock=start+1000;await boss.tick();assert.equal(boss.status().phase,'active');const scheduled=boss.status().occurrenceId!;
await boss.stopNow(scheduled,'matheus');assert.equal(boss.status().phase,'results');assert.equal(boss.status().endReason,'admin');
await boss.tick();assert.equal(boss.status().occurrenceId,scheduled,'the stopped window stays stopped');
// Next day, same hour: opens again, then time runs out.
clock=start+86_400_000+1000;await boss.tick();assert.equal(boss.status().phase,'active');assert.notEqual(boss.status().occurrenceId,scheduled);
clock+=15*60_000;await boss.tick();assert.equal(boss.status().phase,'results');assert.equal(boss.status().endReason,'time');
// Switched off in the settings, schedules do not open; removing one keeps the history.
await boss.saveSettings({name:'Dragão Ancestral',maxHp:500_000,enabled:false},'matheus');
clock=start+2*86_400_000+1000;await boss.tick();assert.notEqual(boss.status().phase,'active');
await boss.removeSchedule(scheduleId);const state=await boss.adminState();assert.equal(state.schedules.length,0);assert.ok(state.history.length>=3);
// A restart reads everything back from Postgres.
const restarted=new WorldBossService(pool,()=>clock);await restarted.init();assert.equal(restarted.status().occurrenceId,boss.status().occurrenceId);
assert.ok(changes.includes('active')&&changes.includes('results'));
await pool.end();
console.log('world boss integration: ok');
