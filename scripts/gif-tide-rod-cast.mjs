// GIF do lançamento da Vara das Marés com o renderer do jogo: carregar (a vara inclina com a força), lançar, o peixe
// voa da ponta e o respingo no chão; +0 em cima, +15 embaixo. Só precisa do Vite; o GIF sai pelo Pillow.
// Uso: node scripts/gif-tide-rod-cast.mjs  (OUT e CHROME_PATH opcionais) → <OUT>/cast.gif
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const out=process.env.OUT??'test-results/tide-rod';await mkdir(`${out}/gif`,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:700,height:600}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
const frames=await page.evaluate(async()=>{
 const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),fx=await import('/src/game/weaponEffects.ts');
 const {DEFAULT_EQUIPMENT,weaponAssetPath}=await import('/shared/catalog.ts');
 const atlases=(await import('/src/game/combatAtlas.json')).default;
 const load=path=>new Promise(resolve=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
 await Promise.all(['/assets/character-base.png',...Object.values(atlases).map(a=>a.path),...[0,15].map(l=>weaponAssetPath('tide-rod',l))].map(load));
 await fx.preloadWeaponEffects(['fish']);
 const W=640,H=280,CHARGE=1200,FLIGHT=1000,IMPACT=760,END=CHARGE+FLIGHT+IMPACT+400,STEP=40;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H*2;document.body.innerHTML='';document.body.append(canvas);const c=canvas.getContext('2d');
 const panels=[0,15].map((level,k)=>{
  const top=k*H,feet=[130,top+235],tip=V.heldMuzzle('tide-rod',1,112),from=[feet[0]+tip[0],feet[1]+tip[1]],to=[560,top+235];
  const points=Array.from({length:41},(_,i)=>{const u=i/40;return [from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u-Math.sin(u*Math.PI)*150-(1-u)*0];});
  return {level,top,feet,shot:{points,delay:0,flightTime:FLIGHT,impact:{x:to[0],y:to[1],radius:26},effect:'fish'}};
 });
 const draw=t=>{
  for(const {level,top,feet,shot} of panels){
   const sky=c.createLinearGradient(0,top,0,top+H);sky.addColorStop(0,'#6fa3dc');sky.addColorStop(1,'#d6e9fb');c.fillStyle=sky;c.fillRect(0,top,W,H);
   c.fillStyle='#f2f7fd';c.fillRect(0,top+235,W,H-235);c.fillStyle='#c9d9ec';c.fillRect(0,top+235,W,3);
   c.fillStyle='#ffffff';c.font='bold 16px sans-serif';c.fillText(`+${level}`,12,top+24);
   const firing=t>=CHARGE,pose=firing?'fire':'charge',poseTime=firing?t-CHARGE:t,power=firing?100:Math.min(100,t/(CHARGE-200)*100);
   const motion=V.createAvatarMotion(1);motion.lastTime=t;motion.turn=1;
   V.drawAvatar(c,{...DEFAULT_EQUIPMENT,weapon:'tide-rod',upgrade:level},feet[0],feet[1],112,t,false,1,true,motion,{combat:true,pose,poseTime,power,angle:45});
   const age=t-CHARGE;
   if(age>=0&&age<FLIGHT)fx.drawProjectile(c,shot,age/FLIGHT*(shot.points.length-1),level,t);
   else if(age>=FLIGHT)fx.drawImpact(c,shot,age-FLIGHT,level,'snow');
   if(!firing){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(300,top+250,200,12);c.fillStyle='#ffcf3a';c.fillRect(300,top+250,2*power,12);}
  }
 };
 draw(CHARGE+100);await new Promise(resolve=>setTimeout(resolve,900));
 const frames=[];for(let t=0;t<END;t+=STEP){draw(t);frames.push(canvas.toDataURL('image/png'));}
 return frames;
});
await browser.close();await server.close();
for(const [i,frame] of frames.entries())await writeFile(`${out}/gif/${String(i).padStart(3,'0')}.png`,Buffer.from(frame.split(',')[1],'base64'));
execFileSync(process.platform==='win32'?'py':'python3',['-c',`import glob
from PIL import Image
files=sorted(glob.glob(r'${out}/gif/*.png'))
images=[Image.open(f).convert('RGB').convert('P',palette=Image.ADAPTIVE,colors=255) for f in files]
images[0].save(r'${out}/cast.gif',save_all=True,append_images=images[1:],duration=40,loop=0,optimize=True)`]);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(`${out}/cast.gif (${frames.length} quadros)`);
