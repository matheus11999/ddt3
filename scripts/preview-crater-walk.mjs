// Prévia: o boneco anda para dentro de uma cratera do Quebra-Tijolos no Sonho Nevado e tenta sair.
// Uso: node scripts/preview-crater-walk.mjs  (BASE_URL, OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out=process.env.OUT??'test-results/crater-walk';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1536,height:864}});
await enterGame(page,base);
const frames=await page.evaluate(async()=>{
 const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
 const {attributes,WEAPONS}=await import('/shared/catalog.ts'),{createTerrain,crater,ground,packTerrain,walkPosition,weaponRoughness}=await import('/shared/physics.ts'),{terrainAimOffset}=await import('/shared/aim.ts'),{preloadEnvironment}=await import('/src/game/environment.ts');
 client.stop();client.send=()=>{};await preloadEnvironment('snow');
 const brick=WEAPONS.find(w=>w.id==='brick'),terrain=createTerrain('snow'),cx=1110;crater(terrain,cx,ground(terrain,cx),brick.crater,'snow',weaponRoughness(brick));
 const packed=btoa(String.fromCharCode(...packTerrain(terrain)));
 const profile=client.state.profile,stats=attributes(profile.equipment);
 // Path: walk right into the crater, climb out on the far side, then walk back across it.
 let p={x:cx-70,y:ground(terrain,cx-70)},facing=1;const path=[{...p,facing}];
 for(const [dir,count] of [[1,24],[-1,24]])for(let n=0;n<count;n++){facing=dir;const next=walkPosition(terrain,p,dir);if(next)p=next;path.push({...p,facing});}
 window.craterWalk={client,terrain,packed,profile,stats,path,terrainAimOffset,ground};return path.length;
});
for(let i=0;i<frames;i++){
 await page.evaluate(i=>{const {client,terrain,packed,profile,stats,path,terrainAimOffset,ground}=window.craterWalk,p=path[i];
  const fighter={id:profile.id,name:profile.name,level:profile.level,equipment:profile.equipment,ready:true,bot:false,team:0,slot:0,connected:true,x:p.x,y:p.y,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:p.facing,boosts:[],aimAngle:45,aimSlope:terrainAimOffset(terrain,p),abilities:{}};
  // The camera follows whoever has the turn: the rival stands still, so the crater stays in frame.
  const enemy={...fighter,id:'rival',name:'RIVAL',team:1,x:1290,y:ground(terrain,1290),facing:-1,aimSlope:0};
  client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'crater-walk',roomId:'fixture',map:'snow',terrain:packed,players:[fighter,enemy],turnId:'rival',turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null}});
 },i);
 await page.waitForTimeout(i===0?9000:110);
 await page.screenshot({path:`${out}/frame-${String(i).padStart(3,'0')}.png`});
}
await browser.close();
console.log(`${frames} quadros em ${out}`);
