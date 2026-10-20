import {chromium,expect} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
import {FISHING_SPOTS,FISHING_LAKES} from '../shared/fishing.ts';
// Pescaria smoke and previews (run with tsx: npx tsx scripts/smoke-fishing.mjs <pasta>):
// goes from the plaza to the Pescaria, fishes by hand until a catch (pressing when the marker
// is on the green), watches a second player fish in automatic, opens the Casa de Pesca and goes back.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const shot=(page,name)=>page.screenshot({path:`${dir}/${name}.png`});
const open=async()=>{const context=await browser.newContext({viewport:{width:1536,height:864}});const page=await context.newPage();await enterGame(page,base);return page;};
const camera=x=>Math.max(0,Math.min(6144-1536,x-768));
const lake=FISHING_LAKES[0],nearest=(x,y,taken=[])=>FISHING_SPOTS.filter(s=>s.lake===lake.id&&!taken.includes(s.id)).sort((a,b)=>Math.hypot(a.bobX-x,a.bobY-y)-Math.hypot(b.bobX-x,b.bobY-y))[0];

// A friend fishing in automatic mode, so the first player sees someone else at the lake.
const friend=await open();
await friend.locator('.lobby-dock-button.fishing').click();await expect(friend.locator('.fishing-hud')).toBeVisible();await friend.waitForTimeout(1500);
await friend.locator('.fishing-auto').click();
const friendSpot=nearest(1450,lake.y);
await friend.locator('.world-canvas').click({position:{x:1450,y:lake.y}});
await expect(friend.locator('.fishing-tip')).toContainText('automático',{timeout:30000});

const page=await open(),canvas=page.locator('.world-canvas');
await page.waitForTimeout(1500);await shot(page,'01-praca-botao');
await page.locator('.lobby-dock-button.fishing').click();
await expect(page.locator('.fishing-hud')).toBeVisible();await expect(page.locator('.lobby-dock-button.arena')).toHaveCount(0);
await page.waitForTimeout(2500);await shot(page,'02-entrada');
// Click the water near the west shore: walk to the nearest free spot and cast.
const spot=nearest(lake.x-lake.rx+120,lake.y,[friendSpot.id]);
await canvas.click({position:{x:lake.x-lake.rx+120-camera(380),y:lake.y}});
await expect(page.locator('.fishing-tip')).toContainText('morder',{timeout:30000});
await page.waitForTimeout(800);await shot(page,'03-esperando');
let caught=false;
for(let attempt=0;attempt<4&&!caught;attempt++){
 await expect(page.locator('.fishing-challenge')).toBeVisible({timeout:30000});
 await page.waitForTimeout(400);await shot(page,'04-fisgou');
 // Press whenever the marker is in the middle of the green, until the bar closes.
 await page.evaluate(()=>new Promise(done=>{let last=0;const loop=()=>{const bar=document.querySelector('.fishing-track');if(!bar){done();return;}
  const zone=bar.querySelector('.fishing-zone'),marker=bar.querySelector('.fishing-marker'),z=zone.getBoundingClientRect(),m=marker.getBoundingClientRect(),cx=m.left+m.width/2,center=z.left+z.width/2;
  if(Math.abs(cx-center)<z.width*.12&&performance.now()-last>350){last=performance.now();window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' '}));}
  requestAnimationFrame(loop);};loop();}));
 await expect(page.locator('.fishing-result')).toBeVisible({timeout:10000});
 caught=await page.locator('.fishing-result.caught').count()>0;
 await page.waitForTimeout(250);await shot(page,caught?'05-pegou':'05-escapou');
 if(caught){await page.waitForTimeout(700);await shot(page,'06-peixe-na-vara');}
 else{await page.waitForTimeout(3200);await page.keyboard.press('Space');}
}
if(!caught)throw new Error('não pescou nada em 4 tentativas');
// Rod and bait from the fishing bag.
await page.waitForTimeout(2600);await page.locator('.fishing-slot').first().click();await expect(page.locator('.fishing-gear-menu')).toBeVisible();await shot(page,'07-trocar-vara');
await page.locator('.fishing-slot').first().click();
// Walk to the Casa de Pesca and open it.
let x=spot.x;const walkTo=async(tx,ty)=>{for(let n=0;n<6&&Math.abs(x-tx)>4;n++){const cam=camera(x),sx=Math.max(40,Math.min(1496,tx-cam)),wx=cam+sx;await canvas.click({position:{x:sx,y:ty},timeout:5000}).catch(async e=>{await shot(page,'erro');throw e;});await page.waitForTimeout(Math.abs(wx-x)/132*1000+900);x=wx;}};
await walkTo(2330,700);await page.waitForTimeout(600);await shot(page,'08-casa-de-pesca');
await canvas.click({position:{x:2330-camera(x),y:520}});
await expect(page.locator('.fishing-shop-window')).toBeVisible();await page.waitForTimeout(800);await shot(page,'09-loja');
await page.getByRole('button',{name:/^Coleção/}).click();await page.waitForTimeout(500);await shot(page,'10-colecao');
await page.locator('.fishing-shop-window .close-button').click();await expect(page.locator('.fishing-shop-window')).toHaveCount(0);
await walkTo(3420,600);await page.waitForTimeout(600);await shot(page,'11-poco-azul');
await walkTo(5180,600);await page.waitForTimeout(600);await shot(page,'12-lagoa-cristal');
await page.locator('.fishing-exit').click();await expect(page.locator('.lobby-dock-button.arena')).toBeVisible();
await page.waitForTimeout(1500);await shot(page,'13-de-volta');
await browser.close();console.log('fishing smoke ok');
