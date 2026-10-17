// Prévia visual da loja (desktop e celular em paisagem): catálogo, dica do item e confirmação de compra.
// Uso: node scripts/preview-shop.mjs  (BASE_URL, OUT, SIZES e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/shop-preview';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const sizes=(process.env.SIZES??'desktop:1536x864,laptop:1280x720,mobile:844x390,small:667x375').split(',').map(entry=>{const [name,size]=entry.split(':'),[width,height]=size.split('x').map(Number);return {name,viewport:{width,height},mobile:name==='mobile'||name==='small'};});
for(const {name,viewport,mobile} of sizes){
 const context=await browser.newContext({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();
 const shop=page.getByRole('dialog',{name:'Loja da Brasa'});await shop.waitFor();await page.waitForTimeout(1200);
 await shop.getByRole('textbox',{name:'Buscar na loja'}).click();await page.screenshot({path:`${output}/catalog-${name}.png`});
 await shop.getByRole('button',{name:'Armas',exact:true}).click();
 await shop.getByRole('button',{name:'Experimentar Tempestade',exact:true}).click();
 if(!mobile){await shop.getByRole('button',{name:'Ver informações de Tempestade',exact:true}).hover();await page.waitForTimeout(500);}
 await page.screenshot({path:`${output}/weapons-${name}.png`});
 await page.mouse.move(2,2);
 await shop.getByRole('button',{name:'Comprar Tempestade',exact:true}).click();await page.waitForTimeout(400);
 await page.screenshot({path:`${output}/confirm-${name}.png`});
 await context.close();
}
await browser.close();
