// Prévia do efeito de usar item ou poder no lutador (docs/consumables.md, "Efeito ao usar"): clarão no corpo,
// brilho dourado e o ícone do item sobre a cabeça. Batalha falsa só no cliente; tira quadros em vários tempos.
// Grava também o vídeo da sequência em OUT (item-use.webm).
// Uso: node scripts/preview-item-use.mjs  (BASE_URL, OUT, CHROME_PATH opcionais; precisa do jogo rodando)
import {chromium} from '@playwright/test';
import {mkdir,rename} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out=process.env.OUT??'test-results/item-use';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const context=await browser.newContext({viewport:{width:1536,height:864},recordVideo:{dir:out,size:{width:1536,height:864}}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);
 await page.evaluate(async()=>{
  const load=path=>import(performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path).at(-1)?.name??path);
  const {client}=await load('/src/client.ts'),{attributes}=await load('/shared/catalog.ts'),{createTerrain,ground}=await load('/shared/physics.ts'),{preloadEnvironment}=await load('/src/game/environment.ts');
  client.stop();client.send=()=>{};
  const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('snow');await preloadEnvironment('snow');
  const fighter={level:profile.level,equipment:profile.equipment,ready:true,bot:false,connected:true,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,boosts:[],abilities:{heal:1,homing:1,invisibility:1,rage:0,ice:0}};
  const meX=820,foeX=1180,me={...fighter,id:profile.id,name:profile.name,team:0,slot:0,x:meX,y:ground(terrain,meX),facing:1,aimAngle:50,powerCharge:80};
  const enemy={...fighter,id:'foe',name:'Pipoca · BOT',bot:true,team:1,slot:0,x:foeX,y:ground(terrain,foeX),facing:-1};
  window.__fx={client,me,enemy};
  client.update({chat:[],status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'item-use-preview',roomId:'fixture',map:'snow',players:[me,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null}});
 });
 await page.locator('.battle-console').waitFor({timeout:15000});
 await page.waitForTimeout(2500);
 const use=patch=>page.evaluate(patch=>{const {client,me}=window.__fx;const b=client.state.battle;client.update({battle:{...b,players:[{...me,...patch},b.players[1]]}});},patch);
 const shoot=async(name,times)=>{let last=0;for(const at of times){await page.waitForTimeout(at-last);last=at;await page.screenshot({path:`${out}/${name}-${String(at).padStart(4,'0')}.png`});}};
 await use({boosts:['extra1']});await shoot('extra1',[120,300,700,1300,2000]);
 await use({boosts:[]});await page.waitForTimeout(300);
 await use({boosts:['damage50']});await shoot('damage50',[900]);
 await use({boosts:[]});await page.waitForTimeout(300);
 await use({abilities:{heal:0,homing:1,invisibility:1,rage:0,ice:0}});await shoot('heal',[900]);
 await page.waitForTimeout(1600);
 const video=page.video();await context.close();if(video)await rename(await video.path(),`${out}/item-use.webm`);
 if(errors.length)console.log(JSON.stringify(errors));
}finally{await browser.close();}
