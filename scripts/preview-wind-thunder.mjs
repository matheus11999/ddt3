// Prévia do Vento Celeste e da Bobina do Trovão numa batalha falsa (docs/wind-thunder.md): as duas armas na
// mão/nas costas, crateras e marcas das quatro máscaras e um POW do Trovão (três raios) e do Vento em voo.
// Uso: node scripts/preview-wind-thunder.mjs  (precisa do jogo rodando; BASE_URL, OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out=process.env.OUT??'test-results/wind-thunder';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[];
for(const [name,weapon,level,pow] of [['thunder-0','thunder-coil',0,false],['thunder-15-pow','thunder-coil',15,true],['wind-12','wind-shuriken',12,false],['wind-15-pow','wind-shuriken',15,true]]){
 const page=await browser.newPage({viewport:{width:1536,height:864}});page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);
 await page.evaluate(async({weapon,level,pow})=>{
  const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
  const {attributes,WEAPONS,weaponStats}=await import('/shared/catalog.ts'),{createTerrain,crater,ground,packTerrain,volley}=await import('/shared/physics.ts'),{destructionProfile}=await import('/shared/destruction.ts');
  client.stop();client.send=()=>{};
  const terrain=createTerrain('snow'),marks=[];let n=0;
  for(const [x,id,stage,powered] of [[180,'wind-shuriken',0,false],[260,'wind-shuriken',15,true],[350,'thunder-coil',0,false],[420,'thunder-coil',12,true],[455,'thunder-coil',12,true],[490,'thunder-coil',12,true]]){
   const profile=destructionProfile(id,stage,powered),y=ground(terrain,x);crater(terrain,x,y,profile.radius,'snow',0,1,profile.mask);
   marks.push({id:`m${n++}`,x,y,radius:profile.radius,shape:profile.mask,profile:profile.id,effect:id==='wind-shuriken'?'shuriken':'electric',level:stage});
  }
  const profile=client.state.profile,equipment={...profile.equipment,weapon,upgrade:level},stats=attributes(equipment);
  const fighter={id:profile.id,name:profile.name,level:profile.level,equipment,ready:true,bot:false,team:0,slot:0,connected:true,x:700,y:ground(terrain,700),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:1,boosts:[],aimAngle:40,aimSlope:0,charging:true,chargePower:60};
  const enemy={...fighter,id:'rival',name:'RIVAL',team:1,x:1150,y:ground(terrain,1150),facing:-1,charging:false};
  const w=weaponStats(WEAPONS.find(item=>item.id===weapon),level),fan=pow&&w.pow?.fan,angles=fan?fan.map(shot=>40+shot.angle):[40],forces=fan?fan.map(shot=>shot.force):[];
  const results=volley(terrain,fighter,angles,62,0,w,[],undefined,[],undefined,true,undefined,forces);
  const startedAt=Date.now();
  const shot={id:'preview',shooterId:fighter.id,startedAt,duration:9000,powered:pow,hits:[],impacted:[],projectiles:results.map(result=>({points:result.points,delay:0,flightTime:result.flightTime,impact:{x:result.x,y:result.y,radius:20},effect:w.effect,powered:pow}))};
  const battle={id:'wind-thunder-preview',roomId:'fixture',map:'snow',terrain:btoa(String.fromCharCode(...packTerrain(terrain))),terrainMarks:marks,players:[fighter,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null};
  client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle});
  // After the aiming shot, the shot itself: started so that the projectiles are about mid-flight.
  window.__previewShot=()=>{const flight=Math.max(...results.map(result=>result.flightTime));client.update({shot:{...shot,startedAt:Date.now()-flight*.45},battle:{...battle,phase:'resolving'}});};
 },{weapon,level,pow});
 await page.waitForTimeout(6000);
 await page.screenshot({path:`${out}/${name}-aim.png`,clip:{x:400,y:380,width:640,height:300}});
 await page.evaluate(()=>window.__previewShot());await page.waitForTimeout(120);
 await page.screenshot({path:`${out}/${name}.png`});
 await page.close();
}
await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
console.log(out);
