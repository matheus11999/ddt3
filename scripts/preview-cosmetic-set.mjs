import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// One cosmetic set where the game shows it: shop icons, standing and walking in the lobby (painted walk sheet),
// with and without the hat, and the painted battle frames (lying, crawling, kneeling throw).
// Usage: node scripts/preview-cosmetic-set.mjs outfit-captain hair-captain hat-captain glasses-captain
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/cosmetic-set.
const ids=process.argv.slice(2);
const output=process.env.OUTPUT_DIR??'test-results/cosmetic-set';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const image=await page.evaluate(async ids=>{
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),H=await import('/src/game/headwear.ts');
  const {CATALOG,DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts'),walkContract=(await import('/src/game/rig/walkFrames.json')).default;
  const walk=(await import('/src/game/walkAtlas.json')).default,combat=(await import('/src/game/combatAtlas.json')).default;
  const load=path=>new Promise(resolve=>{const img=A.asset(path);if(img.complete&&img.naturalWidth)return resolve();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});
  await Promise.all([...new Set(['/assets/character-base.png','/assets/hair-covered-atlas.png',...Object.values(walk).map(a=>a.path),...Object.values(combat).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean)])].map(load));
  await new Promise(resolve=>{const img=new Image();img.onload=resolve;img.onerror=resolve;img.src='/assets/headwear-worn-atlas.png';});
  await new Promise(resolve=>setTimeout(resolve,600));
  const set=Object.fromEntries(ids.map(id=>[CATALOG[id].slot,id])),full={...DEFAULT_EQUIPMENT,face:'face-brave',hat:'hat-none',glasses:'glasses-none',...set};
  const sheet=document.createElement('canvas');sheet.width=1400;sheet.height=1120;const c=sheet.getContext('2d');
  const bg=c.createLinearGradient(0,0,0,sheet.height);bg.addColorStop(0,'#2d4f7c');bg.addColorStop(1,'#1b2c47');c.fillStyle=bg;c.fillRect(0,0,sheet.width,sheet.height);
  const title=(text,x,y)=>{c.fillStyle='#ffe6a6';c.font='bold 20px Georgia';c.fillText(text,x,y);};
  // Shop icons.
  title('LOJA',20,34);
  ids.forEach((id,i)=>{const slot=CATALOG[id].slot,art=slot==='hat'?H.getWornHatPortrait(id):slot==='outfit'?A.getOutfitPortrait(id):slot==='face'?A.getFacePortrait(id):A.getAccessoryPortrait(id);const x=20+i*170,y=50;
   c.fillStyle='#f3e3c3';c.fillRect(x,y,150,150);c.strokeStyle='#8a5a2b';c.lineWidth=3;c.strokeRect(x,y,150,150);
   if(art){const k=Math.min(130/art.width,130/art.height);c.drawImage(art,x+75-art.width*k/2,y+75-art.height*k/2,art.width*k,art.height*k);}
   c.fillStyle='#fff';c.font='13px sans-serif';c.fillText(CATALOG[id].name,x,y+168);});
  // Lobby: standing big, then walk frames, with and without the hat.
  title('LOBBY · PARADO E ANDANDO',20,262);
  const floor=(x,y,w)=>{c.fillStyle='#5b4228';c.fillRect(x,y,w,16);};
  [full,{...full,hat:'hat-none'}].forEach((eq,row)=>{const y=520+row*280;
   floor(20,y,1360);
   [-1,0,1,2,3,4,5].forEach((frame,i)=>{const m=V.createAvatarMotion(1);m.walk=frame<0?0:1;m.phase=frame<0?0:(frame+.5)*walkContract.frameUnits*Math.PI*2/44;m.lastTime=1000;
    V.drawAvatar(c,eq,90+i*190,y,frame<0?250:230,1016,frame>=0,1,false,m,{movementDistance:0,animated:true});});});
  // Battle.
  title('BATALHA',20,850);floor(20,1080,1360);
  [['idle',0],['walk',0],['charge',0],['fire',30],['fire',120],['hit',40]].forEach(([pose,t],i)=>{const m=V.createAvatarMotion(1);
   for(let f=0;f<24;f++)V.drawAvatar(document.createElement('canvas').getContext('2d'),full,0,0,1,1000+f*16,pose==='walk',1,true,m,{combat:true,pose,angle:50,power:70,poseTime:t,movementDistance:pose==='walk'?1.2:0});
   V.drawAvatar(c,full,110+i*225,1080,200,1400,pose==='walk',1,true,m,{combat:true,pose,angle:50,power:70,poseTime:t,movementDistance:pose==='walk'?1.2:0});
   c.fillStyle='#e8f2ff';c.font='13px sans-serif';c.fillText(pose,80+i*225,1105);});
  return sheet.toDataURL('image/png');
 },ids);
 await writeFile(`${output}/${ids[0]??'set'}.png`,Buffer.from(image.split(',')[1],'base64'));
 console.log(JSON.stringify({file:`${output}/${ids[0]??'set'}.png`,errors}));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
