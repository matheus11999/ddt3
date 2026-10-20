// Prancha dos efeitos do Vento Celeste e da Bobina do Trovão desenhados pelo renderer do jogo (docs/wind-thunder.md):
// por fase, o projétil em voo (normal e POW, com o leque de três raios do Trovão), o disparo, o impacto normal e o
// do POW, e as quatro máscaras de cratera. Só precisa do Vite (sobe um servidor próprio).
// Uso: node scripts/preview-wind-thunder-effects.mjs  (OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';

const out=process.env.OUT??'test-results/wind-thunder';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:0,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(`${base}/admin.html`);
await page.evaluate(async()=>{
 document.body.innerHTML='';document.body.style.margin='0';
 const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=900;document.body.append(canvas);
 const c=canvas.getContext('2d'),fx=await import('/src/game/weaponEffects.ts'),{CATALOG}=await import('/shared/catalog.ts'),{craterMask}=await import('/shared/physics.ts');
 await fx.preloadWeaponEffects(['shuriken','electric']);
 const sky=c.createLinearGradient(0,0,0,900);sky.addColorStop(0,'#3a3f7a');sky.addColorStop(1,'#8f8fc8');c.fillStyle=sky;c.fillRect(0,0,1400,900);
 c.fillStyle='#fff';c.font='bold 18px sans-serif';
 const arc=(x,y,spread=0,force=1)=>Array.from({length:40},(_,i)=>[x-160*force+i*4*force,y-Math.sin(i/39*Math.PI*.5)*20+spread*i*.4]);
 const rows=[['shuriken','wind-shuriken'],['electric','thunder-coil']];
 rows.forEach(([effect,id],r)=>{
  const weapon=CATALOG[id],y0=40+r*400;c.fillStyle='#fff';c.fillText(weapon.name,20,y0);
  [0,10,12,15].forEach((level,k)=>{
   const x=200+k*320;c.fillStyle='#ffe9a8';c.fillText(`+${level}`,x-140,y0+30);
   fx.drawProjectile(c,{points:arc(x,y0+80),delay:0,flightTime:600,impact:{x:0,y:0,radius:20},effect},39,level,500);
   const fan=id==='thunder-coil'?[-1,0,1]:[0];
   for(const lane of fan)fx.drawProjectile(c,{points:arc(x,y0+170+lane*22,0,1),delay:0,flightTime:600,impact:{x:0,y:0,radius:20},effect,powered:true},39,level,500);
   fx.drawMuzzle(c,x-150,y0+300,effect,60,level,1);
   fx.drawImpact(c,{points:[[x-60,y0+260]],delay:0,flightTime:0,impact:{x:x-60,y:y0+260,radius:24},effect},150,level,'snow');
   fx.drawImpact(c,{points:[[x+60,y0+260]],delay:0,flightTime:0,impact:{x:x+60,y:y0+260,radius:24},effect,powered:true},150,level,'snow');
  });
 });
 c.fillStyle='#fff';c.fillText('normal / POW (linha de cima e de baixo de cada arma), impactos normal e POW',20,880);
 // The four crater masks at game scale ×3.
 [['wind',26],['wind-pow',28.5],['thunder',25],['thunder-pow',22.5]].forEach(([shape,radius],k)=>{
  const mask=craterMask(shape,radius),x0=1300-mask.width*1.5,y0=60+k*100+(k>1?400:0)/4;c.fillStyle='#f0e';
  for(let j=0;j<mask.height;j++)for(let i=0;i<mask.width;i++)if(mask.bits[j*mask.width+i])c.fillRect(x0+i*1.5,y0+j*1.5,1.5,1.5);
  c.fillStyle='#fff';c.font='12px sans-serif';c.fillText(shape,x0,y0-4);c.font='bold 18px sans-serif';
 });
});
await page.waitForTimeout(300);
await page.screenshot({path:`${out}/effects.png`});
await browser.close();await server.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(`${out}/effects.png`);
