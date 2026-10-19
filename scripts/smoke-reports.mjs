import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Player menu (right click on another player), the player info window, the report window and the
// admin panel's report page with the reported player's chat. Needs the game running (see CLAUDE.md);
// the admin part runs when ADMIN_USERNAME/ADMIN_PASSWORD are set (same as the server's account).
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUTPUT_DIR??'test-results/reports';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const errors=[];
async function player(gender){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const creation=page.locator('.character-creation');await expect(creation).toBeVisible();
 await creation.getByRole('button',{name:gender==='female'?'Personagem feminino':'Personagem masculino',exact:true}).click();
 await creation.getByRole('button',{name:'Criar personagem',exact:true}).click();
 await expect(page.locator('.bottom-dock')).toBeVisible({timeout:15000});
 const profile=(await (await context.request.get(base+'/api/session')).json()).profile;
 return {context,page,profile};
}
const say=async(page,text)=>{await page.getByRole('textbox',{name:'Mensagem de chat'}).fill(text);await page.keyboard.press('Enter');await page.waitForTimeout(900);};
try{
 const a=await player('male'),b=await player('female');
 await say(b.page,'oi pessoal');await say(b.page,'vocês são muito ruins kkk');
 // Right click on the name in the chat: the game's menu, never the browser's.
 const name=a.page.locator('.lobby-chat .chat-messages strong',{hasText:b.profile.name}).first();await expect(name).toBeVisible();
 await name.click({button:'right'});
 const menu=a.page.getByRole('menu',{name:b.profile.name});await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitem')).toHaveText(['Ver informações','Enviar mensagem','Denunciar']);
 await a.page.screenshot({path:`${output}/menu-chat.png`});
 await menu.getByRole('menuitem',{name:'Ver informações'}).click();
 const info=a.page.getByRole('dialog',{name:'Informações do jogador'});await expect(info).toBeVisible();
 await expect(info.locator('.player-info-plate h2')).toHaveText(b.profile.name);
 await expect(info.locator('.combat-power strong')).not.toBeEmpty();
 await a.page.waitForTimeout(900);await a.page.screenshot({path:`${output}/info.png`});
 await info.locator('[data-slot="weapon"]').hover();
 await expect(a.page.locator('#item-tooltip')).toBeVisible();await a.page.waitForTimeout(200);
 await a.page.screenshot({path:`${output}/info-tooltip.png`});
 await info.locator('[data-slot="outfit"]').hover();await a.page.waitForTimeout(250);
 await a.page.screenshot({path:`${output}/info-tooltip-outfit.png`});
 // From the info window straight to the report.
 await info.getByRole('button',{name:'Denunciar'}).click();
 const report=a.page.getByRole('dialog',{name:`Denunciar ${b.profile.name}`});await expect(report).toBeVisible();
 await expect(report.getByRole('button',{name:'Enviar denúncia'})).toBeDisabled();
 await report.getByLabel('Ofensa ou xingamento').check();
 await report.getByRole('textbox').fill('Ficou xingando todo mundo no chat do mundo.');
 await a.page.screenshot({path:`${output}/report.png`});
 await report.getByRole('button',{name:'Enviar denúncia'}).click();
 await expect(report.getByText('Denúncia enviada')).toBeVisible();
 await a.page.screenshot({path:`${output}/report-sent.png`});
 await report.getByRole('button',{name:'Fechar',exact:true}).last().click();await expect(report).toHaveCount(0);
 // Reporting the same player again right away is refused.
 await name.click({button:'right'});await a.page.getByRole('menuitem',{name:'Denunciar'}).click();
 await a.page.getByLabel('Spam ou flood no chat').check();await a.page.getByRole('button',{name:'Enviar denúncia'}).click();
 await expect(a.page.locator('.player-report-error')).toContainText('já denunciou');
 await a.page.keyboard.press('Escape');
 // Own name: only "Ver informações".
 await say(a.page,'para com isso');
 await a.page.locator('.lobby-chat .chat-messages strong',{hasText:a.profile.name}).first().click({button:'right'});
 await expect(a.page.getByRole('menu').getByRole('menuitem')).toHaveText(['Ver informações']);
 await a.page.keyboard.press('Escape');
 // Right click on someone walking in the plaza (the canvas): B walks to the left, A looks for B there.
 await b.page.locator('canvas.world-canvas').click({position:{x:420,y:620}});await a.page.waitForTimeout(3500);
 let found=false;
 for(const x of [420,380,460,340,500,300,540]){
  await a.page.locator('canvas.world-canvas').click({button:'right',position:{x,y:560}});
  const plaza=a.page.getByRole('menu');if(await plaza.count()){await expect(plaza).toHaveAccessibleName(b.profile.name);found=true;await a.page.screenshot({path:`${output}/menu-plaza.png`});await a.page.keyboard.press('Escape');break;}
 }
 assert.ok(found,'right click on a player in the plaza opens the player menu');
 // The online list in the PvP hall.
 await a.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();
 const row=a.page.locator('.hall-online-row',{hasText:b.profile.name});await expect(row).toBeVisible({timeout:8000});
 await row.click({button:'right'});await expect(a.page.getByRole('menu',{name:b.profile.name})).toBeVisible();
 await a.page.screenshot({path:`${output}/menu-hall.png`});
 await a.page.keyboard.press('Escape');

 // In battle: the rival's portrait at the top. Two solo rooms queue into each other.
 await a.page.getByRole('button',{name:'Criar sala'}).click();
 await b.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();await b.page.getByRole('button',{name:'Criar sala'}).click();
 const seat=a.page.locator('.pr-card.is-me');await expect(seat).toBeVisible();
 await seat.click({button:'right'});await expect(a.page.getByRole('menu').getByRole('menuitem')).toHaveText(['Ver informações']);await a.page.keyboard.press('Escape');
 for(const page of [a.page,b.page])await page.getByRole('button',{name:'Buscar partida'}).click();
 const rival=a.page.locator('.fighter-roster.enemy .roster-card').first();await expect(rival).toBeVisible({timeout:20000});
 await rival.click({button:'right'});const battleMenu=a.page.getByRole('menu',{name:b.profile.name});await expect(battleMenu).toBeVisible();
 await a.page.screenshot({path:`${output}/menu-battle.png`});
 await battleMenu.getByRole('menuitem',{name:'Ver informações'}).click();await expect(a.page.getByRole('dialog',{name:'Informações do jogador'})).toBeVisible();
 await a.page.waitForTimeout(600);await a.page.screenshot({path:`${output}/info-battle.png`});await a.page.keyboard.press('Escape');

 if(process.env.ADMIN_USERNAME&&process.env.ADMIN_PASSWORD){
  const admin=await browser.newContext({viewport:{width:1536,height:900}}),page=await admin.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/admin');await page.getByLabel('Usuário').fill(process.env.ADMIN_USERNAME);await page.getByLabel('Senha').fill(process.env.ADMIN_PASSWORD);await page.getByRole('button',{name:'Entrar'}).click();
  await expect(page.locator('.adm-card',{hasText:'Denúncias abertas'})).toBeVisible();
  await page.getByRole('link',{name:'Denúncias'}).click();
  const item=page.locator('.adm-report-list button',{hasText:b.profile.name}).first();await expect(item).toBeVisible();
  await page.screenshot({path:`${output}/admin-list.png`});
  await item.click();
  const detail=page.locator('.adm-report');await expect(detail.locator('.adm-report-log li')).toHaveCount(2);
  await expect(detail).toContainText('vocês são muito ruins kkk');await expect(detail).not.toContainText('para com isso');
  await page.screenshot({path:`${output}/admin-detail.png`});
  const open=Number(await page.locator('.adm-tabs button.on small').textContent());
  await detail.getByRole('button',{name:'Marcar como resolvida'}).click();
  await expect(detail.locator('.adm-report-head .adm-status')).toHaveText('Resolvida');
  await expect(page.locator('.adm-tabs button.on small')).toHaveText(String(open-1));
 }
 assert.deepEqual(errors,[]);
 console.log('smoke-reports ok');
}finally{await browser.close();}
