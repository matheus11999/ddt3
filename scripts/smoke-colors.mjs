import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Color Tickets and the backpack's right-click menu: menu, color window (preset + RGB), body and eye
// colors, buying tickets and discarding with confirmation. Needs the game running (see CLAUDE.md).
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUTPUT_DIR??'test-results/colors';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 const profile=async()=>(await (await context.request.get(base+'/api/session')).json()).profile;
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const creation=page.locator('.character-creation');await expect(creation).toBeVisible();
 await creation.getByRole('button',{name:'Personagem masculino',exact:true}).click();
 await creation.getByLabel('Nome do personagem').fill(`Teste${Math.random().toString(36).slice(2,9)}`);await expect(creation.getByRole('button',{name:'Entrar no jogo',exact:true})).toBeEnabled({timeout:10000});await creation.getByRole('button',{name:'Entrar no jogo',exact:true}).click();
 await expect(page.locator('.bottom-dock')).toBeVisible({timeout:15000});
 const start=await profile();assert.equal(start.colorTickets,3);
 await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();
 const bag=page.getByRole('dialog',{name:'Mochila',exact:true});await expect(bag).toBeVisible();
 await page.waitForTimeout(800);
 await expect(bag.locator('.bag-grid').getByRole('button',{name:'Ticket de Cor'})).toBeVisible();
 // Right click: our menu, never the browser's.
 const hat=bag.locator('.bag-grid').getByRole('button',{name:'Boné do Explorador',exact:true});
 await hat.click({button:'right'});
 const menu=page.getByRole('menu',{name:'Boné do Explorador'});await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitem')).toHaveText(['Remover','Aprimorar','Trocar cor','Excluir']);
 await page.screenshot({path:`${output}/menu-hat.png`});
 const weapon=bag.locator('.bag-grid').getByRole('button',{name:'Quebra-Tijolos',exact:true});
 await weapon.click({button:'right'});
 await expect(page.getByRole('menu',{name:'Quebra-Tijolos'}).getByRole('menuitem')).toHaveText(['Remover','Aprimorar','Excluir']);
 await expect(page.getByRole('menu',{name:'Quebra-Tijolos'}).getByRole('menuitem',{name:'Excluir'})).toBeDisabled();
 await page.screenshot({path:`${output}/menu-weapon.png`});
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);
 await hat.click({button:'right'});await page.getByRole('menuitem',{name:'Trocar cor'}).click();
 const studio=page.getByRole('dialog',{name:'Trocar cor'});await expect(studio).toBeVisible();
 await studio.getByRole('button',{name:'Cor Vermelho'}).click();await page.waitForTimeout(600);
 await page.screenshot({path:`${output}/studio-preset.png`});
 await studio.getByRole('button',{name:'Cor Roxo'}).click();await page.waitForTimeout(600);
 await page.screenshot({path:`${output}/studio-palette.png`});
 // Several parts in one window: the outfit and the skin join the hat on the preview.
 await studio.getByRole('button',{name:/^Roupa/}).click();await studio.getByRole('button',{name:'Cor Verde'}).click();
 await studio.getByRole('button',{name:/^Corpo/}).click();await studio.getByRole('button',{name:'Cor Morena',exact:true}).click();await page.waitForTimeout(600);
 await expect(studio.locator('.color-part.edited')).toHaveCount(3);await expect(studio.getByRole('button',{name:/Aplicar tudo · 3/})).toBeEnabled();
 await page.screenshot({path:`${output}/studio-multi.png`});
 // Undo takes one part back without touching the others.
 await studio.getByRole('button',{name:'Desfazer'}).click();await expect(studio.locator('.color-part.edited')).toHaveCount(2);
 await studio.getByRole('button',{name:'Cor Morena',exact:true}).click();
 await studio.getByRole('button',{name:/Aplicar tudo/}).click();
 await expect(studio).toHaveCount(0,{timeout:10000});
 let saved=await profile();assert.equal(saved.colorTickets,0);assert.equal(saved.itemColors['hat-cap'],'#6f4a9a');assert.equal(saved.equipment.colors.hat,'#6f4a9a');assert.equal(saved.equipment.colors.outfit,'#4f8a4a');assert.equal(saved.equipment.skin,'#b77b52');
 await page.waitForTimeout(600);await page.screenshot({path:`${output}/bag-after-color.png`});
 // Without enough tickets the window explains where to get them.
 await bag.getByRole('button',{name:'Cor do corpo e dos olhos'}).click();
 const body=page.getByRole('dialog',{name:'Trocar cor'});await expect(body).toBeVisible();
 await body.getByRole('button',{name:/^Olhos/}).click();await body.getByRole('button',{name:'Cor Azul'}).click();await page.waitForTimeout(600);
 await page.screenshot({path:`${output}/studio-eyes.png`});
 await expect(body.getByRole('button',{name:/Aplicar tudo/})).toBeDisabled();
 await expect(body).toContainText('Compre Tickets de Cor na loja.');
 await body.getByRole('button',{name:'Cancelar'}).click();await expect(body).toHaveCount(0);
 // Discard asks first.
 const costume=bag.locator('.bag-grid').getByRole('button',{name:'Raposa Arcana',exact:true});
 await costume.click({button:'right'});await page.getByRole('menuitem',{name:'Excluir'}).click();
 const confirm=page.getByRole('alertdialog',{name:'Excluir item'});await expect(confirm).toBeVisible();await page.screenshot({path:`${output}/discard-confirm.png`});
 await confirm.getByRole('button',{name:'Excluir',exact:true}).click();await expect(confirm).toHaveCount(0,{timeout:10000});
 saved=await profile();assert.ok(!saved.inventory.includes('costume-arcane-fox'));
 await bag.getByRole('button',{name:'Fechar'}).first().click();
 // Shop: tickets by quantity.
 await page.locator('.bottom-dock').getByRole('button',{name:/Loja/}).click();
 const shop=page.getByRole('dialog',{name:'Loja da Brasa'});await expect(shop).toBeVisible();
 await shop.getByRole('button',{name:'Comprar Ticket de Cor'}).click();
 await shop.getByRole('button',{name:'Mais'}).click();await shop.getByRole('button',{name:'Mais'}).click();
 await page.screenshot({path:`${output}/shop-ticket.png`});
 await shop.getByRole('button',{name:'Confirmar'}).click();await expect(shop).toContainText('3 Tickets de Cor guardados na mochila!',{timeout:10000});
 saved=await profile();assert.equal(saved.colorTickets,3);
 // Six parts (hair, hat, glasses, outfit, body, eyes) still fit inside the window, with no sideways scroll.
 await shop.getByRole('textbox',{name:'Buscar na loja'}).fill('Sprint');await shop.getByRole('button',{name:'Comprar Óculos Sprint'}).click();await shop.getByRole('button',{name:'Confirmar'}).click();
 await expect.poll(async()=>(await profile()).inventory.includes('glasses-sport'),{timeout:10000}).toBe(true);
 await shop.getByRole('button',{name:'Fechar'}).first().click();
 await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();await expect(bag).toBeVisible();
 await bag.locator('.bag-grid').getByRole('button',{name:'Óculos Sprint',exact:true}).dblclick();
 await expect.poll(async()=>(await profile()).equipment.glasses,{timeout:10000}).toBe('glasses-sport');
 await bag.getByRole('button',{name:'Cor do corpo e dos olhos'}).click();
 const full=page.getByRole('dialog',{name:'Trocar cor'});await expect(full.locator('.color-part')).toHaveCount(6);
 await expect(full.getByRole('button',{name:'Cor Morena clara'})).toBeVisible();await expect(full.getByRole('textbox')).toHaveCount(0);await expect(full.locator('input[type=color],input[type=range]')).toHaveCount(0);
 await expect(full.locator('.color-swatch')).toHaveCount(6);
 const fits=await full.evaluate(dialog=>{const box=dialog.getBoundingClientRect();return [...dialog.querySelectorAll('*')].every(node=>{if(node.closest('.color-studio-preview'))return true;const r=node.getBoundingClientRect();return !r.width||r.right<=box.right+1&&r.left>=box.left-1;})&&[...dialog.querySelectorAll('.color-studio-body,.color-studio-controls')].every(node=>node.scrollWidth<=node.clientWidth+1);});
 await page.waitForTimeout(500);await page.screenshot({path:`${output}/studio-full.png`});
 if(!fits)console.log(await full.evaluate(dialog=>{const box=dialog.getBoundingClientRect();return [...dialog.querySelectorAll('*')].filter(node=>{if(node.closest('.color-studio-preview'))return false;const r=node.getBoundingClientRect();return r.width&&(r.right>box.right+1||r.left<box.left-1);}).slice(0,6).map(node=>`${node.className||node.tagName} ${Math.round(node.getBoundingClientRect().right-box.right)}`).join(' | ');}));
 assert.ok(fits,'everything fits inside the color window');
 if(errors.length)throw Error(errors.join('; '));
 console.log(`Cores e menu da mochila: ok · capturas em ${output}`);
}finally{await browser.close();}
