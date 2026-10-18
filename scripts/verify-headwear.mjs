import {enterGame} from './character-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Visual fixtures: these screenshots still require human inspection of the fit.
// BASE_URL='http://127.0.0.1:5177/?glasses=sport' node scripts/verify-headwear.mjs
// glasses: none (default), sport, cat, all. Optional face=face-wink.
const base=new URL(process.env.BASE_URL??'http://127.0.0.1:5177');
const selection=base.searchParams.get('glasses')??'none';
assert.ok(['none','sport','cat','all'].includes(selection),'glasses must be none, sport, cat or all');
const glasses=selection==='all'?['none','sport','cat']:[selection];
const requiredAtlases=['/assets/headwear-worn-atlas.png','/assets/hair-covered-atlas.png'];
const atlasEvidence=[];
for(const path of requiredAtlases){
 const file=new URL(`../public${path}`,import.meta.url);
 let bytes;
 try{bytes=await readFile(file);}catch{throw new Error(`New artwork is not ready: ${fileURLToPath(file)}. Do not validate the old artwork as a successful correction.`);}
 assert.ok(bytes.length>1000,`Incomplete new atlas: ${path}`);
 atlasEvidence.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const output=process.env.OUTPUT_DIR??'test-results/headwear';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:920},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base.href);await page.waitForLoadState('networkidle');
 // Confirm HTTP serves these exact files, rather than an old build or fallback HTML.
 for(const atlas of atlasEvidence){
  const response=await page.request.get(new URL(atlas.path,base).href);
  assert.ok(response.ok(),`${atlas.path}: HTTP ${response.status()}`);
  assert.equal(createHash('sha256').update(await response.body()).digest('hex'),atlas.sha256,`Served atlas differs from workspace: ${atlas.path}`);
 }
 const setup=await page.evaluate(async({requiredAtlases})=>{
  const appearance=await import('/src/game/appearance.ts');
  const {asset,avatarRig,drawPart,drawHeadLayers,drawHeadRearLayers}=appearance;
  if(typeof drawHeadRearLayers!=='function')throw new Error('The new rear headwear renderer is not ready; refusing to validate the old layer order.');
  const {drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts');
  const {CATALOG,DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const load=path=>new Promise((resolve,reject)=>{
   const image=asset(path);
   if(image.complete&&image.naturalWidth){resolve();return;}
   const timeout=setTimeout(()=>reject(new Error(`Timed out loading ${path}`)),15000);
   const ready=()=>{clearTimeout(timeout);resolve();};
   image.addEventListener('load',ready,{once:true});
   image.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error(`Cannot load ${path}`));},{once:true});
  });
  const dependencies=[...new Set([
   '/assets/character-base.png','/assets/hair-wavy.png',
   '/assets/outfits/cartographer-atlas.png',
   '/assets/outfits/cartographer-walk.png','/assets/outfits/combat-prone.png',
   
   '/assets/hat-cap.png','/assets/hat-mage.png','/assets/shop-hats.png','/assets/shop-accessories.png',
   ...requiredAtlases,...ITEMS.filter(item=>['face','hair','hat','outfit'].includes(item.slot)).map(item=>item.visual?.asset).filter(Boolean)
  ])];
  await Promise.all(dependencies.map(load));
  const hats=['hat-cap','hat-mage','hat-thunder','hat-tide','hat-ruby','hat-tropical'];
  const hairs=['hair-undercut','hair-ponytail','hair-wavy','hair-none'];
  const face=new URL(location.href).searchParams.get('face')??'face-brave';
  if(CATALOG[face]?.slot!=='face')throw new Error(`Unknown face: ${face}`);
  for(const id of [...hats,...hairs])if(!CATALOG[id])throw new Error(`Missing fixture item: ${id}`);
  document.body.replaceChildren();
  document.body.style.cssText='margin:0;background:#122137;overflow:auto';
  const sheet=document.createElement('canvas');sheet.id='headwear-sheet';sheet.width=1440;sheet.height=920;document.body.append(sheet);
  const c=sheet.getContext('2d');
  const paintedPixels=canvas=>{
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let count=0;for(let n=3;n<pixels.length;n+=4)if(pixels[n]>20)count++;
   return count;
  };
  window.renderHeadwearFixture=({kind,hatStart=0,hairStart=0,glasses='none'})=>{
   c.fillStyle='#122137';c.fillRect(0,0,sheet.width,sheet.height);
   c.fillStyle='#f0f7ff';c.font='bold 23px Arial';
   const title=kind==='poses'?'CHAPÉUS · AVATAR EM MOVIMENTO':kind==='baseline'?'CONTROLE · SEM CHAPÉU':'CHAPÉUS · ENCAIXE AMPLIADO';
   c.fillText(`${title} · ${CATALOG[`glasses-${glasses}`].name}`,20,35);
   c.font='14px Arial';c.fillStyle='#adbed3';c.fillText(`${CATALOG[face].name} · cabeça universal · inspeção de banda, franja, laterais e aba`,20,61);
   const cases=[];
   for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const index=row*4+col;
    if(kind==='baseline'&&index>=hairs.length)continue;
    const hat=kind==='baseline'?'hat-none':hats[hatStart+(kind==='poses'?row:col)];
    const hair=kind==='baseline'?hairs[index]:kind==='poses'?hairs[(hatStart+row)%hairs.length]:hairs[hairStart+row];
    if(!hat||!hair)continue;
    const outfit=kind==='poses'?(row?'outfit-cartographer':'outfit-cartographer'):'outfit-cartographer';
    const eq={...DEFAULT_EQUIPMENT,face,hat,hair,outfit,glasses:`glasses-${glasses}`};
    const rig=avatarRig(eq);
    if(!rig?.modular||!rig.head||!rig.combat||!rig.walking)throw new Error(`Incomplete rig: ${hat}/${hair}/${outfit}`);
    const cell=document.createElement('canvas');cell.width=360;cell.height=420;const cc=cell.getContext('2d');
    let pose='idle',combat=false,facing=1;
    if(kind==='poses'){
     ({pose,combat,facing}=[{pose:'walk',combat:false,facing:1},{pose:'walk',combat:false,facing:-1},{pose:'idle',combat:true,facing:-1},{pose:'fire',combat:true,facing:1}][col]);
     const motion=createAvatarMotion(facing);
     for(let frame=0;frame<50;frame++){
      cc.clearRect(0,0,360,420);
      drawAvatar(cc,eq,180,410,combat?400:340,1000+frame*16,pose==='walk',facing,false,motion,{pose,combat,angle:45,poseTime:100});
     }
    }else{
     cc.save();cc.translate(180,600);cc.scale(3,3);
     drawHeadRearLayers(cc,eq,1280,pose,rig.modular);
     drawPart(cc,rig.head);
     drawHeadLayers(cc,eq,1280,pose,rig.modular);
     cc.restore();
    }
    const count=paintedPixels(cell);
    if(count<1500)throw new Error(`Empty or clipped character: ${hat}/${hair}/${pose}`);
    const x=col*360,y=80+row*420;
    c.fillStyle='#deebfb';c.font='bold 15px Arial';c.fillText(CATALOG[hat].name,x+12,y+20);
    c.fillStyle='#aebfd5';c.font='13px Arial';c.fillText(kind==='poses'?`${CATALOG[hair].name} · ${combat?'combate':pose} · ${facing<0?'←':'→'}`:CATALOG[hair].name,x+12,y+40);
    c.drawImage(cell,x,y);
    cases.push({hat,hair,outfit,glasses,face,pose,combat,facing,paintedPixels:count});
   }
   return cases;
  };
  return {hats,hairs,face,dependencies};
 },{requiredAtlases});
 const sheets=[],cases=[];
 for(const eyewear of glasses){
  const capture=async(name,fixture)=>{
   const rendered=await page.evaluate(fixture=>window.renderHeadwearFixture(fixture),{...fixture,glasses:eyewear});
   const path=`${output}/${name}-${eyewear}.png`;
   await page.locator('#headwear-sheet').screenshot({path});
   sheets.push(path);cases.push(...rendered);
  };
  await capture('baseline',{kind:'baseline'});
  for(let hatStart=0;hatStart<setup.hats.length;hatStart+=4)for(let hairStart=0;hairStart<setup.hairs.length;hairStart+=2){
   await capture(`heads-hats-${hatStart+1}-${Math.min(hatStart+4,setup.hats.length)}-hairs-${hairStart+1}-${Math.min(hairStart+2,setup.hairs.length)}`,{kind:'heads',hatStart,hairStart});
  }
  for(let hatStart=0;hatStart<setup.hats.length;hatStart+=2)await capture(`poses-hats-${hatStart+1}-${hatStart+2}`,{kind:'poses',hatStart});
 }
 assert.deepEqual(errors,[],'Browser errors while rendering headwear');
 const report={renderingChecksPassed:true,visualApproval:'pending-human-inspection',url:base.href,atlasEvidence,...setup,sheets,cases,errors};
 await writeFile(`${output}/report-${selection}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({renderingChecksPassed:true,visualApproval:report.visualApproval,cases:cases.length,sheets,atlasEvidence},null,2));
}finally{await browser.close();}
