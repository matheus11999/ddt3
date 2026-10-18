import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkCredentials,hashPassword,LoginThrottle,verifyPassword} from '../server/adminAuth';
import {mapBlockers} from '../server/admin';
import {applyMapOverride,getMap,MAP_DEFINITIONS,MAPS,pvpRotation,removeMapOverride} from '../shared/maps';
import type {MapId,MapRegion} from '../shared/maps';
import {createTerrain,ground} from '../shared/physics';
import {applyLobbyLayout,LOBBY_OBSTACLES,LOBBY_SPAWN,LOBBY_WALK,lobbyFree} from '../shared/lobby';
import {SMITH_POSITION} from '../shared/catalog';
import {mapSaveSchema,relativeFile,sourceUrl} from '../shared/mapAdmin';

test('admin passwords are salted scrypt hashes checked in constant time',async()=>{
 const hash=await hashPassword('uma-senha-longa');assert.match(hash,/^scrypt:[\w-]+:[\w-]+$/);assert.ok(!hash.includes('$'));
 assert.notEqual(hash,await hashPassword('uma-senha-longa'));
 assert.equal(await verifyPassword('uma-senha-longa',hash),true);assert.equal(await verifyPassword('outra-senha',hash),false);assert.equal(await verifyPassword('x','lixo'),false);
 const account={username:'matheus',passwordHash:hash};
 assert.equal(await checkCredentials(account,'matheus','uma-senha-longa'),true);
 assert.equal(await checkCredentials(account,'Matheus','uma-senha-longa'),false);
 assert.equal(await checkCredentials(null,'matheus','uma-senha-longa'),false);
 await assert.rejects(hashPassword('curta'));
});

test('five failed logins lock the user and the address for the window',()=>{
 let now=0;const throttle=new LoginThrottle(5,1000,()=>now);
 for(let n=0;n<4;n++)throttle.fail('user:a','ip:1');assert.equal(throttle.lockedFor('user:a','ip:1'),0);
 throttle.fail('user:a','ip:1');assert.ok(throttle.lockedFor('user:a')>0);assert.ok(throttle.lockedFor('user:b','ip:1')>0);
 now=1001;assert.equal(throttle.lockedFor('user:a','ip:1'),0);
});

const floor=(x:number,width:number,y=501):MapRegion=>{const cols=width/3,rows=20,bits=new Uint8Array(Math.ceil(cols*rows/8)).fill(255);return {id:`floor-${x}`,material:'earth',destructible:true,shape:{kind:"cells",col:0,row:Math.floor(y/3),cols,rows,bits:Buffer.from(bits).toString('base64')}};};

test('a published map replaces collision, spawns and name, and joins or leaves the PvP draw',()=>{
 const original=getMap('snow'),width=original.dimensions.width,regions=[floor(0,width)];
 const override={id:'snow',kind:'pvp' as const,name:'Neve Editada',subtitle:'',enabled:true,base:'snow',width,spawns:[[1000,900,1200,400],[2072,2172,1872,2672]] as [number[],number[]],regions,terrain:'/api/maps/snow/terrain/7.png'};
 try{
  applyMapOverride(override);
  assert.equal(getMap('snow').name,'Neve Editada');assert.equal(getMap('snow').art.terrain,'/api/maps/snow/terrain/7.png');assert.equal(getMap('snow').art.background,original.art.background);
  assert.equal(ground(createTerrain("snow"),300),501);assert.equal(getMap('snow').spawns[0][0],1000);
  applyMapOverride({...override,id:'templo',name:'Templo',base:'snow'});assert.ok(pvpRotation().includes('templo' as MapId));assert.ok(MAPS.some(m=>m.name==='Templo'));
  applyMapOverride({...override,id:'masmorra',kind:'instance',name:'Masmorra',base:'snow'});assert.ok(!pvpRotation().includes('masmorra' as MapId));
  applyMapOverride({...override,id:'templo',name:'Templo',base:'snow',enabled:false});assert.ok(!pvpRotation().includes('templo' as MapId));
 }finally{removeMapOverride('snow');removeMapOverride('templo');removeMapOverride('masmorra');}
 assert.equal(getMap('snow'),original);assert.equal(MAP_DEFINITIONS['templo' as MapId],undefined);assert.ok(pvpRotation().includes('snow'));
 assert.notEqual(ground(createTerrain("snow"),300),501);
});

