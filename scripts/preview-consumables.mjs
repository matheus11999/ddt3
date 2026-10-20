// Prévia do Enfurecer e do Gelo numa batalha falsa só no cliente (docs/consumables.md):
// ícones na barra de poderes, ícone sobre a cabeça, bola de gelo voando, impacto, bloco congelado, rachado e quebrando.
// Uso: node scripts/preview-consumables.mjs  (BASE_URL, OUT, CHROME_PATH opcionais; precisa do jogo rodando)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out=process.env.OUT??'test-results/consumables';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);
 await page.evaluate(async()=>{
  const load=path=>import(performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path).at(-1)?.name??path);
  const {client}=await load('/src/client.ts'),{attributes}=await load('/shared/catalog.ts'),{createTerrain,ground}=await load('/shared/physics.ts'),{preloadEnvironment}=await load('/src/game/environment.ts');
  client.stop();client.send=()=>{};
  const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('snow');await preloadEnvironment('snow');
  const fighter={level:profile.level,equipment:profile.equipment,ready:true,bot:false,connected:true,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,boosts:[]};
  const meX=520,foeX=860,me={...fighter,id:profile.id,name:profile.name,team:0,slot:0,x:meX,y:ground(terrain,meX),facing:1,aimAngle:50,powerCharge:40};
  const enemy={...fighter,id:'foe',name:'Pipoca · BOT',bot:true,team:1,slot:0,x:foeX,y:ground(terrain,foeX),facing:-1,frozenTurns:3};
  const now=Date.now();window.__fx={client,me,enemy,now};
  client.update({chat:[],status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'consumables-preview',roomId:'fixture',map:'snow',players:[me,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:now+300000,phase:'aiming',winner:null}});
 });
 await page.locator('.battle-console').waitFor({timeout:15000});
 await page.waitForTimeout(2500);
 const set=fn=>page.evaluate(fn);
 // Enfurecer used: icon over the head, POW bar +50, queue shows it.
 await set(()=>{const {client,me}=window.__fx;const b=client.state.battle;client.update({battle:{...b,players:[{...me,boosts:['rage'],powerCharge:90},b.players[1]]}});});
 await page.waitForTimeout(350);await page.screenshot({path:`${out}/rage.png`});
 // Gelo chosen, ice ball in flight toward the enemy.
 await set(()=>{const {client,me,enemy}=window.__fx;const b=client.state.battle,pts=[];const sx=me.x+27,sy=me.y-40,ex=enemy.x,ey=enemy.y-20;for(let i=0;i<=40;i++){const q=i/40;pts.push([sx+(ex-sx)*q,sy+(ey-sy)*q-Math.sin(Math.PI*q)*230]);}
  window.__fx.shot={id:'ice-shot',shooterId:me.id,startedAt:Date.now(),duration:1600+900,hits:[],impacted:[],projectiles:[{kind:'ice',effect:'brick',points:pts,delay:0,flightTime:1600,impact:{x:ex,y:ey,radius:0}}]};
  client.update({battle:{...b,phase:'resolving',players:[{...me,boosts:['ice'],powerCharge:90},{...enemy,frozenTurns:0}]},shot:window.__fx.shot,shotReceivedAt:performance.now()-900});});
 await page.waitForTimeout(60);await page.screenshot({path:`${out}/ice-flight.png`});
 await set(()=>{const {client}=window.__fx;client.update({shotReceivedAt:performance.now()-1600-150});});
 await page.waitForTimeout(40);await page.screenshot({path:`${out}/ice-impact.png`});
 // Frozen, then cracked on the last frozen turn, then breaking.
 await set(()=>{const {client,me,enemy}=window.__fx;const b=client.state.battle;client.update({shot:null,battle:{...b,phase:'aiming',players:[{...me,boosts:[]},{...enemy,frozenTurns:3}]}});});
 await page.waitForTimeout(900);await page.screenshot({path:`${out}/frozen.png`});
 await set(()=>{const {client,me,enemy}=window.__fx;const b=client.state.battle;client.update({battle:{...b,players:[me,{...enemy,frozenTurns:1}]}});});
 await page.waitForTimeout(300);await page.screenshot({path:`${out}/cracked.png`});
 await set(()=>{const {client,me,enemy}=window.__fx;const b=client.state.battle;client.update({battle:{...b,players:[me,{...enemy,frozenTurns:0}]}});});
 await page.waitForTimeout(160);await page.screenshot({path:`${out}/shatter.png`});
 if(errors.length)console.log(JSON.stringify(errors));
}finally{await browser.close();}
