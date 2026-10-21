// Prévia do efeito de POW pronto (src/game/powReadyAura.ts): o lutador deitado na pose de combate com cada visual
// (STYLES=aura,mantle,orbs) em quadros seguidos, olhando para a direita e para a esquerda, sobre céu claro e escuro.
// Só precisa do Vite (sobe um servidor próprio).
// Uso: node scripts/preview-pow-aura.mjs  (OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';

const out=process.env.OUT??'test-results/pow-aura';await mkdir(out,{recursive:true});
const server=await createServer({logLevel:'error',server:{port:5291,strictPort:false,host:'127.0.0.1'}});await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:2}),errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(`${base}/admin.html`);
await page.evaluate(styles=>{window.STYLES=styles;},process.env.STYLES??'mantle,orbs');
await page.evaluate(async()=>{
 document.body.innerHTML='';document.body.style.margin='0';
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;document.body.append(canvas);
 const c=canvas.getContext('2d'),aura=await import('/src/game/powReadyAura.ts'),{drawAvatar,createAvatarMotion}=await import('/src/game/avatar.ts'),{DEFAULT_EQUIPMENT}=await import('/shared/catalog.ts');
 const styles=(window.STYLES??'mantle,orbs').split(','),ROW=250;
 await Promise.all(styles.flatMap(style=>aura.preloadPowReadyAura(style)).map(image=>image.decode()));
 const paint=()=>{
  // One pair of rows (light and dark sky) per look.
  styles.forEach((style,pair)=>{for(let sky=0;sky<2;sky++){
   const top=(pair*2+sky)*ROW,y=top+200,gradient=c.createLinearGradient(0,top,0,top+ROW);
   gradient.addColorStop(0,sky?'#141a2c':'#5a8fd0');gradient.addColorStop(1,sky?'#3a4766':'#d8ecff');c.fillStyle=gradient;c.fillRect(0,top,1200,ROW);c.fillStyle='#e9f1fb';c.fillRect(0,y,1200,ROW-200);
   c.fillStyle=sky?'#fff':'#14213a';c.font='bold 18px sans-serif';c.fillText(style,14,top+28);
   for(let k=0;k<6;k++){
    const x=110+k*196,t=k*170,facing=k%2?-1:1;
    aura.drawPowReadyAura(c,x,y,t,-1e4,'back',style);
    drawAvatar(c,DEFAULT_EQUIPMENT,x,y,112,t,false,facing,true,createAvatarMotion(facing),{combat:true,pose:'prone'});
    aura.drawPowReadyAura(c,x,y,t,-1e4,'front',style);
   }
  }});
 };
 for(let i=0;i<25;i++){paint();await new Promise(resolve=>setTimeout(resolve,200));}
});
await page.screenshot({path:`${out}/sheet.png`});
await browser.close();await server.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`${out}/sheet.png`);
