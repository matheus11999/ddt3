import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Rig v2 (docs/rig-v2.md): the SAME look drawn by the game in every context, for approval. Bag/shop (SHOW, blink),
// plaza walking and standing (VIRTUAL), combat actions frame by frame (GAME), with and without the hat.
// Usage: node scripts/rig/preview-rig.mjs [m|f]   -> test-results/rig/preview-<sex>.png
const sex=process.argv[2]??'m';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const image=await page.evaluate(async sex=>{
  const V=await import('/src/game/avatar.ts'),R=await import('/src/game/character/rig.ts'),K=await import('/src/game/character/composer.ts'),{DEFAULT_EQUIPMENT,unequipForGender}=await import('/shared/catalog.ts');
  const basic=unequipForGender(sex==='f'?'female':'male');
  const looks=[{...DEFAULT_EQUIPMENT,face:basic.face,hair:basic.hair,outfit:basic.outfit,hat:'hat-none',glasses:'glasses-none',costume:'costume-none'}];looks.push({...looks[0],hat:'hat-starter'});
  const scratch=document.createElement('canvas').getContext('2d');
  for(let i=0;i<60&&!looks.every(eq=>['game','show','virtual'].every(ctx=>!R.hasRig(eq,ctx)||(ctx==='game'?R.drawRigGame(scratch,eq,'STAND',0):ctx==='show'?R.drawRigShow(scratch,eq,'STATIC',0):R.drawRigVirtual(scratch,eq,'naturalStandFront',0))));i++)await new Promise(r=>setTimeout(r,100));
  const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1000;const c=sheet.getContext('2d');
  c.fillStyle='#22324d';c.fillRect(0,0,1600,1000);
  const title=(t,x,y)=>{c.fillStyle='#ffe6a6';c.font='bold 18px Georgia';c.fillText(t,x,y);};
  const note=(t,x,y)=>{c.fillStyle='#cfd8e6';c.font='12px sans-serif';c.fillText(t,x,y);};
  looks.forEach((eq,row)=>{const y0=row*500;
   title(`MOCHILA / SALA (SHOW)${row?' · com boné':''}`,20,y0+28);
   [0,2,3].forEach((cell,i)=>{note(['aberto','fechado','meio'][i],30+i*130,y0+60);if(R.hasRig(eq,'show')){c.save();c.translate(80+i*130,y0+250);c.scale(170/160,170/160);let t=0;while(K.showFrame('NORMAL_STANDBY',t)!==cell&&t<200)t++;R.drawRigShow(c,eq,'NORMAL_STANDBY',t);c.restore();}
   });
   title('PRAÇA (VIRTUAL)',430,y0+28);
   for(let f=0;f<7;f++){note(f?`andar ${f}`:'parado',440+f*90,y0+60);c.save();c.translate(480+f*90,y0+250);V.drawAvatar(c,eq,0,0,150,f*40*3,f>0,1,false,undefined,{world:true,animated:false,movementDistance:0});c.restore();}
   title('COMBATE (GAME)',20,y0+300);
   const actions=[['STAND',0],['WALK',0],['WALK',2],['WALK',4],['SHOWTHROWS',4],['THROWS',0],['THROWS',2],['THROWS',4],['SHAKE',0],['SHAKE',4],['HANDCLIP',2],['CRY',0]];
   actions.forEach(([a,t],i)=>{note(`${a} ${t}`,24+i*130,y0+330);if(R.hasRig(eq,'game')){c.save();c.translate(80+i*130,y0+470);c.scale(1.1,1.1);R.drawRigGame(c,eq,a,t);c.restore();}});
  });
  return sheet.toDataURL('image/png');
 },sex);
 await mkdir('test-results/rig',{recursive:true});
 const file=`test-results/rig/preview-${sex}.png`;await writeFile(file,Buffer.from(image.split(',')[1],'base64'));
 console.log(JSON.stringify({file,errors}));
}finally{await browser.close();await server.close();}
