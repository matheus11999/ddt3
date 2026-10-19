import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';

// The pet beside its owner, in the plaza (standing, size 134) and in battle (lying, size 112), along its idle routine
// (src/game/petSprite.ts): a filmstrip of one full routine for each stage of the Verdália, to check distance and motion.
// Usage: node scripts/preview-pet-idle.mjs   Optional: BROWSER_EXECUTABLE, OUTPUT_DIR=test-results/pet-idle.
const output=process.env.OUTPUT_DIR??'test-results/pet-idle';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
 const png=await page.evaluate(async()=>{
  await import('/shared/petContent.ts');
  const A=await import('/src/game/appearance.ts'),V=await import('/src/game/avatar.ts'),P=await import('/src/game/petSprite.ts'),{DEFAULT_EQUIPMENT,ITEMS}=await import('/shared/catalog.ts');
  const idle=(await import('/src/game/idleAtlas.json')).default,combat=(await import('/src/game/combatAtlas.json')).default;
  const load=img=>new Promise(resolve=>{if(img.complete&&img.naturalWidth)return resolve();img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});
  const paths=['/assets/character-base.png','/assets/hair-covered-atlas.png',...Object.values(idle).map(a=>a.path),...Object.values(combat).map(a=>a.path),...ITEMS.map(item=>item.visual?.asset).filter(Boolean)];
  await Promise.all([...new Set(paths)].map(p=>load(A.asset(p))));
  const pets=[0,1,2].map(stage=>({id:'pet-preview',species:'verdalia',level:1,quality:'common',stars:0,stage,vitality:100,traits:{},skills:[]}));
  for(const pet of pets)P.drawPet(document.createElement('canvas').getContext('2d'),pet,0,0,100,1,0);
  await Promise.all([...P.petImages()].map(load));await new Promise(r=>setTimeout(r,500));
  const BEATS=[[.15,'descanso'],[.12,'pulo'],[.22,'pulo'],[.45,'pulo'],[.2,'olha'],[.4,'olha'],[.82,'volta'],[.15,'balança'],[.3,'balança']],COLS=BEATS.length,W=230,H=190,rows=[];
  for(const pet of pets)for(const combatMode of [false,true])rows.push({pet,combatMode});
  const out=document.createElement('canvas');out.width=COLS*W;out.height=rows.length*H;const c=out.getContext('2d');
  c.fillStyle='#9fc3d6';c.fillRect(0,0,out.width,out.height);
  rows.forEach((row,r)=>{for(let k=0;k<COLS;k++){
   const [p,beat]=BEATS[k],seg={descanso:0,pulo:1,olha:3,volta:3,balança:5}[beat],t=(seg+p)*P.PET_IDLE_CYCLE,x=k*W+W*.62,y=r*H+H-24,size=row.combatMode?112:134;
   c.fillStyle=r%2?'#b9d7b0':'#c9d9e6';c.fillRect(k*W,r*H,W-2,H-2);c.fillStyle='#7a5a3a';c.fillRect(k*W,y,W-2,4);
   const eq={...DEFAULT_EQUIPMENT,pet:row.pet},m=V.createAvatarMotion(1);
   V.drawAvatar(c,eq,x,y,size,t,false,1,row.combatMode,m,row.combatMode?{combat:true,pose:'idle',angle:45,power:0,slope:0}:{world:true,seed:3});
   P.drawPet(c,{...row.pet,id:''},x,y,size,1,t,'idle',row.combatMode);
   c.fillStyle='#222';c.font='12px sans-serif';c.fillText(`${beat} ${row.combatMode?'batalha':'praça'} ${['Broto','Botão','Flor'][row.pet.stage]}`,k*W+4,r*H+14);
  }});
  return out.toDataURL('image/png');
 });
 await writeFile(`${output}/strip.png`,Buffer.from(png.split(',')[1],'base64'));
 if(errors.length)console.log('Erros:',errors);
 console.log(`${output}/strip.png`);
}finally{await browser.close();await server.close();}
