import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
import {FISH_BY_ID,catchPoints} from '../shared/fishing.ts';
// Prévia da Casa de Pesca (abas Comprar, Vender e Coleção, Vara das Marés com fragmentos) com o jogo rodando no Vite:
// npx tsx scripts/preview-fishing-house.mjs [pasta]. FRAGMENTS=50 mostra o Resgatar liberado.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-house';await mkdir(dir,{recursive:true});
const browser=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const page=await (await browser.newContext({viewport:{width:Number(process.env.WIDTH??1536),height:Number(process.env.HEIGHT??864)}})).newPage();
await enterGame(page,base);
await page.locator('.fishing-zone-button').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));window.__c=(await import(url)).client;});
const catches=[['lambari-dourado',.37],['tilapia-rosada',1.41],['carpa-lua',3.6],['bagre-barbudo',6.9],['peixe-vidro',.31],['tucunare-brasa',4.8],['koi-celeste',5.4],['dourado-real',11.2],['pirarucu-ancestral',41.5]];
const now=Date.now(),bag=catches.map(([fish,kg],i)=>({id:`p${i}`,fish,kg,value:catchPoints(FISH_BY_ID.get(fish),kg,.6),at:now-i*7*60000}));
const caught={},best={};for(const b of bag){caught[b.fish]=(caught[b.fish]??0)+3;best[b.fish]=b.kg;}
const fragments=Number(process.env.FRAGMENTS??23);
await page.evaluate(({bag,caught,best,fragments})=>{const c=window.__c,p=c.state.profile;
 c.update({profile:{...p,gold:Math.max(p.gold,12000),fragments:{...p.fragments,'tide-rod':fragments},fishing:{...p.fishing,bag,points:1840,xp:2600,total:180,caught,best}}});},{bag,caught,best,fragments});
await page.evaluate(()=>window.__c.openFishShop?.('buy'));
await page.waitForTimeout(400);
if(!await page.locator('.fishing-shop-window').isVisible())await page.getByRole('button',{name:/Trocas/}).click();
await page.locator('.fishing-shop-window').waitFor();await page.waitForTimeout(900);
await page.screenshot({path:`${dir}/01-comprar.png`});
await page.locator('.fishing-shop-tabs button').nth(1).click();await page.waitForTimeout(600);
for(const n of [0,2])await page.locator('.fishing-sell-grid .fish-card').nth(n).click();
await page.mouse.move(5,5);await page.waitForTimeout(300);await page.screenshot({path:`${dir}/02-vender.png`});
await page.locator('.fishing-shop-tabs button').nth(2).click();await page.waitForTimeout(600);await page.screenshot({path:`${dir}/03-colecao.png`});
await browser.close();console.log('preview ok');
