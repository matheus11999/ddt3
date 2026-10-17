import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results/shop',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const clients=[],errors=[],checks=[];
async function profile(client){const response=await client.context.request.post(base+'/api/session',{headers:{Origin:base}});assert.equal(response.status(),200);return (await response.json()).profile;}
async function newClient(label){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),client={context,page,commands:[],gender:label};clients.push(client);
 page.on('pageerror',error=>errors.push(`${label}: ${error.message}`));page.on('websocket',ws=>ws.on('framesent',frame=>{try{client.commands.push(JSON.parse(String(frame.payload)));}catch{}}));
 return client;
}
async function createClient(gender){
 const client=await newClient(gender),{page}=client;
 await enterGame(page,base,gender);await page.waitForLoadState('networkidle');const current=await profile(client);assert.equal(current.gender,gender);
 const name=`TEST-SHOP-${gender==='male'?'M':'F'}-${current.id.slice(0,6)}`;
 await page.getByRole('button',{name:'Configurações',exact:true}).click();const settings=page.getByRole('dialog',{name:'Ajustes'});await settings.getByLabel('Nome do aventureiro').fill(name);await settings.getByRole('button',{name:'Salvar nome',exact:true}).click();await expect.poll(async()=>(await profile(client)).name).toBe(name);await settings.getByRole('button',{name:'Fechar',exact:true}).click();
 client.initial=await profile(client);return client;
}
async function openShop(client){await client.page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();const shop=client.page.getByRole('dialog',{name:'Loja da Brasa'});await expect(shop).toBeVisible();return shop;}
async function category(shop,name){await shop.getByRole('navigation',{name:'Categorias da loja'}).getByRole('button',{name,exact:true}).click();}
// Pages hold 10 offers; search first so the item is on screen whatever its page.
async function find(shop,name){await shop.getByRole('textbox',{name:'Buscar na loja'}).fill(name);}
async function buy(shop,name){await find(shop,name);await shop.getByRole('button',{name:`Comprar ${name}`,exact:true}).click();const confirm=shop.getByRole('alertdialog',{name:'Confirmar compra'});await expect(confirm).toContainText(name);await confirm.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(shop.getByRole('status')).toContainText(`${name} guardado na mochila!`);await expect(confirm).toHaveCount(0);}
async function preview(shop,name){await find(shop,name);await shop.getByRole('button',{name:`Experimentar ${name}`,exact:true}).click();}
try{
 const male=await createClient('male'),page=male.page,initial=male.initial;let shop=await openShop(male);
 // The shop has no cart, no gender collections and never lists the other gender's pieces.
 await expect(shop.getByRole('group',{name:'Coleções da loja'})).toHaveCount(0);await expect(shop.getByText(/carrinho/i)).toHaveCount(0);await expect(shop.getByText('Poder na prévia')).toHaveCount(0);await expect(shop.getByText('Unissex')).toHaveCount(0);
 for(const name of ['Dançarina Rubi','Piscadela Confiante','Rabo de Cavalo Rubi','Chapéu Astral'])await expect(shop.getByRole('button',{name:`Experimentar ${name}`,exact:true})).toHaveCount(0);
 for(const name of ['Piloto Relâmpago','Executivo','Boné Relâmpago'])await preview(shop,name);
 assert.deepEqual((await profile(male)).equipment,initial.equipment);assert.equal(male.commands.filter(command=>['equip','customize','shop-buy'].includes(command.type)).length,0);
 checks.push('male shop lists only male and unisex items with no cart, collections or preview power; previews are local');
 await find(shop,'');await category(shop,'Armas');await expect(shop.locator('[data-shop-item="brick"]')).toBeVisible();await preview(shop,'Quebra-Tijolos');
 await shop.getByRole('button',{name:'Experimentar Quebra-Tijolos',exact:true}).hover();let tooltip=page.getByRole('tooltip');await expect(tooltip).toContainText('Armadura');await expect(tooltip).not.toContainText('Unissex');let box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1536&&box.y+box.height<=864);await page.screenshot({path:'test-results/shop/weapon-tooltip.png'});await shop.getByRole('heading',{name:'Loja da Brasa'}).click();
 await category(shop,'Complementos');await preview(shop,'Óculos Gatinho');
 await find(shop,'Pulseira Trançada');await shop.getByRole('button',{name:'Comprar Pulseira Trançada',exact:true}).click();await shop.getByRole('alertdialog',{name:'Confirmar compra'}).getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(male.commands.filter(command=>command.type==='shop-buy').length,0);
 await buy(shop,'Pulseira Trançada');await category(shop,'Roupas');await buy(shop,'Executivo');await page.screenshot({path:'test-results/shop/bought-desktop.png'});
 const purchased=await profile(male);assert.equal(purchased.gold,initial.gold-460);assert.ok(purchased.inventory.includes('outfit-executive'));assert.ok(purchased.inventory.includes('wristband-braid'));assert.deepEqual(purchased.equipment,initial.equipment);assert.equal(male.commands.filter(command=>command.type==='shop-buy').length,2);
 await expect(shop.getByText('Na mochila',{exact:true})).toHaveCount(0);await expect(shop.getByRole('button',{name:'Comprar Executivo',exact:true})).toHaveAttribute('title','Moedas Brasa insuficientes');
 await find(shop,'');await category(shop,'Armas');await expect(shop.getByRole('button',{name:'Comprar Quebra-Tijolos',exact:true})).toBeDisabled();await shop.getByRole('button',{name:'Restaurar visual',exact:true}).click();await expect(shop.getByRole('button',{name:'Restaurar visual',exact:true})).toBeDisabled();
 await page.setViewportSize({width:390,height:844});await find(shop,'');await category(shop,'Rostos');await shop.getByRole('button',{name:'Experimentar Sorriso Provocador',exact:true}).hover();tooltip=page.getByRole('tooltip');await expect(tooltip).toBeVisible();box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);await page.screenshot({path:'test-results/shop/store-mobile-tooltip.png'});await shop.locator('.shop-layout').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'test-results/shop/store-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await shop.getByRole('button',{name:'Fechar',exact:true}).click();await page.setViewportSize({width:1536,height:864});await enterGame(page,base,'male');let restored=await profile(male);assert.equal(restored.gold,purchased.gold);assert.deepEqual(restored.inventory,purchased.inventory);
 checks.push('each purchase is confirmed and charged once (460 total); cancel sends nothing; insufficient balance, mobile tooltip and reload persistence work');
 // Model an older account that already owns an opposite-gender item. The fixture edits a fresh guest
 // before it ever connects (a connected player's live profile is authoritative); do not touch real players.
 const legacy=await newClient('legacy'),created=await legacy.context.request.post(base+'/api/session',{headers:{Origin:base},data:{gender:'male'}});assert.equal(created.status(),200);legacy.initial=(await created.json()).profile;
 const fixtureScript=`import assert from 'node:assert/strict';import {Store} from './server/store.ts';const store=new Store();try{const result=await store.pool.query("UPDATE players SET profile=jsonb_set(profile,'{inventory}',(profile->'inventory')||$3::jsonb) WHERE id=$1 AND name=$2 AND created_at>now()-interval '10 minutes' RETURNING id",[${JSON.stringify(legacy.initial.id)},${JSON.stringify(legacy.initial.name)},JSON.stringify(['outfit-dancer'])]);assert.equal(result.rowCount,1);}finally{await store.pool.end();}`;
 const fixture=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:fixtureScript,encoding:'utf8',timeout:30000});assert.equal(fixture.status,0,fixture.stderr);
 await enterGame(legacy.page,base,'male');await legacy.page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();const bag=legacy.page.getByRole('dialog',{name:'Mochila'});await bag.getByRole('combobox',{name:'Categoria'}).selectOption('outfit');const incompatible=bag.getByRole('button',{name:'Dançarina Rubi',exact:true});await expect(incompatible).toHaveAttribute('data-gender-locked','true');await expect(incompatible).toHaveAttribute('draggable','false');await expect(incompatible).toHaveAttribute('aria-disabled','true');await legacy.page.waitForLoadState('networkidle');const before=(await profile(legacy)).equipment,customizationCount=legacy.commands.filter(command=>command.type==='customize').length;await incompatible.click({force:true});await expect(bag.locator('.dye-swatches')).toHaveCount(0);await expect(bag.getByRole('button',{name:'Salvar personalização',exact:true})).toHaveCount(0);
 await bag.locator('[data-slot="outfit"]').evaluate(element=>{const transfer=new DataTransfer();transfer.setData('application/x-brasa-item','outfit-dancer');element.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));});assert.deepEqual((await profile(legacy)).equipment,before);assert.equal(legacy.commands.filter(command=>command.type==='customize').length,customizationCount);await incompatible.hover();await expect(legacy.page.getByRole('tooltip')).toContainText('Incompatível com este personagem');await legacy.page.screenshot({path:'test-results/shop/inventory-owned-incompatible.png'});await bag.getByRole('button',{name:'Fechar',exact:true}).click();
 checks.push('legacy opposite-gender ownership remains visible but cannot equip, drag, dye or drop; no customization request is sent');
 const female=await createClient('female'),femaleInitial=female.initial;shop=await openShop(female);assert.equal(femaleInitial.equipment.outfit,'outfit-dancer');assert.equal(femaleInitial.equipment.face,'face-smile');await expect(shop.locator('[data-shop-item="outfit-executive"]')).toHaveCount(0);
 await preview(shop,'Piscadela Confiante');await preview(shop,'Chapéu Tropical');await preview(shop,'Óculos Sprint');assert.deepEqual((await profile(female)).equipment,femaleInitial.equipment);
 await category(shop,'Rostos');await buy(shop,'Piscadela Confiante');await category(shop,'Complementos');await buy(shop,'Chapéu Tropical');const femalePurchased=await profile(female);assert.equal(femalePurchased.gold,femaleInitial.gold-360);await female.page.screenshot({path:'test-results/shop/female-collection.png'});await shop.getByRole('button',{name:'Fechar',exact:true}).click();
 await female.page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();const femaleBag=female.page.getByRole('dialog',{name:'Mochila'});await femaleBag.getByRole('combobox',{name:'Categoria'}).selectOption('face');await femaleBag.getByRole('button',{name:'Piscadela Confiante',exact:true}).click();await expect.poll(async()=>(await profile(female)).equipment.face).toBe('face-wink');await expect(femaleBag.locator('.equipment-status')).toHaveText('Visual equipado');await femaleBag.locator('[data-slot="face"]').dblclick();await expect.poll(async()=>(await profile(female)).equipment.face).toBe('face-smile');await expect(femaleBag.locator('.equipment-status')).toHaveText('Visual equipado');await femaleBag.getByRole('button',{name:'Fechar',exact:true}).click();await enterGame(female.page,base,'female');restored=await profile(female);assert.equal(restored.gender,'female');assert.equal(restored.equipment.face,'face-smile');assert.equal(restored.equipment.outfit,'outfit-dancer');assert.equal(restored.gold,femalePurchased.gold);
 checks.push('female profile sees only female and unisex items, buys female items and restores the correct female default face');
 assert.deepEqual(errors,[]);const report={passed:true,base,checks,testPlayerIds:clients.map(client=>client.initial.id),errors};await writeFile('test-results/shop/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){for(const client of clients)await client.page.screenshot({path:`test-results/shop/failure-${client.gender}.png`}).catch(()=>{});throw error;}
finally{await browser.close();}
