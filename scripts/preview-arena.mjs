// Prévia visual do salão PvP e da sala (desktop e celular em paisagem) com dados de exemplo.
// Uso: node scripts/preview-arena.mjs  (BASE_URL, OUT e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/arena-preview';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const sizes=(process.env.SIZES??'desktop:1536x864,laptop:1280x720,mobile:844x390,small:667x375').split(',').map(entry=>{const [name,size]=entry.split(':'),[width,height]=size.split('x').map(Number);return {name,viewport:{width,height},mobile:name==='mobile'||name==='small'};});
// Dados de exemplo injetados no cliente local, sem enviar nada ao servidor.
async function fixture(page,kind){
 await page.evaluate(async kind=>{
  const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
  client.stop();client.send=()=>{};
  const p=client.state.profile,eq=p.equipment,seat=(id,name,level,slot,extra={})=>({id,name,level,equipment:{...eq,...extra},ready:slot!==2,bot:false,team:0,slot,connected:true});
  const room=(id,number,name,size,status,count)=>({id,number,name,hostId:id+'0',mode:`${size}v${size}`,openSlots:Array.from({length:size},(_,i)=>i),map:'garden',status,spectatorSlots:[0],spectators:[],players:Array.from({length:count},(_,i)=>seat(id+i,i?`Aliado ${i}`:`Líder ${number}`,10+i,i)),matchStartedAt:status==='playing'?Date.now()-125000:undefined});
  if(kind==='hall')client.update({onlineTotal:12,onlinePlayers:[[p.id,p.name,p.level,p.gender],['o1','Ptech',63,'male'],['o2','Rosa Brava',55,'female'],['o3','Vanted',44,'male'],['o4','Chazão',38,'male'],['o5','Stormnight',27,'female'],['o6','Richadr',21,'male'],['o7','Gustavo',14,'male'],['o8','Lua Cheia',12,'female'],['o9','Reizin',9,'male'],['o10','Mel',5,'female'],['o11','Tico',2,'male']].map(([id,name,level,gender])=>({id,name,level,gender})).sort((a,b)=>b.level-a.level),status:'online',arenaOnline:17,room:null,battle:null,rooms:[room('a',1,'Cavaleiros da Brasa',2,'waiting',1),room('b',2,'Clã dos Dragões',3,'searching',3),room('c',3,'Heróis do Crepúsculo',4,'playing',4),room('d',4,'Duelo da Aurora',1,'waiting',1),room('e',5,'Força da Maré',4,'waiting',2),room('f',6,'Guardiões do Vale',2,'playing',2),room('g',7,'Sala de Aventureiro',3,'waiting',1)]});
  else{
   const players=[seat(p.id,p.name,34,0,{upgrade:12}),seat('x1','Valentina',52,1,{upgrade:9}),seat('x2','Bruno',18,2,{upgrade:5})];
   client.update({status:'online',battle:null,room:{id:'r1',number:7,name:'Cavaleiros da Brasa',hostId:p.id,mode:'4v4',openSlots:[0,1,2,3],map:'garden',status:'waiting',players,spectatorSlots:[0],spectators:[{id:'s1',name:'Espiã',slot:0,connected:true}]}});
  }
 },kind);
 await page.waitForTimeout(1500);
}
for(const {name,viewport,mobile} of sizes){
 const context=await browser.newContext({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();await page.locator('.arena-hall').waitFor();
 await fixture(page,'hall');await page.screenshot({path:`${output}/hall-${name}.png`});
 await fixture(page,'room');await page.locator('.party-room').waitFor();await page.waitForTimeout(800);await page.screenshot({path:`${output}/room-${name}.png`});
 await context.close();
}
await browser.close();
