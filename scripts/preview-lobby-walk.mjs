import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Lobby walk in motion: the plaza's own chase (src/game/lobbyMotion.ts) at 60 fps for each outfit with a walk sheet,
// standing, walking to a target that moves at the server's speed (LOBBY_WALK_SPEED) and stopping. Writes a filmstrip and, per outfit, how the paintings change: steps
// per second, frames still striding after the stop (a couple at most) and frames where the body is missing (must be 0).
// Usage: node scripts/preview-lobby-walk.mjs [outfit ...]   Optional: BROWSER_EXECUTABLE, OUTPUT_DIR=test-results/lobby-walk.
const output=process.env.OUTPUT_DIR??'test-results/lobby-walk';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const result=await page.evaluate(async only=>{
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),W=await import('/src/game/walkBody.ts'),{chaseLobbyPosition}=await import('/src/game/lobbyMotion.ts');
  const idle=(await import('/src/game/idleAtlas.json')).default,{CATALOG,DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts'),{LOBBY_WALK_SPEED}=await import('/shared/lobby.ts'),walk=(await import('/src/game/walkAtlas.json')).default;
  const load=path=>new Promise(resolve=>{const img=A.asset(path);if(img.complete&&img.naturalWidth)return resolve();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});
  await Promise.all([...new Set(['/assets/character-base.png','/assets/hair-covered-atlas.png',...Object.values(walk).map(a=>a.path),...Object.values(idle).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean)])].map(load));
  await new Promise(resolve=>setTimeout(resolve,600));
  const outfits=only.length?only:Object.keys(walk),SIZE=134,FPS=60,frames=200,shots=[];const report={};
  for(const outfit of outfits){
   const eq={...DEFAULT_EQUIPMENT,outfit,hat:'hat-none'},m=V.createAvatarMotion(1),e={x:0,y:0};let held=0,noBody=0,afterStop=0,changes=0,last=-2,moving=false,movingFrames=0;const strip=[];
   for(let f=0;f<frames;f++){
    const t=1000+f*1000/FPS,target={x:Math.min(260,Math.max(0,f-20)*LOBBY_WALK_SPEED/FPS),y:0},old={...e},next=chaseLobbyPosition(e,target,1000/FPS);e.x=next.x;e.y=next.y;
    const wasMoving=moving;moving=Math.hypot(e.x-old.x,e.y-old.y)>.05;const distance=Math.hypot(e.x-old.x,e.y-old.y)*160/SIZE;
    const cell=document.createElement('canvas');cell.width=170;cell.height=200;const c=cell.getContext('2d');
    V.drawAvatar(c,eq,85,190,SIZE,t,moving,1,false,m,{movementDistance:distance,seed:7,world:true});
    // The body must always show: painted pixels below the head (lower half of the cell).
    {const d=c.getImageData(0,110,170,80).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;if(n<400)noBody++;}
    // Which painting shows: the walk frame by distance, or standing (-1).
    const sheet=W.hasWalkFrames(outfit)&&(moving?m.walk>.02:m.walk>.6),index=sheet?W.walkFrameIndex(m.phase*11*4/(Math.PI*2)):-1;
    if(moving){movingFrames++;if(index===last)held++;}else if(wasMoving||afterStop>0){if(index>=0)afterStop++;}
    if(index!==last)changes++;last=index;
    if(f%3===0)strip.push({cell,label:index<0?'parado':`passo ${index+1}`,moving});
   }
   const seconds=movingFrames/FPS;report[outfit]={stepsPerSecond:+(changes/Math.max(seconds,.01)).toFixed(1),movingFrames,stridingAfterStop:afterStop,framesWithoutBody:noBody};
   shots.push({outfit,strip});
  }
  const perRow=12,cw=170,ch=220,rows=shots.reduce((n,s)=>n+Math.ceil(s.strip.length/perRow),0),sheet=document.createElement('canvas');sheet.width=perRow*cw;sheet.height=rows*ch+shots.length*30;const c=sheet.getContext('2d');
  c.fillStyle='#24395c';c.fillRect(0,0,sheet.width,sheet.height);let y=0;
  for(const {outfit,strip} of shots){c.fillStyle='#ffe6a6';c.font='bold 18px Georgia';c.fillText(`${CATALOG[outfit].name} · a cada 3 quadros (50 ms)`,10,y+22);y+=30;
   strip.forEach(({cell,label,moving},i)=>{const x=i%perRow*cw,yy=y+Math.floor(i/perRow)*ch;c.fillStyle='#5b4228';c.fillRect(x+4,yy+186,cw-8,10);c.drawImage(cell,x,yy);c.fillStyle=moving?'#b8ffd6':'#e8f2ff';c.font='12px sans-serif';c.fillText(label,x+8,yy+212);});
   y+=Math.ceil(strip.length/perRow)*ch;}
  return {report,image:sheet.toDataURL('image/png')};
 },process.argv.slice(2));
 await writeFile(`${output}/filmstrip.png`,Buffer.from(result.image.split(',')[1],'base64'));
 console.log(JSON.stringify({report:result.report,errors},null,1));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();await server.close();}
