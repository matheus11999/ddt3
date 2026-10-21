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
// Um prêmio por lançamento: o peixe, ou o prêmio da vara no lugar dele.
const cases=[
 {name:'comum',fish:'lambari-dourado'},
 {name:'epico',fish:'koi-celeste'},
 {name:'lendario',fish:'carpa-dragao',first:true},
 {name:'ouro',fish:'baiacu-bolha',prize:{kind:'gold',amount:48}},
 {name:'fragmento',fish:'koi-celeste',prize:{kind:'fragments',amount:1,weapon:'tide-rod'}},
 {name:'cupom',fish:'carpa-lua',prize:{kind:'coupons',amount:1}},
];
for(const k of cases){
 await page.evaluate(k=>{window.__c.update({fishing:{spot:'x',phase:'result',auto:false,since:Date.now(),result:k.prize?{success:true,fish:k.fish,prize:k.prize,xp:32}:{success:true,fish:k.fish,catch:{fish:k.fish,kg:3.42,points:18,xp:180,record:false,first:!!k.first}}}});},k);
 for(const t of [450,1500,2500]){await page.waitForTimeout(t===450?450:t===1500?1050:1000);await page.screenshot({path:`${dir}/${k.name}-${t}.png`});}
 await page.evaluate(()=>window.__c.update({fishing:null}));await page.waitForTimeout(5200);
}
// Resumo ao desligar o automático.
await page.evaluate(()=>{const now=Date.now();window.__c.update({fishAutoSummary:{since:now-(47*60+12)*1000,until:now,casts:96,missed:21,fish:{'lambari-dourado':31,'carpa-lua':18,'tilapia-rosada':12,'baiacu-bolha':6,'koi-celeste':2,'carpa-dragao':1},points:412,xp:1380,gold:156,coupons:1,fragments:2,best:{fish:'koi-celeste',kg:4.18}}});});
await page.waitForTimeout(900);await page.screenshot({path:`${dir}/resumo-automatico.png`});
await browser.close();console.log('preview ok');
