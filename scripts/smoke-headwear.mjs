import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
await mkdir('test-results',{recursive:true});
const base=process.env.BASE_URL??'http://127.0.0.1:8097';
const channel=process.env.BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined);
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
const cases=[
 {gender:'male',label:'Masculino',otherLabel:'Feminino',hats:['hat-thunder','hat-tide'],opposite:'hat-ruby',purchase:'hat-thunder',name:'Boné Relâmpago',price:140},
 {gender:'female',label:'Feminino',otherLabel:'Masculino',hats:['hat-ruby','hat-tropical'],opposite:'hat-thunder',purchase:'hat-tropical',name:'Chapéu Tropical',price:180},
];
const results=[];
try{
 for(const entry of cases){
  const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const profile=async()=>{const response=await context.request.post(base+'/api/session',{headers:{Origin:base}});assert.equal(response.status(),200);return (await response.json()).profile;};
  await enterGame(page,base,entry.gender);await page.waitForLoadState('networkidle');
  const before=await profile();assert.equal(before.gender,entry.gender);assert.ok(!before.inventory.includes(entry.purchase));
  assert.ok(before.inventory.every(id=>!id.endsWith('-none')));
  await page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();
  const shop=page.getByRole('dialog',{name:'Loja da Brasa'}),collections=shop.getByRole('group',{name:'Coleções da loja'});
  await expect(collections.getByRole('button',{name:entry.label,exact:true})).toHaveAttribute('aria-pressed','true');
  await shop.getByRole('button',{name:'Complementos',exact:true}).click();
  for(const id of entry.hats){const card=shop.locator(`[data-shop-item="${id}"]`);await card.getByRole('button',{name:/^Experimentar /}).click();await expect(card).toHaveClass(/trying/);}
  assert.deepEqual((await profile()).equipment,before.equipment,'trying compatible hats is local only');
  await collections.getByRole('button',{name:entry.otherLabel,exact:true}).click();
  const opposite=shop.locator(`[data-shop-item="${entry.opposite}"]`);
  await expect(opposite.getByRole('button',{name:/^Experimentar /})).toBeDisabled();
  await expect(opposite.getByRole('button',{name:/^Adicionar /})).toBeDisabled();
  await collections.getByRole('button',{name:entry.label,exact:true}).click();
  const selected=shop.locator(`[data-shop-item="${entry.purchase}"]`);
  await selected.getByRole('button',{name:/^Experimentar /}).click();
  await page.mouse.move(10,10);await page.screenshot({path:`test-results/shop-new-hats-${entry.gender}.png`});
  const dimensions=await selected.evaluate(el=>{
   const card=el.getBoundingClientRect(),actions=el.querySelector('.shop-offer-actions').getBoundingClientRect();
   return {width:el.clientWidth,height:el.clientHeight,actionsInside:actions.left>=card.left&&actions.right<=card.right&&actions.bottom<=card.bottom,contentFits:el.scrollHeight<=el.clientHeight};
  });
  assert.ok(dimensions.height<=220,'gender badge and controls fit a compact shop card');assert.ok(dimensions.actionsInside&&dimensions.contentFits,'card contents must not overflow');
  await selected.getByRole('button',{name:`Adicionar ${entry.name} ao carrinho`}).click();
  await shop.getByRole('button',{name:'Ver carrinho 1',exact:true}).click();await shop.getByRole('button',{name:'Comprar tudo',exact:true}).click();
  await expect(shop.getByRole('status')).toContainText('Item guardado na mochila!');
  const bought=await profile();assert.equal(bought.gold,before.gold-entry.price);assert.ok(bought.inventory.includes(entry.purchase));assert.deepEqual(bought.equipment,before.equipment);
  await shop.getByRole('button',{name:'Ver loja 0',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await shop.locator(`[data-shop-item="${entry.hats[1]}"]`).getByRole('button',{name:/^Experimentar /}).click();
  await page.screenshot({path:`test-results/shop-new-hats-${entry.gender}-mobile.png`});
  await page.reload({waitUntil:'networkidle'});await expect(page.locator('.bottom-dock')).toBeVisible();
  const restored=await profile();assert.equal(restored.gold,bought.gold);assert.ok(restored.inventory.includes(entry.purchase));assert.equal(restored.gender,entry.gender);assert.deepEqual(restored.equipment,before.equipment);assert.deepEqual(errors,[]);
  results.push({gender:entry.gender,previewed:entry.hats,purchase:entry.purchase,purchasePersisted:true,oppositeGenderLocked:true,card:dimensions,mobile:true,errors});
  await context.close();
 }
 console.log({passed:true,creation:'real-gender-ui',results});
}finally{await browser.close();}
