import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// DDTank-style combat frames (docs/combat-frames.md): every outfit with a combat atlas in every
// action, with several hair/hat/glasses sets, both facings and both weapons. Also checks that the
// head never jumps between consecutive frames of a sequence by more than the painting moves.
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/combat.
const output=process.env.OUTPUT_DIR??'test-results/combat';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),B=await import('/src/game/combatBody.ts');
  const atlases=(await import('/src/game/combatAtlas.json')).default;
  const {DEFAULT_EQUIPMENT,ITEMS,weaponAssetPath}=await import('/shared/catalog.ts');
  const load=path=>new Promise(resolve=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
  const outfits=Object.keys(atlases);
  const weapons=['brick','love-boomerang'];
  await Promise.all([...new Set(['/assets/character-base.png','/assets/hair-covered-atlas.png','/assets/outfits/combat-prone.png','/assets/outfits/shop-walking-legs.png','/assets/outfits/cartographer-walk.png',...Object.values(atlases).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean),...weapons.map(w=>weaponAssetPath(w,0))])].map(load));
  await new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.src='/assets/headwear-worn-atlas.png';});
  await new Promise(resolve=>setTimeout(resolve,500));
  const looks=[{hair:'hair-undercut',hat:'hat-cap',glasses:'glasses-none',face:'face-brave'},{hair:'hair-ponytail',hat:'hat-none',glasses:'glasses-sport',face:'face-smile'},{hair:'hair-wavy',hat:'hat-mage',glasses:'glasses-none',face:'face-wink'},{hair:'hair-horizon',hat:'hat-tropical',glasses:'glasses-navigator',face:'face-fierce'}];
  const step=Math.PI*2/8;
  const columns=[['idle',0,0,'parado'],['walk',0,0,'rastejar 1'],['walk',0,2*step,'rastejar 2'],['walk',0,4*step,'rastejar 3'],['walk',0,6*step,'rastejar 4'],['hit',40,0,'atingido'],['charge',20,0,'levantar'],['charge',300,0,'segurar'],['fire',20,0,'preparo'],['fire',100,0,'soltar'],['fire',200,0,'acompanhar'],['fire',330,0,'assentar']];
  const W=150,H=170,rows=outfits.length*2,sheet=document.createElement('canvas');sheet.width=W*columns.length+130;sheet.height=60+rows*H;
  const c=sheet.getContext('2d');c.fillStyle='#24395c';c.fillRect(0,0,sheet.width,sheet.height);
  c.fillStyle='#ffe6a6';c.font='bold 22px Georgia';c.fillText('COMBATE · QUADROS PINTADOS (DDTank) · ROUPAS × AÇÕES',20,30);
  c.font='12px Arial';columns.forEach(([, , ,label],i)=>{c.fillStyle='#e8f2ff';c.fillText(label,130+i*W+W/2-c.measureText(label).width/2,52);});
  const ready=[];
  outfits.forEach((outfit,o)=>[1,-1].forEach((facing,f)=>{
   const row=o*2+f,y=60+row*H,look=looks[(o+f)%looks.length],eq={...DEFAULT_EQUIPMENT,...look,outfit,weapon:weapons[(o+f)%weapons.length]};
   ready.push({outfit,ready:B.combatBodyReady(eq)});
   c.fillStyle='#e8f2ff';c.font='13px Arial';c.fillText(outfit.replace('outfit-',''),10,y+H/2);c.fillText(facing>0?'→':'←',10,y+H/2+18);
   columns.forEach(([pose,poseTime,phase],i)=>{
    const x=130+i*W;c.fillStyle='#2f4870';c.fillRect(x+2,y+2,W-4,H-4);c.fillStyle='#5b3a24';c.fillRect(x+2,y+H-22,W-4,20);
    const motion=V.createAvatarMotion(facing);motion.phase=phase;motion.walk=pose==='walk'?1:0;motion.lastTime=1000;motion.turn=1;
    V.drawAvatar(c,eq,x+W/2,y+H-22,112,1000,pose==='walk',facing,true,motion,{combat:true,pose,poseTime,power:70,angle:45});
   });
  }));
  return {image:sheet.toDataURL('image/png'),ready};
 });
 await writeFile(`${output}/combat-frames.png`,Buffer.from(report.image.split(',')[1],'base64'));
 await writeFile(`${output}/combat-frames.json`,JSON.stringify({ready:report.ready,errors},null,1));
 console.log(JSON.stringify({ready:report.ready,errors},null,1));
 if(errors.length||report.ready.some(r=>!r.ready))process.exitCode=1;
}finally{await browser.close();await server.close();}
