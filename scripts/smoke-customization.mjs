import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPractice} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177';
const output='test-results/customization';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const contexts=[],errors=[],checks=[];
async function settle(page){await page.waitForLoadState('networkidle');await page.evaluate(()=>new Promise(resolve=>{let count=0;const frame=()=>++count>=10?resolve():requestAnimationFrame(frame);requestAnimationFrame(frame);}));}
async function create(gender){
 const context=await browser.newContext({viewport:{width:1536,height:864}});contexts.push(context);
 const page=await context.newPage(),events=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('websocket',ws=>ws.on('framereceived',frame=>{try{events.push(JSON.parse(String(frame.payload)));}catch{}}));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const creation=page.locator('.character-creation');await expect(creation).toBeVisible();
 await creation.getByRole('button',{name:gender==='female'?'Personagem feminino':'Personagem masculino',exact:true}).click();
 await settle(page);await page.screenshot({path:`${output}/creation-${gender}.png`});
 await creation.getByRole('button',{name:'Criar personagem',exact:true}).click();
 await expect(page.locator('.bottom-dock')).toBeVisible({timeout:15000});
 const profile=async()=>{const response=await context.request.get(base+'/api/session');assert.equal(response.status(),200);return (await response.json()).profile;};
 assert.equal((await profile()).gender,gender);
 return {context,page,events,profile};
}
async function bagFor(player){
 await player.page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();
 const bag=player.page.getByRole('dialog',{name:'Mochila',exact:true});await expect(bag).toBeVisible();return bag;
}
async function options(bag){await bag.getByRole('button',{name:'Exibição do personagem',exact:true}).click();const popup=bag.getByRole('dialog',{name:'Exibição do personagem',exact:true});await expect(popup).toBeVisible();return popup;}
async function applied(player,bag,equipment){await expect.poll(async()=>(await player.profile()).equipment,{timeout:15000}).toMatchObject(equipment);await expect(bag.locator('.equipment-status')).toHaveText('Visual equipado');}

