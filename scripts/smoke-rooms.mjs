import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/rooms/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const clients=[],errors=[],checks=[];
async function waitEvent(client,type,predicate=()=>true,after=0){
 await expect.poll(()=>client.events.slice(after).some(event=>event.type===type&&predicate(event)),{timeout:15000,message:`waiting for actual ${type} event`}).toBe(true);
 return client.events.slice(after).find(event=>event.type===type&&predicate(event));
}
async function openClient(label){
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),client={context,page,events:[],commands:[]};clients.push(client);
 page.on('pageerror',error=>errors.push(`${label}: ${error.message}`));
 page.on('websocket',socket=>{socket.on('framesent',frame=>{try{client.commands.push(JSON.parse(String(frame.payload)));}catch{}});socket.on('framereceived',frame=>{try{client.events.push(JSON.parse(String(frame.payload)));}catch{}});});
 await page.goto(base,{waitUntil:'networkidle'});await expect(page.locator('.bottom-dock')).toBeVisible();
 client.profile=(await waitEvent(client,'welcome')).profile;
 await page.getByRole('button',{name:'Configurações',exact:true}).click();const settings=page.getByRole('dialog',{name:'Ajustes'}),name=`TEST-SALA-${label}-${client.profile.id.slice(0,5)}`;
 await settings.getByLabel('Nome do aventureiro').fill(name);const mark=client.events.length;await settings.getByRole('button',{name:'Salvar nome',exact:true}).click();client.profile=(await waitEvent(client,'profile',event=>event.profile.name===name,mark)).profile;await settings.getByRole('button',{name:'Fechar',exact:true}).click();
 return client;
}
async function enterRoom(client,name){
 await client.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();await expect(client.page.locator('.arena-screen')).toBeVisible();
 await client.page.getByRole('textbox',{name:'Buscar sala'}).fill(name);const mark=client.events.length;
 await client.page.locator('.arena-room-entry').filter({hasText:name}).click();return (await waitEvent(client,'room',event=>event.room?.name===name,mark)).room;
}
async function chat(sender,receiver,text){
 const room=sender.page.locator('.arena-room-stage'),mark=receiver.events.length;
 await room.getByRole('button',{name:'Sala',exact:true}).click();await room.getByRole('textbox',{name:'Mensagem de chat'}).fill(text);await room.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await waitEvent(receiver,'chat',event=>event.message.channel==='room'&&event.message.text===text,mark);
 await expect(receiver.page.locator('.arena-room-stage .chat-messages')).toContainText(text);
}
async function inViewport(page,locator){
 await expect(locator).toBeVisible();
 await expect.poll(async()=>{const bounds=await locator.boundingBox(),viewport=page.viewportSize();return !!bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1;},{message:'interactive room control must fit the viewport after responsive layout settles'}).toBe(true);
}

