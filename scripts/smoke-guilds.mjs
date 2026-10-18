import {enterGame,createArenaRoom} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';

// Guildas against a running game (Vite + server, or Docker): found a guild, accept a member, raise the guild and
// its buildings, buy the necklace in the Loja da Guilda, use the Depósito, open the forge from the guild with the
// Ferreiro bonus, and turn GvG on in a PvP room whose cards show the guild under each name.
// Gold and Riqueza are granted straight in Postgres (DATABASE_URL), as GvG wins would.
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/guilds';await mkdir(output,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa'});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
const setGold=(...a)=>setGoldDef(...a);
async function player(label,gender,gold){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));
 // The session is made first so the gold is in the database before the game loads the profile.
 const profile=(await (await context.request.post(`${base}/api/session`,{data:{gender},headers:{Origin:base}})).json()).profile;
 await setGold(profile.id,gold);await enterGame(page,base,gender);
 return {page,profile};
}
const setGoldDef=async(id,gold)=>{await db.query(`UPDATE players SET profile=jsonb_set(profile,'{gold}',to_jsonb($2::int)) WHERE id=$1`,[id,gold]);};
const openGuild=async page=>{await page.locator('.lobby-dock-button.guild').click();const w=page.locator('.guild-window:not(.guild-sub-window)');await w.waitFor();return w;};
try{
 const owner=await player('dono','female',5000),member=await player('membro','male',3000);
 const name=`Brasa ${owner.profile.id.slice(0,4)}`;

 // No guild yet: found one.
 let w=await openGuild(owner.page);await w.locator('.guild-create').waitFor();await owner.page.waitForTimeout(400);
 await owner.page.screenshot({path:`${output}/1-sem-guilda.png`});
 await w.getByLabel('Nome da guilda').fill(name);await w.getByRole('button',{name:'Fundar guilda'}).click();
 await w.locator('.guild-crest-name',{hasText:name}).waitFor();await owner.page.waitForTimeout(600);
 await owner.page.screenshot({path:`${output}/2-guilda-nivel-0.png`});

 // Another player asks to join; the owner accepts in Gerenciar.
 const mw=await openGuild(member.page);await mw.getByLabel('Buscar guilda').fill(name);await mw.getByRole('button',{name:'Buscar',exact:true}).click();await mw.locator('.guild-list li',{hasText:name}).getByRole('button',{name:'Pedir para entrar'}).click();
 await mw.getByRole('button',{name:'Pedido enviado'}).waitFor();
 const manage=owner.page.locator('.guild-sub-window');
 await w.getByRole('button',{name:/^Gerenciar/}).click();await manage.getByRole('button',{name:/^Pedidos/}).click();await manage.locator('.guild-applications li',{hasText:member.profile.name}).waitFor();
 await owner.page.screenshot({path:`${output}/3-gerenciar-pedido.png`});
 await manage.locator('.guild-applications li').getByRole('button',{name:'Aceitar'}).click();
 await mw.locator('.guild-crest-name',{hasText:name}).waitFor();

 // Riqueza from GvG wins raises the guild first, then the buildings (never past the guild level).
 const guildId=(await db.query('SELECT id FROM guilds WHERE name=$1',[name])).rows[0].id;
 await db.query('UPDATE guilds SET riqueza=1000 WHERE id=$1',[guildId]);
 await manage.locator('.close-button').click();await owner.page.locator('.guild-window:not(.guild-sub-window) > .window-header .close-button').click();w=await openGuild(owner.page);await w.getByRole('button',{name:/^Gerenciar/}).click();
 const TARGETS={Guilda:'guild',Loja:'shop',Ferreiro:'smith','Depósito':'storage'},row=label=>manage.locator(`.guild-upgrades li[data-target="${TARGETS[label]}"]`);
 assert.ok(await row('Loja').getByRole('button',{name:'Evoluir'}).isDisabled(),'Loja waits for the guild level');
 await manage.getByRole('button',{name:'Evoluir',exact:true}).first().click();
 await row('Guilda').getByRole('button',{name:'Evoluir'}).click();await row('Guilda').locator('em',{hasText:'Nv. 1'}).waitFor();
 for(const label of ['Loja','Ferreiro','Depósito']){await row(label).getByRole('button',{name:'Evoluir'}).click();await row(label).locator('em',{hasText:'Nv. 1'}).waitFor();}
 await owner.page.waitForTimeout(500);await owner.page.screenshot({path:`${output}/4-gerenciar-evoluido.png`});
 // Cargos: the leader makes the member a Recrutador renamed Comandante.
 await manage.getByRole('button',{name:'Cargos',exact:true}).click();
 await manage.getByLabel('Nome do cargo 3').fill('Comandante');await manage.getByRole('button',{name:'Salvar cargos'}).click();await manage.locator('.guild-toast',{hasText:'Cargos salvos'}).waitFor();
 await owner.page.waitForTimeout(400);await owner.page.screenshot({path:`${output}/4b-cargos.png`});
 await manage.locator('.close-button').click();await w.locator('.guild-crest-level',{hasText:'1'}).waitFor();
 // Engrenagem do membro: Ver informações, Promover, Rebaixar e Expulsar (pede confirmação).
 await w.getByLabel(`Opções de ${member.profile.name}`).click();const gear=owner.page.getByRole('menu',{name:member.profile.name});
 for(const label of ['Ver informações','Promover a Veterano','Expulsar'])await gear.getByRole('menuitem',{name:label}).waitFor();
 await owner.page.waitForTimeout(200);await owner.page.screenshot({path:`${output}/4c-engrenagem.png`});
 await gear.getByRole('menuitem',{name:'Promover a Veterano'}).click();await w.locator('tr',{hasText:member.profile.name}).locator('.guild-role',{hasText:'Veterano'}).waitFor();
 await w.getByLabel(`Opções de ${member.profile.name}`).click();await owner.page.getByRole('menuitem',{name:'Promover a Comandante'}).click();await w.locator('.guild-toast',{hasText:'Cargo alterado'}).waitFor();
 await w.locator('tr',{hasText:member.profile.name}).locator('.guild-role',{hasText:'Comandante'}).waitFor();
 await w.getByLabel(`Opções de ${member.profile.name}`).click();await owner.page.getByRole('menuitem',{name:'Expulsar'}).click();
 await owner.page.getByRole('alertdialog',{name:`Expulsar ${member.profile.name}`}).getByRole('button',{name:'Voltar'}).click();
 await w.getByLabel(`Opções de ${member.profile.name}`).click();await owner.page.getByRole('menuitem',{name:'Ver informações'}).click();
 await owner.page.locator('.player-info-window').getByText(member.profile.name).first().waitFor();await owner.page.waitForTimeout(300);await owner.page.screenshot({path:`${output}/4d-info.png`});
 await owner.page.locator('.player-info-window .close-button').click();
 // Daily missions and contributions: the member finished two missions; the list ranks by contribution.
 await db.query(`UPDATE guild_members SET daily=jsonb_build_object('day',to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD'),'progress',jsonb_build_object('play',3,'forge',2,'win',1),'claimed','[]'::jsonb,'today',0),contribution=contribution+40 WHERE player_id=$1`,[member.profile.id]);
 await member.page.locator('.guild-window:not(.guild-sub-window) > .window-header .close-button').click();const m2=await openGuild(member.page);
 await m2.locator('[data-mission="play"]').getByRole('button',{name:'Receber'}).click();await m2.locator('[data-mission="play"] .guild-mission-done').waitFor();
 assert.equal(await m2.locator('.guild-table tbody tr').first().locator('b').textContent(),member.profile.name,'most contribution first');
 await member.page.waitForTimeout(500);await member.page.screenshot({path:`${output}/5-guilda.png`});

 // The member buys the necklace in the Loja da Guilda and puts it in the Depósito.
 await m2.locator('.guild-building',{hasText:'Loja'}).click();const shop=member.page.locator('.guild-shop-window');await shop.waitFor();await member.page.waitForTimeout(500);
 await member.page.screenshot({path:`${output}/6-loja.png`});
 await shop.locator('[data-shop-item="necklace-guild-1"] .shop-buy').click();
 await shop.getByRole('alertdialog').getByRole('button',{name:'Comprar'}).click();await shop.locator('.guild-toast',{hasText:'Compra concluída'}).waitFor();
 await shop.locator('.close-button').first().click();
 await m2.locator('.guild-building',{hasText:'Depósito'}).click();const store=member.page.locator('.guild-sub-window');await store.getByRole('button',{name:'Guardar item'}).click();
 await store.locator('.guild-picker [title="Colar da Guilda Nv. 1"]').click();await store.locator('.guild-storage-grid button').first().waitFor();
 await member.page.waitForTimeout(400);await member.page.screenshot({path:`${output}/7-deposito.png`});
 await store.locator('.guild-storage-grid button').first().click();await store.locator('.guild-toast',{hasText:'retirado'}).waitFor();
 await store.locator('.close-button').click();

 // The Ferreiro button opens the normal forge, with the guild bonus on the chance.
 await m2.locator('.guild-building',{hasText:'Ferreiro'}).click();
 const forge=member.page.locator('.smith-window');await forge.waitFor();
 await forge.locator('.item-card',{has:member.page.locator('[alt="Quebra-Tijolos"],[aria-label="Quebra-Tijolos"]')}).first().click();
 await forge.locator('[aria-label^="Pedra de Fortificação I,"]').click();await forge.locator('[aria-label^="Pedra de Fortificação I,"]').click();
 await forge.locator('.forge-guild-bonus').waitFor({timeout:5000});
 await member.page.waitForTimeout(600);await member.page.screenshot({path:`${output}/8-ferreiro.png`});
 await member.page.keyboard.press('Escape');

 // PvP room: guild under the name and the Normal | GvG toggle on the room board (none beside Início).
 await owner.page.locator('.guild-window:not(.guild-sub-window) > .window-header .close-button').click();await createArenaRoom(owner.page);
 await owner.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();
 await member.page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
 const search=member.page.getByRole('button',{name:'Pesquisar salas',exact:true});if(await search.isVisible())await search.click();
 await member.page.locator('.arena-room-entry').filter({hasText:owner.profile.name}).first().click();
 await owner.page.locator('.pr-card-guild').nth(1).waitFor();
 const mode=owner.page.locator('.pr-mode-banner');await owner.page.waitForTimeout(400);await owner.page.screenshot({path:`${output}/9a-sala-normal.png`});
 assert.equal(await owner.page.locator('.pr-start-row').getByText('GvG').count(),0,'no GvG button beside Início');
 await mode.getByRole('radio',{name:'GvG'}).click();await mode.getByRole('radio',{name:'GvG',checked:true}).waitFor();
 await owner.page.locator('.pr-banner.is-gvg img[src*="gvg-room-banner"]').waitFor();
 await member.page.locator('.pr-mode-banner').getByRole('radio',{name:'GvG',checked:true}).waitFor();
 assert.equal(await member.page.locator('.pr-mode-banner').getByRole('radio',{name:'Normal'}).isDisabled(),true,'only the leader picks the battle type');
 await member.page.getByRole('button',{name:'Estou pronto'}).click();await owner.page.waitForTimeout(800);
 await owner.page.screenshot({path:`${output}/9-sala-gvg.png`});
 // Smaller screens hide the board: the toggle moves to the title bar.
 await owner.page.setViewportSize({width:1100,height:700});await owner.page.locator('.pr-mode-title').getByRole('radio',{name:'GvG',checked:true}).waitFor();
 await owner.page.waitForTimeout(300);await owner.page.screenshot({path:`${output}/9c-sala-gvg-pequena.png`});
 assert.deepEqual(errors,[]);
 console.log(`guild smoke ok: ${output}`);
}finally{await browser.close();await db.end();}
