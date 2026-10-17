import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',out='test-results/weapon-vfx';
await mkdir(out,{recursive:true});
const channel=process.env.BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined);
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1130},deviceScaleFactor:1,reducedMotion:'no-preference'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.goto(base,{waitUntil:'domcontentloaded'});
 const report=await page.evaluate(async()=>{
  const {preloadWeaponEffects,drawProjectile,drawImpact,drawMuzzle,drawWeaponEnergy,VFX_LIMITS,weaponEffectCacheStats}=await import('/src/game/weaponEffects.ts');
  const {drawHitFeedback,HIT_FEEDBACK_DURATION}=await import('/src/game/hitFeedback.ts');
  await preloadWeaponEffects();await document.fonts.ready;
  const landscape=new Image();landscape.src='/assets/maps/garden-preview.png';await landscape.decode();
  const families=['fire','electric','crystal','dynamite'],levels=[0,9,10,12],names={fire:'BRASA',electric:'VOLTAGEM',crystal:'CRISTAL',dynamite:'DINAMITE'};
  const canvas=(w=300,h=240)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
  const projectile=effect=>({effect,delay:0,flightTime:650,points:Array.from({length:61},(_,n)=>[22+n*3.4,95-Math.sin(n/60*Math.PI)*38]),impact:{x:150,y:138,radius:44,material:effect==='electric'?'metal':effect==='crystal'?'magic':'earth'}});
  const draw=(fn)=>{const cv=canvas(),c=cv.getContext('2d',{willReadFrequently:true});let calls=0;for(const key of ['drawImage','fill','stroke','fillRect','fillText','strokeText']){const original=c[key].bind(c);c[key]=(...args)=>{calls++;return original(...args);};}fn(c);return {canvas:cv,calls};};
  const metrics=cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let pixels=0,opaque=0,partial=0;for(let i=3;i<d.length;i+=4){if(d[i]>8)pixels++;if(d[i]>240)opaque++;if(d[i]>8&&d[i]<230)partial++;}return {pixels,opaque,partial,partialRatio:partial/Math.max(1,pixels)};};
  const checks=[];
  for(const effect of families)for(const level of levels){
   const p=projectile(effect),before=JSON.stringify(p),first=draw(c=>drawProjectile(c,p,36.35,level,1000)),next=draw(c=>drawProjectile(c,p,36.35,level,1190));
   const impact=draw(c=>drawImpact(c,p,190,level,p.impact.material)),dissolved=draw(c=>drawImpact(c,p,520,level,p.impact.material)),low=draw(c=>drawImpact(c,p,190,level,p.impact.material,{quality:'low'}));
   const muzzle=draw(c=>drawMuzzle(c,80,130,effect,70,level,1,-.15)),lateMuzzle=draw(c=>drawMuzzle(c,80,130,effect,170,level,1,-.15));
   const finished=draw(c=>{drawImpact(c,p,720,level);drawMuzzle(c,80,130,effect,500,level,1);});
   const fractionA=draw(c=>drawProjectile(c,p,36,level,1000)),fractionB=draw(c=>drawProjectile(c,p,36.5,level,1000));
   const stillA=draw(c=>drawProjectile(c,p,36.35,level,1000,{reducedMotion:true})),stillB=draw(c=>drawProjectile(c,p,36.35,level,1500,{reducedMotion:true}));
   const restore=canvas().getContext('2d');restore.globalAlpha=.63;restore.lineWidth=7;restore.translate(2,3);drawImpact(restore,p,190,level);drawProjectile(restore,p,20.5,level,500);drawMuzzle(restore,80,130,effect,70,level,1);
   checks.push({effect,level,flight:metrics(first.canvas),impact:metrics(impact.canvas),dissolved:metrics(dissolved.canvas),movingFlight:first.canvas.toDataURL()!==next.canvas.toDataURL(),movingImpact:impact.canvas.toDataURL()!==dissolved.canvas.toDataURL(),movingMuzzle:muzzle.canvas.toDataURL()!==lateMuzzle.canvas.toDataURL(),fractionalInterpolation:fractionA.canvas.toDataURL()!==fractionB.canvas.toDataURL(),reducedMotion:stillA.canvas.toDataURL()===stillB.canvas.toDataURL(),expiredPixels:metrics(finished.canvas).pixels,calls:{flight:first.calls,impact:impact.calls,lowImpact:low.calls,muzzle:muzzle.calls},inputUnchanged:before===JSON.stringify(p),restoresContext:Math.abs(restore.globalAlpha-.63)<.001&&restore.lineWidth===7&&restore.getTransform().e===2});
  }
  const hit={id:'sample',damage:342,x:150,y:120,projectileIndex:0,critical:false,kind:'direct',quality:1};
  const normal=draw(c=>drawHitFeedback(c,hit,180)),critical=draw(c=>drawHitFeedback(c,{...hit,critical:true},180)),hitLater=draw(c=>drawHitFeedback(c,{...hit,critical:true},510)),hitEnd=draw(c=>drawHitFeedback(c,{...hit,critical:true},HIT_FEEDBACK_DURATION));
  const energies=levels.map(level=>{const first=draw(c=>{c.translate(150,120);drawWeaponEnergy(c,'fire',level,1000);}),later=draw(c=>{c.translate(150,120);drawWeaponEnergy(c,'fire',level,1500);});return {level,pixels:metrics(first.canvas).pixels,animated:first.canvas.toDataURL()!==later.canvas.toDataURL()};});
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:999999;background:#14283a;overflow:auto';document.body.append(host);
  const sheet=canvas(1360,1130);sheet.id='vfx-sheet';host.append(sheet);const c=sheet.getContext('2d');
  window.paintVfxSheet=(time=1000,impactAge=190,world=false,moving=false)=>{
   c.fillStyle='#14283a';c.fillRect(0,0,1360,1130);c.font='bold 22px Arial';c.fillStyle='#ffe3a0';c.fillText('BRASA · ENERGIA, TRILHAS E DISSOLUÇÃO',24,35);
   for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=col*340,y=55+row*235,effect=families[row],level=levels[col],p=projectile(effect);
    c.save();c.translate(x+15,y);c.fillStyle=row%2?'#294352':'#34424a';c.fillRect(0,0,310,222);if(world)c.drawImage(landscape,0,26,310,196);else for(let n=0;n<5;n++){c.fillStyle=n%2?'#ffffff05':'#00101d0a';c.fillRect(n*62,0,31,222);}
    c.font='bold 13px Arial';c.fillStyle='#ebdcb5';c.fillText(`${names[effect]}  +${level}`,12,21);
    drawProjectile(c,p,moving?8+(time%1200)/1200*48:43.3,level,time);drawMuzzle(c,15,108,effect,impactAge%250,level,1,0);c.save();c.translate(38,52);drawImpact(c,p,impactAge,level,p.impact.material);c.restore();c.restore();
   }
   c.font='bold 15px Arial';c.fillStyle='#d9e9ee';c.fillText('DANO DO SERVIDOR',24,1032);
   ['direct','graze','splash','fall'].forEach((kind,index)=>drawHitFeedback(c,{...hit,kind,x:160+index*220,y:1100},190));drawHitFeedback(c,{...hit,critical:true,x:1150,y:1100},190);
  };window.paintVfxSheet();
  window.captureVfxMotion=async()=>{
   const stream=sheet.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2400000}),chunks=[];let frame=0,start=performance.now();
   recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
   const render=t=>{window.paintVfxSheet(t,(t-start)%690,false,true);frame=requestAnimationFrame(render);};frame=requestAnimationFrame(render);recorder.start();await new Promise(resolve=>setTimeout(resolve,4200));recorder.stop();await stopped;cancelAnimationFrame(frame);stream.getTracks().forEach(track=>track.stop());
   const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
  };
  return {checks,limits:VFX_LIMITS,cache:weaponEffectCacheStats(),hit:{normalPixels:metrics(normal.canvas).pixels,criticalPixels:metrics(critical.canvas).pixels,different:normal.canvas.toDataURL()!==critical.canvas.toDataURL(),moving:critical.canvas.toDataURL()!==hitLater.canvas.toDataURL(),expired:metrics(hitEnd.canvas).pixels,calls:critical.calls},energies};
 });
 await page.locator('#vfx-sheet').screenshot({path:`${out}/stage-sheet.png`});
 await page.evaluate(()=>window.paintVfxSheet(1390,520));await page.locator('#vfx-sheet').screenshot({path:`${out}/dissolve-sheet.png`});
 await page.evaluate(()=>window.paintVfxSheet(1000,145,true));await page.locator('#vfx-sheet').screenshot({path:`${out}/map-context.png`});
 const recording=await page.evaluate(()=>window.captureVfxMotion());await writeFile(`${out}/effects-motion.webm`,Buffer.from(recording,'base64'));
 await writeFile(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 for(const check of report.checks){
  assert.ok(check.flight.pixels>80&&check.impact.pixels>800,`${check.effect} +${check.level} populated`);
  assert.ok(check.movingFlight&&check.movingImpact&&check.movingMuzzle,'All three phases visibly animate');assert.ok(check.fractionalInterpolation,'Fractional trajectory samples remain smooth');assert.ok(check.reducedMotion);
  assert.ok(check.impact.partialRatio>.8,'Impact energy stays translucent');assert.ok(check.dissolved.pixels<check.impact.pixels,'Painted impact dissolves instead of holding a solid decal');
  assert.equal(check.expiredPixels,0);assert.ok(check.inputUnchanged&&check.restoresContext);assert.ok(check.calls.impact<=130&&check.calls.flight<=65&&check.calls.muzzle<=25,'Draw calls bounded');assert.ok(check.calls.lowImpact<=check.calls.impact);
 }
 assert.ok(report.hit.different&&report.hit.moving&&report.hit.criticalPixels>report.hit.normalPixels);assert.equal(report.hit.expired,0);
 assert.equal(report.energies[0].pixels,0);assert.ok(report.energies.slice(1).every(e=>e.pixels>0&&e.animated));assert.ok(report.cache.rgbaBytes<16*1024*1024,'Bounded precomputed RGBA cache');assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({...report,errors},null,2));
 console.log(JSON.stringify({passed:true,cases:report.checks.length,maxCalls:{flight:Math.max(...report.checks.map(c=>c.calls.flight)),impact:Math.max(...report.checks.map(c=>c.calls.impact)),lowImpact:Math.max(...report.checks.map(c=>c.calls.lowImpact))},cache:report.cache,minImpactTranslucency:Math.min(...report.checks.map(c=>c.impact.partialRatio)),hit:report.hit,video:`${out}/effects-motion.webm`,errors},null,2));
}finally{await browser.close();}
