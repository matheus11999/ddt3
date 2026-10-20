// Prévia do arremesso da Vara das Marés (src/game/rodCast.ts): o lutador segura a vara ao carregar e lança como na
// pesca; o ponto vermelho é a ponta da vara, de onde o peixe sai (heldMuzzle). Só precisa do Vite.
// Uso: node scripts/preview-tide-rod-cast.mjs  (OUT, OUTFIT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';

const out=process.env.OUT??'test-results/tide-rod';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1500,height:760}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
await page.evaluate(async outfit=>{
 const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts');
 const {DEFAULT_EQUIPMENT,weaponAssetPath}=await import('/shared/catalog.ts');
 const atlases=(await import('/src/game/combatAtlas.json')).default;
 const load=path=>new Promise(resolve=>{const image=A.asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
 await Promise.all(['/assets/character-base.png',...Object.values(atlases).map(a=>a.path),...[0,10,12,15].map(l=>weaponAssetPath('tide-rod',l))].map(load));
 await new Promise(resolve=>setTimeout(resolve,500));
 const columns=[['idle',0,'parado'],['charge',300,'carregando'],['fire',25,'preparo'],['fire',75,'lançando'],['fire',110,'lançando'],['fire',160,'soltou'],['fire',260,'acompanha'],['fire',400,'assenta'],['fire',600,'volta']];
 const W=160,H=170,rows=[[0,1],[15,1],[0,-1],[12,-1]];
 const canvas=document.createElement('canvas');canvas.width=W*columns.length+20;canvas.height=40+rows.length*H;document.body.innerHTML='';document.body.append(canvas);
 const c=canvas.getContext('2d');c.fillStyle='#24395c';c.fillRect(0,0,canvas.width,canvas.height);
 c.font='13px Arial';columns.forEach(([, ,label],i)=>{c.fillStyle='#e8f2ff';c.fillText(label,10+i*W+W/2-c.measureText(label).width/2,26);});
 // Twice: the first pass asks spriteCache for the screen-size copies of the paintings.
 for(let pass=0;pass<2;pass++){if(pass)await new Promise(resolve=>setTimeout(resolve,2500));
 rows.forEach(([upgrade,facing],r)=>columns.forEach(([pose,poseTime],i)=>{
  const x=10+i*W,y=40+r*H;c.fillStyle='#8fb6e0';c.fillRect(x+2,y+2,W-4,H-4);c.fillStyle='#e9f1fb';c.fillRect(x+2,y+H-24,W-4,22);
  const eq={...DEFAULT_EQUIPMENT,outfit:outfit??DEFAULT_EQUIPMENT.outfit,weapon:'tide-rod',upgrade},motion=V.createAvatarMotion(facing);motion.lastTime=1000;motion.turn=1;
  const fx=x+W/2,fy=y+H-24;V.drawAvatar(c,eq,fx,fy,112,1000,false,facing,true,motion,{combat:true,pose,poseTime,power:70,angle:45});
  const tip=V.heldMuzzle('tide-rod',facing,112);c.fillStyle='#ff2a2a';c.beginPath();c.arc(fx+tip[0],fy+tip[1],3,0,Math.PI*2);c.fill();
 }));}
},process.env.OUTFIT??null);
await page.waitForTimeout(200);
await page.screenshot({path:`${out}/cast.png`});
await browser.close();await server.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(`${out}/cast.png`);
