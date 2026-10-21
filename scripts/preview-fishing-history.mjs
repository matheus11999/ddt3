import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
// Prévia do Histórico da Pescaria com capturas e sessões automáticas falsas (jogo rodando no Vite):
// node scripts/preview-fishing-history.mjs [pasta]. Fotografa a lista e a janela Ver de uma sessão.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-history';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.fishing-zone-button').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));const c=(await import(url)).client;
 const now=Date.now(),min=60_000;
 const history=[
  {fish:'koi-celeste',kg:4.18,points:42,xp:320,at:now-2*min},
  {fish:'lambari-dourado',kg:.31,points:4,xp:22,at:now-4*min},
  {fish:'carpa-dragao',kg:6.4,points:120,xp:900,at:now-70*min},
  {fish:'tilapia-rosada',kg:1.2,points:9,xp:60,at:now-75*min},
  {fish:'baiacu-bolha',kg:.9,points:11,xp:80,at:now-26*60*min},
 ];
 const autoRuns=[
  {since:now-58*min,until:now-11*min,casts:96,missed:21,fish:{'lambari-dourado':31,'carpa-lua':18,'tilapia-rosada':12,'baiacu-bolha':6,'koi-celeste':2,'carpa-dragao':1},points:412,xp:1380,gold:156,coupons:1,fragments:2,best:{fish:'koi-celeste',kg:4.18}},
  {since:now-5*60*min,until:now-3*60*min,casts:160,missed:40,fish:{'lambari-dourado':70,'carpa-lua':40,'tilapia-rosada':10},points:520,xp:1900,gold:210,coupons:0,fragments:0,best:{fish:'tilapia-rosada',kg:2.1}},
 ];
 const profile=c.state.profile;c.update({profile:{...profile,fishing:{...profile.fishing,history,autoRuns}}});});
await page.locator('.fishing-history-button').click();await page.waitForTimeout(700);
await page.screenshot({path:`${dir}/historico.png`});
await page.locator('.fishing-history-see').first().click();await page.waitForTimeout(800);
await page.screenshot({path:`${dir}/historico-ver.png`});
await browser.close();console.log('preview ok');
