// Prancha dos efeitos da Vara das Marés desenhados pelo renderer do jogo (docs/tide-rod.md): por fase, o peixe em voo
// para a direita e para a esquerda (quadros t=0 e t=120 ms, o rabo balança), o tubarão do POW, o disparo, o respingo
// normal e a onda do POW. Só precisa do Vite (sobe um servidor próprio).
// Uso: node scripts/preview-tide-rod-effects.mjs  (OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';

const out=process.env.OUT??'test-results/tide-rod';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1400,height:620}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(`${base}/admin.html`);
await page.evaluate(async()=>{
 document.body.innerHTML='';document.body.style.margin='0';
 const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=620;document.body.append(canvas);
 const c=canvas.getContext('2d'),fx=await import('/src/game/weaponEffects.ts');
 await fx.preloadWeaponEffects(['fish']);
 const sky=c.createLinearGradient(0,0,0,620);sky.addColorStop(0,'#5a8fd0');sky.addColorStop(1,'#d8ecff');c.fillStyle=sky;c.fillRect(0,0,1400,620);
 c.font='bold 18px sans-serif';
 const arc=(x,y,dir=1)=>Array.from({length:40},(_,i)=>[x-160*dir+i*4*dir,y-Math.sin(i/39*Math.PI*.5)*20]);
 const shot=(points,powered=false)=>({points,delay:0,flightTime:600,impact:{x:0,y:0,radius:20},effect:'fish',powered});
 [0,10,12,15].forEach((level,k)=>{
  const x=200+k*320;c.fillStyle='#fff';c.fillText(`+${level}`,x-140,30);
  fx.drawProjectile(c,shot(arc(x,80)),39,level,500);
  fx.drawProjectile(c,shot(arc(x-60,140,-1)),39,level,620);
  fx.drawProjectile(c,shot(arc(x,250),true),39,level,500);
  fx.drawMuzzle(c,x-150,360,'fish',60,level,1);
  fx.drawImpact(c,{points:[[x-60,500]],delay:0,flightTime:0,impact:{x:x-60,y:500,radius:24},effect:'fish'},150,level,'snow');
  fx.drawImpact(c,{points:[[x+70,500]],delay:0,flightTime:0,impact:{x:x+70,y:500,radius:24},effect:'fish',powered:true},150,level,'snow');
 });
 c.fillStyle='#fff';c.fillText('peixe (direita e esquerda), tubarão POW, disparo, respingo normal e onda do POW',20,605);
});
await page.waitForTimeout(300);
await page.screenshot({path:`${out}/effects.png`});
await browser.close();await server.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(`${out}/effects.png`);
