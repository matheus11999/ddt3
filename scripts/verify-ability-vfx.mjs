import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out='test-results/ability-vfx';
await mkdir(out,{recursive:true});
const channel=process.env.BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined);
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
try{
 const page=await browser.newPage({viewport:{width:1120,height:1040},deviceScaleFactor:1,reducedMotion:'no-preference'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.goto(base,{waitUntil:'domcontentloaded'});
 const report=await page.evaluate(async()=>{
  const vfx=await import('/src/game/abilityEffects.ts'),{drawAvatar}=await import('/src/game/avatar.ts'),{DEFAULT_EQUIPMENT}=await import('/shared/catalog.ts');
  await vfx.preloadAbilityEffects();await document.fonts.ready;
  const names=['heal','homing','invisibility','flight'],labels={heal:'CURA',homing:'MIRA ASSISTIDA',invisibility:'INVISIBILIDADE',flight:'VOO'};
  const images=Object.fromEntries(await Promise.all(names.map(async id=>{const image=new Image();image.src=`/assets/abilities/${id}.png`;await image.decode();return [id,image];})));
  const landscape=new Image();landscape.src='/assets/maps/snow-preview.png';await landscape.decode();
  const canvas=(w=360,h=240)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
  const render=fn=>{const cv=canvas(),c=cv.getContext('2d',{willReadFrequently:true});let calls=0;const geometry=[];
   for(const key of ['drawImage','fill','stroke','fillRect','fillText','strokeText']){const original=c[key].bind(c);c[key]=(...args)=>{calls++;return original(...args);};}
   for(const key of ['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','translate','rotate','scale']){const original=c[key].bind(c);c[key]=(...args)=>{geometry.push([key,...args]);return original(...args);};}
   fn(c);return {cv,calls,geometry:JSON.stringify(geometry)};
  };
  const metrics=cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let pixels=0,partial=0,empty=0;for(let n=3;n<d.length;n+=4){if(d[n]>8)pixels++;if(d[n]>8&&d[n]<230)partial++;if(d[n]<3)empty++;}return {pixels,partial,partialRatio:partial/Math.max(1,pixels),emptyRatio:empty/(d.length/4)};};
  const checks=names.map(ability=>{
   const event={playerId:'p',ability,x:180,y:190,amount:300,at:0},before=JSON.stringify(event),a=render(c=>vfx.drawAbilityEffect(c,event,200)),b=render(c=>vfx.drawAbilityEffect(c,event,500)),low=render(c=>vfx.drawAbilityEffect(c,event,200,{quality:'low'})),q1=render(c=>vfx.drawAbilityEffect(c,event,200,{reducedMotion:true})),q2=render(c=>vfx.drawAbilityEffect(c,event,500,{reducedMotion:true}));
   const hidden=render(c=>vfx.drawAbilityEffect(c,{...event,hidden:true},200)),sentinel=render(c=>vfx.drawAbilityEffect(c,{...event,x:-10000,y:-10000},200)),expired=render(c=>vfx.drawAbilityEffect(c,event,vfx.ABILITY_EFFECT_DURATION)),negative=render(c=>vfx.drawAbilityEffect(c,event,-10));
   const state=canvas().getContext('2d');state.translate(4,7);state.globalAlpha=.43;state.lineWidth=9;state.globalCompositeOperation='multiply';vfx.drawAbilityEffect(state,event,200);
   return {ability,...metrics(a.cv),animated:a.cv.toDataURL()!==b.cv.toDataURL(),reducedGeometry:q1.geometry===q2.geometry,calls:a.calls,lowCalls:low.calls,hiddenPixels:metrics(hidden.cv).pixels,sentinelPixels:metrics(sentinel.cv).pixels,expiredPixels:metrics(expired.cv).pixels,negativePixels:metrics(negative.cv).pixels,inputUnchanged:before===JSON.stringify(event),statePreserved:Math.abs(state.globalAlpha-.43)<.001&&state.lineWidth===9&&state.getTransform().e===4&&state.globalCompositeOperation==='multiply'};
  });
  const p={kind:'flight',effect:'fire',delay:0,flightTime:800,impact:{x:300,y:190,radius:0},points:Array.from({length:61},(_,n)=>[20+n*5,160-Math.sin(n/60*Math.PI)*75])},before=JSON.stringify(p);
  const a=render(c=>vfx.drawFlightProjectile(c,p,35.1,1000)),b=render(c=>vfx.drawFlightProjectile(c,p,35.6,1000)),moving=render(c=>vfx.drawFlightProjectile(c,p,35.1,1400)),q1=render(c=>vfx.drawFlightProjectile(c,p,35.1,1000,{reducedMotion:true})),q2=render(c=>vfx.drawFlightProjectile(c,p,35.1,1400,{reducedMotion:true})),low=render(c=>vfx.drawFlightProjectile(c,p,35.1,1000,{quality:'low'}));
  const empty=render(c=>vfx.drawFlightProjectile(c,{...p,points:[]},2,0));
  const flight={...metrics(a.cv),fractional:a.cv.toDataURL()!==b.cv.toDataURL(),animated:a.cv.toDataURL()!==moving.cv.toDataURL(),reducedStable:q1.cv.toDataURL()===q2.cv.toDataURL(),calls:a.calls,lowCalls:low.calls,inputUnchanged:JSON.stringify(p)===before,emptyPixels:metrics(empty.cv).pixels};
  const healValue=amount=>render(c=>vfx.drawAbilityEffect(c,{playerId:'p',ability:'heal',x:180,y:190,amount,at:0},200)).cv.toDataURL();
  const iconMetrics=names.map(id=>{const cv=canvas(384,384);cv.getContext('2d').drawImage(images[id],0,0,384,384);return {id,width:images[id].naturalWidth,height:images[id].naturalHeight,...metrics(cv)};});
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:999999;background:#14283a;overflow:auto';document.body.append(host);const sheet=canvas(1120,1040);sheet.id='ability-sheet';host.append(sheet);const c=sheet.getContext('2d');
  // Warm the existing compositor before recording; do not substitute old character art.
  for(let n=0;n<25;n++){drawAvatar(c,DEFAULT_EQUIPMENT,180,600,100,0,false,1,true,undefined,{combat:true,animated:false});await new Promise(resolve=>requestAnimationFrame(resolve));}
  window.paintAbilitySheet=(age=200,time=1000)=>{
   c.fillStyle='#14283a';c.fillRect(0,0,1120,1040);c.font='bold 23px Arial';c.fillStyle='#ffe3a0';c.fillText('BRASA · HABILIDADES',24,35);
   names.forEach((id,i)=>{const x=i*280;c.save();c.translate(x,55);c.fillStyle='#20384f';c.fillRect(12,0,256,288);c.font='bold 15px Arial';c.fillStyle='#fff0c3';c.fillText(labels[id],28,27);c.drawImage(images[id],55,44,170,170);c.fillStyle='#f3e8cf';c.fillRect(64,221,72,60);c.fillStyle='#162738';c.fillRect(146,221,72,60);c.drawImage(images[id],70,221,60,60);c.drawImage(images[id],152,221,60,60);c.restore();});
   c.font='bold 15px Arial';c.fillStyle='#b7d9e6';c.fillText('EFEITOS SOBRE O CENÁRIO · VALORES VÊM DO SERVIDOR',24,377);
   names.forEach((id,i)=>{const x=i*280;c.save();c.translate(x+12,390);c.drawImage(landscape,0,0,256,260);c.font='bold 14px Arial';c.fillStyle='#17253c';c.fillText(labels[id],16,22);c.save();if(id==='invisibility')c.globalAlpha=.22;drawAvatar(c,DEFAULT_EQUIPMENT,128,225,108,0,false,1,true,undefined,{combat:true,animated:false});c.restore();vfx.drawAbilityEffect(c,{playerId:'p',ability:id,x:128,y:225,amount:300,at:0},age);c.restore();});
   c.font='bold 15px Arial';c.fillStyle='#b7d9e6';c.fillText('PROJÉTIL DE PAPEL · TRAJETÓRIA FRACIONÁRIA',24,688);
   c.drawImage(landscape,24,705,1072,305);c.save();c.translate(45,730);c.scale(2.8,1.2);vfx.drawFlightProjectile(c,p,8+(time%1600)/1600*47,time);c.restore();vfx.drawTeleportEffect(c,940,980,age);
  };window.paintAbilitySheet();
  window.captureAbilityMotion=async()=>{const stream=sheet.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1800000}),chunks=[];let frame=0;const start=performance.now();recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>{recorder.onstop=resolve;});const draw=time=>{window.paintAbilitySheet((time-start)%1300,time-start);frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);recorder.start();await new Promise(resolve=>setTimeout(resolve,3900));recorder.stop();await stopped;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});};
  return {checks,flight,iconMetrics,healingAmountChanges:healValue(300)!==healValue(140),zeroHealNoFalseNumber:healValue(0)===healValue(undefined),cache:vfx.abilityEffectCacheStats(),limits:vfx.ABILITY_VFX_LIMITS};
 });
 await page.locator('#ability-sheet').screenshot({path:`${out}/abilities-sheet.png`});await page.evaluate(()=>window.paintAbilitySheet(620,1420));await page.locator('#ability-sheet').screenshot({path:`${out}/late-effects.png`});
 const recording=await page.evaluate(()=>window.captureAbilityMotion());await writeFile(`${out}/abilities-motion.webm`,Buffer.from(recording,'base64'));
 await writeFile(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 for(const check of report.checks){assert.ok(check.pixels>80&&check.animated,`${check.ability} visible and animated`);assert.ok(check.partialRatio>.65,`${check.ability} translucent`);assert.ok(check.reducedGeometry,`${check.ability} reduced-motion keeps geometry still`);assert.equal(check.hiddenPixels,0);assert.equal(check.sentinelPixels,0);assert.equal(check.expiredPixels,0);assert.equal(check.negativePixels,0);assert.ok(check.statePreserved&&check.inputUnchanged);assert.ok(check.lowCalls<=check.calls&&check.calls<50);}
 assert.ok(report.flight.fractional&&report.flight.animated&&report.flight.reducedStable&&report.flight.inputUnchanged);assert.equal(report.flight.emptyPixels,0);assert.ok(report.flight.calls<20&&report.flight.lowCalls<=report.flight.calls);
 assert.ok(report.healingAmountChanges&&report.zeroHealNoFalseNumber);for(const icon of report.iconMetrics){assert.equal(icon.width,384);assert.equal(icon.height,384);assert.ok(icon.emptyRatio>.12);}assert.ok(report.iconMetrics.find(i=>i.id==='invisibility').partialRatio>.7);assert.ok(report.cache.rgbaBytes<3*1024*1024);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',checks:report.checks.map(({ability,pixels,partialRatio,calls,lowCalls})=>({ability,pixels,partialRatio,calls,lowCalls})),flight:report.flight,cache:report.cache,artifacts:out}));
}finally{await browser.close();}
