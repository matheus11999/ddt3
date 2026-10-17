import {enterGame,createArenaRoom} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/rooms/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const clients=[],errors=[],checks=[];
function observe(client,page,label){
 page.on('pageerror',error=>errors.push(`${label}: ${error.message}`));
 page.on('websocket',socket=>{socket.on('framesent',frame=>{try{client.commands.push(JSON.parse(String(frame.payload)));}catch{}});socket.on('framereceived',frame=>{try{client.events.push(JSON.parse(String(frame.payload)));}catch{}});});
}
async function waitEvent(client,type,predicate=()=>true,after=0){
 await expect.poll(()=>client.events.slice(after).some(event=>event.type===type&&predicate(event)),{timeout:15000,message:`waiting for actual ${type} event`}).toBe(true);
 return client.events.slice(after).find(event=>event.type===type&&predicate(event));
}
async function openClient(label){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),client={context,page,events:[],commands:[]};clients.push(client);
 observe(client,page,label);
 await enterGame(page,base);await expect(page.locator('.bottom-dock')).toBeVisible();
 client.profile=(await waitEvent(client,'welcome')).profile;
 await page.getByRole('button',{name:'Configurações',exact:true}).click();const settings=page.getByRole('dialog',{name:'Ajustes'}),name=`TEST-SALA-${label}-${client.profile.id.slice(0,5)}`;
 await settings.getByLabel('Nome do aventureiro').fill(name);const mark=client.events.length;await settings.getByRole('button',{name:'Salvar nome',exact:true}).click();client.profile=(await waitEvent(client,'profile',event=>event.profile.name===name,mark)).profile;await settings.getByRole('button',{name:'Fechar',exact:true}).click();
 return client;
}
async function createRoom(client){
 const mark=client.events.length;await createArenaRoom(client.page);
 const room=(await waitEvent(client,'room',event=>!!event.room,mark)).room;
 assert.equal(room.name,`Sala de ${client.profile.name}`.slice(0,24));assert.deepEqual(room.openSlots,[0]);assert.ok(Number.isInteger(room.number)&&room.number>0,'room number is authoritative');await expect(client.page.locator('.party-room-number strong')).toHaveText(String(room.number));await expect(client.page.getByRole('button',{name:'Mensagens',exact:true})).toHaveCount(0);await expect(client.page.locator('.party-slot-toggle')).toHaveText(['','','']);
 assert.deepEqual(client.commands.filter(command=>command.type==='create').at(-1),{type:'create'},'the server assigns name and initial slots without a creation form');
 await client.page.screenshot({path:`${output}/creation-${client.profile.id.slice(0,5)}.png`});
 return room;
}
async function enterRoom(client,name){
 await client.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();const search=client.page.getByRole('button',{name:'Pesquisar salas',exact:true});if(await search.isVisible())await search.click();await client.page.getByRole('textbox',{name:'Buscar sala'}).fill(name);const mark=client.events.length;
 await client.page.locator('.arena-room-entry').filter({hasText:name}).click();return (await waitEvent(client,'room',event=>event.room?.name===name,mark)).room;
}
async function inViewport(page,locator){
 await locator.scrollIntoViewIfNeeded();await expect(locator).toBeVisible();
 await expect.poll(async()=>{const bounds=await locator.boundingBox(),viewport=page.viewportSize();return !!bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1;},{message:'interactive control fits the viewport'}).toBe(true);
}
async function chat(sender,receiver,text){
 const room=sender.page.locator('.party-room'),mark=receiver.events.length;
 await inViewport(sender.page,room.getByRole('textbox',{name:'Mensagem de chat'}));await room.getByRole('button',{name:'Sala',exact:true}).click();await room.getByRole('textbox',{name:'Mensagem de chat'}).fill(text);await room.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await waitEvent(receiver,'chat',event=>event.message.channel==='room'&&event.message.text===text,mark);
 await expect(receiver.page.locator('.party-room .chat-messages')).toContainText(text);
}
async function leave(client){
 const roomExit=client.page.getByRole('button',{name:'Sair da sala',exact:true}),battleExit=client.page.getByRole('button',{name:'Sair da batalha',exact:true}),lobby=client.page.locator('.bottom-dock');
 for(let attempt=0;attempt<5;attempt++){
  if(await lobby.isVisible())return;
  if(await roomExit.isVisible()){
   const mark=client.events.length;await roomExit.click();await waitEvent(client,'room',event=>event.room===null,mark);await expect(lobby).toBeVisible({timeout:15000});return;
  }
  if(await client.page.locator('.battle-reward-overlay').isVisible()){
   await expect(roomExit).toBeVisible({timeout:15000});continue;
  }
  if(await battleExit.isVisible()){
   const mark=client.events.length;
   try{
    await battleExit.click({timeout:2000});await client.page.getByRole('button',{name:'Sair',exact:true}).click({timeout:2000});
    await waitEvent(client,'room',event=>event.room===null,mark);
    // Once leave is acknowledged, a result overlay must not reopen the battle.
    await expect(lobby).toBeVisible({timeout:15000});return;
   }catch(error){
    if(client.events.slice(mark).some(event=>event.type==='room'&&event.room===null))throw error;
    if(await client.page.locator('.battle-finished,.battle-reward-overlay,.party-room').count())continue;
    throw error;
   }
  }
  // A result transition can temporarily expose neither combat nor room controls.
  // Never treat that visual gap as a successful leave without a server ACK.
  await expect.poll(async()=>await lobby.isVisible()||await roomExit.isVisible()||await battleExit.isVisible()||await client.page.locator('.battle-reward-overlay').isVisible(),{timeout:15000}).toBe(true);
 }
 throw new Error('Could not leave the room after the authoritative result');
}

