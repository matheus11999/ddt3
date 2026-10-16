import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1450,height:820},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const {getFacePortrait,asset}=await import('/src/game/appearance.ts');
  const {drawAvatar}=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const faces=ITEMS.filter(item=>item.slot==='face'),ids=faces.map(item=>item.id);
  await Promise.all(['/assets/character-base.png','/assets/adventurer.png','/assets/hair-spiky.png','/assets/hat-cap.png','/assets/hair-covered-atlas.png','/assets/headwear-worn-atlas.png',...ids.map(id=>`/assets/faces/${id}.png`)].map(path=>new Promise((resolve,reject)=>{const i=asset(path);if(i.complete&&i.naturalWidth)return resolve();i.addEventListener('load',resolve,{once:true});i.addEventListener('error',()=>reject(new Error(path)),{once:true});})));
  const images=ids.map(id=>getFacePortrait(id).getContext('2d').getImageData(0,0,1254,1254).data);
  let alphaMismatch=0;const differences=[];
  for(let n=1;n<images.length;n++){let different=0;for(let p=0;p<images[0].length;p+=4){if(images[0][p+3]!==images[n][p+3])alphaMismatch++;if(Math.abs(images[0][p]-images[n][p])+Math.abs(images[0][p+1]-images[n][p+1])+Math.abs(images[0][p+2]-images[n][p+2])>60)different++;}differences.push(different);}
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#f0dfbf;overflow:hidden';
  const sheet=document.createElement('canvas');sheet.width=1450;sheet.height=80+Math.ceil(ids.length/5)*740;document.body.append(sheet);const c=sheet.getContext('2d');
  c.fillStyle='#f0dfbf';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#4c3437';c.font='bold 26px Georgia';c.fillText('ROSTOS · MESMA CABEÇA, EXPRESSÕES DIFERENTES',35,42);
  for(let n=0;n<ids.length;n++){
   const x=145+(n%5)*290;c.save();c.translate(0,Math.floor(n/5)*740);c.fillStyle='#72513c';c.font='bold 17px Arial';c.textAlign='center';c.fillText(faces[n].name,x,78);
   drawAvatar(c,{...DEFAULT_EQUIPMENT,hat:'hat-none',face:ids[n]},x,381,279,1000,false,1,false);
   drawAvatar(c,{...DEFAULT_EQUIPMENT,hat:'hat-cap',face:ids[n]},x,708,279,1000,false,1,false);
   c.drawImage(getFacePortrait(ids[n]),425,180,420,416,x-34,730,68,67);c.restore();
  }
  return {faces:ids.length,alphaMismatch,expressionPixelsChanged:differences,sheetHeight:sheet.height};
 });
 await page.setViewportSize({width:1450,height:report.sheetHeight});
 await page.screenshot({path:'test-results/faces-contact-sheet.png'});
 assert.equal(report.alphaMismatch,0,'Every expression must keep exactly the same alpha silhouette');
 assert.ok(report.faces>=5,'The complete starter expression set must remain available');
 assert.ok(report.expressionPixelsChanged.every(n=>n>3000),'Expressions must change facial drawing, not only names');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,...report},null,2));
}finally{await browser.close();}
