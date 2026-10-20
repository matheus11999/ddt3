// Prévia do Salão PvP e da Central de Expedições (com salas e vazios), com dados de exemplo.
// Uso: node scripts/preview-halls.mjs  (BASE_URL, OUT, SIZES e CHROME_PATH opcionais)
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/halls-preview';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const sizes=(process.env.SIZES??'desktop:1536x864,mobile:844x390').split(',').map(entry=>{const [name,size]=entry.split(':'),[width,height]=size.split('x').map(Number);return {name,viewport:{width,height},mobile:name==='mobile'||name==='small'};});
async function fixture(page,kind,empty){
 await page.evaluate(async ({kind,empty})=>{
  const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);
  client.stop();client.send=()=>{};
  const p=client.state.profile,eq=p.equipment,seat=(id,name,level,slot)=>({id,name,level,equipment:eq,ready:true,bot:false,team:0,slot,connected:true});
  const room=(id,number,name,size,status,count)=>({id,number,name,hostId:id+'0',mode:kind==='pvp'?`${size}v${size}`:'expedition',openSlots:Array.from({length:size},(_,i)=>i),map:'snow',status,spectatorSlots:[0],spectators:[],players:Array.from({length:count},(_,i)=>seat(id+i,i?`Aliado ${i}`:`Líder ${number}`,10+i,i)),matchStartedAt:status==='playing'?Date.now()-125000:undefined,...(kind==='pvp'?{}:{kind:'expedition',expedition:{id:'anthill',difficulty:'easy',stage:0}})});
  const rooms=empty?[]:kind==='pvp'?[room('a',1,'Cavaleiros da Brasa',2,'waiting',1),room('b',2,'Clã dos Dragões',3,'searching',3),room('c',3,'Heróis do Crepúsculo',4,'playing',4),room('d',4,'Duelo da Aurora',1,'waiting',1)]:[room('a',1,'Rumo ao Formigueiro',4,'waiting',2),room('b',2,'Caçadores',4,'playing',4)];
  client.update({onlineTotal:12,onlinePlayers:[[p.id,p.name,p.level,p.gender],['o1','Ptech',63,'male'],['o2','Rosa Brava',55,'female'],['o3','Vanted',44,'male'],['o4','Chazão',38,'male'],['o5','Stormnight',27,'female'],['o6','Richadr',21,'male'],['o7','Gustavo',14,'male'],['o8','Lua Cheia',12,'female'],['o9','Reizin',9,'male'],['o10','Mel',5,'female'],['o11','Tico',2,'male']].map(([id,name,level,gender])=>({id,name,level,gender})).sort((a,b)=>b.level-a.level),status:'online',arenaOnline:17,room:null,battle:null,rooms});
 },{kind,empty});
 await page.waitForTimeout(1500);
}
for(const {name,viewport,mobile} of sizes){
 const context=await browser.newContext({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();await page.locator('.arena-hall').waitFor();
 await fixture(page,'pvp',false);await page.screenshot({path:`${output}/pvp-${name}.png`});
 await fixture(page,'pvp',true);await page.screenshot({path:`${output}/pvp-empty-${name}.png`});
 await page.locator('.hall-back').click();await page.waitForTimeout(500);
 await page.locator('.bottom-dock').getByRole('button',{name:/^Expedições(?:\s|$)/}).click();await page.locator('.expedition-hall').waitFor();
 await fixture(page,'expedition',false);await page.screenshot({path:`${output}/exp-${name}.png`});
 await fixture(page,'expedition',true);await page.screenshot({path:`${output}/exp-empty-${name}.png`});
 await context.close();
}
await browser.close();
