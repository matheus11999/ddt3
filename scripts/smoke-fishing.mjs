import {chromium,expect} from '@playwright/test';
import {enterGame} from './character-helpers.mjs';
import {FISHING_HEIGHT,FISHING_LAKES,FISHING_SPOTS,FISHING_WIDTH,fishingFree} from '../shared/fishing.ts';
import {FISHING_STATIONS} from '../src/game/fishingWorld.ts';
// Pescaria smoke and previews (run with tsx: npx tsx scripts/smoke-fishing.mjs <pasta>):
// goes from the plaza to the Pescaria, fishes by hand until a catch (pressing when the marker
// is on the green), watches a second player fish in automatic, opens the Casa de Pesca and goes back.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const shot=(page,name)=>page.screenshot({path:`${dir}/${name}.png`});
/** A player's page, with its real position kept from the server's updates (`page.at()`). */
const open=async()=>{const context=await browser.newContext({viewport:{width:1536,height:864}});const page=await context.newPage();let me=null,at=null;
 page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const e=JSON.parse(String(payload));if(e.type==='welcome')me=e.profile.id;const p=(e.type==='lobby'||e.type==='welcome'||e.type==='lobby-moves')&&(e.players??e.moves)?.find(q=>q.id===me);if(p)at={x:p.x,y:p.y};}catch{}}));
 page.at=()=>at;await enterGame(page,base);return page;};
/** Walks to a world point a screen at a time, clicking only the open middle of the view (clear of the HUD and of the weekly ranking on the right, whose height grows with its entries). */
const walkTo=async(page,x,y)=>{for(let n=0;n<8;n++){const p=page.at();if(Math.hypot(p.x-x,p.y-y)<10)return;const cam=camera(p.x,p.y);
 // A click on water would walk to a fishing spot: aim for the nearest floor instead.
 const w=fishingFree(cam.x+Math.max(440,Math.min(1200,x-cam.x)),cam.y+Math.max(250,Math.min(640,y-cam.y)));
 await page.locator('.world-canvas').click({position:{x:w.x-cam.x,y:w.y-cam.y}});
 const start=Date.now();let last={...p};while(Date.now()-start<15000){await page.waitForTimeout(500);const q=page.at();if(Math.hypot(q.x-last.x,q.y-last.y)<.5)break;last={...q};}}};
const camera=(x,y)=>({x:Math.max(0,Math.min(FISHING_WIDTH-1536,x-768)),y:Math.max(0,Math.min(FISHING_HEIGHT-864,y-864*.6))});
// Everyone arrives at the quay and first climbs to the lawn in front of the Lago das Ninfeias.
const lake=FISHING_LAKES[0],lawn={x:lake.x+270,y:lake.y+260},view=camera(lawn.x,lawn.y),onLake=dx=>({x:lake.x+dx-view.x,y:lake.y+20-view.y});
const climb=page=>walkTo(page,lawn.x,lawn.y);
/** The free spot a click on the water walks to (as the scene picks it). */
const spotFor=(dx,taken=[])=>FISHING_SPOTS.filter(s=>s.lake===lake.id&&!taken.includes(s.id)).sort((a,b)=>Math.hypot(a.bobX-lake.x-dx,a.bobY-lake.y-20)-Math.hypot(b.bobX-lake.x-dx,b.bobY-lake.y-20))[0];

// A friend fishing in automatic mode, so the first player sees someone else at the lake.
const friend=await open();
await friend.locator('.fishing-zone-button').click();await expect(friend.locator('.fishing-hud')).toBeVisible();await friend.waitForTimeout(1500);
await friend.locator('.fishing-auto').click();await climb(friend);if(process.env.DEBUG)await shot(friend,'00-amigo');
const friendSpot=spotFor(-150);
await friend.locator('.fishing-main').click();await friend.locator('.world-canvas').click({position:onLake(-150)});
if(process.env.DEBUG){await friend.waitForTimeout(6000);await shot(friend,'00b-amigo');}await expect(friend.locator('.fishing-auto.on')).toBeVisible({timeout:30000});await expect(friend.locator('.fishing-main.reel')).toBeVisible({timeout:30000});

