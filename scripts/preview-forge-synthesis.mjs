// Prévia da aba Síntese do ferreiro (desktop e celular em paisagem). Uso: node scripts/preview-forge-synthesis.mjs  (BASE_URL, OUT e CHROME_PATH opcionais)
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/forge-synthesis';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
for(const [name,width,height,mobile] of [['desktop',1536,864,false],['mobile',844,390,true]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:/Ferreiro/}).click();
 const forge=page.getByRole('dialog',{name:'Ferreiro'});await expect(forge).toBeVisible({timeout:30000});
 await forge.getByRole('tab',{name:'Síntese'}).click();await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/empty-${name}.png`});
 await forge.getByRole('button',{name:/Pedra de Fortificação I,/}).click();
 await forge.getByRole('button',{name:'Uma a mais'}).click();await forge.getByRole('button',{name:'Uma a mais'}).click();
 await page.waitForTimeout(500);await page.screenshot({path:`${output}/ready-${name}.png`});
 const before=Number(await forge.getByRole('button',{name:/Pedra de Fortificação II,/}).locator('b').textContent());
 await forge.getByRole('button',{name:'Sintetizar',exact:true}).click();
 await expect(forge.locator('.forge-outcome')).toBeVisible({timeout:5000});await page.waitForTimeout(700);
 await page.screenshot({path:`${output}/result-${name}.png`});
 await expect(forge.getByRole('button',{name:/Pedra de Fortificação II,/}).locator('b')).toHaveText(String(before+3));
 await forge.getByRole('button',{name:'Sorte',exact:true}).click();
 await forge.getByRole('button',{name:/Topázio da Fortuna I,/}).click();await page.waitForTimeout(400);
 await page.screenshot({path:`${output}/composition-${name}.png`});
 await context.close();
}
await browser.close();