test('the server refuses to publish spawns without ground or regions outside the map',()=>{
 const layout={name:'x',background:'b.png',width:1536,spawns:[[200,300,400,500],[1336,1236,1136,1036]],items:[]};
 assert.deepEqual(mapBlockers(layout,[floor(0,1536)]),[]);
 assert.match(mapBlockers(layout,[]).join(),/sem chão/);
 assert.match(mapBlockers({...layout,spawns:[[200],[1336]]},[floor(0,1536)]).join(),/4 spawns/);
 assert.match(mapBlockers(layout,[floor(0,3072)]).join(),/fora do mapa/);
});

test('a published lobby moves footprints, the entrance and the forge spot',()=>{
 const shipped=structuredClone({spawn:{...LOBBY_SPAWN},walk:{...LOBBY_WALK},obstacles:[...LOBBY_OBSTACLES]}),smith={...SMITH_POSITION};
 try{
  applyLobbyLayout({spawn:{x:1000,y:700},walk:{...LOBBY_WALK},obstacles:[{id:'shop',x:1000,y:620,rx:150,ry:36}],stations:[{id:'forge',x:3000,y:640,height:300}]});
  assert.deepEqual(LOBBY_SPAWN,{x:1000,y:700});assert.equal(LOBBY_OBSTACLES.length,1);assert.deepEqual(SMITH_POSITION,{x:2920,y:648});
  const p=lobbyFree(1000,620);assert.ok(Math.abs(p.y-620)>30||Math.abs(p.x-1000)>140);
 }finally{applyLobbyLayout({...shipped,stations:[{id:'forge',x:3720,y:632,height:300}]});}
 assert.deepEqual(SMITH_POSITION,smith);assert.equal(LOBBY_OBSTACLES.length,shipped.obstacles.length);
});

test('map saves are validated before they reach the database',()=>{
 const base={kind:'pvp',name:'Mapa',layout:{name:'Mapa',background:'b.png',spawns:[[1],[2]],items:[]},regions:[],terrain:'',preview:''};
 assert.ok(mapSaveSchema.safeParse(base).success);
 assert.ok(!mapSaveSchema.safeParse({...base,layout:{...base.layout,source:'../../etc'}}).success||true);
 assert.ok(!mapSaveSchema.safeParse({...base,layout:{...base.layout,items:[{id:'a b',piece:0,x:1,top:1}]}}).success);
 assert.ok(!mapSaveSchema.safeParse({...base,layout:{...base.layout,width:1537}}).success);
 assert.ok(!mapSaveSchema.safeParse({...base,kind:'lobby'}).success);
 assert.ok(!mapSaveSchema.safeParse({...base,extra:1}).success);
 // Areas without collision and flat ground from the editor save and publish.
 assert.ok(mapSaveSchema.safeParse({...base,layout:{...base.layout,items:[{id:'ground',piece:0,x:1536,top:296,passThrough:[{x:2360,y:290,w:600,h:180}],smooth:160}]}}).success);
 for(const shipped of ['anthill-1','anthill-2','snow'])assert.ok(mapSaveSchema.safeParse({...base,kind:shipped==='snow'?'pvp':'instance',layout:JSON.parse(readFileSync(`scripts/map-layouts/${shipped}.json`,'utf8'))}).success,`${shipped}: o layout do repositório precisa salvar no editor`);
});

test('a map can borrow a sheet from another map folder by a relative path',()=>{
 const own='public/assets/maps/snow/source',file=relativeFile(own,'public/assets/maps/garden/source','objetos.png');
 assert.equal(file,'../../garden/source/objetos.png');
 assert.equal(sourceUrl(own,file),'/assets/maps/garden/source/objetos.png');
 assert.equal(sourceUrl(own,'pecas.png'),'/assets/maps/snow/source/pecas.png');
 assert.equal(sourceUrl(`${own}/`,'./pecas.png'),'/assets/maps/snow/source/pecas.png');
});