try{
 const male=await create('male'),female=await create('female');
 checks.push('Both creation choices persist; accounts are isolated new guests');
 const bag=await bagFor(male),initial=await male.profile();
 await expect(bag.locator('[data-slot]')).toHaveCount(13);
 await expect(bag.getByRole('button',{name:/Salvar personalização|Restaurar visual|^Remover /})).toHaveCount(0);
 assert.ok(initial.inventory.includes('costume-thunder-chick')&&initial.inventory.includes('costume-arcane-fox'));
 assert.ok(initial.inventory.every(id=>!id.endsWith('-none')));
 await expect(bag.locator('.bag-grid')).not.toContainText(/Sem (óculos|pulseira|chapéu|fantasia|bracelete|cabelo)/i);
 const power=await bag.locator('.combat-power strong').innerText();
 const canvas=bag.locator('canvas[aria-label="Prévia do personagem"]');
 assert.ok(initial.equipment.upgrade<5,'pixel comparisons use a fresh profile without an animated aura; advanced aura has a separate renderer regression');
 await settle(male.page);const original=await canvas.evaluate(node=>node.toDataURL());
 let popup=await options(bag);
 await popup.getByRole('checkbox',{name:'Exibir chapéu',exact:true}).uncheck();
 await popup.getByRole('checkbox',{name:'Exibir óculos',exact:true}).uncheck();
 await popup.getByRole('button',{name:'Fechar exibição',exact:true}).click();
 await settle(male.page);assert.notEqual(await canvas.evaluate(node=>node.toDataURL()),original,'hiding hat changes the composed preview');
 await applied(male,bag,{visibility:{hat:false,glasses:false}});
 let saved=await male.profile();assert.equal(saved.equipment.visibility.hat,false);assert.equal(saved.equipment.visibility.glasses,false);assert.equal(saved.equipment.hat,initial.equipment.hat);
 assert.equal(await bag.locator('.combat-power strong').innerText(),power,'hidden gear keeps attributes');
 checks.push('Visibility applies immediately and preserves equipped item and stats; no save, restore or trash controls');
 await bag.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('costume');
 await expect(bag.locator('.bag-grid').getByRole('button')).toHaveCount(2);
 await bag.locator('.bag-grid').getByRole('button',{name:'Pintinho do Trovão',exact:true}).dblclick();
 await applied(male,bag,{costume:'costume-thunder-chick'});
 await settle(male.page);const chick=await canvas.evaluate(node=>node.toDataURL());
 await settle(male.page);assert.equal(await canvas.evaluate(node=>node.toDataURL()),chick,'costume preview is completely static');
 assert.equal((await male.profile()).equipment.costume,'costume-thunder-chick');
 assert.equal(await bag.locator('.combat-power strong').innerText(),power);
 await male.page.screenshot({path:`${output}/inventory-chick.png`});
 popup=await options(bag);await popup.getByRole('checkbox',{name:'Exibir fantasia',exact:true}).uncheck();await popup.getByRole('button',{name:'Fechar exibição',exact:true}).click();
 await settle(male.page);assert.notEqual(await canvas.evaluate(node=>node.toDataURL()),chick,'hidden costume restores the underlying character');
 await applied(male,bag,{costume:'costume-thunder-chick',visibility:{costume:false}});saved=await male.profile();assert.equal(saved.equipment.costume,'costume-thunder-chick');assert.equal(saved.equipment.visibility.costume,false);
 await bag.getByRole('button',{name:'Fechar',exact:true}).click();await male.page.reload({waitUntil:'networkidle'});await expect(male.page.locator('.bottom-dock')).toBeVisible();
 assert.deepEqual((await male.profile()).equipment,saved.equipment,'reload preserves all visibility preferences');
 checks.push('Costume toggles complete appearance; saved equipment and visibility survive reload');
 const bag2=await bagFor(male);popup=await options(bag2);
 await expect(popup.getByRole('checkbox',{name:'Exibir fantasia',exact:true})).not.toBeChecked();
 for(const label of ['Exibir chapéu','Exibir óculos','Exibir fantasia'])await popup.getByRole('checkbox',{name:label,exact:true}).check();
 await popup.getByRole('button',{name:'Fechar exibição',exact:true}).click();await applied(male,bag2,{visibility:{hat:true,glasses:true,costume:true}});
 await bag2.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect.poll(()=>female.events.some(event=>event.type==='lobby'&&event.players?.some(player=>player.id===initial.id&&player.equipment.costume==='costume-thunder-chick'&&player.equipment.visibility?.costume===true)),{timeout:15000}).toBe(true);
 const femaleBag=await bagFor(female);await femaleBag.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('costume');
 await femaleBag.locator('.bag-grid').getByRole('button',{name:'Raposa Arcana',exact:true}).click();await applied(female,femaleBag,{costume:'costume-arcane-fox'});
 assert.equal((await female.profile()).equipment.costume,'costume-arcane-fox');assert.equal((await female.profile()).gender,'female');
 await settle(female.page);await female.page.screenshot({path:`${output}/inventory-fox.png`});
 await female.page.setViewportSize({width:390,height:844});popup=await options(femaleBag);await settle(female.page);
 const bounds=await popup.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=391&&bounds.y+bounds.height<=845,'visibility modal fits mobile');
 await female.page.screenshot({path:`${output}/visibility-mobile.png`});await popup.getByRole('button',{name:'Fechar exibição',exact:true}).click();
 await femaleBag.locator('[data-slot="costume"]').dblclick();await applied(female,femaleBag,{costume:'costume-none'});
 await femaleBag.locator('.bag-grid').getByRole('button',{name:'Raposa Arcana',exact:true}).click();await applied(female,femaleBag,{costume:'costume-arcane-fox'});
 await femaleBag.getByRole('button',{name:'Fechar',exact:true}).click();
 checks.push('Both genders equip costumes immediately; slot double-click unequips; second client receives appearance; narrow desktop settings fit');
  await female.page.setViewportSize({width:1536,height:864});
  const shopSaved=await female.profile();
  await female.page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();
  const shop=female.page.getByRole('dialog',{name:'Loja da Brasa',exact:true}),shopAvatar=shop.locator('canvas[aria-label="Prévia do personagem"]');
  await settle(female.page);const equippedFox=await shopAvatar.evaluate(node=>node.toDataURL());
  await shop.getByRole('button',{name:'Roupas',exact:true}).click();await shop.getByRole('button',{name:'Experimentar Dançarina Rubi',exact:true}).click();
  await settle(female.page);assert.notEqual(await shopAvatar.evaluate(node=>node.toDataURL()),equippedFox,'trying clothing reveals it beneath the saved costume');
  await shop.getByRole('button',{name:'Restaurar visual',exact:true}).click();await settle(female.page);assert.equal(await shopAvatar.evaluate(node=>node.toDataURL()),equippedFox);
  await shop.getByRole('button',{name:'Fantasias',exact:true}).click();await shop.getByRole('button',{name:'Experimentar Pintinho do Trovão',exact:true}).click();
  await settle(female.page);assert.notEqual(await shopAvatar.evaluate(node=>node.toDataURL()),equippedFox);
  assert.deepEqual((await female.profile()).equipment,shopSaved.equipment,'shop fitting never saves visibility or equipment');
  await shop.getByRole('button',{name:'Fechar',exact:true}).click();
  checks.push('Shop reveals fitted clothing beneath a costume and Restore recovers the saved appearance');
 await startPractice(male.page);
 await expect.poll(()=>male.events.some(event=>event.type==='battle'&&event.battle?.players.some(player=>player.id===initial.id&&player.equipment.costume==='costume-thunder-chick'&&player.equipment.visibility?.costume===true)),{timeout:15000}).toBe(true);
 await settle(male.page);await male.page.screenshot({path:`${output}/costume-combat.png`});
 checks.push('Real practice battle snapshot carries equipped costume and visibility');
 assert.deepEqual(errors,[]);checks.push('Zero browser JavaScript errors');
 await writeFile(`${output}/report.json`,JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({ok:true,checks},null,2));
}finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();}
