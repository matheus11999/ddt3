import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {ServerEvent} from '../shared/protocol';
import {WEAPONS} from '../shared/catalog';
import {shotModifiers} from '../shared/combat';
import {artPrompt,boostsForShot,PHASE_ART_SLOTS,powTridentRule,soundPrompt,WEAPON_KITS,WEAPON_PHASES,WEAPON_SOUND_SLOTS} from '../shared/weaponKit';
import type {PowTridentRule,WeaponSoundSlot} from '../shared/weaponKit';

test('every weapon has a kit with a brief for every phase and sound',()=>{
 assert.deepEqual(Object.keys(WEAPON_KITS).sort(),WEAPONS.map(weapon=>weapon.id).sort());
 for(const weapon of WEAPONS){
  const kit=WEAPON_KITS[weapon.id];assert.equal(kit.id,weapon.id);
  for(const phase of WEAPON_PHASES)for(const field of ['held','projectile','muzzle','impact'] as const)assert.ok(kit.phases[phase.stage][field].length>5,`${weapon.id} ${phase.stage} ${field}`);
  for(const slot of Object.keys(WEAPON_SOUND_SLOTS) as WeaponSoundSlot[])assert.ok(kit.sound[slot].length>5);
 }
});

test('generated prompts name the weapon, the phase and where to save, and never ask for text',()=>{
 const weapon=WEAPONS.find(item=>item.id==='ember')!,kit=WEAPON_KITS.ember;
 for(const slot of Object.keys(PHASE_ART_SLOTS) as (keyof typeof PHASE_ART_SLOTS)[])for(const phase of WEAPON_PHASES){
  const prompt=artPrompt(weapon,kit,slot==='icon'||slot==='held'?slot:'atlas',phase.stage);
  assert.match(prompt,/Dragão de Brasa/);assert.match(prompt,/Save as public\/assets\//);assert.match(prompt,/No text/);
 }
 assert.match(artPrompt(weapon,kit,'icon',10),/icon-10\.png/);assert.match(artPrompt(weapon,kit,'held',10),/weapon-ember-awakened\.png/);
 assert.match(soundPrompt(kit,'impact'),/no music, no voice/);
});

test('POW × Tridente: undecided weapons stay free; pow-tridente adds the spread only on POW',()=>{
 assert.equal(powTridentRule('ember'),WEAPON_KITS.ember.powTrident??'livre');assert.equal(powTridentRule('unknown'),'livre');
 const saved=WEAPON_KITS.volt.powTrident;
 try{
  WEAPON_KITS.volt.powTrident='pow-tridente';
  assert.equal(shotModifiers(boostsForShot('volt',['damage20'],true)).spread.length,3);
  assert.equal(shotModifiers(boostsForShot('volt',['damage20'],false)).spread.length,1);
  assert.deepEqual(boostsForShot('volt',['trident'],true),['trident']);
 }finally{WEAPON_KITS.volt.powTrident=saved;}
});

async function fixture(){
 const events:ServerEvent[]=[],store={getProfile:async()=>null,finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store,()=>{},()=>.99);
 const players=['Kit Um','Kit Dois'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const player of players)game.connect(player,event=>events.push(structuredClone(event)));
 await game.command(players[0].id,{type:'create',practice:true,name:'Kit teste',mode:'1v1',map:'garden'});
 const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players.find(p=>p.id===match.state.turnId)!;
 return {game,shooter,events};
}
const lastError=(events:ServerEvent[])=>events.filter(event=>event.type==='error').at(-1) as {message:string}|undefined;

for(const [rule,message] of [['exclusivo',/não combina Power com Tridente/],['pow-tridente',/já dispara o Tridente/]] as [PowTridentRule,RegExp][])
 test(`server refuses POW with Tridente when the weapon rule is ${rule}`,async()=>{
  const f=await fixture(),weapon=f.shooter.equipment.weapon,saved=WEAPON_KITS[weapon].powTrident;
  try{
   WEAPON_KITS[weapon].powTrident=rule;
   f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerArmed,true);
   await f.game.command(f.shooter.id,{type:'boost',boost:'trident'});assert.deepEqual(f.shooter.boosts,[]);assert.match(lastError(f.events)!.message,message);
   const g=await fixture();await g.game.command(g.shooter.id,{type:'boost',boost:'trident'});g.shooter.powerCharge=100;
   await g.game.command(g.shooter.id,{type:'power'});assert.equal(g.shooter.powerArmed,false);assert.match(lastError(g.events)!.message,message);
  }finally{WEAPON_KITS[weapon].powTrident=saved;}
 });
