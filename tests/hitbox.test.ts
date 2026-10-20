import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../shared/catalog';
import {FIGHTER_BODY_CENTER,FIGHTER_HIT_BOX,fighterHitBounds,trajectory,volley,WORLD} from '../shared/physics';
import {STRAIGHT_BALL} from './fixtures/weapons';

// Flat, gravity-free shots: origin (50,100) facing right fires from (77,60).
const empty=()=>new Uint8Array(WORLD.cols*WORLD.rows),origin={x:50,y:100,facing:1 as const};
const flat=(radius:number)=>({...WEAPONS[0],projectileRadius:radius,ball:STRAIGHT_BALL});
/** A target whose box has its top-left corner at (left,top). */
const at=(id:string,left:number,top:number,extra:object={})=>({id,x:left+15,y:top+46,hp:100,...extra});

test('player hit box is the DDTank 30×30 rectangle, origin 26 px above the feet, centre 31 px above them',()=>{
 assert.deepEqual(FIGHTER_HIT_BOX,{left:-15,top:-20,width:30,height:30});
 assert.equal(FIGHTER_BODY_CENTER,31);
 assert.deepEqual(fighterHitBounds({x:400,y:500}),{left:385,top:454,right:415,bottom:484,originX:400,originY:474});
});

test('the box ignores outfit, costume, head, facing, slope and pose: only the feet position matters',()=>{
 const base={x:640,y:420},looks=[{facing:1,aimSlope:0,equipment:DEFAULT_EQUIPMENT},{facing:-1,aimSlope:25,equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-explorer',hat:'hat-captain'}},{facing:1,aimSlope:-30,charging:true}];
 for(const look of looks)assert.deepEqual(fighterHitBounds({...base,...look}),fighterHitBounds(base));
});

test('central, edge and corner contacts: flat faces are exact, rounded corners never catch a square expansion',()=>{
 const r=6,weapon=flat(r);
 // Centre: the line runs through the box centre.
 const centre=trajectory(empty(),origin,0,100,0,weapon,[at('c',300,45)]);assert.equal(centre.hitId,'c');assert.ok((centre.hitQuality??0)>.999);
 assert.equal(centre.x,300);assert.ok(Math.abs(centre.points.at(-1)![0]-(300-r))<1e-7);
 // Exact tangent on the top and bottom faces counts (inclusive edge); one hundredth further misses.
 for(const [top,hit] of [[66,true],[66.01,false],[60-30-r,true],[60-30-r-.01,false]] as const)assert.equal(trajectory(empty(),origin,0,100,0,weapon,[at('t',300,top)]).hitId,hit?'t':undefined,`top ${top}`);
});

test('the four corners use the rounded Minkowski boundary in both directions',()=>{
 const r=6;
 // A shot rising at 45° passes one corner: just inside the disk it hits, just outside it misses,
 // although a square expansion of the box would catch both.
 for(const facing of [1,-1] as const){
  const from={x:600,y:500,facing},sx=600+facing*27,sy=460;
  for(const [sign,inside] of [[1,true],[1,false],[-1,true],[-1,false]] as const){
   const offset=r+(inside?-.05:.05),cornerX=sx+facing*80+facing*sign*offset/Math.SQRT2,cornerY=sy-80+sign*offset/Math.SQRT2;
   // sign 1: lower-right of the line (facing right) → the box hangs from that corner away from the path.
   const left=facing*sign>0?cornerX:cornerX-30,top=sign>0?cornerY:cornerY-30;
   const result=trajectory(empty(),from,45,100,0,flat(r),[at('k',left,top)]);
   assert.equal(result.hitId,inside?'k':undefined,`facing ${facing} sign ${sign} inside ${inside}`);
   if(inside)assert.ok((result.hitQuality??1)<.1,'a corner graze is low quality');
  }
 }
});

test('quality is normalised for the box: 1 through the centre, falling to 0 at the tangent',()=>{
 const weapon=flat(6),qualities=[0,5,10,15,20.9].map(offset=>trajectory(empty(),origin,0,100,0,weapon,[at('q',300,45+offset)]).hitQuality??-1);
 for(let i=1;i<qualities.length;i++)assert.ok(qualities[i]<qualities[i-1],`${qualities}`);
 assert.ok(qualities[0]>.999&&qualities.at(-1)!<.1);
});

test('very fast shots still meet the box first and a wall just before the player stops them',()=>{
 const weapon=flat(3),target=at('fast',900,45);
 const fast=trajectory(empty(),origin,0,100,0,{...weapon,ball:{...STRAIGHT_BALL}},[target]);assert.equal(fast.hitId,'fast');assert.ok(Math.abs(fast.points.at(-1)![0]-(900-3))<1e-6);
 const terrain=empty();for(let row=0;row<WORLD.rows;row++)terrain[row*WORLD.cols+Math.floor(894/WORLD.cell)]=1;
 const blocked=trajectory(terrain,origin,0,100,0,weapon,[target]);assert.equal(blocked.hitId,undefined);assert.ok(blocked.x<900);
});

test('different weapon radii keep their own size against the same box',()=>{
 const target=at('w',300,66),hits=[3,6,9].map(r=>trajectory(empty(),origin,0,100,0,flat(r),[target]));
 assert.deepEqual(hits.map(hit=>hit.hitId),[undefined,'w','w']);assert.ok(hits[2].flightTime<hits[1].flightTime);
});

test('dead fighters never intercept; monsters and bosses keep their own circles',()=>{
 const weapon=flat(6);
 assert.equal(trajectory(empty(),origin,0,100,0,weapon,[at('dead',300,45,{hp:0})]).hitId,undefined);
 // A monster 40 px under the line: a 30×30 box would miss, its own radius-50 circle is hit.
 const monster={id:'ant',x:315,y:150,hp:100,hitRadius:50,hitHeight:50};
 assert.equal(trajectory(empty(),origin,0,100,0,weapon,[monster]).hitId,'ant');
});

test('an overlapping rival is passed on the way out and can be hit on the way back',()=>{
 // Rival standing on the shooter: the shot spawns inside his box, so it ignores him while inside.
 const rival={id:'rival',x:60,y:100,hp:100},shot=volley(empty(),origin,[0],100,0,flat(6),[rival])[0];assert.equal(shot.hitId,undefined);
 // Further aside (beyond FIGHTER_OVERLAP) the same box is hit at once.
 const aside={id:'aside',x:85,y:100,hp:100};assert.equal(volley(empty(),origin,[0],100,0,flat(6),[aside])[0].hitId,'aside');
 // A lob straight up comes back down on the overlapping rival.
 const lob=volley(empty(),{x:200,y:500,facing:1},[90],30,0,{...WEAPONS[0],projectileRadius:6},[{id:'under',x:215,y:500,hp:100}])[0];assert.equal(lob.hitId,'under');
});
