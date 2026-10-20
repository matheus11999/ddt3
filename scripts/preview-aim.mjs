// Prévia da mira junto ao personagem e da hitbox (docs/hitbox-aim.md), com uma batalha falsa só no cliente.
// Uso: node scripts/preview-aim.mjs  (BASE_URL, OUT, DEBUG=1 para as guias de hitbox, CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',out=process.env.OUT??'test-results/aim-preview',debug=process.env.DEBUG==='1';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 if(debug)await page.addInitScript(()=>{try{localStorage.setItem('brasa-debug-hitbox','1');}catch{}});
 await enterGame(page,base);
 await page.evaluate(async()=>{
  const clientUrl=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(clientUrl);
  const {attributes}=await import('/shared/catalog.ts'),{createTerrain,ground}=await import('/shared/physics.ts'),{terrainAimOffset}=await import('/shared/aim.ts'),{preloadEnvironment}=await import('/src/game/environment.ts');
  client.stop();client.send=()=>{};const now=Date.now();Date.now=()=>now;
  const profile=client.state.profile,stats=attributes(profile.equipment),terrain=createTerrain('snow');await preloadEnvironment('snow');
  const base={id:profile.id,name:'AIM-PLAYER',level:profile.level,equipment:profile.equipment,ready:true,bot:false,team:0,slot:0,connected:true,hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,boosts:[]};
  // Flat ground and the steepest ramp of the map, found by the same support reading as the game.
  let ramp={x:600,slope:0};for(let x=200;x<2900;x+=6){const slope=terrainAimOffset(terrain,{x,y:ground(terrain,x),facing:1});if(Math.abs(slope)>Math.abs(ramp.slope)&&Math.abs(slope)<=24)ramp={x,slope};}
  let flat=600;for(let x=300;x<2900;x+=6)if(terrainAimOffset(terrain,{x,y:ground(terrain,x),facing:1})===0){flat=x;break;}
  window.aimFixture={client,terrain,ground,terrainAimOffset,base,flat,ramp:ramp.x,show(spec){
   const y=ground(terrain,spec.x),me={...base,x:spec.x,y,facing:spec.facing,aimAngle:spec.angle,aimSlope:terrainAimOffset(terrain,{x:spec.x,y,facing:spec.facing})};
   const enemy={...base,id:'aim-enemy',name:'RIVAL',team:1,x:spec.x+spec.facing*220,y:ground(terrain,spec.x+spec.facing*220),facing:-spec.facing};
   client.update({status:'online',offset:0,shot:null,impacts:[],abilityEffects:[],room:null,battle:{id:'aim-preview',roomId:'fixture',map:'snow',players:[me,enemy],turnId:profile.id,turnNumber:1,wind:0,deadline:now+300000,phase:'aiming',winner:null}});
   return me;
  }};
  window.aimFixture.show({x:flat,facing:1,angle:45});
  window.aimLabels=[];const original=CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText=function(text,x,y,...args){if(text==='AIM-PLAYER'&&this.canvas.classList.contains('world-canvas')){const m=this.getTransform();window.aimLabels.push({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,scale:m.a});}return original.call(this,text,x,y,...args);};
 });
 await page.locator('.battle-console').waitFor({timeout:15000}).catch(async error=>{await page.screenshot({path:out+'/failure.png'});console.log(JSON.stringify(errors));throw error;});
 const shots=[['flat-right-min',{place:'flat',facing:1,angle:'min'}],['flat-right-45',{place:'flat',facing:1,angle:45}],['flat-right-max',{place:'flat',facing:1,angle:'max'}],['flat-left-45',{place:'flat',facing:-1,angle:45}],['ramp-right-45',{place:'ramp',facing:1,angle:45}],['ramp-left-45',{place:'ramp',facing:-1,angle:45}]];
 for(const [name,spec] of shots){
  await page.evaluate(async spec=>{
   const f=window.aimFixture,x=spec.place==='flat'?f.flat:f.ramp,me=f.show({x,facing:spec.facing,angle:45});
   const {aimSource,weaponAimLimits}=await import('/shared/aim.ts'),limits=weaponAimLimits(aimSource(me),me.aimSlope??0);
   window.aimTarget={min:limits.minAngle,max:limits.maxAngle,angle:spec.angle==='min'?limits.minAngle:spec.angle==='max'?limits.maxAngle:Math.max(limits.minAngle,Math.min(limits.maxAngle,spec.angle+(me.aimSlope??0)))};
  },spec);
  // The HUD owns the angle: step it with the real buttons until it reaches the target.
  for(let guard=0;guard<120;guard++){
   const state=await page.evaluate(()=>({now:Number(document.querySelector('.angle-gauge-readout strong')?.textContent?.match(/-?\d+/)?.[0]),target:window.aimTarget.angle}));
   if(!Number.isFinite(state.now)||state.now===state.target)break;
   await page.getByRole('button',{name:state.now<state.target?'Aumentar ângulo':'Diminuir ângulo'}).click();
  }
  await page.evaluate(()=>{window.aimLabels=[];});await page.waitForTimeout(700);
  const label=await page.evaluate(()=>window.aimLabels.at(-1));
  const clip=label?{x:Math.max(0,label.x-230),y:Math.max(0,label.y-60),width:460,height:300}:undefined;
  await page.screenshot({path:`${out}/${name}${debug?'-debug':''}.png`,...(clip?{clip}:{})});
 }
 await page.screenshot({path:`${out}/full${debug?'-debug':''}.png`});
 // Angle tick: once per real change, never at a limit, never from a snapshot or a re-render.
 const ticks=await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/game/audio.ts').at(-1).name,{audio}=await import(url);
  window.aimTicks=0;const cue=audio.cue.bind(audio);audio.cue=id=>{if(id==='angleChange')window.aimTicks++;return cue(id);};
  const f=window.aimFixture;f.show({x:f.flat,facing:1,angle:45});return true;
 });
 const clicks=async(name,n)=>{for(let i=0;i<n;i++)await page.getByRole('button',{name}).click();};
 const count=()=>page.evaluate(()=>window.aimTicks);
 const readAngle=()=>page.evaluate(()=>Number(document.querySelector('.angle-gauge-readout strong')?.textContent?.match(/-?\d+/)?.[0]));
 await clicks('Aumentar ângulo',3);const afterUp=await count();
 for(let guard=0;guard<120;guard++){const before=await readAngle();await page.getByRole('button',{name:'Aumentar ângulo'}).click();if(await readAngle()===before)break;}
 const atLimit=await count();await clicks('Aumentar ângulo',4);const stillAtLimit=await count();
 await page.evaluate(()=>{const f=window.aimFixture;f.client.update({battle:{...f.client.state.battle,turnNumber:2}});});await page.waitForTimeout(300);const afterSnapshot=await count();
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(470);await page.keyboard.up('ArrowDown');const afterKeys=await count();
 const report={afterUp,atLimit,stillAtLimit,afterSnapshot,afterKeys,ticks};console.log(JSON.stringify(report));
 if(afterUp!==3||stillAtLimit!==atLimit||afterSnapshot!==stillAtLimit||afterKeys<=afterSnapshot)throw Error('angle tick check failed '+JSON.stringify(report));
 if(errors.length)console.log(JSON.stringify(errors));
}finally{await browser.close();}
