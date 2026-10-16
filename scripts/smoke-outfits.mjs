import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL??'http://127.0.0.1:5177';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1536,height:960}}),observer=await browser.newContext();
await context.addInitScript(()=>{const Native=WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);window.outfitTestSocket=this;}};});
const page=await context.newPage(),peer=await observer.newPage(),events=[],errors=[];
for(const p of [page,peer])p.on('pageerror',e=>errors.push(e.message));
peer.on('websocket',ws=>ws.on('framereceived',frame=>{try{events.push(JSON.parse(String(frame.payload)));}catch{}}));
const profile=async()=>{const r=await context.request.get(base+'/api/session');assert.equal(r.status(),200);return (await r.json()).profile;};
try{
 await peer.goto(base,{waitUntil:'networkidle'});await page.goto(base,{waitUntil:'networkidle'});
 await expect(page.locator('.bottom-dock')).toBeVisible();
 const initial=await profile();
 assert.equal(initial.inventory.filter(id=>id.startsWith('outfit-')).length,2,'Only the two current costumes remain in inventory');
 await page.evaluate(name=>window.outfitTestSocket.send(JSON.stringify({type:'rename',name})),`TEST-OUTFIT-${initial.id.slice(0,6)}`);
 for(const [id,name] of [['outfit-executive','Executivo'],['outfit-surfer','Surfista da Maré'],['outfit-executive','Executivo']]){
  await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();
  const bag=page.getByRole('dialog',{name:'Mochila'});
  await bag.getByRole('combobox',{name:'Categoria'}).selectOption('outfit');
  const before=(await profile()).equipment.outfit,marker=events.length;
  await bag.getByRole('button',{name,exact:true}).dblclick();
  assert.equal((await profile()).equipment.outfit,before,'Trying on outfit stays local until saved');
  await page.screenshot({path:`test-results/${id}-inventory.png`});
  await bag.getByRole('button',{name:'Salvar personalização'}).click();
  await expect(bag.getByText('Visual salvo',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await profile()).equipment.outfit).toBe(id);
  await expect.poll(()=>events.slice(marker).some(e=>e.type==='lobby'&&e.players.some(p=>p.id===initial.id&&p.equipment.outfit===id))).toBe(true);
  await bag.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.reload({waitUntil:'networkidle'});await expect(page.locator('.bottom-dock')).toBeVisible();
  const saved=(await profile()).equipment;assert.equal(saved.outfit,id);for(const slot of ['face','hair','hat','glasses'])assert.equal(saved[slot],initial.equipment[slot]);
 }
 await page.locator('.bottom-dock').getByRole('button',{name:/Arena/}).click();await page.getByRole('button',{name:'Treinar com bot',exact:true}).click();
 await expect(page.locator('.battle-console')).toBeVisible({timeout:15000});
 await page.screenshot({path:'test-results/outfit-executive-battle.png'});
 await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,base,testPlayerId:initial.id,checks:['only two current outfits locally previewed','atomic save','both current outfits broadcast to second browser','reload persistence','head/hair/hat/glasses slots preserved','equipped Executive enters practice battle']},null,2));
}finally{await browser.close();}
