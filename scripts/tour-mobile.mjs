// Visits every screen at phone landscape sizes and saves screenshots plus a list of tap targets smaller than 40 px.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame,createArenaRoom,startPractice} from './character-helpers.mjs';
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/mobile-tour';
const sizes=(process.env.SIZES??'667x375,844x390').split(',').map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const report={};
const DOCK=['Mochila','Loja','Leilão','Ferreiro','Pets','Missões','Correio','Guilda','Hall da Fama','Ajustes','Expedições','Arena'];
async function smallTargets(page){return page.evaluate(()=>[...document.querySelectorAll('button,[role=button],[role=tab],input,select,a')].filter(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&(r.width<36||r.height<36);}).map(el=>{const r=el.getBoundingClientRect();return `${el.getAttribute('aria-label')||el.textContent?.trim().slice(0,24)||el.className} ${Math.round(r.width)}x${Math.round(r.height)}${r.right>innerWidth+1||r.bottom>innerHeight+1||r.left<-1||r.top<-1?' FORA':''}`;}));}
async function shot(page,size,name){const file=`${output}/${size.width}-${name}.png`;await page.waitForTimeout(500);await page.screenshot({path:file});(report[`${size.width}-${name}`]=await smallTargets(page));}
async function closeAll(page){for(let i=0;i<3;i++){const close=page.locator('[role=dialog] button[aria-label="Fechar"]:visible').last();if(await close.count()){await close.click({force:true}).catch(()=>{});await page.waitForTimeout(250);}else{await page.keyboard.press('Escape');await page.waitForTimeout(150);}}}
for(const size of sizes){
 const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();
 await enterGame(page,base);await page.waitForTimeout(3000);await shot(page,size,'lobby');
 for(const name of DOCK){
  const button=page.locator('.bottom-dock').getByRole('button',{name,exact:true});
  if(!await button.count())continue;
  try{await button.click({force:true,timeout:3000});await shot(page,size,name.replace(/\s/g,'-').toLowerCase());}catch(e){report[`${size.width}-${name}`]=['ERRO '+e.message.split('\n')[0]];}
  if(name==='Arena'||name==='Expedições'){const leave=page.getByRole('button',{name:name==='Arena'?'Sair da arena':/Sair/}).first();if(await leave.count())await leave.click({force:true}).catch(()=>{});}
  await closeAll(page);
 }
 try{await createArenaRoom(page);await shot(page,size,'sala');await startPractice(page);await page.waitForTimeout(2500);await shot(page,size,'batalha');}catch(e){report[`${size.width}-batalha`]=['ERRO '+e.message.split('\n')[0]];await page.screenshot({path:`${output}/${size.width}-erro.png`});}
 await context.close();
}
await writeFile(`${output}/small-targets.json`,JSON.stringify(report,null,1));await browser.close();console.log('ok');
