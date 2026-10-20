// Prévia da caminhada (docs/implementation-status.md "Caminhada"): casos reais do Sonho Nevado — crateras de
// cada arma, crateras sobrepostas, poste, placa, presentes — andando com a mesma função do servidor.
// Uso: node scripts/preview-walk.mjs  (BASE_URL, OUT, CHROME_PATH, WALK_MODULE e ONLY opcionais)
// WALK_DEBUG=0 esconde as guias do ?walk=1. WALK_MODULE troca o módulo com `walkPosition` (ex.: uma cópia da física antiga) para comparar antes/depois.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out=process.env.OUT??'test-results/walk',module=process.env.WALK_MODULE??'/shared/physics.ts';
const only=process.env.ONLY?.split(',');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1536,height:864}});
await enterGame(page,base);
await page.goto(base+(process.env.WALK_DEBUG==='0'?'/':'/?walk=1'),{waitUntil:'domcontentloaded'});await page.locator('.bottom-dock').waitFor({timeout:15000});
const names=await page.evaluate(async module=>{
 const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
 const {attributes,WEAPONS}=await import('/shared/catalog.ts'),{createTerrain,crater,ground,packTerrain,weaponRoughness}=await import('/shared/physics.ts'),{walkPosition}=await import(module),{terrainAimOffset}=await import('/shared/aim.ts'),{preloadEnvironment}=await import('/src/game/environment.ts');
 client.stop();client.send=()=>{};await preloadEnvironment('snow');
 const weapon=id=>WEAPONS.find(w=>w.id===id);
 const dig=(t,x,id,n,pow=false)=>{const w=weapon(id);for(let i=0;i<n;i++)crater(t,x,ground(t,x),pow?w.crater*1.05:w.crater,'snow',weaponRoughness(w),1,pow?(w.powCraterShape??w.craterShape):w.craterShape);return t;};
 // [name, terrain, start x (null: bottom of the hole at hole x), direction, commands, hole x]
 const cases=[
  ['cratera-tijolo-1',()=>dig(createTerrain('snow'),1150,'brick',1),null,1,14,1150],
  ['cratera-tijolo-2',()=>dig(createTerrain('snow'),1150,'brick',2),null,1,14,1150],
  ['cratera-tijolo-3',()=>dig(createTerrain('snow'),1150,'brick',3),null,-1,14,1150],
  ['cratera-bumerangue-2',()=>dig(createTerrain('snow'),1950,'love-boomerang',2),null,1,14,1950],
  ['cratera-trovao-1-pow',()=>dig(createTerrain('snow'),1950,'thunder-coil',1,true),null,-1,14,1950],
  ['cratera-vento-2',()=>dig(createTerrain('snow'),2700,'wind-shuriken',2),null,1,14,2700],
  ['crateras-lado-a-lado',()=>{const t=createTerrain('snow');for(const x of [1120,1150,1180])dig(t,x,'brick',1);return t;},1080,1,22,1150],
  ['poste',()=>createTerrain('snow'),1215,1,12,1280],
  ['placa',()=>createTerrain('snow'),2270,1,12,2330],
  ['presentes',()=>createTerrain('snow'),850,1,12,900],
  ['borda-ponte',()=>createTerrain('snow'),1240,1,16,1300],
  ['cristais',()=>createTerrain('snow'),385,1,16,470],
  ['arvore',()=>createTerrain('snow'),2687,1,16,2770],
 ];
 const rows=[];
 for(const [name,make,start,dir,commands,hx] of cases){const terrain=make();const x0=start??hx;let p={x:x0,y:ground(terrain,x0)};const path=[p];
  for(let n=0;n<commands;n++){const next=walkPosition(terrain,p,dir);if(!next)break;p={x:next.x,y:next.y};path.push(p);if(p.y>864||next.fell)break;}
  rows.push({name,terrain:btoa(String.fromCharCode(...packTerrain(terrain))),path,dir,hx});}
 const profile=client.state.profile,stats=attributes(profile.equipment);
 window.walkPreview={client,rows,profile,stats,terrainAimOffset,createTerrain,ground};return rows.map(r=>({name:r.name,path:r.path,hx:r.hx}));
},module);
const report=[];
for(let i=0;i<names.length;i++){if(only&&!only.includes(names[i].name))continue;
 await page.evaluate(i=>{const {client,rows,profile,stats,terrainAimOffset}=window.walkPreview,row=rows[i],p=row.path.at(-1);
  const fighter={id:profile.id,name:profile.name,level:profile.level,equipment:profile.equipment,ready:true,bot:false,team:0,slot:0,connected:true,x:p.x,y:Math.min(p.y,860),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:row.dir,boosts:[],aimAngle:45,aimSlope:0,abilities:{}};
  const enemy={...fighter,id:'rival',name:'RIVAL',team:1,x:2690,y:500,facing:-1,aimSlope:0};
  client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'walk-preview',roomId:'fixture',map:'snow',terrain:row.terrain,players:[fighter,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null}});
 },i);
 await page.waitForTimeout(i===0?9000:3500);
 const file=`${out}/${names[i].name}.png`;await page.screenshot({path:file,clip:{x:418,y:330,width:700,height:420}});
 const path=names[i].path,end=path.at(-1);report.push({name:names[i].name,from:path[0],to:end,commands:path.length-1});
}
await writeFile(`${out}/report.json`,JSON.stringify(report,null,1));
await browser.close();
console.log(report.map(r=>`${r.name}: ${r.from.x},${r.from.y} -> ${r.to.x},${r.to.y} (${r.commands} comandos)`).join('\n'));
