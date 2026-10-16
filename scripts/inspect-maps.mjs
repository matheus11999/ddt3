import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results/maps',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/map-preview.html',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><canvas id="map" width="1536" height="864"></canvas></body></html>'}));
await page.goto((process.env.BASE_URL??'http://127.0.0.1:5177')+'/map-preview.html');
await page.evaluate(async()=>{
 const env=await import('/src/game/environment.ts'),physics=await import('/shared/physics.ts'),catalog=await import('/shared/catalog.ts'),avatar=await import('/src/game/avatar.ts');
 window.preview={env,physics,catalog,avatar};
 window.drawMap=(id,zoom=1,time=6000,damage=false)=>{
  const {env,physics,catalog,avatar}=window.preview,c=document.querySelector('canvas').getContext('2d');const terrain=physics.createTerrain(id);
  if(damage){physics.crater(terrain,650,physics.ground(terrain,650),86,id);physics.crater(terrain,870,physics.ground(terrain,870),66,id);}
  const renderer=new env.EnvironmentRenderer(id,terrain),camera=env.createCamera();camera.zoom=camera.targetZoom=zoom;camera.x=zoom>1?650:768;camera.y=zoom>1?480:432;
  window.renderMap=()=>{renderer.drawBack(c,time,camera);c.save();env.applyCamera(c,camera);renderer.drawTerrain(c,time);
   for(const [index,x] of [260,1276].entries()){const y=physics.ground(terrain,x);avatar.drawAvatar(c,{...catalog.DEFAULT_EQUIPMENT,weapon:index?'volt':'ember',upgrade:index?9:0},x,y,112,time,false,index?-1:1);c.fillStyle=index?'#e6a3a3':'#a1d5e1';c.fillRect(x-34,y-135,68,5);}
   c.restore();renderer.drawFront(c,time,camera);
  };window.renderMap();return {solids:terrain.reduce((a,b)=>a+b,0)};
 };
});
const results=[];
for(const id of ['garden','park','celestial']){
 const initial=await page.evaluate(id=>window.drawMap(id),id);await page.waitForTimeout(1600);await page.evaluate(()=>window.renderMap());await page.screenshot({path:`test-results/maps/${id}.png`});
 await page.evaluate(id=>window.drawMap(id,1.45),id);await page.waitForTimeout(150);await page.evaluate(()=>window.renderMap());await page.screenshot({path:`test-results/maps/${id}-zoom.png`});
 const damaged=await page.evaluate(id=>window.drawMap(id,1,6000,true),id);await page.waitForTimeout(150);await page.evaluate(()=>window.renderMap());await page.screenshot({path:`test-results/maps/${id}-impact.png`});
 const timing=await page.evaluate(()=>{const samples=[];for(let i=0;i<90;i++){const start=performance.now();window.renderMap();samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);return {medianMs:samples[45],p95Ms:samples[85]};});results.push({id,initial,damaged,timing});
}
await writeFile('test-results/maps/report.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));await browser.close();if(errors.length)process.exitCode=1;
