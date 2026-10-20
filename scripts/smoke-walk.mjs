// Caminhada no jogo real (servidor autoritativo): segura D/A no HUD da batalha, confere passos de 3 px,
// velocidade, vigor só por passo dado, parede dos presentes no Sonho Nevado e as guias do ?walk=1.
// Uso: npm run test:walk:browser  (BASE_URL e OUT opcionais)
import {enterGame} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/walk-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1536,height:864}});
const page=await context.newPage(),events=[],errors=[];
await context.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native {constructor(...args){super(...args);if(new URL(String(args[0]),location.href).pathname==='/ws')window.__walkSocket=this;}};});
page.on('pageerror',error=>errors.push(error.message));
page.on('websocket',socket=>socket.on('framereceived',frame=>{try{events.push({at:Date.now(),...JSON.parse(String(frame.payload))});}catch{}}));
const send=command=>page.evaluate(command=>window.__walkSocket.send(JSON.stringify(command)),command);
async function waitEvent(journal,type,predicate=()=>true,after=0,timeout=15000){
 await expect.poll(()=>journal.slice(after).some(event=>event.type===type&&predicate(event)),{timeout,message:`waiting for ${type}`}).toBe(true);
 return journal.slice(after).find(event=>event.type===type&&predicate(event));
}
let partner;
try{
 const response=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'male'})});
 const cookie=response.headers.get('set-cookie').split(';')[0],{profile:other}=await response.json(),journal=[];
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base,headers:{Cookie:cookie}});socket.on('message',raw=>journal.push(JSON.parse(raw.toString())));
 partner={socket,profile:other,send:command=>{const mark=journal.length;socket.send(JSON.stringify(command));return mark;},journal};
 await waitEvent(journal,'welcome');
 await enterGame(page,base);await page.goto(base+'/?walk=1');await expect(page.locator('.bottom-dock')).toBeVisible({timeout:15000});
 const me=(await waitEvent(events,'welcome')).profile;
 let mark=events.length;await send({type:'create',practice:true,name:'TEST Walk',mode:'1v1',map:'snow'});const room=(await waitEvent(events,'room',event=>!!event.room,mark)).room;
 await waitEvent(journal,'room',event=>event.room?.id===room.id,partner.send({type:'join',roomId:room.id}));await waitEvent(journal,'room',event=>event.room?.players.some(p=>p.id===other.id&&p.ready),partner.send({type:'ready'}));
 mark=events.length;await send({type:'start'});
 // The partner passes until it is our turn.
 for(let i=0;i<4;i++){const battle=(await waitEvent(events,'battle',event=>event.battle?.phase==='aiming',mark,40000)).battle;if(battle.turnId===me.id)break;mark=events.length;partner.send({type:'pass'});}
 await expect(page.locator('.battle-top')).toBeVisible({timeout:40000});await page.waitForTimeout(2500);
 const mine=()=>events.filter(event=>event.type==='battle'&&event.battle).map(event=>({at:event.at,...event.battle.players.find(p=>p.id===me.id)}));
 const start=mine().at(-1);assert.equal(start.facing,1);
 // Right: open ground. Hold D for 2 s.
 await page.keyboard.down('d');await page.waitForTimeout(2000);await page.keyboard.up('d');await page.waitForTimeout(400);
 const right=mine().filter(p=>p.at>=start.at);const moved=right.at(-1).x-start.x,spent=start.stamina-right.at(-1).stamina;
 for(let n=1;n<right.length;n++){const dx=right[n].x-right[n-1].x;assert.equal(dx%3,0,`steps of 3 px (${dx})`);assert.ok(dx<=9);}
 assert.equal(spent*3,moved,'one vigor per 3 px step');
 const speed=moved/2;assert.ok(speed>70&&speed<100,`about 89 px/s (${speed})`);
 await page.screenshot({path:`${output}/open-ground.png`});
 // Left: back past the spawn into the gift boxes; the walk stops at their foot and stops charging.
 await page.keyboard.down('a');await page.waitForTimeout(4500);
 const stuck=mine().at(-1);await page.waitForTimeout(800);const later=mine().at(-1);await page.keyboard.up('a');
 assert.equal(later.x,stuck.x,'the boxes are a wall');assert.equal(later.stamina,stuck.stamina,'pushing a wall costs nothing');
 assert.ok(stuck.x>980&&stuck.x<1010,`at the box foot (${stuck.x})`);
 await page.waitForTimeout(500);await page.screenshot({path:`${output}/gift-wall.png`});
 assert.deepEqual(errors,[]);
 const report={ok:true,base,speed,moved,spent,wall:{x:stuck.x,y:stuck.y}};await writeFile(`${output}/report.json`,JSON.stringify(report,null,1));console.log(JSON.stringify(report));
}finally{
 if(partner?.socket.readyState===WebSocket.OPEN){partner.send({type:'leave'});partner.socket.close();}await browser.close();
}
