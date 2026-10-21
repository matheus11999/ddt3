import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
// Prévia do resultado da pesca por raridade e da janela de Histórico (jogo rodando no Vite):
// node scripts/preview-fishing-rarity.mjs [pasta]. Põe um resultado falso no estado do cliente.
const base=process.env.BASE??'http://127.0.0.1:5177',dir=process.argv[2]??'test-results/fishing-rarity';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await (await browser.newContext({viewport:{width:1536,height:864}})).newPage();
await enterGame(page,base);
await page.locator('.fishing-zone-button').click();await page.locator('.fishing-hud').waitFor();await page.waitForTimeout(2500);
// The app's own module instance (Vite may load it with a query).
await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/client\.ts/.test(n));window.__c=(await import(url)).client;});
const sample={comum:'lambari-dourado',normal:'carpa-lua',raro:'baiacu-bolha',epico:'koi-celeste',lendario:'carpa-dragao'};
for(const [rarity,fish] of Object.entries(sample)){
 await page.evaluate(async fish=>{const client=window.__c;
  client.update({fishing:{spot:'x',phase:'result',auto:false,since:Date.now(),result:{success:true,fish,catch:{fish,kg:3.42,points:18,xp:180,record:false,first:fish==='carpa-dragao'}}}});},fish);
 await page.waitForTimeout(rarity==='lendario'?250:700);
 await page.screenshot({path:`${dir}/${rarity}.png`,clip:{x:368,y:150,width:800,height:220}});
 if(rarity==='lendario')await page.screenshot({path:`${dir}/lendario-tela.png`});
}
await page.evaluate(async fishes=>{const client=window.__c;const p=client.state.profile;const now=Date.now();
 client.update({fishing:null,profile:{...p,fishing:{...p.fishing,history:fishes.map((fish,i)=>({fish,kg:1+i*.7,points:2+i*4,xp:20+i*40,at:now-i*95000,...(i%2?{auto:true}:{})}))}}});},['carpa-dragao','koi-celeste','baiacu-bolha','carpa-lua','lambari-dourado','bota-velha']);
await page.locator('.fishing-history-button').click();await page.waitForTimeout(800);
await page.screenshot({path:`${dir}/historico.png`});
await browser.close();console.log('preview ok');
