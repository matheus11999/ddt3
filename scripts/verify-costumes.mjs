import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1450},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base,{waitUntil:'domcontentloaded'});
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig}=await import('/src/game/appearance.ts');
  const {COSTUMES,getCostumeFrame,getCostumePortrait}=await import('/src/game/costumes.ts');
  const {drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,starterEquipment,CATALOG}=await import('/shared/catalog.ts');
  const ids=Object.keys(COSTUMES),poses=['idle','walk','aim','charge','fire','hit','fall','prone','victory','defeat'];
  const load=path=>new Promise((resolve,reject)=>{const image=asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(Error(path)),{once:true});});
  await Promise.all([...Object.values(COSTUMES).map(c=>c.path),...Object.values(CATALOG).map(c=>c.visual?.asset).filter(Boolean),'/assets/character-base.png','/assets/headwear-worn-atlas.png','/assets/hair-covered-atlas.png','/assets/outfits/combat-prone.png','/assets/outfits/outfit-surfer-walk.png','/assets/weapon-ember-base.png'].map(load));
  for(let i=0;i<10&&!avatarRig(DEFAULT_EQUIPMENT);i++)await new Promise(r=>setTimeout(r,80));
  const fixture=document.createElement('div');fixture.style.cssText='position:fixed;inset:0;z-index:999999;overflow:auto;background:#152941';document.body.append(fixture);
  const sheet=document.createElement('canvas');sheet.id='costume-sheet';sheet.width=1600;sheet.height=1400;fixture.append(sheet);const c=sheet.getContext('2d');
  const drawCell=(eq,pose='idle',combat=false,facing=1,time=1600,animated=true,weapon=false)=>{const cv=document.createElement('canvas');cv.width=cv.height=310;const ctx=cv.getContext('2d'),motion=createAvatarMotion(facing);for(let f=0;f<30;f++){ctx.clearRect(0,0,310,310);drawAvatar(ctx,eq,165,295,combat?290:265,time+f*16,pose==='walk',facing,weapon,motion,{pose,poseTime:85,angle:55,power:85,combat,animated,movementDistance:pose==='walk'?.7:0});}return cv;};
  const count=cv=>{const p=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>12)n++;return n;};
  window.drawCostumeSheet=(combat=false,facing=1,weapon=false)=>{c.fillStyle='#152941';c.fillRect(0,0,1600,1400);c.fillStyle='#ffe4a0';c.font='bold 24px Arial';c.fillText(`FANTASIAS · ${combat?'COMBATE':'LOBBY / PRÉVIA'} · ${facing===1?'DIREITA':'ESQUERDA'}`,25,38);for(let k=0;k<20;k++){const x=(k%5)*320,y=58+Math.floor(k/5)*333,id=ids[Math.floor(k/10)],pose=poses[k%10];c.fillStyle=Math.floor(k/10)?'#2f2346':'#243a53';c.fillRect(x+5,y,310,325);c.fillStyle='#fff1ce';c.font='bold 17px Arial';c.textAlign='center';c.fillText(`${id.includes('chick')?'Pintinho':'Raposa'} · ${pose}`,x+160,y+22);c.drawImage(drawCell({...DEFAULT_EQUIPMENT,costume:id},pose,combat,facing,1600,true,weapon),x,y+20);}c.textAlign='left';};window.drawCostumeSheet();
  const checks=ids.map(id=>{
   const eq={...DEFAULT_EQUIPMENT,costume:id,upgrade:0},before=JSON.stringify(eq),idle=drawCell(eq),later=drawCell(eq,'idle',false,1,6900,false),earlier=drawCell(eq,'idle',false,1,100,false);
   const male=drawCell({...starterEquipment('male'),costume:id}),female=drawCell({...starterEquipment('female'),costume:id});
   const hidden=drawCell({...eq,visibility:{costume:false}}),normal=drawCell({...eq,costume:'costume-none'});
   const movement=[0,10,20,30].map(distance=>{const cv=document.createElement('canvas');cv.width=cv.height=310;const m=createAvatarMotion(1);m.walk=1;drawAvatar(cv.getContext('2d'),eq,165,295,265,1000,true,1,false,m,{pose:'walk',movementDistance:distance});return cv.toDataURL();});
   const poseCounts=poses.flatMap(pose=>[1,-1].flatMap(facing=>[false,true].map(combat=>({pose,facing,combat,pixels:count(drawCell(eq,pose,combat,facing))}))));
   return {id,frames:[0,1,2,3].map(i=>{const f=getCostumeFrame(id,i);return {width:f.canvas.width,height:f.canvas.height,pixels:count(f.canvas)};}),idlePixels:count(idle),portraitPixels:count(getCostumePortrait(id)),static:later.toDataURL()===earlier.toDataURL(),unisexIdentical:male.toDataURL()===female.toDataURL(),hideRestoresUnderlying:hidden.toDataURL()===normal.toDataURL(),inputUnchanged:JSON.stringify(eq)===before,walkingFrames:new Set(movement).size,weaponVisible:drawCell(eq,'aim',true,1,1600,true,true).toDataURL()!==drawCell(eq,'aim',true,1,1600,true,false).toDataURL(),poseCounts};
  });
  const equipped={...DEFAULT_EQUIPMENT,hat:'hat-cap',glasses:'glasses-sport',visibility:{hat:false,glasses:false}},canonical={...equipped,hat:'hat-none',glasses:'glasses-none'};
  // Warm the lazy headwear cache, then compare both paths with identical motion.
  drawCell(equipped);drawCell(canonical);await new Promise(r=>setTimeout(r,150));
  return {checks,visibilityUsesOpenHair:drawCell(equipped).toDataURL()===drawCell(canonical).toDataURL()};
 });
 await page.locator('#costume-sheet').screenshot({path:'test-results/costumes-preview-right.png'});
 await page.evaluate(()=>window.drawCostumeSheet(false,-1));await page.locator('#costume-sheet').screenshot({path:'test-results/costumes-preview-left.png'});
 await page.evaluate(()=>window.drawCostumeSheet(true,1));await page.locator('#costume-sheet').screenshot({path:'test-results/costumes-combat-right.png'});
 await page.evaluate(()=>window.drawCostumeSheet(true,1,true));await page.locator('#costume-sheet').screenshot({path:'test-results/costumes-combat-armed.png'});
 for(const costume of report.checks){assert.ok(costume.frames.every(f=>f.pixels>20000),'Four populated transparent frames');assert.ok(costume.idlePixels>15000&&costume.portraitPixels>70000,'Painted artwork present');assert.ok(costume.static,'Inventory preview must stay still');assert.ok(costume.unisexIdentical,'Same costume across both genders');assert.ok(costume.hideRestoresUnderlying,'Hidden costume restores equipped cosmetics');assert.ok(costume.inputUnchanged,'No equipment mutation');assert.ok(costume.walkingFrames>=3,'Travel changes painted foot contacts');assert.ok(costume.weaponVisible,'Combat still draws the equipped weapon');assert.ok(costume.poseCounts.every(p=>p.pixels>7000),'Every pose and direction renders');}
 assert.ok(report.visibilityUsesOpenHair,'Hidden hat uses the uncovered hairstyle');assert.deepEqual(errors,[]);
 await writeFile('test-results/costumes-report.json',JSON.stringify({ok:true,...report,errors},null,2));console.log(JSON.stringify({ok:true,...report,errors},null,2));
}finally{await browser.close();}
