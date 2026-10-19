import {enterGame,createArenaRoom} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';

// Chat channels against a running game (Vite + server, or Docker): Mundo, Privado (sent from the player menu,
// seen in any tab and answered without picking the player again), Guilda (only members) and Sala (only the room).
// The founder's gold is granted straight in Postgres (DATABASE_URL), as in smoke-guilds.
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/chat';await mkdir(output,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa'});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
async function player(label,gender,gold){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));
 const profile=(await (await context.request.post(`${base}/api/session`,{data:{gender},headers:{Origin:base}})).json()).profile;
 if(gold)await db.query(`UPDATE players SET profile=jsonb_set(profile,'{gold}',to_jsonb($2::int)) WHERE id=$1`,[profile.id,gold]);
 await enterGame(page,base,gender);await expect(page.locator('.bottom-dock')).toBeVisible();
 return {page,profile};
}
const chatOf=(page,scope='.lobby-chat')=>page.locator(scope);
const tab=(page,name,scope)=>chatOf(page,scope).getByRole('button',{name,exact:true});
const lines=(page,scope)=>chatOf(page,scope).locator('.chat-messages');
const say=async(page,text,scope)=>{await chatOf(page,scope).getByRole('textbox',{name:'Mensagem de chat'}).fill(text);await chatOf(page,scope).getByRole('textbox',{name:'Mensagem de chat'}).press('Enter');};
const openGuild=async page=>{await page.locator('.lobby-dock-button.guild').click();const w=page.locator('.guild-window:not(.guild-sub-window)');await w.waitFor();return w;};
const closeGuild=async page=>{await page.locator('.guild-window:not(.guild-sub-window) > .window-header .close-button').click();};
try{
 const owner=await player('dono','female',5000),member=await player('membro','male'),stranger=await player('fora','male');
globalThis.dbg=[owner,member,stranger];
 const name=`Chat ${owner.profile.id.slice(0,4)}`;
 // Without a guild the Guilda tab is off.
 await expect(tab(owner.page,'Guilda')).toBeDisabled();

 // Mundo reaches everyone on the channel.
 await say(stranger.page,'bom dia praça');
 for(const p of [owner,member])await expect(lines(p.page)).toContainText('bom dia praça');

 // Privado from the player menu: the receiver sees it in the tab they are on, with a reply target ready.
 await chatOf(owner.page).locator('.chat-messages strong',{hasText:stranger.profile.name}).first().click({button:'right'});
 await owner.page.getByRole('menuitem',{name:'Enviar mensagem'}).click();
 await expect(tab(owner.page,'Privado')).toHaveClass(/active/);
 await say(owner.page,'oi, só pra você');
 await expect(lines(stranger.page)).toContainText(`De ${owner.profile.name}: oi, só pra você`);
 await expect(lines(member.page)).not.toContainText('só pra você');
 await stranger.page.screenshot({path:`${output}/1-privado-recebido.png`});
 await tab(stranger.page,'Privado').click();
 await expect(chatOf(stranger.page).getByRole('textbox',{name:'Mensagem de chat'})).toBeEnabled();
 await expect(chatOf(stranger.page).locator('.chat-target')).toContainText(owner.profile.name);
 await say(stranger.page,'oi! recebi');
 await expect(lines(owner.page)).toContainText(`De ${stranger.profile.name}: oi! recebi`);
 await owner.page.screenshot({path:`${output}/2-privado-resposta.png`});

 // Guilda: found it, accept the member.
 let w=await openGuild(owner.page);await w.locator('.guild-create').waitFor();
 await w.getByLabel('Nome da guilda').fill(name);await w.getByRole('button',{name:'Fundar guilda'}).click();await w.locator('.guild-crest-name',{hasText:name}).waitFor();
 const mw=await openGuild(member.page);await mw.getByLabel('Buscar guilda').fill(name);await mw.getByRole('button',{name:'Buscar',exact:true}).click();await mw.locator('.guild-list li',{hasText:name}).getByRole('button',{name:'Pedir para entrar'}).click();await mw.getByRole('button',{name:'Pedido enviado'}).waitFor();
 const manage=owner.page.locator('.guild-sub-window');await w.getByRole('button',{name:/^Gerenciar/}).click();await manage.getByRole('button',{name:/^Pedidos/}).click();
 await manage.locator('.guild-applications li').getByRole('button',{name:'Aceitar'}).click();await mw.locator('.guild-crest-name',{hasText:name}).waitFor();
 await manage.locator('.close-button').click();await closeGuild(owner.page);await closeGuild(member.page);
 await expect(tab(owner.page,'Guilda')).toBeEnabled();await expect(tab(member.page,'Guilda')).toBeEnabled();await expect(tab(stranger.page,'Guilda')).toBeDisabled();
 await tab(owner.page,'Guilda').click();await say(owner.page,'reunião da guilda às 20h');
 // The member is on Mundo: the Guilda tab lights up until it is opened.
 await expect(tab(member.page,'Guilda')).toHaveAttribute('data-unread','true');
 await member.page.screenshot({path:`${output}/3-guilda-aviso.png`});
 await tab(member.page,'Guilda').click();await expect(lines(member.page)).toContainText('reunião da guilda às 20h');
 await expect(tab(member.page,'Guilda')).not.toHaveAttribute('data-unread','true');
 await say(member.page,'estarei lá');await expect(lines(owner.page)).toContainText('estarei lá');
 await owner.page.screenshot({path:`${output}/4-guilda.png`});
 await tab(stranger.page,'Mundo').click();await expect(lines(stranger.page)).not.toContainText('reunião da guilda');

 // Sala: only the room reads it; the square does not.
 await createArenaRoom(owner.page);const room='.party-room .party-chat';await expect(tab(owner.page,'Sala',room)).toHaveClass(/active/);
 await say(owner.page,'sala aberta',room);await expect(lines(owner.page,room)).toContainText('sala aberta');
 await expect(lines(member.page)).not.toContainText('sala aberta');
 // Whispers and the guild still work from inside the room.
 await say(member.page,'te vejo na sala');await expect(tab(owner.page,'Guilda',room)).toHaveAttribute('data-unread','true');
 await owner.page.screenshot({path:`${output}/5-sala.png`});
 await tab(owner.page,'Guilda',room).click();await expect(lines(owner.page,room)).toContainText('te vejo na sala');
 assert.deepEqual(errors,[]);
 console.log('chat smoke ok:',output);
}catch(e){for(const [i,p] of (globalThis.dbg??[]).entries()){console.log(i,await p.page.locator('.lobby-chat').innerText().catch(()=>'-'));await p.page.screenshot({path:`${output}/fail-${i}.png`});}throw e;}finally{await browser.close();await db.end();}
