import {enterGame,createArenaRoom,startPractice} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';

// Chat balloons in the look of the equipped Bolha against a running game: over the walker in the plaza,
// over the room card (PvP room) and over the fighter in battle, where Enter opens the battle chat.
// The Bolha is given straight in Postgres (DATABASE_URL).
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/chat-bubbles';await mkdir(output,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa'});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
async function player(label,bubble){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),events=[];
 page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));
 page.on('websocket',s=>s.on('framereceived',f=>{try{events.push(JSON.parse(String(f.payload)));}catch{}}));
 const profile=(await (await context.request.post(`${base}/api/session`,{data:{gender:'male'},headers:{Origin:base}})).json()).profile;
 if(bubble)await db.query(`UPDATE players SET profile=jsonb_set(jsonb_set(profile,'{inventory}',(profile->'inventory')||to_jsonb($2::text)),'{equipment,bubble}',to_jsonb($2::text)) WHERE id=$1`,[profile.id,bubble]);
 await enterGame(page,base);await expect(page.locator('.bottom-dock')).toBeVisible();
 return {page,profile,events};
}
const say=async(page,text,scope='.lobby-chat')=>{const box=page.locator(scope).getByRole('textbox',{name:'Mensagem de chat'});await box.fill(text);await box.press('Enter');};
const heard=(p,text)=>expect.poll(()=>p.events.find(e=>e.type==='chat'&&e.message.text===text)?.message.bubble).toBeTruthy();
try{
 const a=await player('A','bubble-royal'),b=await player('B','bubble-cloud'),c=await player('C');
 // Plaza: everyone walks in the same spot; each line goes over its writer.
 await say(a.page,'Bom dia, praça!');await say(b.page,'Olá!');await say(c.page,'Quem vai pra arena?');
 await heard(c,'Bom dia, praça!');assert.equal(c.events.find(e=>e.type==='chat'&&e.message.text==='Bom dia, praça!').message.bubble,'bubble-royal');
 await c.page.waitForTimeout(400);await c.page.screenshot({path:`${output}/1-praca.png`});

 // PvP room: the balloon over the card of who wrote.
 await createArenaRoom(a.page);await a.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();
 const room=(await expect.poll(()=>a.events.filter(e=>e.type==='room'&&e.room).at(-1)?.room?.id).toBeTruthy(),a.events.filter(e=>e.type==='room'&&e.room).at(-1).room);
 await b.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();const search=b.page.getByRole('button',{name:'Pesquisar salas',exact:true});if(await search.isVisible())await search.click();
 await b.page.getByRole('textbox',{name:'Buscar sala'}).fill(room.name);await b.page.locator('.arena-room-entry').filter({hasText:room.name}).click();await expect(b.page.locator('.party-room')).toBeVisible();
 await say(b.page,'Pronto pra luta!','.party-room .party-chat');
 const card=a.page.locator(`.party-player-card[data-slot="1"]`);await expect(card.getByTestId('seat-speech')).toBeVisible();
 await a.page.waitForTimeout(400);await a.page.screenshot({path:`${output}/2-sala.png`});
 await expect(card.getByTestId('seat-speech')).toHaveCount(0,{timeout:8000});

 // Battle: Enter opens the battle chat; the balloon goes over the fighter.
 await c.page.locator('.lobby-chat').getByRole('textbox',{name:'Mensagem de chat'}).blur();
 await startPractice(c.page);await c.page.waitForTimeout(2500);
 await c.page.keyboard.press('Enter');const line=c.page.getByRole('textbox',{name:'Mensagem para a sala'});await expect(line).toBeFocused();
 await line.fill('Lá vai!');await line.press('Enter');await expect(line).toHaveCount(0);
 await expect(c.page.locator('.battle-chat-log')).toContainText('Lá vai!');await heard(c,'Lá vai!');
 await c.page.waitForTimeout(500);await c.page.screenshot({path:`${output}/3-batalha.png`});
 assert.deepEqual(errors,[]);console.log('chat bubbles smoke ok:',output);
}finally{await browser.close();await db.end();}
