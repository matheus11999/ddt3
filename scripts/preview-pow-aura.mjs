// Prévia da aura do POW pronto (src/game/powReadyAura.ts): o lutador deitado na pose de combate com a aura em
// quadros seguidos do pisca-pisca e da pulsação, olhando para a direita e para a esquerda, sobre céu claro e escuro.
// Só precisa do Vite (sobe um servidor próprio).
// Uso: node scripts/preview-pow-aura.mjs  (OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';

const out=process.env.OUT??'test-results/pow-aura';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:5291,strictPort:false,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1200,height:520},deviceScaleFactor:2}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(`${base}/admin.html`);
await page.evaluate(async()=>{
 document.body.innerHTML='';document.body.style.margin='0';
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=520;document.body.append(canvas);
 const c=canvas.getContext('2d'),aura=await import('/src/game/powReadyAura.ts'),{drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts'),{DEFAULT_EQUIPMENT}=await import('/shared/catalog.ts');
 await Promise.all(aura.preloadPowReadyAura().map(image=>image.decode()));
 const paint=()=>{
  for(const [row,top,bottom] of [[0,'#5a8fd0','#d8ecff'],[1,'#141a2c','#3a4766']]){const sky=c.createLinearGradient(0,row*260,0,row*260+260);sky.addColorStop(0,top);sky.addColorStop(1,bottom);c.fillStyle=sky;c.fillRect(0,row*260,1200,260);c.fillStyle='#e9f1fb';c.fillRect(0,row*260+200,1200,60);}
  for(let row=0;row<2;row++)for(let k=0;k<6;k++){
   const x=100+k*200,y=row*260+200,t=k*160,facing=k%2?-1:1;
   aura.drawPowReadyAura(c,x,y,t,-1e4);
   drawAvatar(c,DEFAULT_EQUIPMENT,x,y,112,t,false,facing,true,createAvatarMotion(facing),{combat:true,pose:'prone'});
  }
 };
 for(let i=0;i<25;i++){paint();await new Promise(resolve=>setTimeout(resolve,200));}
});
await page.screenshot({path:`${out}/sheet.png`});
await browser.close();await server.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`${out}/sheet.png`);