const page=await open(),canvas=page.locator('.world-canvas');
await page.waitForTimeout(1500);await shot(page,'01-praca-botao');
await page.locator('.fishing-zone-button').click();
await expect(page.locator('.fishing-hud')).toBeVisible();await expect(page.locator('.lobby-dock-button.arena')).toHaveCount(0);
await page.waitForTimeout(2500);await shot(page,'02-entrada');
await climb(page);
// Lançar, then pick the lake: walk to its nearest free spot and cast.
await page.locator('.fishing-main').click();await expect(page.locator('.fishing-tip.picking')).toBeVisible();
await canvas.hover({position:onLake(120)});await page.waitForTimeout(500);await shot(page,'03-escolher-lago');
await canvas.click({position:onLake(120)});
await page.waitForTimeout(300);await expect(page.locator('.fishing-tip')).toContainText('morder',{timeout:30000});await page.waitForTimeout(150);await shot(page,'03b-isca-na-agua');
await expect(page.locator('.fishing-tip')).toContainText('morder',{timeout:30000});
await page.waitForTimeout(800);await shot(page,'03c-esperando');
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
// The rod menu, then the rod's prizes (Fragmentos da Vara das Marés).
await page.waitForTimeout(2600);await page.locator('.fishing-rod-swap').click();await expect(page.locator('.fishing-gear-menu')).toBeVisible();await shot(page,'07-trocar-vara');
await page.locator('.fishing-rod-swap').click();
// The Pescaria menu: no backpack, shop, auction, pets, missions or guild; the Sacola holds what was fished.
for(const id of ['bag','shop','auction','pets','quests','guild'])await expect(page.locator(`.lobby-dock-button.${id}`)).toHaveCount(0);
await page.locator('.lobby-dock-button.fish-bag').click();await expect(page.locator('.fishing-bag-slot:not(.empty)')).not.toHaveCount(0);
await page.waitForTimeout(600);await shot(page,'07b-sacola');await page.locator('.fishing-bag-window .close-button').click();
// Maior peixe da semana: at the side, hidden and opened again.
await expect(page.locator('.fishing-rank')).toBeVisible();await expect(page.locator('.fishing-rank li')).not.toHaveCount(0);await shot(page,'07d-ranking');
await page.locator('.fishing-rank header button').click();await expect(page.locator('.fishing-rank-tab')).toBeVisible();await shot(page,'07e-ranking-oculto');
await page.locator('.fishing-rank-tab').click();await expect(page.locator('.fishing-rank')).toBeVisible();
// The Auto switch: lit, with the AUTOMÁTICO seal and a short notice; then off again.
await page.locator('.fishing-auto').click();await expect(page.locator('.fishing-auto.on')).toBeVisible();await page.waitForTimeout(300);await shot(page,'07c-auto-ligado');
await page.locator('.fishing-auto').click();await expect(page.locator('.fishing-auto.on')).toHaveCount(0);
// Desligar o automático abre o resumo da pescaria (tempo e itens).
await expect(page.locator('.fishing-auto-summary')).toBeVisible();await shot(page,'07d-resumo-auto');await page.locator('.fishing-summary-ok').click();await expect(page.locator('.fishing-auto-summary')).toHaveCount(0);
// No Casa de Pesca building since 20/10: the map has only the airship to click.
await expect(FISHING_STATIONS.some(s=>s.id==='casa')).toBe(false);
// The Trocas button opens the same window from anywhere.
await page.locator('.fishing-trade:not(.fishing-history-button)').click();await expect(page.locator('.fishing-shop-window')).toBeVisible();await page.waitForTimeout(800);await shot(page,'09-loja');
// Vender: pick the caught fish (records are picked by hand) and sell them for Pontos de Pesca.
await page.getByRole('button',{name:/^Vender/}).click();await expect(page.locator('.fishing-sell-grid .fish-card')).not.toHaveCount(0);
await page.locator('.fishing-sell-grid .fish-card').first().click();await page.locator('.fishing-sell-grid .fish-card').first().hover();await page.waitForTimeout(400);await shot(page,'09b-vender');
await page.locator('.fishing-sell-go').click();await expect(page.locator('.fishing-sell.empty, .fishing-sell-go:text-is("Vender")').first()).toBeVisible();await page.waitForTimeout(700);await shot(page,'09c-vendido');
await page.getByRole('button',{name:/^Coleção/}).click();await page.waitForTimeout(500);await shot(page,'10-colecao');
await page.locator('.fishing-shop-window .close-button').click();await expect(page.locator('.fishing-shop-window')).toHaveCount(0);
// Histórico: the latest catches, newest first.
await page.locator('.fishing-history-button').click();await expect(page.locator('.fishing-history-window')).toBeVisible();await page.waitForTimeout(500);await shot(page,'10b-historico');
await page.locator('.fishing-history-window .close-button').click();await expect(page.locator('.fishing-history-window')).toHaveCount(0);
await page.locator('.fishing-exit').click();await expect(page.locator('.lobby-dock-button.arena')).toBeVisible();
await page.waitForTimeout(1500);await shot(page,'11-de-volta');
await browser.close();console.log('fishing smoke ok');