try{
 const host=await openClient('H'),guest=await openClient('G');
 let room=await createRoom(host);let roomName=room.name;assert.equal(room.mode,'1v1');assert.equal(room.players.length,1);
 await expect(host.page.locator('.arena-room-stage.compact-party-room')).toBeVisible();await expect(host.page.locator('.arena-player-card')).toHaveCount(4);await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeEnabled();
 await expect(host.page.getByRole('button',{name:/Adicionar bot|Fechar posição|Abrir posição/})).toHaveCount(0);
 await expect(host.page.locator('[data-slot-state="closed"]')).toHaveCount(3);await expect(host.page.locator('.party-card-abilities')).toHaveCount(0);await expect(host.page.locator('.preparation-loadout [data-loadout-slot]')).toHaveCount(3);
 await expect(host.page.locator('.party-slot-number,.party-card-badges,.party-room>.party-heading .party-presence')).toHaveCount(0);
 await expect(host.page.getByRole('button',{name:'Sair da sala',exact:true})).toHaveText('');await expect(host.page.getByRole('button',{name:'Sair da sala',exact:true})).toHaveAttribute('title','Sair da sala');
 await host.page.getByRole('button',{name:'Renomear sala',exact:true}).click();await host.page.getByRole('textbox',{name:'Nome da sala',exact:true}).fill('x');await expect(host.page.getByRole('button',{name:'Confirmar nome da sala',exact:true})).toBeDisabled();await host.page.getByRole('textbox',{name:'Nome da sala',exact:true}).fill(`Equipe ${host.profile.id.slice(0,7)}`);const renameMark=host.events.length;await host.page.getByRole('button',{name:'Confirmar nome da sala',exact:true}).click();room=(await waitEvent(host,'room',event=>event.room?.name===`Equipe ${host.profile.id.slice(0,7)}`,renameMark)).room;roomName=room.name;await expect(host.page.locator('.party-room-name h1')).toHaveText(roomName);
 const roomBounds=await host.page.locator('.party-room').boundingBox();assert.ok(roomBounds&&Math.abs(roomBounds.width-1536)<2&&Math.abs(roomBounds.height-864)<2,'waiting room fills the viewport');
 await host.page.setViewportSize({width:2050,height:1056});await expect.poll(async()=>Math.round((await host.page.locator('.party-room').boundingBox()).width)).toBe(2050);const wideCards=await host.page.locator('.party-player-card').evaluateAll(cards=>cards.map(card=>{const r=card.getBoundingClientRect();return {width:r.width,height:r.height};}));assert.ok(wideCards.every(card=>Math.abs(card.width/card.height-.8)<.025&&card.width<=310),'cards remain narrow with a 4:5 frame and moderate size on a wide monitor');await host.page.screenshot({path:`${output}/room-wide-monitor.png`});await host.page.setViewportSize({width:1536,height:864});
 const cardBoxes=await host.page.locator('.party-player-card').evaluateAll(cards=>cards.map(card=>{const box=card.getBoundingClientRect();return {x:box.x,y:box.y,bottom:box.bottom};}));assert.equal(cardBoxes[0].y,cardBoxes[1].y);assert.equal(cardBoxes[2].y,cardBoxes[3].y);assert.ok(cardBoxes[2].y>cardBoxes[0].bottom,'allied seats form two distinct rows');
 await expect(host.page.getByRole('button',{name:'Convidar',exact:true})).toBeDisabled();
 await host.page.getByRole('button',{name:'Equipamentos',exact:true}).click();const inventory=host.page.getByRole('dialog',{name:'Mochila',exact:true});await expect(inventory).toBeVisible();await inventory.getByRole('button',{name:'Fechar',exact:true}).click();await expect(inventory).toHaveCount(0);await expect(host.page.locator('.compact-party-room')).toBeVisible();
 await host.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();await expect(host.page.locator('[data-slot="1"]')).toHaveAttribute('data-slot-state','open');await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeDisabled();await expect(host.page.getByRole('button',{name:'Treinar com bots',exact:true})).toBeEnabled();
 await host.page.getByRole('button',{name:'Convidar',exact:true}).click();const invite=host.page.getByRole('dialog',{name:'Convidar para a sala'});await expect(invite).toBeVisible();await expect(invite.getByRole('button',{name:`Convidar ${guest.profile.name}`,exact:true})).toBeVisible();await expect(invite.getByRole('textbox',{name:'Link da sala'})).toHaveCount(0);await host.page.screenshot({path:`${output}/invite-popover.png`});await invite.getByRole('button',{name:'Fechar convite',exact:true}).click();
 room=await enterRoom(guest,roomName);assert.equal(room.mode,'2v2');assert.ok(room.players.every(player=>player.team===0));
 await expect(guest.page.getByRole('button',{name:'Renomear sala',exact:true})).toHaveCount(0);await expect(host.page.locator('.party-player-state')).toHaveCount(1);
 await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeDisabled();await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeEnabled();
 await expect(host.page.locator('.arena-player-card[data-slot-state="occupied"]')).toHaveCount(2);
 for(const card of await host.page.locator('.arena-player-card').all())await inViewport(host.page,card);
 const avatar=host.page.locator('.party-player-portrait>canvas').first();await host.page.waitForTimeout(500);const still=await avatar.evaluate(canvas=>canvas.toDataURL());await host.page.waitForTimeout(700);assert.equal(await avatar.evaluate(canvas=>canvas.toDataURL()),still,'room character does not float or animate');
 await chat(host,guest,'Equipe pronta para a arena');await chat(guest,host,'Mensagem recebida na sala');await host.page.screenshot({path:`${output}/party-desktop.png`});
 checks.push('one-click creation, host rename with validated length and broadcast; three initially closed seats; host opens a seat before join; four allied cards with ready-only seals, separate preparation tray, static portraits and two-way chat');
 await expect(host.page.getByRole('button',{name:`Expulsar ${host.profile.name}`,exact:true})).toHaveCount(0);await expect(guest.page.getByRole('button',{name:/^Expulsar /})).toHaveCount(0);
 let mark=host.events.length,guestMark=guest.events.length;await host.page.getByRole('button',{name:`Expulsar ${guest.profile.name}`,exact:true}).click();room=(await waitEvent(host,'room',event=>event.room?.players.length===1,mark)).room;assert.equal(room.mode,'2v2');await waitEvent(guest,'room',event=>event.room===null,guestMark);await expect(guest.page.locator('.bottom-dock')).toBeVisible();
 mark=host.events.length;await host.page.getByRole('button',{name:'Fechar vaga 2',exact:true}).click();room=(await waitEvent(host,'room',event=>event.room?.openSlots.length===1,mark)).room;assert.equal(room.mode,'1v1');await host.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();await expect(host.page.locator('[data-slot="1"]')).toHaveAttribute('data-slot-state','open');
 await guest.page.reload({waitUntil:'networkidle'});room=await enterRoom(guest,roomName);assert.equal(room.players.find(player=>player.id===guest.profile.id).ready,false);await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();
 checks.push('host kick preserves the open seat; closing changes capacity; reopening and rejoining require fresh readiness');
 mark=host.events.length;await host.page.getByRole('button',{name:'Buscar partida',exact:true}).click();await waitEvent(host,'room',event=>event.room?.status==='searching',mark);
 await expect(host.page.getByRole('button',{name:'Equipamentos',exact:true})).toBeDisabled();await expect(host.page.getByRole('button',{name:/^Expulsar /})).toHaveCount(0);await host.page.screenshot({path:`${output}/searching.png`});
 mark=host.events.length;await guest.page.getByRole('button',{name:'Voltar a preparar',exact:true}).click();await waitEvent(host,'room',event=>event.room?.status==='waiting',mark);await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeDisabled();
 await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();await host.page.getByRole('button',{name:'Buscar partida',exact:true}).click();await expect(host.page.getByRole('button',{name:'Cancelar busca',exact:true})).toBeVisible();await host.page.getByRole('button',{name:'Cancelar busca',exact:true}).click();await expect(host.page.getByRole('button',{name:'Buscar partida',exact:true})).toBeVisible();
 checks.push('search locks equipment and kicking; member readiness and host cancel both return the party to preparation');
 const desktopContext=host.context,mobileContext=await browser.newContext({storageState:await desktopContext.storageState(),viewport:{width:844,height:390},isMobile:true,hasTouch:true});await host.page.close();host.page=await mobileContext.newPage();observe(host,host.page,'H-mobile');await host.page.goto(base,{waitUntil:'domcontentloaded'});
 await expect(host.page.locator('.arena-room-portal .party-room')).toBeVisible();await expect(host.page.locator('html')).toHaveClass(/mobile-landscape/);await inViewport(host.page,host.page.getByRole('button',{name:'Sair da sala',exact:true}));await inViewport(host.page,host.page.getByRole('button',{name:'Buscar partida',exact:true}));await host.page.screenshot({path:`${output}/party-mobile-landscape.png`});await chat(host,guest,'Chat da equipe em paisagem');await host.page.screenshot({path:`${output}/party-mobile-chat.png`});await mobileContext.close();host.page=await desktopContext.newPage();observe(host,host.page,'H-return');await host.page.goto(base,{waitUntil:'domcontentloaded'});await expect(host.page.locator('.party-room')).toBeVisible();
 checks.push('the same host session reconnects on a real touch landscape context; exit, queue and two-way chat remain usable');
 const opponent=await openClient('O'),ally=await openClient('A'),opponentRoom=await createRoom(opponent),opponentName=opponentRoom.name;
 await opponent.page.getByRole('button',{name:'Abrir vaga 2',exact:true}).click();await expect(opponent.page.locator('[data-slot="1"]')).toHaveAttribute('data-slot-state','open');await enterRoom(ally,opponentName);await ally.page.getByRole('button',{name:'Estou pronto',exact:true}).click();if(await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).isVisible())await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();
 const marks=clients.map(client=>client.events.length);await host.page.getByRole('button',{name:'Buscar partida',exact:true}).click();await opponent.page.getByRole('button',{name:'Buscar partida',exact:true}).click();
 const battles=await Promise.all(clients.map((client,index)=>waitEvent(client,'battle',event=>!!event.battle,marks[index])));const battle=battles[0].battle;
 assert.equal(battle.players.length,4);assert.deepEqual([...new Set(battles.map(event=>event.battle.id))],[battle.id]);assert.ok(['garden','park','celestial'].includes(battle.map));assert.equal(battle.players.filter(player=>player.team===0).length,2);assert.equal(battle.players.filter(player=>player.team===1).length,2);assert.ok(battle.players.every(player=>!player.bot));
 for(const client of clients)await expect(client.page.locator('.battle-console')).toBeVisible();await host.page.screenshot({path:`${output}/matchmade-battle.png`});
 checks.push('two ready parties find a real 2v2 on the same server-selected random map without bots');
 for(const client of clients)await leave(client);
 for(const client of clients){await expect(client.page.locator('.bottom-dock')).toBeVisible();assert.deepEqual(client.events.filter(event=>event.type==='error'&&event.message!=='Você foi removido da sala pelo líder.'),[]);}
 assert.deepEqual(errors,[]);const report={ok:true,base,checks,testPlayerIds:clients.map(client=>client.profile.id)};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){for(const [index,client] of clients.entries())await client.page.screenshot({path:`${output}/failure-${index}.png`}).catch(()=>{});throw error;}
finally{for(const client of clients)await leave(client).catch(()=>{});await browser.close();}
