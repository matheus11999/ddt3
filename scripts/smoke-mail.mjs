import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Admin players page + in-game Correio against a running game (Docker or Vite + server):
// a new player appears in /admin/jogadores (and under Online), the admin mails items, coins and a
// message, the player sees the letters arrive, reads one and receives everything with "Receber tudo".
// Needs ADMIN_USER and ADMIN_PASSWORD matching the server's ADMIN_USERNAME / ADMIN_PASSWORD_HASH.
const base=process.env.BASE_URL??'http://127.0.0.1:8097',user=process.env.ADMIN_USER??'matheus',password=process.env.ADMIN_PASSWORD;
if(!password)throw new Error('Defina ADMIN_PASSWORD (a senha do painel) para rodar este teste.');
const output='test-results/mail';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
try{
 // The player: a fresh character in the plaza.
 const game=await browser.newPage({viewport:{width:1536,height:864}});game.on('pageerror',e=>errors.push(`jogo: ${e.message}`));
 await game.goto(base);
 const created=await game.evaluate(async()=>{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender:'female'})});return (await r.json()).profile;});
 await game.reload();const mailButton=game.locator('.lobby-dock-button.mail');await mailButton.waitFor({timeout:30000});
 const name=created.name,gold=created.gold;

 // The admin finds the player, online, and mails items, coins and a message.
 const admin=await browser.newPage({viewport:{width:1600,height:900}});admin.on('pageerror',e=>errors.push(`admin: ${e.message}`));
 await admin.goto(`${base}/admin`);
 await admin.getByLabel('Usuário').fill(user);await admin.getByLabel('Senha').fill(password);await admin.getByRole('button',{name:'Entrar'}).click();
 await admin.getByRole('link',{name:'Jogadores'}).click();await admin.getByRole('heading',{name:'Jogadores'}).waitFor();
 await admin.getByRole('button',{name:/^Online/}).click();
 const row=admin.locator('.adm-table tbody tr',{hasText:name});await row.waitFor();
 assert.match(await row.innerText(),/Na praça/);
 await admin.waitForTimeout(500);await admin.screenshot({path:`${output}/admin-jogadores.png`});
 await admin.getByRole('button',{name:`Enviar itens para ${name}`}).click();
 const dialog=admin.locator('.adm-compose');await dialog.waitFor();
 await dialog.locator('.adm-catalog-item',{hasText:'Quebra-Tijolos'}).click();
 await dialog.locator('.adm-upgrade select').selectOption('12');
 await dialog.getByRole('button',{name:/^Chapéus/}).click();
 assert.ok(await dialog.locator('.adm-catalog-item',{hasText:'Boné Relâmpago'}).isDisabled(),'chapéu masculino bloqueado para personagem feminino');
 await dialog.locator('.adm-catalog-item',{hasText:'Chapéu Astral'}).click();
 await dialog.getByRole('button',{name:/^Pedras de forja/}).click();await dialog.locator('.adm-catalog-item',{hasText:'Fortificação III'}).click();
 await dialog.getByRole('button',{name:/^Ticket de Cor/}).click();await dialog.locator('.adm-catalog-item',{hasText:'Ticket de Cor'}).click();
 await dialog.getByLabel('Mensagem').fill('Obrigado por testar a Brasa!\nAqui vai um kit para começar com tudo.');
 await admin.waitForTimeout(800);await admin.screenshot({path:`${output}/admin-enviar-itens.png`});
 await dialog.getByRole('button',{name:'Enviar carta'}).click();await admin.getByText(/enviada para/).waitFor();
 await admin.getByRole('button',{name:`Adicionar moedas para ${name}`}).click();
 await dialog.getByRole('button',{name:'5.000'}).click();await admin.screenshot({path:`${output}/admin-moedas.png`});
 await dialog.getByRole('button',{name:'Enviar carta'}).click();await admin.locator('.adm-compose').waitFor({state:'detached'});
 await admin.getByRole('button',{name:`Enviar mensagem para ${name}`}).click();
 await dialog.getByLabel('Assunto').fill('Manutenção hoje à noite');await dialog.getByLabel('Mensagem').fill('O servidor reinicia às 23h para uma atualização. Suas partidas voltam sozinhas.');
 await dialog.getByRole('button',{name:'Enviar carta'}).click();await admin.locator('.adm-compose').waitFor({state:'detached'});
 await row.click();await admin.locator('.adm-player-drawer h4',{hasText:'Correio enviado'}).waitFor();await admin.waitForTimeout(600);
 await admin.screenshot({path:`${output}/admin-jogador.png`});

 // The player sees three new letters, reads one and receives everything.
 await game.locator('.lobby-dock-button.mail .lobby-dock-count',{hasText:'3'}).waitFor();
 await mailButton.click();const box=game.locator('.mail-window');await box.locator('.mail-row').nth(2).waitFor();
 await box.locator('.mail-row',{hasText:'Presente da equipe'}).click();await box.locator('.mail-attachment').nth(3).waitFor();await game.waitForTimeout(900);
 await game.screenshot({path:`${output}/correio.png`});
 await box.getByRole('button',{name:/Receber tudo/}).click();await box.locator('.mail-received').waitFor();await game.waitForTimeout(400);
 await game.screenshot({path:`${output}/correio-recebido.png`});
 const after=await game.evaluate(async()=>(await (await fetch('/api/session')).json()).profile);
 assert.equal(after.gold,gold+5000);assert.ok(after.inventory.includes('hat-mage'));assert.equal(after.upgrades['brick~2'],12);
 await box.locator('.mail-received').waitFor({state:'detached'});await box.getByRole('button',{name:/Receber tudo/}).isDisabled();
 await game.waitForTimeout(300);await game.screenshot({path:`${output}/correio-depois.png`});
 assert.deepEqual(errors,[]);
 console.log(`Correio ok: ${name} recebeu os anexos; capturas em ${output}`);
}finally{await browser.close();}
