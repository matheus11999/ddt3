import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
import {FISH_BY_ID,catchPoints,fishingWeek} from '../shared/fishing.ts';
// Prévia do peso, da Sacola, da aba Vender e do ranking Maior peixe da semana (jogo rodando no Vite):
// npx tsx scripts/preview-fishing-sell.mjs [pasta]. Põe uma Sacola falsa (o mesmo peixe em pesos diferentes) no cliente.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-sell';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.lobby-dock-button.fishing').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));window.__c=(await import(url)).client;});
const catches=[['lambari-dourado',.12],['lambari-dourado',.37],['lambari-dourado',.18],['tilapia-rosada',.55],['tilapia-rosada',1.41],['carpa-lua',1.3],['carpa-lua',3.6],
 ['bagre-barbudo',2.4],['bagre-barbudo',6.9],['peixe-vidro',.31],['traira-taboa',.8],['carpa-termal',1.1],['baiacu-bolha',.7],['tucunare-brasa',4.8],['truta-aurora',1.6],
 ['pacu-esmeralda',2.2],['salamandra-vapor',.45],['koi-celeste',2.6],['koi-celeste',5.4],['enguia-trovao',1.9],['dourado-real',11.2],['pirarucu-ancestral',41.5],['bota-velha',.5]];
const now=Date.now(),bag=catches.map(([fish,kg],i)=>({id:`p${i}`,fish,kg,value:catchPoints(FISH_BY_ID.get(fish),kg,.6),at:now-i*7*60000,auto:i%5===3||undefined}));
const best={};for(const b of bag)best[b.fish]=Math.max(best[b.fish]??0,b.kg);
const week=fishingWeek(now);
await page.evaluate(({bag,best,week})=>{const c=window.__c,p=c.state.profile;
 c.update({profile:{...p,fishing:{...p.fishing,bag,points:1840,xp:2600,total:180,best,week:{key:week,fish:'pirarucu-ancestral',kg:41.5}}},
  fishRanking:{week,entries:[{rank:1,id:'x1',name:'MarujoDoLago',fish:'pirarucu-ancestral',kg:63.42},{rank:2,id:p.id,name:p.name,fish:'pirarucu-ancestral',kg:41.5},
   {rank:3,id:'x3',name:'Pescadora',fish:'dourado-real',kg:13.9},{rank:4,id:'x4',name:'Zé Anzol',fish:'bagre-barbudo',kg:7.61},{rank:5,id:'x5',name:'Brisa',fish:'koi-celeste',kg:5.88},
   {rank:6,id:'x6',name:'Tainha',fish:'tucunare-brasa',kg:5.2},{rank:7,id:'x7',name:'Lumi',fish:'enguia-trovao',kg:4.4},{rank:8,id:'x8',name:'Capitão',fish:'carpa-lua',kg:3.9}]}});},{bag,best,week});
await page.waitForTimeout(800);await page.screenshot({path:`${dir}/01-ranking.png`});
await page.locator('.fishing-rank header button').click();await page.waitForTimeout(400);await page.screenshot({path:`${dir}/02-ranking-oculto.png`,clip:{x:1100,y:0,width:436,height:320}});
await page.locator('.fishing-rank-tab').click();
await page.locator('.lobby-dock-button.fish-bag').click();await page.locator('.fishing-bag-window').waitFor();await page.waitForTimeout(600);
await page.locator('.fishing-bag-slot.fish .fish-card').nth(1).hover();await page.waitForTimeout(400);await page.screenshot({path:`${dir}/03-sacola.png`});
await page.locator('.fishing-bag-sell button').click();await page.locator('.fishing-sell-grid').waitFor();await page.waitForTimeout(700);
for(const n of [0,3,6,8])await page.locator('.fishing-sell-grid .fish-card').nth(n).click();
await page.locator('.fishing-sell-grid .fish-card').nth(8).hover();await page.waitForTimeout(400);await page.screenshot({path:`${dir}/04-vender.png`});
await page.locator('.fishing-sell-tools select').selectOption({index:1});await page.mouse.move(10,10);await page.waitForTimeout(400);await page.screenshot({path:`${dir}/05-vender-peso.png`});
await page.getByRole('button',{name:/^Comprar/}).click();await page.waitForTimeout(600);await page.screenshot({path:`${dir}/06-comprar.png`});
await page.locator('.fishing-shop-window .close-button').click();
await page.evaluate(()=>window.__c.update({fishing:{spot:'x',phase:'result',auto:false,since:Date.now(),result:{success:true,fish:'koi-celeste',catch:{fish:'koi-celeste',kg:5.41,points:52,xp:72,record:true,first:false,drops:[{kind:'gold',amount:120}]}}}}));
await page.waitForTimeout(900);await page.screenshot({path:`${dir}/07-resultado.png`,clip:{x:368,y:120,width:800,height:320}});
await browser.close();console.log('preview ok');
