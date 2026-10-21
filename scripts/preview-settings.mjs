// Prévia da janela de Ajustes (abas Gráfico e Som) aberta na praça e pela engrenagem da batalha (batalha falsa só no cliente).
// Uso: node scripts/preview-settings.mjs  (BASE_URL, OUT, CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out=process.env.OUT??'test-results/settings';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);
 const shoot=async name=>{const box=await page.locator('.settings-window').boundingBox();await page.screenshot({path:`${out}/${name}.png`,clip:{x:box.x-20,y:box.y-20,width:box.width+40,height:box.height+40}});};
 await page.getByRole('button',{name:'Configurações',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Ajustes'});await settings.waitFor();await page.waitForTimeout(400);
 await shoot('plaza-graphics');
 await settings.getByRole('tab',{name:'Som'}).click();await page.waitForTimeout(200);await shoot('plaza-sound');
 await settings.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.evaluate(async()=>{
  const load=path=>import(performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path).at(-1)?.name??path);
  const {client}=await load('/src/client.ts'),{attributes}=await load('/shared/catalog.ts'),{createTerrain,ground}=await load('/shared/physics.ts'),{preloadEnvironment}=await load('/src/game/environment.ts');
  client.stop();client.send=()=>{};const now=Date.now();
  const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('snow');await preloadEnvironment('snow');
  const fighter={level:profile.level,equipment:profile.equipment,ready:true,bot:false,connected:true,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,boosts:[]};
  const me={...fighter,id:profile.id,name:profile.name,team:0,slot:0,x:600,y:ground(terrain,600),facing:1,aimAngle:50};
  const enemy={...fighter,id:'set-enemy',name:'Pipoca · BOT',bot:true,team:1,slot:0,x:1300,y:ground(terrain,1300),facing:-1};
  client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'settings-preview',roomId:'fixture',map:'snow',players:[me,enemy],turnId:profile.id,turnNumber:1,wind:1.4,deadline:now+300000,phase:'aiming',winner:null}});
 });
 await page.locator('.battle-console').waitFor({timeout:15000});await page.waitForTimeout(1500);
 await page.locator('.battle-settings').click();await page.getByRole('dialog',{name:'Ajustes'}).waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:`${out}/battle.png`});
 if(errors.length)console.log(JSON.stringify(errors));
}finally{await browser.close();}
