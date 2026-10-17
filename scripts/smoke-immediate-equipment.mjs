import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/immediate-equipment';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
// Delay only the delivery of correlated acknowledgements to exercise rapid UI
// input and unmounting while the real server/PostgreSQL commits each transaction.
await page.addInitScript(()=>{
 window.equipmentCommands=[];window.equipmentReplies=[];
 const descriptor=Object.getOwnPropertyDescriptor(WebSocket.prototype,'onmessage'),send=WebSocket.prototype.send;
 Object.defineProperty(WebSocket.prototype,'onmessage',{...descriptor,set(handler){
  descriptor.set.call(this,event=>{
   let data;try{data=JSON.parse(event.data);}catch{}
   const deliver=()=>{if(data?.requestId)window.equipmentReplies.push(data);handler?.call(this,event);};
   if(data?.requestId)setTimeout(deliver,500);else deliver();
  });
 }});
 WebSocket.prototype.send=function(raw){
  let data;try{data=JSON.parse(raw);}catch{}
  if(data?.type==='customize'){
   window.equipmentCommands.push(data);
   if(window.rejectNextEquipment){window.rejectNextEquipment=false;data.selection.items.face='face-wink';raw=JSON.stringify(data);}
  }
  return send.call(this,raw);
 };
});
const profile=async()=>(await (await context.request.get(base+'/api/session')).json()).profile;
async function bag(){await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();return page.getByRole('dialog',{name:'Mochila',exact:true});}
async function settled(dialog){await expect(dialog.locator('.equipment-status')).toHaveText('Visual equipado',{timeout:15000});}
try{
 await enterGame(page,base);let dialog=await bag();
 await expect(dialog.getByRole('button',{name:'Salvar personalização',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Restaurar visual',exact:true})).toHaveCount(0);
 await expect(dialog.locator('.appearance-remove')).toHaveCount(0);
 // All clicks occur before the first acknowledgement is delivered.
 await dialog.locator('.bag-grid').evaluate(grid=>{
  const pick=name=>{const button=[...grid.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===name);if(!button)throw Error(name);button.click();};
  pick('Pintinho do Trovão');pick('Raposa Arcana');pick('Pintinho do Trovão');pick('Raposa Arcana');
 });
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect.poll(async()=>(await profile()).equipment.costume,{timeout:15000}).toBe('costume-arcane-fox');
 await expect.poll(()=>page.evaluate(()=>window.equipmentReplies.length)).toBe(2);
 assert.equal(await page.evaluate(()=>window.equipmentCommands.length),2,'rapid clicks coalesce behind one active transaction');
 assert.deepEqual(await page.evaluate(()=>window.equipmentReplies.map(reply=>reply.type)),['profile','profile']);
 checks.push('Four rapid clicks become two committed transactions; closing the inventory preserves the final choice');
 dialog=await bag();await settled(dialog);
 await dialog.getByRole('button',{name:'Exibição do personagem',exact:true}).click();
 const options=dialog.getByRole('dialog',{name:'Exibição do personagem',exact:true});
 await options.evaluate(popup=>{
  for(const text of ['Exibir chapéu','Exibir óculos','Exibir fantasia']){
   const label=[...popup.querySelectorAll('label')].find(label=>label.textContent.includes(text));label.querySelector('input').click();
  }
 });
 await options.getByRole('button',{name:'Fechar exibição',exact:true}).click();await settled(dialog);
 let saved=await profile();assert.deepEqual(saved.equipment.visibility,{hat:false,glasses:false,costume:false});
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await enterGame(page,base);dialog=await bag();
 assert.deepEqual((await profile()).equipment,saved.equipment);
 checks.push('Rapid visibility changes merge with all equipped slots and survive reload without Save');
 await dialog.locator('[data-slot="costume"]').dblclick();await settled(dialog);assert.equal((await profile()).equipment.costume,'costume-none');
 checks.push('Double-clicking an equipped slot unequips immediately without a trash button');
 await dialog.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('costume');
 saved=await profile();await page.evaluate(()=>{window.rejectNextEquipment=true;});
 await dialog.locator('.bag-grid').getByRole('button',{name:'Pintinho do Trovão',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();await settled(dialog);
 assert.deepEqual((await profile()).equipment,saved.equipment,'a rejected transaction keeps the committed equipment');
 await expect(dialog.locator('[data-slot="costume"]')).toHaveAttribute('aria-label','Fantasia: Vazio');
 checks.push('Correlated server rejection rolls back the optimistic selection without changing the saved profile');
 await page.getByRole('button',{name:'Fechar aviso',exact:true}).click();
 await dialog.locator('.bag-grid').getByRole('button',{name:'Raposa Arcana',exact:true}).click();await settled(dialog);
 assert.equal((await profile()).equipment.costume,'costume-arcane-fox');
 checks.push('A valid selection succeeds after rejection');
 await dialog.getByRole('combobox',{name:'Categoria',exact:true}).selectOption('all');await page.screenshot({path:`${output}/inventory.png`});
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await page.locator('.player-hud').screenshot({path:`${output}/lobby-portrait.png`});
 assert.deepEqual(errors,[]);const report={passed:true,base,checks,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}
