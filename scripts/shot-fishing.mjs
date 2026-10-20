import {chromium} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
import {FISHING_HEIGHT,FISHING_SPAWN,FISHING_WIDTH,fishingFree,fishingStep} from '../shared/fishing.ts';
import {LOBBY_WALK_SPEED} from '../shared/lobby.ts';
// Previews of the Pescaria's scenery (run with tsx: npx tsx scripts/shot-fishing.mjs <pasta>, game running):
// enters the zone and walks to a few places, one screenshot each.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-scenery';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
// The real position, from the server's lobby updates (alone in the zone, so the only player listed).
let real=null;page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const e=JSON.parse(String(payload));if(e.type==='lobby'&&e.players?.length===1)real={x:e.players[0].x,y:e.players[0].y};}catch{}}));
await enterGame(page,base);
await page.locator('.lobby-dock-button.fishing').click();await page.waitForTimeout(3500);
const canvas=page.locator('.world-canvas'),camera=(x,y)=>({x:Math.max(0,Math.min(FISHING_WIDTH-1536,x-768)),y:Math.max(0,Math.min(FISHING_HEIGHT-864,y-864*.6))});
let at={...FISHING_SPAWN};
/** Where the server's walk ends and how long it takes (same steps as the server). */
function route(from,to){let p={...from},t=0;for(;t<120&&Math.hypot(p.x-to.x,p.y-to.y)>1;t+=.05)p=fishingStep(p,to,LOBBY_WALK_SPEED*.05);return {end:p,ms:t*1000};}
/** Walks to a world point (clicking the visible part of the way) and waits there. */
async function walkTo(x,y){
 const goal=fishingFree(x,y);
 for(let n=0;n<8&&Math.hypot(at.x-goal.x,at.y-goal.y)>8;n++){
  const cam=camera(at.x,at.y),sx=Math.max(30,Math.min(1506,goal.x-cam.x)),sy=Math.max(250,Math.min(620,goal.y-cam.y)),{end,ms}=route(at,fishingFree(cam.x+sx,cam.y+sy));
  await canvas.click({position:{x:sx,y:sy}});
  await page.waitForTimeout(ms+1500);at=real??end;if(process.env.DEBUG)console.log({goal,end,real});
  // A click that lands on the Casa de Pesca opens its window; close it and keep walking.
  if(await page.locator('.fishing-shop-window').isVisible())await page.locator('.fishing-shop-window .close-button').click();
 }
}
await page.screenshot({path:`${dir}/01-chegada.png`});
for(const [name,x,y] of [['02-casa-de-pesca',2300,2430],['03-escada-cais',1700,2150],['04-ninfeias',1750,1960],['05-ilha-ponte',2040,1700],['06-poco-azul',3350,1720],['07-juncos',3900,2040],['08-mirante-termal',3300,1110],['09-pagode',2250,1050],['10-lagoa-cristal',1250,1110]]){
 await walkTo(x,y);await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/${name}.png`});
}
await browser.close();console.log('fishing scenery ok');
