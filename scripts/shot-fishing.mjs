import {chromium} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
import {FISHING_HEIGHT,FISHING_SPAWN,FISHING_WIDTH,fishingFree} from '../shared/fishing.ts';
// Previews of the Pescaria's scenery (run with tsx: npx tsx scripts/shot-fishing.mjs <pasta>, game running):
// enters the zone and walks to a few places, one screenshot each.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-scenery';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.lobby-dock-button.fishing').click();await page.waitForTimeout(3500);
const canvas=page.locator('.world-canvas'),camera=(x,y)=>({x:Math.max(0,Math.min(FISHING_WIDTH-1536,x-768)),y:Math.max(0,Math.min(FISHING_HEIGHT-864,y-864*.6))});
let at={...FISHING_SPAWN};
/** Walks to a world point (clicking the visible part of the way) and waits there. */
async function walkTo(x,y){
 const goal=fishingFree(x,y);
 for(let n=0;n<6&&Math.hypot(at.x-goal.x,at.y-goal.y)>8;n++){
  const cam=camera(at.x,at.y),sx=Math.max(30,Math.min(1506,goal.x-cam.x)),sy=Math.max(120,Math.min(700,goal.y-cam.y)),w=fishingFree(cam.x+sx,cam.y+sy);
  await canvas.click({position:{x:sx,y:sy}});
  await page.waitForTimeout(Math.hypot(w.x-at.x,w.y-at.y)/132*1000*1.6+1200);at=w;
 }
}
await page.screenshot({path:`${dir}/01-chegada.png`});
for(const [name,x,y] of [['02-cais-leste',2300,1540],['03-escada-jardim',2620,1250],['04-poco-azul',3500,1300],['05-casa-de-pesca',1500,1290],['06-mirante',1940,830],['07-lagoa-cristal',3200,700],['08-mirante-oeste',700,760]]){
 await walkTo(x,y);await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/${name}.png`});
}
await browser.close();console.log('fishing scenery ok');