try{
 const host=await openClient('H'),guest=await openClient('G'),roomName=`TEST Sala ${host.profile.id.slice(0,7)}`;
 await host.page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();await expect(host.page.locator('.arena-screen')).toBeVisible();
 await expect(host.page.getByRole('dialog',{name:'Arena de Brasa'})).toHaveCount(0);
 await host.page.getByRole('button',{name:'Criar sala',exact:true}).last().click();const form=host.page.locator('.create-panel');
 await form.getByLabel('Nome da sala').fill(roomName);await form.locator('.arena-mode-choices button').filter({hasText:'4 × 4'}).click();
 await form.getByRole('button',{name:'Fortaleza Celestial, Indestrutível',exact:true}).click();let mark=host.events.length;
 await form.getByRole('button',{name:'Criar sala',exact:true}).click();let room=(await waitEvent(host,'room',event=>event.room?.name===roomName,mark)).room;
 await expect(host.page.locator('.arena-room-stage.fullscreen-room')).toBeVisible();await expect(host.page.locator('.arena-player-card')).toHaveCount(8);
 const roomBounds=await host.page.locator('.arena-room-stage').boundingBox();assert.ok(roomBounds&&roomBounds.width>=1500&&roomBounds.height>=830,'the waiting room must use the stage instead of a dialog');
 await enterRoom(guest,roomName);await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();
 for(let count=3;count<=8;count++){
  mark=host.events.length;await host.page.getByRole('button',{name:'Adicionar bot',exact:true}).click();room=(await waitEvent(host,'room',event=>event.room?.players.length===count,mark)).room;
 }
 await expect(host.page.locator('.arena-player-card[data-slot-state="occupied"]')).toHaveCount(8);
 for(const card of await host.page.locator('.arena-player-card').all())await inViewport(host.page,card);
 await expect(host.page.getByRole('button',{name:`Expulsar ${host.profile.name}`,exact:true})).toHaveCount(0);await expect(guest.page.getByRole('button',{name:/^Expulsar /})).toHaveCount(0);
 await inViewport(host.page,host.page.getByRole('textbox',{name:'Mensagem de chat'}));await inViewport(guest.page,guest.page.getByRole('textbox',{name:'Mensagem de chat'}));
 await chat(host,guest,'Equipe pronta para a arena');await chat(guest,host,'Mensagem recebida na sala');await host.page.screenshot({path:`${output}/room-eight-and-chat.png`});
 checks.push('fullscreen arena creates four versus four with eight visible player cards and working two-way room chat');
 const slots=room.openSlots.slice(),guestSeat=room.players.find(player=>player.id===guest.profile.id),kickMark=host.commands.filter(command=>command.type==='kick').length,guestMark=guest.events.length;
 mark=host.events.length;await host.page.getByRole('button',{name:`Expulsar ${guest.profile.name}`,exact:true}).click();
 room=(await waitEvent(host,'room',event=>event.room?.players.length===7&&!event.room.players.some(player=>player.id===guest.profile.id),mark)).room;
 await waitEvent(guest,'room',event=>event.room===null,guestMark);await waitEvent(guest,'battle',event=>event.battle===null,guestMark);
 await expect(guest.page.locator('.bottom-dock')).toBeVisible();await expect(guest.page.locator('.arena-room-stage')).toHaveCount(0);await expect(guest.page.getByRole('alert')).toContainText('removido da sala');
 assert.deepEqual(room.openSlots,slots);assert.equal(room.mode,'4v4');assert.ok(room.players.filter(player=>!player.bot).every(player=>!player.ready));
 const kicks=host.commands.filter(command=>command.type==='kick');assert.equal(kicks.length,kickMark+1);assert.deepEqual(kicks.at(-1),{type:'kick',playerId:guest.profile.id});
 checks.push('only the waiting host sees kick, one click returns the guest to the lobby and preserves open slots');
 mark=guest.events.length;await guest.page.reload({waitUntil:'networkidle'});const resumed=await waitEvent(guest,'welcome',()=>true,mark);assert.equal(resumed.room,null);assert.equal(resumed.battle,null);
 room=await enterRoom(guest,roomName);const rejoined=room.players.find(player=>player.id===guest.profile.id);assert.equal(rejoined.team,guestSeat.team);assert.equal(rejoined.slot,guestSeat.slot);assert.equal(rejoined.ready,false);
 await guest.page.getByRole('button',{name:'Estou pronto',exact:true}).click();await expect(host.page.getByRole('button',{name:'Iniciar batalha',exact:true})).toBeEnabled();
 checks.push('reload after kick stays in the lobby; explicit rejoin restores the vacant position and requires readiness again');
 await host.page.setViewportSize({width:390,height:844});await expect(host.page.locator('.arena-room-portal .compact-arena-room')).toBeVisible();
 await inViewport(host.page,host.page.getByRole('textbox',{name:'Mensagem de chat'}));await inViewport(host.page,host.page.getByRole('button',{name:'Sair da sala',exact:true}));
 await chat(host,guest,'Chat da sala em tela compacta');await host.page.screenshot({path:`${output}/room-mobile-chat.png`});checks.push('390px room keeps chat and exit reachable and sends real messages');
 await host.page.getByRole('button',{name:'Sair da sala',exact:true}).click();await guest.page.getByRole('button',{name:'Sair da sala',exact:true}).click();
 for(const client of clients){await expect(client.page.locator('.bottom-dock')).toBeVisible();assert.deepEqual(client.events.filter(event=>event.type==='error'&&event.message!=='Você foi removido da sala pelo líder.'),[]);}
 assert.deepEqual(errors,[]);const report={ok:true,base,checks,testPlayerIds:clients.map(client=>client.profile.id)};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){for(const [index,client] of clients.entries())await client.page.screenshot({path:`${output}/failure-${index}.png`}).catch(()=>{});throw error;}
finally{for(const client of clients)await client.page.getByRole('button',{name:'Sair da sala',exact:true}).click({timeout:1000}).catch(()=>{});await browser.close();}
