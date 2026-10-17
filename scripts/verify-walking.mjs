import {enterGame} from './character-helpers.mjs';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1500},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await enterGame(page,base);await page.waitForLoadState('networkidle');
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig,AVATAR_UNIT}=await import('/src/game/appearance.ts'),{drawAvatar,createAvatarMotion,sampleWalkingLeg}=await import('/src/game/avatar.ts'),{DEFAULT_EQUIPMENT}=await import('/shared/catalog.ts');
  const ids=['outfit-surfer','outfit-executive'];
  await Promise.all(['/assets/character-base.png','/assets/shop-accessories.png','/assets/faces/face-brave.png',...ids.flatMap(id=>[`/assets/${id}-body.png`,`/assets/outfits/${id}-walk.png`])].map(path=>new Promise((resolve,reject)=>{const i=asset(path);if(i.complete&&i.naturalWidth)return resolve();i.addEventListener('load',resolve,{once:true});i.addEventListener('error',()=>reject(new Error(path)),{once:true});})));
  const results=ids.map(id=>{
   const rig=avatarRig({...DEFAULT_EQUIPMENT,outfit:id}),step=id==='outfit-surfer'?10.5:9;let maxJointError=0,maxGroundError=0,maxLift=0,plantedFeet=0;
   for(let i=0;i<120;i++){
    const phase=i*Math.PI/60;let contacts=0;
    for(const [leg,offset] of [[rig.walking.near,0],[rig.walking.far,Math.PI]]){
     const f=sampleWalkingLeg(leg,phase+offset,3,0,0,step),expectedThigh=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])*AVATAR_UNIT,expectedShin=Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])*AVATAR_UNIT;
     maxJointError=Math.max(maxJointError,Math.abs(Math.hypot(f.knee[0]-f.hip[0],f.knee[1]-f.hip[1])-expectedThigh),Math.abs(Math.hypot(f.ankle[0]-f.knee[0],f.ankle[1]-f.knee[1])-expectedShin));
     const ground=f.ankle[1]+(leg.groundY-leg.ankle[1])*AVATAR_UNIT;if(f.grounded){maxGroundError=Math.max(maxGroundError,Math.abs(ground));contacts++;}else maxLift=Math.max(maxLift,-ground);
    }if(contacts>=1)plantedFeet++;
   }
   const leg=rig.walking.near,p=.3,a=sampleWalkingLeg(leg,p,3,0,0,step),distance=3,delta=distance*Math.PI/(2*step),b=sampleWalkingLeg(leg,p+delta,3,0,0,step),plantedWorldDrift=Math.abs(a.ankle[0]-(b.ankle[0]+distance));
   return {id,maxJointError,maxGroundError,maxLift,framesWithSupport:plantedFeet,plantedWorldDrift};
  });
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#152641';const canvas=document.createElement('canvas');canvas.id='walking-sheet';canvas.width=1920;canvas.height=1530;document.body.append(canvas);const c=canvas.getContext('2d');c.fillStyle='#152641';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#fff0b0';c.font='bold 28px Georgia';c.fillText('CAMINHADA · OITO FASES · APOIO E FLEXÃO DE JOELHO',24,42);
  for(let row=0;row<4;row++){
   const id=ids[Math.floor(row/2)],direction=row%2===0?1:-1,y=70+row*360;c.fillStyle='#f9e3a1';c.font='bold 17px Arial';c.fillText(`${id} ${direction>0?'→':'←'}`,24,y+20);
   for(let n=0;n<8;n++){
    const phase=n*Math.PI/4,cell=document.createElement('canvas');cell.width=240;cell.height=320;const ctx=cell.getContext('2d'),motion=createAvatarMotion(direction);motion.walk=1;motion.phase=phase;motion.lastTime=1000;motion.pose='walk';motion.bodyY=id==='outfit-surfer'?1.8:2;
    ctx.strokeStyle='#75a6a4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(5,300.5);ctx.lineTo(235,300.5);ctx.stroke();drawAvatar(ctx,{...DEFAULT_EQUIPMENT,outfit:id,hat:'hat-none'},120,300,249,1000,true,direction,false,motion,{pose:'walk',movementDistance:0});c.drawImage(cell,n*240,y+28);
   }
  }
  window.walkingCapture={ids,drawAvatar,createAvatarMotion,DEFAULT_EQUIPMENT,canvas};
  return {results};
 });
 await page.locator('#walking-sheet').screenshot({path:'test-results/walking-filmstrip.png'});
 const transitions=await page.evaluate(()=>{
  const {ids,drawAvatar,createAvatarMotion,DEFAULT_EQUIPMENT,canvas}=window.walkingCapture;canvas.width=1920;canvas.height=850;const c=canvas.getContext('2d');c.fillStyle='#152641';c.fillRect(0,0,1920,850);c.fillStyle='#fff0b0';c.font='bold 27px Georgia';c.fillText('TRANSIÇÃO · PARADO → PASSOS → POSE EXCLUSIVA',24,40);
  const stamps=[0,160,320,480,640,800,1120,1440],result=[];
  for(let row=0;row<ids.length;row++){
   const id=ids[row],m=createAvatarMotion(1),cell=document.createElement('canvas');cell.width=240;cell.height=330;const cc=cell.getContext('2d');let n=0;
   for(let elapsed=0;elapsed<=1440;elapsed+=16){const moving=elapsed>=128&&elapsed<800;cc.clearRect(0,0,240,330);drawAvatar(cc,{...DEFAULT_EQUIPMENT,outfit:id,hat:'hat-none'},120,320,260,1000+elapsed,moving,1,false,m,{pose:moving?'walk':'idle',movementDistance:moving?1.7:0});if(elapsed===stamps[n]){c.drawImage(cell,n*240,95+row*370);c.fillStyle='#f9e3a1';c.font='15px Arial';c.fillText(`${id.replace('outfit-','')} · ${elapsed}ms`,n*240+15,90+row*370);n++;}}
   result.push({id,finalWalkBlend:m.walk,finalPose:m.pose,frames:n});
  }return result;
 });
 await page.locator('#walking-sheet').screenshot({path:'test-results/walking-transitions.png'});
 assert.ok(transitions.every(v=>v.frames===8&&v.finalPose==='idle'&&v.finalWalkBlend<.002),'After walking each costume returns to its own idle painting');report.transitions=transitions;
 for(const result of report.results){assert.ok(result.maxJointError<.6,'Bones retain their length');assert.ok(result.maxGroundError<.01,'Supporting soles remain on the ground');assert.ok(result.maxLift>=9,'Swinging foot must lift clear of the ground');assert.equal(result.framesWithSupport,120);assert.ok(result.plantedWorldDrift<.001,'Supporting foot must not slide as character advances');}
 assert.deepEqual(errors,[]);await writeFile('test-results/walking-report.json',JSON.stringify({ok:true,...report},null,2));console.log(JSON.stringify({ok:true,...report},null,2));
}finally{await browser.close();}
