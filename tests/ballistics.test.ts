import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {forceBarValue,FORCE_BAR_STEP_MS} from '../shared/forceBar';
import {trajectory,WORLD} from '../shared/physics';

const brick=WEAPONS.find(weapon=>weapon.id==='brick')!;
const sky=()=>new Uint8Array(WORLD.cols*4*WORLD.rows);
/** Offset from the launch point after `ms` of free flight. */
function at(ms:number,angle:number,power:number,wind:number,facing:1|-1=1){
 const origin={x:3000,y:860,facing},points=trajectory(sky(),origin,angle,power,wind,brick).points,launch=points[0],point=points[Math.round(ms*60/1000)];
 return [point[0]-launch[0],point[1]-launch[1]];
}

test('free flight matches the DDTank 4.1 reference vectors (force 50, 45°, 25 steps of 0.04 s)',()=>{
 for(const [wind,x] of [[-3,602.818],[0,637.969],[3,673.119]]){
  const [dx,dy]=at(1000,45,50,wind);
  assert.ok(Math.abs(dx-x)<.1,`wind ${wind}: x ${dx}`);assert.ok(Math.abs(dy+296.23)<.1,`wind ${wind}: y ${dy}`);
 }
});

test('without wind the two sides mirror; wind is a world value that does not follow the facing',()=>{
 const right=at(800,55,70,0,1),left=at(800,55,70,0,-1);
 assert.ok(Math.abs(right[0]+left[0])<.11&&Math.abs(right[1]-left[1])<.11);
 const mirrored=at(800,55,70,-2,-1),original=at(800,55,70,2,1);
 assert.ok(Math.abs(original[0]+mirrored[0])<.11&&Math.abs(original[1]-mirrored[1])<.11);
 // Positive wind pushes right for both: it helps the right-facing shot and holds back the left-facing one.
 assert.ok(at(800,55,70,2,1)[0]>right[0]&&at(800,55,70,2,-1)[0]>left[0]);
});

test('drag makes the range grow slower than the square of the force, unlike a drag-free parabola',()=>{
 const range=(power:number)=>{const origin={x:200,y:400,facing:1 as const},terrain=sky();for(let col=0;col<WORLD.cols*4;col++)terrain[Math.floor(400/WORLD.cell)*WORLD.cols*4+col]=1;return trajectory(terrain,origin,45,power,0,brick).x-origin.x;};
 const half=range(50),full=range(100);
 assert.ok(full/half>2.5&&full/half<3.5,`ratio ${full/half}`);
});

test('the force bar rises 1→100 in 4 s, falls back and reaches zero after 8 s',()=>{
 assert.deepEqual(forceBarValue(0),{power:1,falling:false});
 assert.deepEqual(forceBarValue(99*FORCE_BAR_STEP_MS),{power:100,falling:false});
 assert.deepEqual(forceBarValue(150*FORCE_BAR_STEP_MS),{power:50,falling:true});
 assert.equal(forceBarValue(200*FORCE_BAR_STEP_MS).power,0);
 assert.equal(forceBarValue(10).power,forceBarValue(39).power,'the bar moves on its own clock, not per frame');
});
