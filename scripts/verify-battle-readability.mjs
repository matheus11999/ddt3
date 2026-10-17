import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out='test-results/battle-readability';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
try{
 const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await enterGame(page,base);
 await page.evaluate(async()=>{
  const clientUrl=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name;const {client}=await import(clientUrl);window.readabilityClient=client;const {attributes}=await import('/shared/catalog.ts'),{createTerrain,ground}=await import('/shared/physics.ts'),{preloadEnvironment}=await import('/src/game/environment.ts');
  client.stop();client.send=()=>{};window.readabilityNow=Date.now();Date.now=()=>window.readabilityNow;const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('garden');await preloadEnvironment('garden');
  const fighter={id:profile.id,name:'FALL-PLAYER',level:profile.level,equipment:profile.equipment,ready:true,bot:false,team:0,slot:0,connected:true,x:370,y:ground(terrain,370),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:1,boosts:[],aimAngle:45,aimSlope:0,abilities:{heal:1,homing:1,invisibility:1}};
  const enemy={...fighter,id:'test-enemy',name:'RIVAL',team:1,x:1100,y:ground(terrain,1100),facing:-1};
  client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'readability',roomId:'fixture',map:'garden',players:[fighter,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:Date.now()+300000,phase:'aiming',winner:null}});
  window.readabilitySamples=[];const original=CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText=function(text,x,y,...args){if(text==='FALL-PLAYER'&&this.canvas.classList.contains('world-canvas'))window.readabilitySamples.push({at:Date.now(),y:y+124});return original.call(this,text,x,y,...args);};
 });
 await expect(page.locator('.battle-console')).toBeVisible();
 await expect(page.getByRole('button',{name:/Campo de batalha|Aproximar|Afastar|Restaurar câmera/})).toHaveCount(0);
 await page.waitForTimeout(2100);await page.screenshot({path:`${out}/protractor-and-background.png`});
 const fall=await page.evaluate(async()=>{
  const client=window.readabilityClient,{createFall}=await import('/shared/fall.ts');const battle=structuredClone(client.state.battle),me=battle.players[0];
  me.fall=createFall(me.y,me.y+180,Date.now()+120);me.y+=180;battle.phase='resolving';window.readabilitySamples=[];client.update({battle});return me.fall;
 });
 for(const fraction of [0,.15,.35,.6,.85,1.1]){await page.evaluate(async time=>{window.readabilityNow=time;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},fall.startedAt+fall.duration*fraction);if(fraction===.6)await page.screenshot({path:out+'/mid-fall.png'});}
 const samples=await page.evaluate(()=>window.readabilitySamples);
 assert.ok(samples.length>10);
 const during=samples.filter(sample=>sample.at>=fall.startedAt&&sample.at<fall.startedAt+fall.duration);
 assert.ok(during.length>3,'multiple visible frames during falling');
 assert.ok(samples[0].y<fall.fromY+10,'fall begins at previous feet instead of snapping');
 assert.ok(during.some(sample=>sample.y>fall.fromY+30&&sample.y<fall.toY-30),'intermediate height is rendered');
 const mismatches=during.filter(sample=>Math.abs(sample.y-(fall.fromY+.5*1800*((sample.at-fall.startedAt)/1000)**2))>5);
 assert.equal(mismatches.length,0,'render follows acceleration without a second easing layer');
 const voidFall=await page.evaluate(async()=>{
  const client=window.readabilityClient,{createFall}=await import('/shared/fall.ts');const battle=structuredClone(client.state.battle),me=battle.players[0];
  me.fall=createFall(450,1014,Date.now()+100,true);me.y=944;me.hp=0;battle.phase='finished';battle.winner=1;const opensAt=me.fall.startedAt+me.fall.duration+3000;battle.rewards={phase:'picking',saved:false,opensAt,deadline:opensAt+5000,cards:Array.from({length:8},(_,index)=>({index}))};window.readabilitySamples=[];client.update({battle});return me.fall;
 });
 await page.evaluate(async time=>{window.readabilityNow=time;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},voidFall.startedAt+voidFall.duration*.6);await expect(page.locator('.battle-reward-overlay')).toHaveCount(0);
 await page.screenshot({path:`${out}/void-fall-before-result.png`});
 await page.evaluate(async time=>{window.readabilityNow=time;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},voidFall.startedAt+voidFall.duration+100);await expect(page.locator('.result-announcement')).toBeVisible();
 const afterVoid=await page.evaluate(()=>window.readabilitySamples);assert.ok(afterVoid.some(sample=>sample.y>600));assert.ok(!afterVoid.some(sample=>sample.at>voidFall.startedAt+voidFall.duration+30),'void fighter stops drawing after leaving the map');
 const damageText=await page.evaluate(async()=>{
  const {drawHitFeedback}=await import('/src/game/hitFeedback.ts');const seen=[],original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){seen.push(String(text));return original.call(this,text,...args);};
  const c=document.createElement('canvas').getContext('2d');drawHitFeedback(c,{id:'check',damage:127,x:50,y:80,projectileIndex:0,critical:false,kind:'direct',quality:1},200);
  CanvasRenderingContext2D.prototype.fillText=original;return seen;
 });
 assert.ok(damageText.includes('127'));assert.ok(!damageText.some(text=>text.includes('−')||text.includes('-')));
 assert.deepEqual(errors,[]);
 const report={checks:['camera menu removed','protractor and shaded parallax captured','gravity-rendered intermediate fall','void fall visible before result','damage numeral without minus'],fallFrames:during.length,errors};
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}

