import {enterGame} from './character-helpers.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

// Uses Vite modules to exercise the actual React component, including cold artwork.
const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // A deliberately late body image catches portraits that only render once on mount.
 let releaseBody;const bodyReady=new Promise(resolve=>{releaseBody=resolve;});
 await page.route('**/assets/outfits/cartographer-atlas.png',async route=>{await bodyReady;await route.continue();});
 await enterGame(page,base);
 await page.evaluate(async()=>{
  const [{default:{createElement}},{default:{createRoot}},{Avatar},{DEFAULT_EQUIPMENT}]=await Promise.all([
   import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js'),
   import('/src/components/Avatar.tsx'),import('/shared/catalog.ts')
  ]);
  const host=document.createElement('div');host.id='static-avatar-fixture';
  host.style.cssText='position:fixed;inset:0;z-index:999999;background:#10243b;display:grid;place-items:center';document.body.append(host);
  const root=createRoot(host);
  let props={equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-cartographer',face:'face-wink',hair:'hair-undercut',hat:'hat-thunder',glasses:'glasses-sport',upgrade:12},size:440,animated:false,showAura:true};
  window.updateAvatarFixture=update=>{props={...props,...update,equipment:{...props.equipment,...update.equipment}};root.render(createElement(Avatar,props));};
  window.updateAvatarFixture({});
  window.avatarPixels=()=>{
   const canvas=host.querySelector('canvas');if(!canvas)return {count:0,image:''};
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let count=0;for(let index=3;index<pixels.length;index+=4)if(pixels[index]>20)count++;
   return {count,image:canvas.toDataURL()};
  };
 });
 const initial=await page.evaluate(()=>window.avatarPixels());
 assert.equal(initial.count,0,'Cold portrait should wait for its selected artwork');
 releaseBody();
 await page.waitForFunction(()=>window.avatarPixels().count>10000);
 // Other lazy equipment images may finish after the first body draw.
 await page.waitForLoadState('networkidle');
 const first=await page.evaluate(()=>window.avatarPixels());
 await page.waitForTimeout(900);
 assert.equal((await page.evaluate(()=>window.avatarPixels())).image,first.image,'Static avatar changed with elapsed time');
 await page.evaluate(()=>window.dispatchEvent(new Event('brasa-art-loaded')));
 await page.waitForTimeout(80);
 assert.equal((await page.evaluate(()=>window.avatarPixels())).image,first.image,'Art refresh advanced a frozen pose');
 await page.evaluate(()=>window.updateAvatarFixture({equipment:{outfit:'outfit-cartographer',hat:'hat-tropical'}}));
 await page.waitForFunction(previous=>window.avatarPixels().count>10000&&window.avatarPixels().image!==previous,first.image);
 await page.waitForLoadState('networkidle');
 const changed=await page.evaluate(()=>window.avatarPixels());
 await page.waitForTimeout(700);
 assert.equal((await page.evaluate(()=>window.avatarPixels())).image,changed.image,'Changed equipment should remain still');
 await page.evaluate(()=>window.updateAvatarFixture({facing:-1}));
 await page.waitForFunction(previous=>window.avatarPixels().image!==previous,changed.image);
 const mirrored=await page.evaluate(()=>window.avatarPixels());
 await page.evaluate(()=>window.updateAvatarFixture({weapon:false}));
 await page.waitForFunction(previous=>window.avatarPixels().image!==previous,mirrored.image);
 await page.locator('#static-avatar-fixture').screenshot({path:'test-results/static-avatar.png'});
 await page.evaluate(()=>window.updateAvatarFixture({animated:true}));
 await page.waitForTimeout(100);
 const animated=await page.evaluate(()=>window.avatarPixels());
 await page.waitForTimeout(250);
 assert.notEqual((await page.evaluate(()=>window.avatarPixels())).image,animated.image,'Normal animated avatar stopped moving');
 await page.evaluate(()=>window.updateAvatarFixture({animated:false}));
 await page.waitForTimeout(80);
 const stopped=await page.evaluate(()=>window.avatarPixels());
 await page.waitForTimeout(500);
 assert.equal((await page.evaluate(()=>window.avatarPixels())).image,stopped.image,'Switching back to static preserved motion');
 assert.deepEqual(errors,[],'Browser errors');
 const report={coldArtworkRedraw:true,frozenAcrossTime:true,frozenAfterAssetRefresh:true,equipmentUpdates:true,facingUpdates:true,weaponVisibility:true,animationStillAvailable:true,errors};
 await writeFile('test-results/static-avatar.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
