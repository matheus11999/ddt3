// Prévia da aba Síntese do ferreiro (desktop e celular em paisagem). Uso: node scripts/preview-forge-synthesis.mjs  (BASE_URL, OUT e CHROME_PATH opcionais)
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/forge-synthesis';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const have=async(forge,name)=>Number((await forge.locator('.synthesis-row',{hasText:name}).first().locator('.synthesis-need small').textContent()).replace(/\D/g,''));
for(const [name,width,height,mobile] of [['desktop',1536,864,false],['mobile',844,390,true]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:/Ferreiro/}).click();
 const forge=page.getByRole('dialog',{name:'Ferreiro'});await expect(forge).toBeVisible({timeout:30000});
 // Fortalecer: o item na bigorna sai da lista ao lado.
 const items=await forge.locator('.forge-stock-item').count();
 await forge.locator('.forge-stock-item').first().click();
 await expect(forge.locator('.forge-stock-item')).toHaveCount(items-1);
 await page.screenshot({path:`${output}/strengthen-${name}.png`});
 await forge.getByRole('tab',{name:'Síntese'}).click();await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/table-${name}.png`});
 const before=await have(forge,'Pedra de Fortificação III');
 await forge.locator('.synthesis-row',{hasText:'Pedra de Fortificação II'}).first().click();await forge.getByRole('button',{name:/^Máx/}).click();
 await page.waitForTimeout(400);await page.screenshot({path:`${output}/ready-${name}.png`});
 await forge.getByRole('button',{name:'Sintetizar',exact:true}).click();
 await expect(forge.locator('.forge-outcome')).toBeVisible({timeout:5000});await page.waitForTimeout(700);
 await page.screenshot({path:`${output}/result-${name}.png`});
 if(await have(forge,'Pedra de Fortificação III')<=before)throw new Error('a síntese não entregou pedras');
 await forge.getByRole('button',{name:/Composição · Sorte/}).click();
 await forge.getByText('Mostrar apenas disponíveis').click();await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/available-${name}.png`});
 await context.close();
}
await browser.close();
