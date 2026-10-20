import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
// Prévia das varas, prêmios e Fragmentos da Pescaria e da Vara das Marés na Síntese (jogo rodando no Vite):
// npx tsx scripts/preview-fishing-rods.mjs [pasta]. Põe varas, Fragmentos e um resultado falsos no estado do cliente.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-rods';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.lobby-dock-button.fishing').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));window.__c=(await import(url)).client;});
const fake=(patch)=>page.evaluate(patch=>{const c=window.__c,p=c.state.profile;c.update({profile:{...p,...patch.profile,fishing:{...p.fishing,...patch.fishing}}});},patch);
await fake({profile:{fragments:{'tide-rod':37}},fishing:{rods:['rod-bamboo','rod-oak','rod-coral','rod-crystal','rod-aurora','rod-royal'],rod:'rod-royal',xp:60*29**1.7,points:12500,daily:{day:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()),gold:640,coupons:1,fragments:3}}});
await page.waitForTimeout(600);
await page.locator('.fishing-slot.rod').click();await page.waitForTimeout(500);await page.screenshot({path:`${dir}/01-varas.png`});
await page.locator('.fishing-slot.prizes').click();await page.waitForTimeout(500);await page.screenshot({path:`${dir}/02-premios.png`});
await page.locator('.fishing-slot.prizes').click();
await page.evaluate(()=>window.__c.update({fishing:{spot:'x',phase:'result',auto:false,since:Date.now(),result:{success:true,fish:'koi-celeste',catch:{fish:'koi-celeste',kg:4.12,points:27,xp:180,record:false,first:false,drops:[{kind:'gold',amount:120},{kind:'fragments',amount:1,weapon:'tide-rod'}]}}}}));
await page.waitForTimeout(900);await page.screenshot({path:`${dir}/03-resultado.png`,clip:{x:368,y:150,width:800,height:260}});
await page.evaluate(()=>window.__c.update({fishing:null}));
await page.locator('.fishing-trade:not(.fishing-history-button)').click();await page.locator('.fishing-shop-window').waitFor();await page.waitForTimeout(900);
await page.screenshot({path:`${dir}/04-casa-de-pesca.png`});
await page.getByRole('button',{name:/^Coleção/}).click();await page.waitForTimeout(800);await page.screenshot({path:`${dir}/05-colecao.png`});
// A Vara das Marés na Síntese do Ferreiro, com 52 Fragmentos.
await page.locator('.fishing-shop-window .close-button').click();
await page.locator('.fishing-exit').click();await page.locator('.lobby-dock-button.arena').waitFor();await page.waitForTimeout(1500);
await fake({profile:{fragments:{'tide-rod':52},gold:8000},fishing:{}});
await page.locator('.lobby-dock-button.forge').click();await page.getByRole('tab',{name:'Síntese'}).click();await page.waitForTimeout(700);
await page.locator('.synthesis-row',{hasText:'Vara das Marés'}).click();await page.waitForTimeout(900);
await page.screenshot({path:`${dir}/06-sintese.png`});
await browser.close();console.log('preview ok');
