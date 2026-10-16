import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

// Environment-only harness. The full game/avatar/browser smoke has a separate
// script; timing here is explicitly not a promise about hardware or game FPS.
const directory='test-results/maps';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],results=[];
async function setup(page){
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/map-preview.html',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><canvas id="map" width="1536" height="864" style="width:1536px;height:864px"></canvas></body></html>'}));
 await page.goto((process.env.BASE_URL??'http://127.0.0.1:5177')+'/map-preview.html');
 await page.evaluate(async()=>{
  const env=await import('/src/game/environment.ts'),physics=await import('/shared/physics.ts');
  const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
  window.preview={env,physics,canvas,c};
  window.startMap=(id,{zoom=1,time=6000,damage=false,quality='high',dpr=1}={})=>{
   env.setEnvironmentQuality(quality);canvas.width=1536*dpr;canvas.height=864*dpr;
   const terrain=physics.createTerrain(id);
   if(damage){physics.crater(terrain,650,physics.ground(terrain,650),86,id);physics.crater(terrain,870,physics.ground(terrain,870),66,id);}
   const renderer=new env.EnvironmentRenderer(id,terrain),camera=env.createCamera();camera.zoom=camera.targetZoom=zoom;camera.x=zoom>1?650:768;camera.y=zoom>1?480:432;
   const initial=terrain.slice();window.scene={id,renderer,camera,time,dpr,terrain,initial};
   window.renderMap=()=>{const s=window.scene;c.setTransform(s.dpr,0,0,s.dpr,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';renderer.drawBack(c,s.time,s.camera);c.save();env.applyCamera(c,s.camera);renderer.drawTerrain(c,s.time);c.restore();renderer.drawFront(c,s.time,s.camera);};
   window.renderMap();return {solids:terrain.reduce((a,b)=>a+b,0)};
  };
  window.drawMap=async(id,options)=>{const initial=window.startMap(id,options),ready=await window.scene.renderer.whenReady();window.renderMap();return {...initial,ready};};
  window.pixelSnapshot=()=>c.getImageData(0,0,canvas.width,canvas.height).data;
  window.compare=(before,after)=>{let changed=0,maxChannelDelta=0,totalDelta=0;for(let i=0;i<before.length;i+=4){let different=false;for(let channel=0;channel<4;channel++){const delta=Math.abs(before[i+channel]-after[i+channel]);if(delta){different=true;maxChannelDelta=Math.max(maxChannelDelta,delta);totalDelta+=delta;}}if(different)changed++;}return {changedPixels:changed,maxChannelDelta,meanChannelDelta:totalDelta/before.length};};
 });
}
async function saveCanvas(page,path){
 const data=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));
 await writeFile(path,Buffer.from(data.split(',')[1],'base64'));
}
const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();
await setup(page);
const machine=await page.evaluate(()=>{
 const gl=document.createElement('canvas').getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');
 return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,renderer:gl&&debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'not exposed',scope:'Environment-only Canvas2D. Pixel checks use CPU readback; timing uses a separate presented Canvas with no repeated readback. Headless measurements, not full-game FPS.'};
});
for(const id of ['garden','park','celestial']){
 const initial=await page.evaluate(id=>window.drawMap(id),id);assert.equal(initial.ready,true,`${id}: assets decoded`);
 await saveCanvas(page,`${directory}/${id}.png`);
 await page.evaluate(id=>window.drawMap(id,{zoom:1.45}),id);await saveCanvas(page,`${directory}/${id}-zoom.png`);
 const damaged=await page.evaluate(id=>window.drawMap(id,{damage:true}),id);await saveCanvas(page,`${directory}/${id}-impact.png`);
 const updatedTerrain=await page.evaluate(async id=>{
  const {env,physics,c}=window.preview,{renderer,terrain,camera}=window.scene;
  const x=id==='garden'?519:666;physics.crater(terrain,x,physics.ground(terrain,x),44,id);renderer.setTerrain(terrain);window.renderMap();const updated=window.pixelSnapshot();
  const restored=new env.EnvironmentRenderer(id,terrain);await restored.whenReady();restored.drawBack(c,6000,camera);c.save();env.applyCamera(c,camera);restored.drawTerrain(c,6000);c.restore();restored.drawFront(c,6000,camera);
  return window.compare(updated,window.pixelSnapshot());
 },id);
 assert.equal(updatedTerrain.changedPixels,0,`${id}: terrain/prop cache after a live impact must match a fresh renderer`);
 for(const quality of ['high','low'])for(const dpr of [1,2]){
  await page.evaluate(({id,quality,dpr})=>window.drawMap(id,{zoom:1.45,damage:true,quality,dpr}),{id,quality,dpr});
  const verification=await page.evaluate(()=>{
   const {renderer,camera,dpr,terrain,initial}=window.scene,{canvas}=window.preview;
   window.renderMap();const before=window.pixelSnapshot();window.renderMap();const identical=window.compare(before,window.pixelSnapshot());
   const x=camera.x,y=camera.y,zoom=camera.zoom,motion=[],sheet=document.createElement('canvas');sheet.width=1440;sheet.height=560;const sc=sheet.getContext('2d');let prior=before;
   for(let frame=0;frame<6;frame++){
    camera.x=x+frame*.23;camera.y=y+frame*.13;camera.zoom=zoom+frame*.0007;window.renderMap();const pixels=window.pixelSnapshot();motion.push(window.compare(prior,pixels));prior=pixels;
    sc.drawImage(canvas,475*dpr,405*dpr,480*dpr,250*dpr,(frame%3)*480,Math.floor(frame/3)*280,480,250);sc.fillStyle='#09122d';sc.fillRect((frame%3)*480,Math.floor(frame/3)*280+250,480,30);sc.fillStyle='#ffffff';sc.font='16px sans-serif';sc.fillText(`x +${(frame*.23).toFixed(2)} / y +${(frame*.13).toFixed(2)} / zoom ${camera.zoom.toFixed(4)}`,(frame%3)*480+12,Math.floor(frame/3)*280+271);
   }
   camera.x=x;camera.y=y;camera.zoom=zoom;window.renderMap();const returned=window.compare(before,window.pixelSnapshot());
   const oldQuality=window.preview.env.getEnvironmentQuality();window.preview.env.setEnvironmentQuality(oldQuality==='high'?'low':'high');window.renderMap();window.preview.env.setEnvironmentQuality(oldQuality);window.renderMap();const restoredQuality=window.compare(before,window.pixelSnapshot());
   const layer=renderer.getTerrainLayer(),lc=layer.getContext('2d'),alpha=lc.getImageData(0,0,layer.width,layer.height).data;let partialAlphaPixels=0;for(let i=3;i<alpha.length;i+=4)if(alpha[i]>0&&alpha[i]<255)partialAlphaPixels++;
   return {identical,returned,restoredQuality,motion,physicalBytesUnchanged:terrain.every((value,index)=>value===initial[index]),terrainBuffer:[layer.width,layer.height],partialAlphaPixels,filmstrip:sheet.toDataURL('image/png')};
  });
  assert.equal(verification.identical.changedPixels,0,`${id}/${quality}/${dpr}: identical frame`);
  assert.equal(verification.returned.changedPixels,0,`${id}/${quality}/${dpr}: camera return`);
  assert.equal(verification.restoredQuality.changedPixels,0,`${id}/${quality}/${dpr}: quality return`);
  assert.equal(verification.physicalBytesUnchanged,true,`${id}: rendering must not mutate collision`);
  assert.ok(verification.partialAlphaPixels>0,`${id}: antialiased coverage`);
  await writeFile(`${directory}/${id}-${quality}-dpr${dpr}-motion.png`,Buffer.from(verification.filmstrip.split(',')[1],'base64'));delete verification.filmstrip;
  const timing=await page.evaluate(async()=>{
   // Reading pixels every frame can force Chromium's CPU raster path. Use a
   // fresh, presented canvas for animation timings, like the real Scene does.
   const {canvas,env}=window.preview,measured=document.createElement('canvas');measured.width=canvas.width;measured.height=canvas.height;measured.style.cssText=canvas.style.cssText;canvas.replaceWith(measured);const context=measured.getContext('2d');
   const frames=[],draws=[];let last=0;
   for(let n=0;n<36;n++){
    const now=await new Promise(requestAnimationFrame);if(last&&n>5)frames.push(now-last);last=now;
    window.scene.time=6000+n*(1000/60);window.scene.camera.x=650+n*.23;
    const start=performance.now(),{renderer,time,camera,dpr}=window.scene;context.setTransform(dpr,0,0,dpr,0,0);renderer.drawBack(context,time,camera);context.save();env.applyCamera(context,camera);renderer.drawTerrain(context,time);context.restore();renderer.drawFront(context,time,camera);if(n>5)draws.push(performance.now()-start);
   }
   await new Promise(requestAnimationFrame);measured.replaceWith(canvas);
   const stats=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};};
   return {drawSubmission:stats(draws),rafInterval:stats(frames),samples:draws.length};
  });
  results.push({id,quality,dpr,initial,damaged,updatedTerrain,verification,timing});
  console.error(`${id}/${quality}/DPR${dpr}: deterministic pixels, camera return, quality return and physics OK`);
 }
}
await context.close();

