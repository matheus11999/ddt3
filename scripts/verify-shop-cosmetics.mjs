import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1680,height:1180}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL??'http://127.0.0.1:5177',{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const {asset,avatarRig,getFacePortrait,getAccessoryPortrait,PAINTED_ACCESSORIES}=await import('/src/game/appearance.ts');
  const {drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts');
  const {DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const load=path=>new Promise((resolve,reject)=>{const image=asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(path)),{once:true});});
  await Promise.all(['/assets/character-base.png','/assets/adventurer.png','/assets/hair-spiky.png','/assets/hair-wavy.png','/assets/outfit-surfer-body.png','/assets/outfits/outfit-surfer-walk.png','/assets/outfits/combat-prone.png','/assets/hat-cap.png','/assets/hair-covered-atlas.png','/assets/headwear-worn-atlas.png','/assets/hat-mage.png','/assets/shop-hats.png','/assets/outfits/shop-outfits.png','/assets/outfits/shop-walking-legs.png','/assets/shop-accessories.png',...ITEMS.filter(i=>i.slot==='face').map(i=>i.visual.asset)].map(load));
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#122137';
  const sheet=document.createElement('canvas');sheet.id='cosmetic-sheet';sheet.width=1680;sheet.height=1180;document.body.append(sheet);const c=sheet.getContext('2d');
  c.fillStyle='#122137';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#e8f2ff';c.font='bold 25px Arial';c.fillText('COLEÇÃO DA LOJA · MESMA CABEÇA E ENCAIXES',25,38);
  const outfits=['outfit-racer','outfit-dancer'],hairs=location.search.includes('wavy')?['hair-wavy','hair-wavy']:['hair-undercut','hair-ponytail'],glasses=['glasses-sport','glasses-cat'];
  const rigs=[],bounds=[];
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){
   const index=row%2,eq={...DEFAULT_EQUIPMENT,outfit:outfits[index],hair:hairs[index],glasses:col===0?'glasses-none':glasses[col%2],face:col===0?'face-brave':'face-wink',hat:col===5?(location.search.includes('newhats')?['hat-thunder','hat-tide','hat-ruby','hat-tropical']:['hat-cap','hat-mage','hat-pilot','hat-knight'])[row]:'hat-none'},facing=col===4?-1:1,combat=row>=2,pose=col===2?'walk':col===3?'fire':'idle',motion=createAvatarMotion(facing);
   const cell=document.createElement('canvas');cell.width=280;cell.height=250;const cc=cell.getContext('2d');
   for(let f=0;f<50;f++){cc.clearRect(0,0,280,250);drawAvatar(cc,eq,140,235,combat?280:240,1000+f*16,pose==='walk',facing,false,motion,{pose,combat,angle:45,poseTime:100});}
   const rig=avatarRig(eq);rigs.push(!!rig&&!!rig.combat&&!!rig.walking&&rig.outfitPose===eq.outfit.replace('outfit-',''));c.fillStyle='#e8f2ff';c.font='13px Arial';c.fillText(`${index?'Rubi':'Piloto'} · ${combat?'combate':pose} · ${eq.glasses.replace('glasses-','')}`,col*280+10,70+row*275);c.drawImage(cell,col*280,80+row*275);
   const data=cc.getImageData(0,0,280,250).data;let colored=0;for(let p=3;p<data.length;p+=4)if(data[p]>20)colored++;bounds.push(colored);
  }
  const base=getFacePortrait('face-brave').getContext('2d').getImageData(0,0,1254,1254).data,newFace=getFacePortrait('face-wink').getContext('2d').getImageData(0,0,1254,1254).data;let alphaMismatch=0;for(let p=3;p<base.length;p+=4)if(base[p]!==newFace[p])alphaMismatch++;
  const accessories=Object.keys(PAINTED_ACCESSORIES).map(id=>({id,ready:!!getAccessoryPortrait(id)}));
  return {cases:bounds.length,rigsReady:rigs.every(Boolean),alphaMismatch,accessories,minPaintedPixels:Math.min(...bounds)};
 });
 await page.locator('#cosmetic-sheet').screenshot({path:process.env.OUTPUT??(process.env.BASE_URL?.includes('wavy')?'test-results/shop-wavy-hair-sheet.png':'test-results/shop-cosmetics-sheet.png')});
 assert.equal(report.alphaMismatch,0);assert.ok(report.rigsReady);assert.ok(report.accessories.every(i=>i.ready));assert.ok(report.minPaintedPixels>5000);assert.deepEqual(errors,[]);
 await writeFile('test-results/shop-cosmetics-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
