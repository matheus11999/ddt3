import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
const channel=process.env.BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined);
await mkdir('test-results/avatar-portrait',{recursive:true});
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:1,reducedMotion:'no-preference'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await enterGame(page,base);await page.waitForLoadState('networkidle');
 await expect(page.locator('.player-hud canvas')).toHaveAttribute('aria-label','Retrato do personagem');
 const inspectHud=target=>target.locator('.player-hud').evaluate(element=>{
  const canvas=element.querySelector('canvas'),badge=element.querySelector('.profile-level-badge'),number=element.querySelector('.level-badge-number');
  return {backing:canvas.width,cssWidth:canvas.getBoundingClientRect().width,dpr:devicePixelRatio,smoothing:canvas.getContext('2d').imageSmoothingQuality,badgeOpacity:getComputedStyle(badge).opacity,badgeBackground:getComputedStyle(badge).backgroundColor,badgeBorder:getComputedStyle(badge).borderTopWidth,badgeLeft:getComputedStyle(badge).left,badgeBottom:getComputedStyle(badge).bottom,numberBackground:getComputedStyle(number).backgroundImage};
 });
 const hudResolution=await inspectHud(page);
 assert.ok(hudResolution.backing>=174,'The small 87px head must supersample on a 1x display');
 assert.equal(hudResolution.smoothing,'high');assert.equal(hudResolution.badgeOpacity,'1');
 assert.equal(hudResolution.badgeBackground,'rgba(0, 0, 0, 0)','Preserve the original badge silhouette without a rectangular backing');
 assert.equal(hudResolution.badgeBorder,'0px','Do not add a frame around the original level badge');
 assert.equal(hudResolution.badgeLeft,'25px');assert.equal(hudResolution.badgeBottom,'-24px');
 assert.match(hudResolution.numberBackground,/linear-gradient/,'Preserve the original metallic numeral finish');
 const hud=await page.locator('.player-hud').boundingBox();
 await page.screenshot({path:'test-results/avatar-portrait/lobby-hud.png',clip:{x:Math.max(0,hud.x-5),y:Math.max(0,hud.y-5),width:hud.width+10,height:hud.height+50}});
 const retina=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:3});
 let retinaHud;
 try{
  await enterGame(retina,base);await retina.waitForLoadState('networkidle');retinaHud=await inspectHud(retina);
  assert.ok(retinaHud.backing>=261,'A 3x display must not be capped to the previous 2x backing store');
  const retinaBox=await retina.locator('.player-hud').boundingBox();
  await retina.screenshot({path:'test-results/avatar-portrait/lobby-hud-retina.png',clip:{x:Math.max(0,retinaBox.x-5),y:Math.max(0,retinaBox.y-5),width:retinaBox.width+10,height:retinaBox.height+50}});
 }finally{await retina.close();}
 const report=await page.evaluate(async()=>{
  const [{asset},{drawAvatar,drawAvatarPortrait,getUpgradeAura},{DEFAULT_EQUIPMENT,CATALOG},{COSTUMES},{Avatar},{default:{createElement}},{default:{createRoot}}]=await Promise.all([
   import('/src/game/appearance.ts'),import('/src/game/avatar.ts'),import('/shared/catalog.ts'),import('/src/game/costumes.ts'),import('/src/components/Avatar.tsx'),import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js')
  ]);
  const load=path=>new Promise((resolve,reject)=>{const image=asset(path);if(image.complete&&image.naturalWidth)return resolve();image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(Error(path)),{once:true});});
  await Promise.all([...Object.values(CATALOG).map(item=>item.visual?.asset).filter(Boolean),...Object.values(COSTUMES).map(item=>item.path),'/assets/character-base.png','/assets/headwear-worn-atlas.png','/assets/hair-covered-atlas.png','/assets/auras/upgrade-rings.png','/assets/outfits/outfit-surfer-walk.png','/assets/outfits/combat-prone.png'].map(load));
  const createCanvas=(size=360)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return canvas;};
  const pixels=canvas=>canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const sources=new WeakMap();let sourceId=0;
  const full=(equipment,time,showAura,auraAnimated=true)=>{
   const canvas=createCanvas(),context=canvas.getContext('2d'),nativeDraw=context.drawImage.bind(context),ring=getUpgradeAura(equipment.upgrade);canvas.bodyDraws=[];
   context.drawImage=(source,...args)=>{if(source!==ring){if(!sources.has(source))sources.set(source,++sourceId);const m=context.getTransform();canvas.bodyDraws.push([sources.get(source),...args,m.a,m.b,m.c,m.d,m.e,m.f,context.globalAlpha,context.shadowBlur]);}nativeDraw(source,...args);};
   drawAvatar(context,equipment,180,360*.94,360*.79,time,false,1,false,undefined,{animated:false,auraAnimated,showAura});return canvas;
  };
  const head=equipment=>{const canvas=createCanvas(240);drawAvatarPortrait(canvas.getContext('2d'),equipment,0,0,240);return canvas;};
  const equal=(a,b)=>a.toDataURL()===b.toDataURL();
  const auraCases=['costume-none',...Object.keys(COSTUMES)].map(costume=>{
   const eq={...DEFAULT_EQUIPMENT,costume,upgrade:12},body=pixels(full(eq,1000,false)),early=full(eq,1000,true),late=full(eq,7000,true),first=pixels(early),later=pixels(late);
   let bodyPixels=0,solidBody=0,changedBody=0,changedAura=0;
   for(let i=0;i<body.length;i+=4){if(body[i+3]>20)bodyPixels++;const difference=Math.max(...[0,1,2,3].map(k=>Math.abs(first[i+k]-later[i+k])));if(body[i+3]===255){solidBody++;if(difference>2)changedBody++;}else if(body[i+3]===0&&difference>10)changedAura++;}
   return {costume,bodyPixels,solidBody,changedBody,changedAura,bodyDrawsUnchanged:JSON.stringify(early.bodyDraws)===JSON.stringify(late.bodyDraws),frozenWithoutAura:equal(full(eq,1000,false),full(eq,7000,false)),optOutFrozen:equal(full(eq,1000,true,false),full(eq,7000,true,false))};
  });
  const base={...DEFAULT_EQUIPMENT,glasses:'glasses-sport',upgrade:12};
  const cap=head(base),bare=head({...base,hat:'hat-none'}),hidden=head({...base,visibility:{hat:false}}),noGlasses=head({...base,glasses:'glasses-none'}),hiddenGlasses=head({...base,visibility:{glasses:false}});
  const hiddenMatchesBare=equal(hidden,bare),hiddenGlassesMatchesEmpty=equal(hiddenGlasses,noGlasses),hatChangesPortrait=!equal(cap,bare);
  const excludedLayersDoNotChangePortrait=equal(head({...base,outfit:'outfit-dancer',costume:'costume-arcane-fox',weapon:'crystal',upgrade:0}),cap);
  const sheet=createCanvas();sheet.id='portrait-contact-sheet';sheet.width=1440;sheet.height=680;const c=sheet.getContext('2d');
  c.fillStyle='#132941';c.fillRect(0,0,sheet.width,sheet.height);c.font='bold 24px Arial';c.fillStyle='#ffe3a7';c.fillText('RETRATO · CABEÇA UNIVERSAL E CHAPÉUS',25,38);
  const samples=[
   ['Sem chapéu',{...base,hat:'hat-none'}],['Boné equipado',base],['Boné oculto',{...base,visibility:{hat:false}}],
   ['Rosto sorrindo',{...base,face:'face-smile',hair:'hair-ponytail',hat:'hat-ruby'}],['Chapéu tropical',{...base,face:'face-smile',hair:'hair-ponytail',hat:'hat-tropical'}],['Chapéu astral',{...base,face:'face-serene',hair:'hair-wavy',hat:'hat-mage'}],
  ];
  for(let index=0;index<samples.length;index++){
   const [label,eq]=samples[index],x=20+(index%3)*480,y=70+Math.floor(index/3)*300;c.fillStyle='#28465d';c.beginPath();c.arc(x+150,y+130,120,0,Math.PI*2);c.fill();c.save();c.clip();drawAvatarPortrait(c,eq,x+30,y+10,240);c.restore();c.font='bold 16px Arial';c.fillStyle='#fff1cf';c.fillText(label,x+45,y+275);
  }
  const fixture=document.createElement('div');fixture.id='portrait-regression';fixture.style.cssText='position:fixed;inset:0;background:#132941;z-index:999999;overflow:auto';fixture.append(sheet);document.body.append(fixture);
  const mounted=document.createElement('div');mounted.id='aura-live-fixture';mounted.style.cssText='display:flex;justify-content:center';fixture.append(mounted);
  const root=createRoot(mounted);let props={equipment:{...base,upgrade:12},size:360,animated:false,auraAnimated:true,showAura:true,weapon:false};
  window.updatePortraitFixture=update=>{props={...props,...update,equipment:{...props.equipment,...update.equipment}};root.render(createElement(Avatar,props));};window.updatePortraitFixture({});
  window.portraitFixtureImage=()=>mounted.querySelector('canvas')?.toDataURL()??'';
  return {auraCases,hiddenMatchesBare,hiddenGlassesMatchesEmpty,hatChangesPortrait,excludedLayersDoNotChangePortrait};
 });
 await page.locator('#portrait-contact-sheet').screenshot({path:'test-results/avatar-portrait/headwear-sheet.png'});
 await writeFile('test-results/avatar-portrait/report.json',JSON.stringify(report,null,2));
 for(const result of report.auraCases){assert.ok(result.bodyPixels>10000,'Body remains present');assert.equal(result.changedBody,0,'Aura clock must not change opaque character pixels');assert.ok(result.bodyDrawsUnchanged,'Character image selection, transforms and opacity must be identical while the aura rotates');assert.ok(result.changedAura>1000,'The surrounding ring must advance');assert.ok(result.frozenWithoutAura&&result.optOutFrozen,'Static mode remains available');}
 assert.ok(report.hiddenMatchesBare&&report.hiddenGlassesMatchesEmpty&&report.hatChangesPortrait);
 assert.ok(report.excludedLayersDoNotChangePortrait,'Costume, outfit, weapon and upgrade cannot leak into the head portrait');
 await page.waitForFunction(()=>window.portraitFixtureImage());await page.waitForLoadState('networkidle');
 const first=await page.evaluate(()=>window.portraitFixtureImage());await page.waitForTimeout(350);
 assert.notEqual(await page.evaluate(()=>window.portraitFixtureImage()),first,'React must schedule frames for the aura independently');
 await page.evaluate(()=>window.updatePortraitFixture({auraAnimated:false}));await page.waitForTimeout(80);
 const frozen=await page.evaluate(()=>window.portraitFixtureImage());await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.portraitFixtureImage()),frozen);
 await page.evaluate(()=>window.updatePortraitFixture({portrait:true,equipment:{hat:'hat-none'}}));await page.waitForTimeout(80);
 const noHat=await page.evaluate(()=>window.portraitFixtureImage());await page.evaluate(()=>window.updatePortraitFixture({equipment:{hat:'hat-thunder'}}));
 await page.waitForFunction(previous=>window.portraitFixtureImage()!==previous,noHat);
 await page.locator('#aura-live-fixture').screenshot({path:'test-results/avatar-portrait/live-head.png'});
 // A head portrait must redraw when a late face finishes, even while body art
 // remains unavailable. This guards against both one-shot rendering and rig coupling.
 const cold=await browser.newPage({viewport:{width:900,height:700}});
 let releaseHead,releaseBody;const headReady=new Promise(resolve=>{releaseHead=resolve;}),bodyReady=new Promise(resolve=>{releaseBody=resolve;});
 await cold.route('**/assets/faces/face-brave.png',async route=>{await headReady;await route.continue();});
 await cold.route('**/assets/outfit-surfer-body.png',async route=>{await bodyReady;await route.continue();});
 try{
  await cold.goto(base,{waitUntil:'domcontentloaded'});
  await cold.evaluate(async()=>{
   const [{Avatar},{DEFAULT_EQUIPMENT},{default:{createElement}},{default:{createRoot}}]=await Promise.all([import('/src/components/Avatar.tsx'),import('/shared/catalog.ts'),import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js')]);
   const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:999999;background:#132941';document.body.append(host);createRoot(host).render(createElement(Avatar,{equipment:DEFAULT_EQUIPMENT,size:240,portrait:true,animated:false}));
   window.coldHeadPixels=()=>{const cv=host.querySelector('canvas');if(!cv)return 0;const data=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>20)count++;return count;};
  });
  assert.equal(await cold.evaluate(()=>window.coldHeadPixels()),0,'Portrait waits for the correct expression');releaseHead();
  await cold.waitForFunction(()=>window.coldHeadPixels()>5000);
 }finally{releaseHead();releaseBody();await cold.close();}
 assert.deepEqual(errors,[]);const complete={...report,hudResolution,retinaHud,reactAuraTicks:true,reactAuraOptOut:true,portraitEquipmentRedraw:true,lateHeadRedrawWithoutBody:true,errors};
 await writeFile('test-results/avatar-portrait/report.json',JSON.stringify(complete,null,2));console.log(JSON.stringify(complete,null,2));
}finally{await browser.close();}