// A deferred asset must keep one coherent loading composition, even if a crater
// arrives meanwhile. Release the gate explicitly: elapsed time is not readiness.
const loadingContext=await browser.newContext({viewport:{width:1536,height:864}}),loadingPage=await loadingContext.newPage();let release;const gate=new Promise(resolve=>{release=resolve;});
await loadingPage.route('**/assets/maps/*-terrain-world.png',async route=>{await gate;await route.continue();});
await setup(loadingPage);await loadingPage.evaluate(()=>window.startMap('garden'));
const loading=await loadingPage.evaluate(async()=>{
 const image=new Image();image.src='/assets/maps/garden-preview.png';await image.decode();window.renderMap();const before=window.pixelSnapshot();
 const {renderer,terrain}=window.scene;window.preview.physics.crater(terrain,650,550,86,'garden');renderer.setTerrain(terrain);window.scene.time+=1000;window.renderMap();
 const layer=renderer.getTerrainLayer(),p=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;
 return {readyWhileBlocked:renderer.isReady(),changedWhileBlocked:window.compare(before,window.pixelSnapshot()).changedPixels,paintedTerrainWhileBlocked:p.some(value=>value!==0)};
});
await saveCanvas(loadingPage,`${directory}/loading.png`);release();
loading.readyAfterRelease=await loadingPage.evaluate(()=>window.scene.renderer.whenReady());
await loadingPage.evaluate(()=>window.renderMap());await saveCanvas(loadingPage,`${directory}/loaded.png`);
assert.equal(loading.readyWhileBlocked,false);assert.equal(loading.changedWhileBlocked,0);assert.equal(loading.paintedTerrainWhileBlocked,false);assert.equal(loading.readyAfterRelease,true);
await loadingContext.close();
const failedContext=await browser.newContext({viewport:{width:1536,height:864}}),failedPage=await failedContext.newPage();
await failedPage.route('**/assets/maps/*-terrain-world.png',route=>route.abort());await setup(failedPage);
const failed=await failedPage.evaluate(async()=>{window.startMap('garden');const ready=await window.scene.renderer.whenReady();window.renderMap();return {ready,rendererReady:window.scene.renderer.isReady()};});
await saveCanvas(failedPage,`${directory}/loading-error.png`);assert.equal(failed.ready,false);assert.equal(failed.rendererReady,false);await failedContext.close();
const report={machine,results,loading,failed,errors};await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({machine,scenarios:results.map(({id,quality,dpr,timing,verification})=>({id,quality,dpr,timing,identicalPixels:verification.identical.changedPixels,cameraReturnPixels:verification.returned.changedPixels,qualityReturnPixels:verification.restoredQuality.changedPixels,physicsUnchanged:verification.physicalBytesUnchanged})),loading,failed,errors},null,2));
await browser.close();assert.equal(errors.length,0,'browser exceptions');
