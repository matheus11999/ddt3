import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {ServerEvent} from '../shared/protocol';
import {CATALOG,STARTER_WEAPON,WEAPONS,weaponAssetPath,weaponIconPath,weaponVisualStage} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import {shotModifiers} from '../shared/combat';
import {artPrompt,boostsForShot,powBoostConflict,powTridentRule,promptOrder,soundPrompt,WEAPON_KITS,WEAPON_PHASES,WEAPON_SOUND_SLOTS} from '../shared/weaponKit';
import type {PowTridentRule,WeaponSoundSlot} from '../shared/weaponKit';

const kitWeapons=WEAPONS.filter(weapon=>WEAPON_KITS[weapon.id]);

test('the rebuilt arsenal starts with the Quebra-Tijolos: starter, balanced, small craters, single-projectile POW',()=>{
 assert.equal(STARTER_WEAPON,'brick');assert.ok(CATALOG.brick);
 const brick=CATALOG.brick as Weapon;assert.deepEqual([brick.attack,brick.defense,brick.agility,brick.luck],[85,95,85,85]);
 assert.ok(brick.crater<=30&&brick.fragments!.crater<=10);assert.equal(powTridentRule('brick'),'pow-unico');
 assert.deepEqual(WEAPON_PHASES.map(phase=>phase.stage),[0,10,12,15]);
 assert.deepEqual([0,9,10,11,12,14,15].map(weaponVisualStage),[0,0,10,10,12,12,15]);
 assert.equal(weaponAssetPath('brick',12),'/assets/weapons/brick/held-12.png');assert.equal(weaponIconPath('brick',15),'/assets/weapons/brick/icon-15.png');
});

test('every kit has a brief for every phase and sound, and every real weapon has a kit',()=>{
 for(const id of Object.keys(WEAPON_KITS))assert.ok(CATALOG[id]?.slot==='weapon',id);
 assert.ok(kitWeapons.some(weapon=>weapon.id===STARTER_WEAPON));
 for(const weapon of kitWeapons){
  const kit=WEAPON_KITS[weapon.id];assert.equal(kit.id,weapon.id);assert.ok(kit.identity.length>20);
  for(const phase of WEAPON_PHASES)for(const field of ['held','projectile','muzzle','impact'] as const)assert.ok(kit.phases[phase.stage][field].length>5,`${weapon.id} ${phase.stage} ${field}`);
  for(const slot of Object.keys(WEAPON_SOUND_SLOTS) as WeaponSoundSlot[])assert.ok(kit.sound[slot].length>5);
 }
});

test('generated prompts chain references in order, name where to save and never ask for text',()=>{
 const weapon=CATALOG.brick as Weapon,kit=WEAPON_KITS.brick;
 const first=artPrompt(weapon,kit,'icon',0);assert.match(first,/FIRST piece/);assert.match(first,/Save as public\/assets\/weapons\/brick\/icon-0\.png/);assert.match(first,/No text/);
 assert.match(artPrompt(weapon,kit,'icon',12),/Reference images: public\/assets\/weapons\/brick\/icon-0\.png, public\/assets\/weapons\/brick\/icon-10\.png/);
 assert.match(artPrompt(weapon,kit,'held',10),/Reference images: public\/assets\/weapons\/brick\/icon-10\.png, public\/assets\/weapons\/brick\/held-0\.png/);
 assert.match(artPrompt(weapon,kit,'atlas'),/held-15\.png/);assert.match(artPrompt(weapon,kit,'terrain'),/terrain\.png/);
 const order=[...WEAPON_PHASES.flatMap(phase=>[promptOrder('icon',phase.stage),promptOrder('held',phase.stage)]),promptOrder('atlas'),promptOrder('terrain')];
 assert.deepEqual(order,[1,2,3,4,5,6,7,8,9,10]);
 assert.match(soundPrompt(kit,'impact'),/no music, no voice/);
});

test('POW rules: pow-unico drops extra projectiles on POW, pow-tridente adds the spread, livre keeps both',()=>{
 assert.equal(powTridentRule('unknown'),'livre');
 assert.deepEqual(boostsForShot('brick',['trident','extra2','damage20'],true),['damage20']);
 assert.deepEqual(boostsForShot('brick',['trident','damage20'],false),['trident','damage20']);
 assert.match(powBoostConflict('brick','extra1')!,/projétil único/);assert.equal(powBoostConflict('brick','damage30'),undefined);
 const saved=WEAPON_KITS.brick.powTrident;
 try{
  WEAPON_KITS.brick.powTrident='pow-tridente';
  assert.equal(shotModifiers(boostsForShot('brick',['damage20'],true)).spread.length,3);
  assert.equal(shotModifiers(boostsForShot('brick',['damage20'],false)).spread.length,1);
  WEAPON_KITS.brick.powTrident='livre';assert.equal(powBoostConflict('brick','trident'),undefined);
 }finally{WEAPON_KITS.brick.powTrident=saved;}
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

for(const [rule,boost,message] of [['exclusivo','trident',/não combina Power com Tridente/],['pow-tridente','trident',/já dispara o Tridente/],['pow-unico','extra1',/projétil único/]] as [PowTridentRule,BoostId,RegExp][])
 test(`server refuses POW with ${boost} when the weapon rule is ${rule}`,async()=>{
  const f=await fixture(),saved=WEAPON_KITS.brick.powTrident;
  try{
   WEAPON_KITS.brick.powTrident=rule;f.shooter.equipment.weapon='brick';
   f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerArmed,true);
   await f.game.command(f.shooter.id,{type:'boost',boost});assert.deepEqual(f.shooter.boosts,[]);assert.match(lastError(f.events)!.message,message);
   const g=await fixture();g.shooter.equipment.weapon='brick';await g.game.command(g.shooter.id,{type:'boost',boost});g.shooter.powerCharge=100;
   await g.game.command(g.shooter.id,{type:'power'});assert.equal(g.shooter.powerArmed,false);assert.match(lastError(g.events)!.message,message);
  }finally{WEAPON_KITS.brick.powTrident=saved;}
 });
