// Prévia do console da batalha e da câmera com um inimigo perto da base do mapa, numa batalha falsa só no cliente.
// Uso: node scripts/preview-battle-hud.mjs  (BASE_URL, OUT, CHROME_PATH, WIDTH/HEIGHT opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out=process.env.OUT??'test-results/battle-hud';
const width=Number(process.env.WIDTH??1536),height=Number(process.env.HEIGHT??864);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width,height},...(process.env.MOBILE?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);
 await page.evaluate(async()=>{
  // The app's own module instances (the pet registry lives in them), not fresh copies.
  const load=path=>import(performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path).at(-1)?.name??path);
  const {client}=await load('/src/client.ts'),{attributes}=await load('/shared/catalog.ts'),{createTerrain,ground,terrainWidth}=await load('/shared/physics.ts'),{createBattlePet}=await load('/shared/petSkills.ts'),{preloadEnvironment}=await load('/src/game/environment.ts');
  client.stop();client.send=()=>{};const now=Date.now();Date.now=()=>now;
  const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('snow');await preloadEnvironment('snow');
  const snapshot=profile.equipment.pet,pet=snapshot?createBattlePet({petId:snapshot.id,species:snapshot.species,stage:snapshot.stage,skills:snapshot.skills},'pvp'):undefined;
  if(pet){pet.mana=60;if(!pet.skills.some(skill=>skill.id==='verdalia-orb'))pet.skills.push({id:'verdalia-orb',level:1,readyAt:0,uses:0});}
  const fighter={level:profile.level,equipment:profile.equipment,ready:true,bot:false,connected:true,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,boosts:[]};
  // The player on the bridge, the enemy in the gap under it, almost at the bottom edge of the map.
  let low={x:0,y:0};for(let x=200;x<terrainWidth(terrain)-200;x+=4){const y=ground(terrain,x);if(y<860&&y>low.y)low={x,y};}
  const meX=Math.max(200,low.x-380),me={...fighter,id:profile.id,name:profile.name,guild:'Brasa Eterna',team:0,slot:0,x:meX,y:ground(terrain,meX),facing:1,aimAngle:50,pet};
  const enemy={...fighter,id:'hud-enemy',name:'Pipoca · BOT',bot:true,team:1,slot:0,x:low.x,y:low.y,facing:-1,hp:4041};
  const chat=[['world','Mundo','Lia','alguém pra expedição?'],['guild','Guilda','Tomás','boa sorte na luta!'],['room','Sala','Pipoca · BOT','vem!'],['private','Privado','Rafa','me chama depois']].map(([channel,,name,text],i)=>({id:'c'+i,channel,name,text,time:now-1000*(4-i),playerId:'p'+i}));
  client.update({chat,status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'hud-preview',roomId:'fixture',map:'snow',players:[me,enemy],turnId:profile.id,turnNumber:1,wind:1.4,deadline:now+300000,phase:'aiming',winner:null}});
 });
 await page.locator('.battle-console').waitFor({timeout:15000}).catch(async error=>{await page.screenshot({path:out+'/failure.png'});console.log(JSON.stringify(errors));throw error;});
 await page.waitForTimeout(2500);
 await page.screenshot({path:`${out}/full.png`});
 const console_=await page.locator('.battle-console').boundingBox();
 await page.screenshot({path:`${out}/console.png`,clip:{x:0,y:Math.max(0,console_.y-40),width,height:height-Math.max(0,console_.y-40)}});
 // Charging: the numbers stay readable over the fill.
 await page.keyboard.down('Space');await page.waitForTimeout(2100);
 await page.screenshot({path:`${out}/charging.png`,clip:{x:0,y:Math.max(0,console_.y-40),width,height:height-Math.max(0,console_.y-40)}});
 // Last shot at 62: the band shows where it was.
 await page.keyboard.up('Space');await page.waitForTimeout(400);
 await page.screenshot({path:`${out}/last-power.png`,clip:{x:0,y:Math.max(0,console_.y-40),width,height:height-Math.max(0,console_.y-40)}});
 // Enter opens the line to write under the chat.
 await page.keyboard.press('Enter');await page.waitForTimeout(300);
 await page.screenshot({path:`${out}/chat-open.png`,clip:{x:0,y:0,width:Math.min(width,640),height:Math.min(height,480)}});
 if(errors.length)console.log(JSON.stringify(errors));
}finally{await browser.close();}
