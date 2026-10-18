import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Lobby walk sheets (docs/combat-frames.md, "Andar do lobby"): every outfit with a walk atlas standing and in
// each painted step, with two looks and both facings, so the head can be checked against every painting.
// Optional: BROWSER_EXECUTABLE=/path/to/chromium, OUTPUT_DIR=test-results/walk.
const output=process.env.OUTPUT_DIR??'test-results/walk';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const report=await page.evaluate(async()=>{
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),contract=(await import('/src/game/rig/walkFrames.json')).default;
  const atlases=(await import('/src/game/walkAtlas.json')).default,{DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const load=path=>new Promise(resolve=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
  await Promise.all([...new Set(['/assets/character-base.png','/assets/hair-covered-atlas.png',...Object.values(atlases).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean)])].map(load));
  await new Promise(resolve=>setTimeout(resolve,500));
  const looks=[{hair:'hair-undercut',hat:'hat-cap',face:'face-brave'},{hair:'hair-ponytail',hat:'hat-none',glasses:'glasses-sport',face:'face-smile',skin:'#8d5a3b'}];
  const outfits=Object.keys(atlases),columns=[-1,...contract.frames.map((_,i)=>i)],W=230,H=300;
  const sheet=document.createElement('canvas');sheet.width=130+W*columns.length;sheet.height=60+outfits.length*looks.length*2*H;
  const c=sheet.getContext('2d');c.fillStyle='#24395c';c.fillRect(0,0,sheet.width,sheet.height);
  c.fillStyle='#ffe6a6';c.font='bold 22px Georgia';c.fillText('LOBBY · ANDAR PINTADO (DDTank) · QUADROS',20,30);
  c.font='13px Arial';columns.forEach((frame,i)=>{const label=frame<0?'parado':contract.frames[frame].name;c.fillStyle='#e8f2ff';c.fillText(label,130+i*W+W/2-c.measureText(label).width/2,52);});
  let row=0;
  for(const outfit of outfits)for(const look of looks)for(const facing of [1,-1]){
   const y=60+row++*H,eq={...DEFAULT_EQUIPMENT,...look,outfit};
   c.fillStyle='#e8f2ff';c.fillText(outfit.replace(/^outfit-/,''),10,y+H/2);c.fillText(facing>0?'→':'←',10,y+H/2+18);
   columns.forEach((frame,i)=>{
    const x=130+i*W,m=V.createAvatarMotion(facing);m.walk=frame<0?0:1;m.phase=frame<0?0:(frame+.5)*contract.frameUnits*Math.PI*2/44;m.lastTime=1000;
    c.fillStyle='#5b4228';c.fillRect(x+4,y+H-34,W-8,30);
    V.drawAvatar(c,eq,x+W/2,y+H-34,240,1016,frame>=0,facing,false,m,{movementDistance:0,animated:true});
   });
  }
  return {outfits,image:sheet.toDataURL('image/png')};
 });
 await writeFile(`${output}/walk-frames.png`,Buffer.from(report.image.split(',')[1],'base64'));
 console.log(JSON.stringify({outfits:report.outfits,errors},null,1));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
