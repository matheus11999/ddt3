import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
// Prévia da comemoração da captura por raridade, com Ouro, Cupom e Fragmento (jogo rodando no Vite):
// node scripts/preview-fishing-catch.mjs [pasta]. Põe resultados falsos no estado do cliente e fotografa a animação.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-catch';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.lobby-dock-button.fishing').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));window.__c=(await import(url)).client;});
const cases=[
 {name:'comum',fish:'lambari-dourado'},
 {name:'raro-ouro',fish:'baiacu-bolha',drops:[{kind:'gold',amount:48}]},
 {name:'epico-fragmento',fish:'koi-celeste',drops:[{kind:'gold',amount:60},{kind:'fragments',amount:1,weapon:'tide-rod'}]},
 {name:'lendario-cupom',fish:'carpa-dragao',drops:[{kind:'gold',amount:90},{kind:'coupons',amount:1}],first:true},
];
for(const k of cases){
 await page.evaluate(k=>{window.__c.update({fishing:{spot:'x',phase:'result',auto:false,since:Date.now(),result:{success:true,fish:k.fish,catch:{fish:k.fish,kg:3.42,points:18,xp:180,record:false,first:!!k.first,...(k.drops?{drops:k.drops}:{})}}}});},k);
 for(const t of [450,1500,2500]){await page.waitForTimeout(t===450?450:t===1500?1050:1000);await page.screenshot({path:`${dir}/${k.name}-${t}.png`});}
 await page.evaluate(()=>window.__c.update({fishing:null}));await page.waitForTimeout(5200);
}
await browser.close();console.log('preview ok');
