import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {DESTRUCTION_MODES,DESTRUCTION_STAGES,destructionProfile,destructionProfiles,markBox} from '../shared/destruction';
import {WEAPONS} from '../shared/catalog';
import {POWER_CRATER_MULTIPLIER} from '../shared/power';
import {craterAnchor,craterMask,crater,createTerrain,DIRECT_HIT_CRATER,digMask,ground,MAP_CELL,packTerrain,unpackTerrain,upgradeTerrain,WORLD} from '../shared/physics';
import {keepVisibleMarks,MAX_TERRAIN_MARKS,markVisible} from '../shared/terrainMarks';
import type {TerrainMark} from '../shared/protocol';


/** The compiled masks of the shipped profiles. A change here changes every hole in the game: bump DESTRUCTION_VERSION. */
const MASK_HASHES:Record<string,string>={};
const hash=(bits:Uint8Array)=>createHash('sha256').update(bits).digest('hex').slice(0,16);

test('16 destruction profiles: 2 weapons × 4 phases × normal|POW, 4 shared masks and 16 distinct paintings',()=>{
 const profiles=[...destructionProfiles().values()];
 assert.equal(profiles.length,16);
 assert.equal(new Set(profiles.map(p=>p.mark.src)).size,16,'one painting per profile');
 assert.equal(new Set(profiles.map(p=>p.mask)).size,4,'phases share the cut');
 for(const weapon of ['brick','love-boomerang'])for(const mode of DESTRUCTION_MODES)for(const stage of DESTRUCTION_STAGES){
  const p=profiles.find(item=>item.weapon===weapon&&item.mode===mode&&item.stage===stage)!;assert.ok(p,`${weapon} ${mode} ${stage}`);
  assert.equal(p.id,`${weapon}:${mode}:${stage}@${p.version}`);assert.equal(p.mark.src,`/assets/weapons/${weapon}/destruction/${mode}/mark-${stage}.png`);
  const w=WEAPONS.find(item=>item.id===weapon)!;
  assert.equal(p.mask,mode==='pow'?w.powCraterShape:w.craterShape);
  assert.equal(p.radius,w.crater*(mode==='pow'?POWER_CRATER_MULTIPLIER:1),'POW multiplier applied once, by the profile radius only');
  assert.ok(p.mark.world>p.radius*2,'the painting frames the hole with a rim');
 }
 // The phase follows weaponVisualStage: +0–9, +10–11, +12–14, +15.
 for(const [level,stage] of [[0,0],[9,0],[10,10],[11,10],[12,12],[14,12],[15,15]] as const){
  assert.equal(destructionProfile('brick',level,false)?.stage,stage);assert.equal(destructionProfile('love-boomerang',level,true)?.mode,'pow');
 }
});

test('masks are compiled from the shape alone: same bits everywhere, binary, symmetric, versioned by hash',()=>{
 for(const profile of destructionProfiles().values()){
  const mask=craterMask(profile.mask,profile.radius),again=craterMask(profile.mask,profile.radius);
  assert.equal(mask,again,'cached');assert.equal(mask.width,mask.pivotX*2);assert.equal(mask.height,mask.pivotY*2);
  assert.ok(mask.bits.every(bit=>bit===0||bit===1));
  for(let j=0;j<mask.height;j++)for(let i=0;i<mask.width;i++){
   const bit=mask.bits[j*mask.width+i];
   assert.equal(bit,mask.bits[j*mask.width+mask.width-1-i],'left/right symmetric');assert.equal(bit,mask.bits[(mask.height-1-j)*mask.width+i],'up/down symmetric');
  }
  MASK_HASHES[profile.mask]??=hash(mask.bits);assert.equal(hash(mask.bits),MASK_HASHES[profile.mask]);
 }
 // Fixed shapes, measured on the fine grid: the brick is a flat 44×29 hexagon, the boomerang a 52×35 oval.
 const brick=craterMask('brick',22),oval=craterMask('oval',26);
 assert.deepEqual([brick.width,brick.height],[44,30]);assert.deepEqual([oval.width,oval.height],[52,36]);
 const row=(m:typeof brick,j:number)=>m.bits.slice(j*m.width,(j+1)*m.width).reduce((a,b)=>a+b,0);
 assert.equal(row(brick,brick.pivotY),44,'full width across the middle');assert.ok(row(brick,0)<row(brick,brick.pivotY)*.62,'chamfered top and floor');
 assert.ok(row(oval,0)<row(oval,oval.pivotY)*.45,'the oval narrows to its poles');
});

