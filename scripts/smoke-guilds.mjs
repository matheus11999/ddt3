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
const openGuild=async page=>{await page.locator('.lobby-dock-button.guild').click();const w=page.locator('.guild-window');await w.waitFor();return w;};
try{
 const owner=await player('dono','female',5000),member=await player('membro','male',3000);
 const name=`Brasa ${owner.profile.id.slice(0,4)}`;

 // No guild yet: found one.
 let w=await openGuild(owner.page);await w.locator('.guild-create').waitFor();await owner.page.waitForTimeout(400);
 await owner.page.screenshot({path:`${output}/1-sem-guilda.png`});
 await w.getByLabel('Nome da guilda').fill(name);await w.getByRole('button',{name:'Fundar guilda'}).click();
 await w.locator('.guild-head h2',{hasText:name}).waitFor();await owner.page.waitForTimeout(600);
 await owner.page.screenshot({path:`${output}/2-guilda-nivel-0.png`});

 // Another player asks to join; the owner accepts in Gerenciar.
 const mw=await openGuild(member.page);await mw.locator('.guild-list li',{hasText:name}).getByRole('button',{name:'Pedir para entrar'}).click();
 await mw.getByRole('button',{name:'Pedido enviado'}).waitFor();
 await w.getByRole('button',{name:/^Gerenciar/}).click();await w.locator('.guild-applications li',{hasText:member.profile.name}).waitFor();
 await owner.page.screenshot({path:`${output}/3-gerenciar-pedido.png`});
 await w.locator('.guild-applications li').getByRole('button',{name:'Aceitar'}).click();
 await mw.locator('.guild-head h2',{hasText:name}).waitFor();

 // Riqueza from GvG wins raises the guild first, then the buildings (never past the guild level).
 const guildId=(await db.query('SELECT id FROM guilds WHERE name=$1',[name])).rows[0].id;
 await db.query('UPDATE guilds SET riqueza=1000 WHERE id=$1',[guildId]);
 await owner.page.locator('.guild-window .close-button').click();w=await openGuild(owner.page);await w.getByRole('button',{name:/^Gerenciar/}).click();
 const TARGETS={Guilda:'guild',Loja:'shop',Ferreiro:'smith','Depósito':'storage'},row=label=>w.locator(`.guild-upgrades li[data-target="${TARGETS[label]}"]`);
 assert.ok(await row('Loja').getByRole('button',{name:'Evoluir'}).isDisabled(),'Loja waits for the guild level');
 await row('Guilda').getByRole('button',{name:'Evoluir'}).click();await w.locator('.guild-head small',{hasText:'Nível 1'}).waitFor();
 for(const label of ['Loja','Ferreiro','Depósito']){await row(label).getByRole('button',{name:'Evoluir'}).click();await row(label).locator('em',{hasText:'Nv. 1'}).waitFor();}
 await owner.page.waitForTimeout(500);await owner.page.screenshot({path:`${output}/4-gerenciar-evoluido.png`});
 await w.getByRole('button',{name:'Guilda',exact:true}).click();await owner.page.waitForTimeout(400);await owner.page.screenshot({path:`${output}/5-construcoes.png`});

 // The member buys the necklace in the Loja da Guilda and puts it in the Depósito.
 await member.page.locator('.guild-window .close-button').click();const m2=await openGuild(member.page);
 await m2.getByRole('button',{name:'Loja',exact:true}).click();await m2.locator('.guild-offers li',{hasText:'Colar da Guilda'}).getByRole('button').click();
 await m2.getByRole('alertdialog').getByRole('button',{name:'Comprar'}).click();await m2.locator('.guild-toast',{hasText:'Compra concluída'}).waitFor();
 await member.page.screenshot({path:`${output}/6-loja.png`});
 await m2.getByRole('button',{name:'Depósito',exact:true}).click();await m2.getByRole('button',{name:'Guardar item'}).click();
 await m2.locator('.guild-picker [title="Colar da Guilda Nv. 1"]').click();await m2.locator('.guild-storage-grid button').first().waitFor();
 await member.page.waitForTimeout(400);await member.page.screenshot({path:`${output}/7-deposito.png`});
 await m2.locator('.guild-storage-grid button').first().click();await m2.locator('.guild-toast',{hasText:'retirado'}).waitFor();

 // The Ferreiro button opens the normal forge, with the guild bonus on the chance.
 await m2.getByRole('button',{name:'Guilda',exact:true}).click();await m2.locator('.guild-building',{hasText:'Ferreiro'}).click();
 const forge=member.page.locator('.smith-window');await forge.waitFor();
 await forge.locator('.item-card',{has:member.page.locator('[alt="Quebra-Tijolos"],[aria-label="Quebra-Tijolos"]')}).first().click();
 await forge.locator('[aria-label^="Pedra de Fortificação I,"]').click();await forge.locator('[aria-label^="Pedra de Fortificação I,"]').click();
 await forge.locator('.forge-guild-bonus').waitFor({timeout:5000});
 await member.page.waitForTimeout(600);await member.page.screenshot({path:`${output}/8-ferreiro.png`});
 await member.page.keyboard.press('Escape');

 // PvP room: guild under the name and the GvG switch beside Início.
 await owner.page.locator('.guild-window .close-button').click();await createArenaRoom(owner.page);
 await owner.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();
 await member.page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
 const search=member.page.getByRole('button',{name:'Pesquisar salas',exact:true});if(await search.isVisible())await search.click();
 await member.page.locator('.arena-room-entry').filter({hasText:owner.profile.name}).first().click();
 await owner.page.locator('.pr-card-guild').nth(1).waitFor();
 await owner.page.getByRole('button',{name:'GvG desligado'}).click();await owner.page.getByRole('button',{name:/GvG ligado/}).waitFor();
 await member.page.getByRole('button',{name:'Estou pronto'}).click();await owner.page.waitForTimeout(800);
 await owner.page.screenshot({path:`${output}/9-sala-gvg.png`});
 assert.deepEqual(errors,[]);
 console.log(`guild smoke ok: ${output}`);
}finally{await browser.close();await db.end();}
