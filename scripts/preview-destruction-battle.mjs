// Prévia: crateras e marcas de destruição numa batalha de verdade (cliente do jogo com uma partida falsa).
// Uso: node scripts/preview-destruction-battle.mjs  (precisa do jogo rodando; BASE_URL e OUT opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out=process.env.OUT??'test-results/destruction';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1536,height:864}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await enterGame(page,base);
await page.evaluate(async()=>{
 const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
 const {attributes}=await import('/shared/catalog.ts'),{createTerrain,crater,ground,packTerrain}=await import('/shared/physics.ts'),{destructionProfile}=await import('/shared/destruction.ts');
 client.stop();client.send=()=>{};
 const terrain=createTerrain('snow'),marks=[];let n=0;
 // Both weapons, every phase, normal and POW, side by side on the left bridge, plus a body hit.
 for(const [x,weapon,level,pow] of [[180,'brick',0,false],[250,'brick',10,true],[320,'brick',12,false],[390,'brick',15,true],[470,'love-boomerang',0,false],[540,'love-boomerang',10,true],[610,'love-boomerang',15,false],[560,'brick',15,false]]){
  const profile=destructionProfile(weapon,level,pow),y=ground(terrain,x);crater(terrain,x,y,profile.radius,'snow',0,1,profile.mask);
  marks.push({id:`m${n++}`,x,y,radius:profile.radius,shape:profile.mask,profile:profile.id,effect:weapon==='brick'?'brick':'boomerang',level});
 }
 const profile=client.state.profile,stats=attributes(profile.equipment);
 const fighter={id:profile.id,name:profile.name,level:profile.level,equipment:profile.equipment,ready:true,bot:false,team:0,slot:0,connected:true,x:700,y:ground(terrain,700),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:1,boosts:[],aimAngle:45,aimSlope:0};
 const enemy={...fighter,id:'rival',name:'RIVAL',team:1,x:2400,y:ground(terrain,2400),facing:-1};
 client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'destruction-preview',roomId:'fixture',map:'snow',terrain:btoa(String.fromCharCode(...packTerrain(terrain))),terrainMarks:marks,players:[fighter,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null}});
});
await page.waitForTimeout(9000);
await page.screenshot({path:`${out}/battle.png`});
await page.screenshot({path:`${out}/battle-zoom.png`,clip:{x:100,y:480,width:640,height:240}});
await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(`${out}/battle.png`);
