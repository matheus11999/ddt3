import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const base=process.env.BASE_URL??'http://127.0.0.1:8097',browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const profile=async()=>{const response=await context.request.post(base+'/api/session',{headers:{Origin:base}});assert.equal(response.status(),200);return (await response.json()).profile;};
 await page.goto(base,{waitUntil:'networkidle'});const before=await profile();
 const hats=['hat-thunder','hat-tide','hat-ruby','hat-tropical'];assert.ok(hats.every(id=>!before.inventory.includes(id)));
 await page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();
 const shop=page.getByRole('dialog',{name:'Loja da Brasa'});
 await shop.getByRole('button',{name:'Complementos',exact:true}).click();
 for(const id of hats){const card=shop.locator(`[data-shop-item="${id}"]`);await card.getByRole('button',{name:/^Experimentar /}).click();await expect(card).toHaveClass(/trying/);}
 assert.deepEqual((await profile()).equipment,before.equipment);
 await shop.locator('[data-shop-item="hat-thunder"]').getByRole('button',{name:/^Experimentar /}).click();
 await page.mouse.move(10,10);await page.screenshot({path:'test-results/shop-new-hats.png'});
 const dimensions=await shop.locator('[data-shop-item="hat-thunder"]').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));assert.ok(dimensions.height<=190);
 await shop.getByRole('button',{name:'Adicionar Boné Relâmpago ao carrinho'}).click();
 await shop.getByRole('button',{name:'Ver carrinho 1',exact:true}).click();await shop.getByRole('button',{name:'Comprar tudo',exact:true}).click();
 await expect(shop.getByRole('status')).toContainText('Item guardado na mochila!');
 const bought=await profile();assert.equal(bought.gold,before.gold-140);assert.ok(bought.inventory.includes('hat-thunder'));assert.deepEqual(bought.equipment,before.equipment);
 await shop.getByRole('button',{name:'Ver loja 0',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await shop.locator('[data-shop-item="hat-tide"]').getByRole('button',{name:/^Experimentar /}).click();
 await page.screenshot({path:'test-results/shop-new-hats-mobile.png'});
 await page.reload({waitUntil:'networkidle'});const restored=await profile();assert.equal(restored.gold,bought.gold);assert.ok(restored.inventory.includes('hat-thunder'));assert.deepEqual(errors,[]);
 console.log({passed:true,previewed:hats,purchasePersisted:true,card:dimensions,mobile:true,errors});
}finally{await browser.close();}
