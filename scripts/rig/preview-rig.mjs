import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// Rig v2 (docs/rig-v2.md): the SAME look drawn by the game's own drawAvatar, as the screens call it, for approval.
// Bag (Avatar component size), plaza walking in the 8 directions at the plaza size, combat poses at the battle size
// (lying to walk and aim, kneeling to charge and throw), with and without the hat.
// Usage: node scripts/rig/preview-rig.mjs [m|f]   -> test-results/rig/preview-<sex>.png
const sex=process.argv[2]??'m';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
await server.listen();
const executablePath=process.env.BROWSER_EXECUTABLE??process.env.CHROME_PATH;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1400}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0]+'game',{waitUntil:'domcontentloaded'});
 // the first run makes Vite optimize the deps and reload the page mid-evaluate: try again on the reloaded page
 const render=()=>page.evaluate(async sex=>{
  const A=await import('/src/game/avatar.ts'),R=await import('/src/game/character/rig.ts'),{DEFAULT_EQUIPMENT,unequipForGender}=await import('/shared/catalog.ts');
  const basic=unequipForGender(sex==='f'?'female':'male');
  const bare={...DEFAULT_EQUIPMENT,face:basic.face,hair:basic.hair,outfit:basic.outfit,hat:'hat-none',glasses:'glasses-none',costume:'costume-none'};
  const looks=[bare,{...bare,hat:'hat-starter',weapon:'thunder-coil',upgrade:0}];
  const scratch=document.createElement('canvas').getContext('2d');
  for(let i=0;i<80&&R.RIG_ENABLED&&!looks.every(eq=>R.drawRigGame(scratch,eq,'STAND',0)&&R.drawRigShow(scratch,eq,'STATIC',0)&&R.drawRigVirtual(scratch,eq,'naturalStandFront',0));i++)await new Promise(r=>setTimeout(r,100));
  // weapons load lazily and decode on the next draw: draw a few times in combat with pauses
  for(let i=0;i<4;i++){for(const eq of looks){A.drawAvatar(scratch,eq,0,0,112,0,false,1,true,undefined,{combat:true});A.drawAvatar(scratch,eq,0,0,230,0,false,1,false,undefined,{animated:false});A.drawAvatar(scratch,eq,0,0,134,0,true,1,false,undefined,{world:true});}await new Promise(r=>setTimeout(r,800));}
  const W=1800,H=1400,sheet=document.createElement('canvas');sheet.width=W;sheet.height=H;const c=sheet.getContext('2d');
  c.fillStyle='#2b3a52';c.fillRect(0,0,W,H);
  const title=(t,x,y)=>{c.fillStyle='#ffe6a6';c.font='bold 20px Georgia';c.fillText(t,x,y);};
  const note=(t,x,y)=>{c.fillStyle='#cfd8e6';c.font='13px sans-serif';c.fillText(t,x,y);};
  // a moving figure needs its motion warmed up like the scene does frame by frame
  const draw=(eq,x,y,size,{walking=false,facing=1,combat=false,...ctx},time=2000)=>{const m=A.createAvatarMotion(facing);for(let t=0;t<=time;t+=16)A.drawAvatar(scratch,eq,0,0,size,t,walking,facing,combat,m,{...ctx,combat,poseTime:t});A.drawAvatar(c,eq,x,y,size,time,walking,facing,combat,m,{...ctx,combat,poseTime:time});};
  looks.forEach((eq,row)=>{const y0=row*700;
   title(`MOCHILA${row?' · com boné':''}`,20,y0+30);
   draw(eq,150,y0+330,230,{animated:false});
   title('PRAÇA (8 direções, tamanho da praça)',320,y0+30);
   const dirs=[['parado',0,1,false],['→',1,1,false],['←',1,-1,false],['↓',1,1,false],['↑',1,1,true],['↗',1,1,true],['↖',1,-1,true],['↘',1,1,false],['↙',1,-1,false]];
   dirs.forEach(([label,walk,facing,back],i)=>{note(label,350+i*95,y0+60);draw(eq,370+i*95,y0+300,134,{walking:!!walk,facing,world:true,back},1000+i*170);});
   title('COMBATE (tamanho da batalha)',20,y0+400);
   const poses=[['parado','idle'],['andando','walk'],['mirando','aim'],['carregando','charge'],['arremesso','fire'],['atingido','hit'],['derrota','defeat']];
   poses.forEach(([label,pose],i)=>{note(label,40+i*170,y0+430);draw(eq,90+i*170,y0+620,112,{combat:true,walking:pose==='walk',pose,angle:45,power:60},pose==='fire'?220:1200);});
  });
  return sheet.toDataURL('image/png');
 },sex);
 let image;
 for(let attempt=0;;attempt++){try{image=await render();break;}catch(error){if(attempt>=3||!/context was destroyed|navigation/i.test(error.message))throw error;await page.waitForLoadState('load');}}
 await mkdir('test-results/rig',{recursive:true});
 const file=`test-results/rig/preview-${sex}.png`;await writeFile(file,Buffer.from(image.split(',')[1],'base64'));
 console.log(JSON.stringify({file,errors}));
}finally{await browser.close();await server.close();}
