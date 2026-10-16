import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig,getOutfitPortrait,paintedOutfitReady,ENABLE_MODULAR_APPEARANCE}=await import('/src/game/appearance.ts');
  const {drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,CATALOG}=await import('/shared/catalog.ts');
  const paths=['/assets/character-base.png','/assets/adventurer.png','/assets/hair-spiky.png','/assets/hat-cap.png','/assets/hair-covered-atlas.png','/assets/headwear-worn-atlas.png','/assets/faces/face-brave.png','/assets/faces/face-fierce.png','/assets/outfit-surfer-body.png','/assets/outfit-executive-body.png','/assets/outfits/outfit-surfer-walk.png','/assets/outfits/outfit-executive-walk.png'];
  await Promise.all(paths.map(path=>new Promise((resolve,reject)=>{const i=asset(path);if(i.complete&&i.naturalWidth)return resolve();i.addEventListener('load',resolve,{once:true});i.addEventListener('error',()=>reject(new Error(path)),{once:true});})));
  const ids=['outfit-surfer','outfit-executive'],poses=['idle','walk','aim','charge','fire','hit','fall','prone','victory','defeat'];
  const baseRig=avatarRig(DEFAULT_EQUIPMENT),headData=baseRig.head.canvas.getContext('2d').getImageData(0,0,baseRig.head.canvas.width,baseRig.head.canvas.height).data;
  const outfits=ids.map(id=>{const rig=avatarRig({...DEFAULT_EQUIPMENT,outfit:id}),data=rig.head.canvas.getContext('2d').getImageData(0,0,rig.head.canvas.width,rig.head.canvas.height).data;let headChanged=0;for(let i=0;i<data.length;i++)if(data[i]!==headData[i])headChanged++;const dyed=avatarRig({...DEFAULT_EQUIPMENT,outfit:id,dyes:{outfit:'coral'}});let dyedPixels=0,warmMaterialsChanged=0,warmMaterials=0;
   for(const key of rig.stanceBody?['stanceBody']:['torso','leftArm','rightArm','leftLeg','rightLeg']){const before=rig[key].canvas.getContext('2d').getImageData(0,0,rig[key].canvas.width,rig[key].canvas.height).data,after=dyed[key].canvas.getContext('2d').getImageData(0,0,dyed[key].canvas.width,dyed[key].canvas.height).data;for(let p=0;p<before.length;p+=4){if(!before[p+3])continue;const changed=Math.abs(before[p]-after[p])+Math.abs(before[p+1]-after[p+1])+Math.abs(before[p+2]-after[p+2])>12;if(changed)dyedPixels++;if(before[p]>before[p+1]*1.05&&before[p+1]>before[p+2]*1.3){warmMaterials++;if(changed)warmMaterialsChanged++;}}}
   const portrait=getOutfitPortrait(id);return {id,dyedPixels,warmMaterials,warmMaterialsChanged,active:paintedOutfitReady(id)&&rig.paintedOutfit,headChanged,portrait:[portrait.width,portrait.height],distinctPaintedStance:!!rig.stanceBody,walkingRig:!!rig.walking,parts:Object.fromEntries((rig.stanceBody?['stanceBody']:['torso','leftArm','rightArm','leftLeg','rightLeg']).map(key=>[key,rig[key].canvas.getContext('2d').getImageData(0,0,rig[key].canvas.width,rig[key].canvas.height).data.filter((n,i)=>i%4===3&&n>0).length]))};});
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#182945;overflow:auto';
  const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=80+ids.length*840;sheet.id='outfit-sheet';document.body.append(sheet);const c=sheet.getContext('2d');
  const drawSheet=(facing,start=0)=>{
   sheet.width=1800;sheet.height=80+(ids.length-start)*840;
   c.fillStyle='#182945';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#fff2c8';c.font='bold 30px Georgia';c.fillText(`ROUPAS COMPLETAS · DEZ POSES · ${facing>0?'DIREITA':'ESQUERDA'}`,35,44);
   for(let n=start*10;n<ids.length*10;n++){
    const id=ids[Math.floor(n/10)],pose=poses[n%10],x=(n%5)*360,y=80+Math.floor((n-start*10)/5)*420;
    c.fillStyle=['#174c5b','#292d4e'][Math.floor(n/10)];c.fillRect(x+8,y,344,409);c.textAlign='center';c.fillStyle='#fff2c8';c.font='bold 18px Arial';c.fillText(`${id.replace('outfit-','')} · ${pose}`,x+180,y+28);
    const eq={...DEFAULT_EQUIPMENT,outfit:id,hat:n%3===0?'hat-cap':'hat-none',glasses:n%3===1?'glasses-round':'glasses-none'};
    const cell=document.createElement('canvas');cell.width=cell.height=360;const ctx=cell.getContext('2d'),motion=createAvatarMotion(facing);
    for(let frame=0;frame<60;frame++){ctx.clearRect(0,0,360,360);drawAvatar(ctx,eq,180,335,282,1000+frame*16,pose==='walk',facing,false,motion,{pose,poseTime:90,angle:55,power:80,slope:pose==='aim'?.25:0});}
    c.drawImage(cell,x,y+30);
   }
   c.textAlign='left';
  };
  window.drawOutfitSheet=drawSheet;drawSheet(1);
  window.drawOutfitComparison=(start=0)=>{
   sheet.width=(ids.length-start)*450;sheet.height=760;c.fillStyle='#172944';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#fff2c8';c.font='bold 30px Georgia';c.fillText(start?'POSES EXCLUSIVAS POR ROUPA':'VISUAIS E POSES DOS CONJUNTOS',40,50);
   for(let i=start;i<ids.length;i++){
    const x=(i-start)*450+225;c.textAlign='center';c.font='bold 22px Arial';c.fillStyle='#fff2c8';c.fillText(CATALOG[ids[i]].name,x,110);
    const m=createAvatarMotion(1);for(let frame=0;frame<60;frame++){c.fillStyle='#172944';c.fillRect((i-start)*450,135,450,625);drawAvatar(c,{...DEFAULT_EQUIPMENT,outfit:ids[i],hat:'hat-none',glasses:'glasses-none'},x,708,525,1000+frame*16,false,1,false,m,{pose:'idle'});}
   }
  };
  return {outfits,poses,modularRolloutRemainsDisabled:ENABLE_MODULAR_APPEARANCE===false};
 });
 await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-right.png'});
 await page.evaluate(()=>window.drawOutfitSheet(-1));
 await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-left.png'});
 assert.ok(report.outfits.every(o=>o.active&&o.headChanged===0&&Object.values(o.parts).every(n=>n>4000)),'All outfits must be complete, active, and preserve exact universal head pixels');
 await page.evaluate(()=>window.drawOutfitComparison());
 await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-comparison.png'});
 await page.evaluate(()=>window.drawOutfitComparison());await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-new-poses.png'});
 await page.evaluate(()=>window.drawOutfitSheet(1));await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-new-right.png'});
 await page.evaluate(()=>window.drawOutfitSheet(-1));await page.locator('#outfit-sheet').screenshot({path:'test-results/outfits-new-left.png'});
 assert.ok(report.outfits.filter(o=>['outfit-surfer','outfit-executive'].includes(o.id)).every(o=>o.distinctPaintedStance&&o.walkingRig),'New costumes must preserve their own painted stance');
 assert.ok(report.outfits.every(o=>o.dyedPixels>5000&&o.warmMaterials>1000&&o.warmMaterialsChanged/o.warmMaterials<.02),'Dye must recolor cloth while preserving warm metal and leather');
 assert.equal(report.modularRolloutRemainsDisabled,true);
 assert.deepEqual(errors,[]);
 await writeFile('test-results/outfits-report.json',JSON.stringify({ok:true,...report},null,2));
 console.log(JSON.stringify({ok:true,...report},null,2));
}finally{await browser.close();}
