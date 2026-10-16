import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:2040}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL??'http://127.0.0.1:5177',{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig,drawPart,drawHeadLayers,drawHeadRearLayers}=await import('/src/game/appearance.ts');
  const {DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  await Promise.all([...new Set(['/assets/character-base.png','/assets/adventurer.png','/assets/hat-cap.png','/assets/hair-covered-atlas.png','/assets/headwear-worn-atlas.png','/assets/hat-mage.png',...ITEMS.flatMap(i=>i.visual?.asset?[i.visual.asset]:[])])].map(path=>new Promise((resolve,reject)=>{
   const img=asset(path);if(img.complete&&img.naturalWidth)return resolve();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(new Error(path)),{once:true});
  })));
  const hats=location.search.includes('hats'),faces=hats?ITEMS.filter(i=>i.slot==='hair'):ITEMS.filter(i=>i.slot==='face'),glasses=hats?(location.search.includes('new')?['none','thunder','tide','ruby','tropical']:['none','cap','mage','pilot','knight']):['none','round','pilot','sport','cat'];
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#132136';
  const sheet=document.createElement('canvas');sheet.id='glasses-sheet';sheet.width=1600;sheet.height=faces.length*340;document.body.append(sheet);const c=sheet.getContext('2d');
  const cases=[];
  faces.forEach((face,row)=>glasses.forEach((variant,col)=>{
   const eq={...DEFAULT_EQUIPMENT,face:hats?'face-brave':face.id,glasses:hats?(col%2?'glasses-cat':'glasses-sport'):`glasses-${variant}`,hat:hats?`hat-${variant}`:'hat-none',hair:hats?face.id:row%2?'hair-ponytail':'hair-spiky'},rig=avatarRig(eq);
   if(!rig)throw new Error(`Rig missing: ${face.id}`);
   c.fillStyle='#132136';c.fillRect(col*320,row*340,320,340);c.fillStyle='#edf6ff';c.font='16px Arial';c.fillText(`${face.name} · ${variant}`,col*320+12,row*340+24);
   c.save();c.translate(col*320+150,row*340+(hats?550:600));c.scale(hats?2.8:3.5,hats?2.8:3.5);drawHeadRearLayers(c,eq,1000,'idle',true);drawPart(c,rig.head);drawHeadLayers(c,eq,1000,'idle',true);c.restore();
   cases.push(`${face.id}/${variant}`);
  }));return {cases};
 });
 await page.locator('#glasses-sheet').screenshot({path:process.env.OUTPUT??'test-results/glasses-fit.png'});
 assert.equal(report.cases.length,30);assert.deepEqual(errors,[]);
 await writeFile('test-results/glasses-report.json',JSON.stringify(report,null,2));console.log(`Verified ${report.cases.length} face/glasses combinations`);
}finally{await browser.close();}
