import {enterGame} from './character-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const output='test-results/cartographer';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1160}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,process.env.BASE_URL??'http://127.0.0.1:8097/?dev=live');
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig,getOutfitPortrait,getAccessoryPortrait,getFacePortrait}=await import('/src/game/appearance.ts');
  const {drawAvatar,drawAvatarPortrait,createAvatarMotion}=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,CATALOG,ITEMS}=await import('/shared/catalog.ts');
  const ids=['outfit-cartographer','hair-horizon','glasses-navigator'];
  for(const id of ids){const item=CATALOG[id];if(!item||item.gender!=='male')throw new Error(`${id}: missing male catalog entry`);}
  const faceIds=ITEMS.filter(item=>item.slot==='face').map(item=>item.id);
  const paths=[...ids.map(id=>CATALOG[id].visual.asset),'/assets/outfits/cartographer-walk.png','/assets/character-base.png','/assets/hair-covered-atlas.png','/assets/headwear-worn-atlas.png',...faceIds.map(id=>CATALOG[id].visual.asset)];
  await Promise.all([...new Set(paths)].map(path=>new Promise((resolve,reject)=>{const image=asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(`Asset unavailable: ${path}`)),{once:true});})));
  const body=getOutfitPortrait('outfit-cartographer'),hair=getAccessoryPortrait('hair-horizon'),glasses=getAccessoryPortrait('glasses-navigator');
  if(!body||!hair||!glasses)throw new Error('At least one card illustration is missing');
  const cases=[
   ['parado · descoberto', 'hat-none','idle',false,1,false],
   ['parado · boné', 'hat-cap','idle',false,1,false],
   ['parado · boné, esquerda', 'hat-cap','idle',false,-1,false],
   ['caminhada · boné', 'hat-cap','walk',true,1,false],
   ['caminhada · descoberto', 'hat-none','walk',true,-1,false],
   ['mira · boné', 'hat-cap','aim',false,1,false],
   ['disparo · descoberto', 'hat-none','fire',false,1,false],
   ['combate · boné', 'hat-cap','idle',false,1,true],
   ['combate · esquerda', 'hat-none','fire',false,-1,true]
  ];
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#10243d';
  const sheet=document.createElement('canvas');sheet.id='cartographer-sheet';sheet.width=1500;sheet.height=1160;document.body.append(sheet);
  const c=sheet.getContext('2d');c.fillStyle='#10243d';c.fillRect(0,0,sheet.width,sheet.height);
  c.fillStyle='#f8e3ae';c.font='bold 28px Arial';c.fillText('CARTÓGRAFO · REGISTRO DE POSES E EQUIPAMENTO',25,42);
  const results=[];
  for(let index=0;index<cases.length;index++){
   const [label,hat,pose,walking,facing,combat]=cases[index],col=index%3,row=Math.floor(index/3),left=col*500,top=70+row*360;
   const equipment={...DEFAULT_EQUIPMENT,outfit:'outfit-cartographer',hair:'hair-horizon',glasses:'glasses-navigator',hat};
   const rig=avatarRig(equipment);if(!rig||!rig.walking||!rig.combat||rig.outfitPose!=='cartographer')throw new Error(`${label}: incomplete avatar rig ${JSON.stringify({rig:!!rig,walking:!!rig?.walking,combat:!!rig?.combat,pose:rig?.outfitPose})}`);
   c.fillStyle='#173b5a';c.fillRect(left+8,top+8,484,340);c.strokeStyle='#7399ac';c.lineWidth=2;c.strokeRect(left+8,top+8,484,340);
   c.fillStyle='#f2e6c6';c.font='bold 19px Arial';c.fillText(label,left+22,top+34);
   const preview=document.createElement('canvas');preview.width=470;preview.height=292;const p=preview.getContext('2d'),motion=createAvatarMotion(facing);
   for(let frame=0;frame<54;frame++){p.clearRect(0,0,470,292);drawAvatar(p,equipment,235,272,combat?280:255,2000+frame*16,walking,facing,false,motion,{pose,combat,angle:50,poseTime:100});}
   const pixels=p.getImageData(0,0,470,292).data;let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)painted++;
   c.drawImage(preview,left+15,top+45);results.push({label,painted,hasWalking:true,hasCombat:true});
  }
  const faces=document.createElement('canvas');faces.id='cartographer-faces';faces.width=1200;faces.height=310;document.body.append(faces);
  const fc=faces.getContext('2d');fc.fillStyle='#10243d';fc.fillRect(0,0,faces.width,faces.height);
  const baseline=getFacePortrait(faceIds[0]).getContext('2d').getImageData(0,0,1254,1254).data;
  let alphaMismatch=0;
  faceIds.forEach((face,index)=>{
   const pixels=getFacePortrait(face).getContext('2d').getImageData(0,0,1254,1254).data;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==baseline[i])alphaMismatch++;
   const equipment={...DEFAULT_EQUIPMENT,face,hair:'hair-horizon',glasses:'glasses-navigator',hat:index%2?'hat-cap':'hat-none'};
   drawAvatarPortrait(fc,equipment,index*200+12,47,176);fc.fillStyle='#f4e6c6';fc.font='14px Arial';fc.fillText(face,200*index+9,29);
  });
  const hats=document.createElement('canvas');hats.id='cartographer-hats';hats.width=1200;hats.height=310;document.body.append(hats);
  const hc=hats.getContext('2d');hc.fillStyle='#10243d';hc.fillRect(0,0,hats.width,hats.height);
  const hatIds=['hat-cap','hat-thunder','hat-tide','hat-ruby','hat-tropical','hat-mage'];
  hatIds.forEach((hat,index)=>{const equipment={...DEFAULT_EQUIPMENT,face:'face-brave',hair:'hair-horizon',glasses:'glasses-navigator',hat};drawAvatarPortrait(hc,equipment,index*200+12,47,176);hc.fillStyle='#f4e6c6';hc.font='14px Arial';hc.fillText(hat,200*index+9,29);});
  return {cards:{outfit:[body.width,body.height],hair:[hair.width,hair.height],glasses:[glasses.width,glasses.height]},faces:faceIds.length,hats:hatIds.length,alphaMismatch,results};
 });
 await page.locator('#cartographer-sheet').screenshot({path:`${output}/poses.png`});
 await page.evaluate(()=>{const source=document.querySelector('#cartographer-sheet'),zoom=document.createElement('canvas');zoom.id='cartographer-neck';zoom.width=zoom.height=600;zoom.getContext('2d').drawImage(source,180,170,150,150,0,0,600,600);document.body.append(zoom);});
 await page.locator('#cartographer-neck').screenshot({path:`${output}/neck.png`});
 await page.locator('#cartographer-faces').screenshot({path:`${output}/faces.png`});
 await page.locator('#cartographer-hats').screenshot({path:`${output}/hats.png`});
 assert.equal(report.results.length,9);
 assert.ok(report.faces>=6);
 assert.equal(report.hats,6);
 assert.equal(report.alphaMismatch,0);
 assert.ok(report.results.every(result=>result.painted>3500),JSON.stringify(report.results));
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
