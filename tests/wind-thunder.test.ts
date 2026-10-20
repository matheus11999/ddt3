import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {ServerEvent} from '../shared/protocol';
import {CATALOG,itemAttributes,weaponStats} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import {destructionProfile} from '../shared/destruction';
import {CRATER_MASKS,craterMask,volley,WORLD} from '../shared/physics';
import {powBoostConflict,powTridentRule,WEAPON_KITS} from '../shared/weaponKit';
import {SHOP_OFFER_BY_ID} from '../shared/shop';

const wind=CATALOG['wind-shuriken'] as Weapon,thunder=CATALOG['thunder-coil'] as Weapon;

test('Vento Celeste and Bobina do Trovão read their DDTank 4.1 phase tables, never the milestone rule on top',()=>{
 const table={
  'wind-shuriken':[[0,60,30,250,40],[9,60,30,250,40],[10,72,36,300,48],[11,72,36,300,48],[12,93,46,390,62],[14,93,46,390,62],[15,111,55,488,77]],
  'thunder-coil':[[0,30,40,60,250],[10,36,48,72,300],[12,46,62,93,390],[15,55,77,111,488]]
 } as const;
 for(const [id,rows] of Object.entries(table))for(const [level,attack,defense,agility,luck] of rows){
  const stats=weaponStats(CATALOG[id] as Weapon,level);assert.deepEqual([stats.attack,stats.defense,stats.agility,stats.luck],[attack,defense,agility,luck],`${id} +${level}`);
  assert.deepEqual(itemAttributes(CATALOG[id],level),{attack,defense,agility,luck,damage:stats.damage,armor:0},'tooltips and totals read the same numbers');
 }
 // Dano 200 strengthens once: round(200 × 1.1^level).
 for(const [level,damage] of [[0,200],[10,519],[12,628],[15,835]])for(const weapon of [wind,thunder])assert.equal(weaponStats(weapon,level).damage,damage);
});

test('angles, ball size, POW profiles and shop entries follow the reconstruction',()=>{
 assert.deepEqual([wind.minAngle,wind.maxAngle,thunder.minAngle,thunder.maxAngle],[15,50,25,60]);
 assert.equal(wind.projectileRadius,3);assert.equal(thunder.projectileRadius,3);assert.equal(thunder.hold,'hand');assert.equal(wind.hold,undefined);
 assert.deepEqual([wind.splash,wind.pow?.splash,thunder.splash,thunder.pow?.splash],[55,65,55,65]);
 assert.equal(wind.pow?.damage,1.5);assert.equal(wind.pow?.fan,undefined,'three painted shurikens, one physical projectile');
 assert.equal(thunder.pow?.damage,.6);assert.deepEqual(thunder.pow?.fan,[{angle:-5,force:.9},{angle:0,force:1},{angle:5,force:1.1}]);
 for(const id of ['wind-shuriken','thunder-coil']){
  assert.equal(powTridentRule(id),'exclusivo');assert.match(powBoostConflict(id,'trident')!,/não combina Power com Tridente/);
  for(const boost of ['extra1','extra2','damage50'] as BoostId[])assert.equal(powBoostConflict(id,boost),undefined,'+1 and +2 stay allowed with POW');
  assert.ok(WEAPON_KITS[id]);assert.equal(SHOP_OFFER_BY_ID[id]?.price,520);
 }
});

test('four crater masks keep the measured proportions; the Trovão POW hole is smaller than its normal one',()=>{
 for(const [shape,height] of [['wind',.67],['wind-pow',.71],['thunder',.82],['thunder-pow',.74]] as const)assert.equal(CRATER_MASKS[shape].height,height);
 const area=(shape:keyof typeof CRATER_MASKS,radius:number)=>craterMask(shape,radius).bits.reduce((sum,bit)=>sum+bit,0);
 assert.ok(area('thunder-pow',thunder.pow!.crater!)<area('thunder',thunder.crater));
 assert.ok(area('wind-pow',wind.pow!.crater!)>area('wind',wind.crater));
 // The serrated Trovão holes cover a little less than their ellipse, like the measured PNG areas (97.7% and 95.6%).
 for(const [shape,radius,share] of [['thunder',200,.977],['thunder-pow',200,.956]] as const){const ellipse=Math.PI*radius*radius*CRATER_MASKS[shape].height;assert.ok(Math.abs(area(shape,radius)/ellipse-share)<.01,`${shape} ${area(shape,radius)/ellipse}`);}
 for(const level of [0,10,12,15]){
  assert.equal(destructionProfile('thunder-coil',level,true)?.radius,22.5);assert.equal(destructionProfile('thunder-coil',level,true)?.mask,'thunder-pow');
  assert.equal(destructionProfile('wind-shuriken',level,true)?.radius,28.5);assert.equal(destructionProfile('wind-shuriken',level,false)?.mask,'wind');
 }
});

test('volley forces scale each launch on its own: the fan keeps one angle per projectile and only changes speed',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:400,y:500,facing:1 as const};
 const [slow,same,fast]=volley(terrain,origin,[45,45,45],60,0,thunder,[],undefined,[],undefined,true,undefined,[.9,1,1.1]);
 const [plain]=volley(terrain,origin,[45],60,0,thunder);
 assert.deepEqual(same.points,plain.points);
 assert.ok(slow.points[2][0]<same.points[2][0]&&same.points[2][0]<fast.points[2][0]);
});

async function fixture(weapon:string){
 const events:ServerEvent[]=[],store={getProfile:async()=>null,finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store,()=>{},()=>.99);
 const players=['Vento Um','Vento Dois'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const player of players)game.connect(player,event=>events.push(structuredClone(event)));
 await game.command(players[0].id,{type:'create',practice:true,name:'Armas novas',mode:'1v1',map:'garden'});
 const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players.find(p=>p.id===match.state.turnId)!;
 shooter.equipment.weapon=weapon;shooter.stamina=1000;
 return {game,match,shooter,events};
}
async function powShot(weapon:string,boosts:BoostId[]=[]){
 const f=await fixture(weapon);f.shooter.powerCharge=100;
 await f.game.command(f.shooter.id,{type:'power'});for(const boost of boosts)await f.game.command(f.shooter.id,{type:'boost',boost});
 await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});f.game.tick(f.match.pendingPower!.at);
 return f.events.filter((event):event is Extract<ServerEvent,{type:'shot'}>=>event.type==='shot').at(-1)!.shot;
}

test('server: Vento POW is one projectile, Trovão POW three per volley with their own smaller craters, +1 keeps the volleys',async()=>{
 const windShot=await powShot('wind-shuriken');
 assert.equal(windShot.projectiles.length,1);assert.equal(windShot.projectiles[0].impact.shape,'wind-pow');assert.equal(windShot.projectiles[0].impact.radius,28.5);
 const thunderShot=await powShot('thunder-coil');
 assert.equal(thunderShot.projectiles.length,3);
 for(const projectile of thunderShot.projectiles){assert.equal(projectile.impact.shape,'thunder-pow');assert.ok(projectile.impact.radius===22.5||projectile.impact.dig?.radius===Math.round(22.5*.75));}
 assert.equal((await powShot('thunder-coil',['extra1'])).projectiles.length,6,'2 volleys × 3 bolts');
 assert.equal((await powShot('wind-shuriken',['extra2'])).projectiles.length,3,'3 volleys × 1 shuriken');
});