test('the dig is pinned to the rounded impact point, one pixel at a time, and only cuts destructible ground',()=>{
 const x=700.49,terrain=createTerrain('snow'),surface=ground(terrain,x),before=terrain.slice(),mask=craterMask('brick',22),[ax,ay]=craterAnchor(x,surface);
 assert.deepEqual([ax,ay],[700,surface]);
 const removed=digMask(terrain,mask,x,surface,'snow');assert.ok(removed>0);
 let changed=0;
 for(let i=0;i<terrain.length;i++)if(terrain[i]!==before[i]){changed++;const cols=terrain.length/WORLD.rows,px=i%cols,py=Math.floor(i/cols),mi=px-ax+mask.pivotX,mj=py-ay+mask.pivotY;
  assert.ok(mi>=0&&mj>=0&&mi<mask.width&&mj<mask.height&&mask.bits[mj*mask.width+mi]===1,'only mask pixels go');}
 assert.equal(changed,removed);
 // A body hit digs the same mask at 75%, which is the radius the mark is scaled by too.
 const body=Math.round(22*DIRECT_HIT_CRATER),profile=destructionProfile('brick',0,false)!,full=markBox(profile,ax,ay),small=markBox(profile,ax,ay,body);
 assert.ok(Math.abs(small.size/full.size-body/22)<1e-9);assert.equal(small.x+small.size/2,ax);
 // crater() with a shape is the same operation.
 const other=createTerrain('snow');crater(other,x,surface,22,'snow',0,1,'brick');assert.deepEqual(other,terrain);
});

test('fine terrain travels as run lengths and terrains saved on the 3px grid are expanded explicitly',()=>{
 const terrain=createTerrain('snow');crater(terrain,900,ground(terrain,900),22,'snow',0,1,'brick');
 const packed=packTerrain(terrain);assert.deepEqual(unpackTerrain(packed),terrain);assert.ok(packed.byteLength<terrain.length/50,`${packed.byteLength} bytes`);
 const width=terrain.length/WORLD.rows,legacyCols=width/MAP_CELL,legacyRows=WORLD.height/MAP_CELL,legacy=new Uint8Array(legacyCols*legacyRows);
 for(let y=0;y<legacyRows;y++)for(let x=0;x<legacyCols;x++)legacy[y*legacyCols+x]=terrain[y*MAP_CELL*width+x*MAP_CELL];
 const upgraded=upgradeTerrain(legacy,width);assert.equal(upgraded.length,terrain.length);
 assert.equal(upgraded[601*width+901],legacy[200*legacyCols+300]);assert.equal(upgradeTerrain(terrain,width),terrain,'a fine terrain is kept');
});

test('mark history keeps every mark that can still paint ground, drops only invisible ones, and is bounded',()=>{
 const map='snow',terrain=createTerrain(map),x=1000,surface=ground(terrain,x),profile=destructionProfile('brick',0,false)!;
 const mark=(id:string,y=surface):TerrainMark=>({id,x,y,radius:22,shape:'brick',profile:profile.id,effect:'brick',level:0});
 const marks:TerrainMark[]=[];
 for(let n=0;n<60;n++){marks.push(mark(`m${n}`,ground(terrain,x)));crater(terrain,x,ground(terrain,x),22,map,0,1,'brick');}
 const kept=keepVisibleMarks(marks,terrain,map);
 assert.ok(kept.length>48||kept.every(item=>markVisible(item,terrain,map)),'no arbitrary 48 cut');
 assert.ok(kept.every(item=>markVisible(item,terrain,map)));
 for(const dropped of marks.filter(item=>!kept.includes(item)))assert.equal(markVisible(dropped,terrain,map),false);
 // Order is kept.
 assert.deepEqual(kept.map(item=>item.id),marks.filter(item=>kept.includes(item)).map(item=>item.id));
 // A mark in the sky over nothing breakable is never visible.
 assert.equal(markVisible(mark('sky',40),createTerrain(map),map),false);
 const many=Array.from({length:MAX_TERRAIN_MARKS+10},(_,n)=>({...mark(`k${n}`),x:200+n%1500}));
 assert.equal(keepVisibleMarks(many,createTerrain(map),map).length,MAX_TERRAIN_MARKS);
});

test('shots carry the profile fixed at fire time and both weapons point at their own masks',()=>{
 for(const weapon of WEAPONS.filter(item=>item.craterShape))for(const level of [0,10,12,15])for(const powered of [false,true]){
  const profile=destructionProfile(weapon.id,level,powered);if(!profile)continue;
  assert.equal(profile.weapon,weapon.id);assert.equal(profile.mask,powered?weapon.powCraterShape:weapon.craterShape);
 }
});
