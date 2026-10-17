import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame,createArenaRoom} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',output='test-results/loadout';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}});
const errors=[],checks=[],clients=[];
async function open(viewport,touch=false){
 const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch}),page=await context.newPage(),events=[],commands=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('websocket',socket=>{
  socket.on('framesent',frame=>{try{commands.push(JSON.parse(String(frame.payload)));}catch{}});
  socket.on('framereceived',frame=>{try{events.push(JSON.parse(String(frame.payload)));}catch{}});
 });
 await enterGame(page,base);await createArenaRoom(page);
 const client={context,page,events,commands};clients.push(client);return client;
}
const slot=(page,index)=>page.locator(`[data-loadout-slot="${index}"]`);
const choice=(page,name)=>page.getByRole('button',{name:`Selecionar ${name}`,exact:true});
async function assertSaved(client,slots){
 await expect.poll(()=>client.events.filter(event=>event.type==='profile'&&event.requestId?.startsWith('loadout-')).at(-1)?.profile.abilityLoadout).toEqual(slots);
 await expect(client.page.locator('.preparation-state')).not.toHaveText('Aplicando…');
 for(let i=0;i<3;i++)await expect(slot(client.page,i)).toHaveAttribute('data-loadout-ability',slots[i]??'');
 const persisted=await client.context.request.get(base+'/api/session');
 assert.deepEqual((await persisted.json()).profile.abilityLoadout,slots);
}
try{
 const desktop=await open({width:1536,height:864}),page=desktop.page;
 await expect(page.locator('.party-player-card .ability-slot')).toHaveCount(0);
 await expect(page.locator('.ability-preparation')).toBeVisible();
 await choice(page,'Invisibilidade').dragTo(slot(page,0));
 await assertSaved(desktop,['invisibility','homing','heal']);
 await slot(page,0).dragTo(slot(page,1));
 await assertSaved(desktop,['homing','invisibility','heal']);
 await slot(page,2).dblclick();
 await assertSaved(desktop,['homing','invisibility',null]);
 await choice(page,'Cura').click();await slot(page,2).click();
 await assertSaved(desktop,['homing','invisibility','heal']);
 await slot(page,0).focus();await page.keyboard.press('Delete');
 await assertSaved(desktop,[null,'invisibility','heal']);
 await page.reload();await expect(page.locator('.ability-preparation')).toBeVisible({timeout:15000});
 await expect(slot(page,0)).toHaveAttribute('data-loadout-ability','');
 await expect(slot(page,1)).toHaveAttribute('data-loadout-ability','invisibility');
 await expect(slot(page,2)).toHaveAttribute('data-loadout-ability','heal');
 await page.screenshot({path:`${output}/desktop.png`});
 checks.push('catalog drag, slot swap, double-click removal, tap insertion, keyboard removal and persistent reload');
 const touch=await open({width:844,height:390},true);
 await choice(touch.page,'Invisibilidade').tap();await slot(touch.page,0).tap();
 await assertSaved(touch,['invisibility','homing','heal']);
 for(const control of [choice(touch.page,'Cura'),slot(touch.page,0),slot(touch.page,2),touch.page.getByRole('button',{name:'Treinar com bots',exact:true})]){
  await control.scrollIntoViewIfNeeded();const bounds=await control.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=845&&bounds.y+bounds.height<=391,'preparation and start controls fit landscape');
 }
 await touch.page.screenshot({path:`${output}/mobile.png`});
 checks.push('landscape touch selection, automatic save and reachable active slots');
 await touch.page.getByRole('button',{name:'Treinar com bots',exact:true}).tap();await touch.page.getByRole('dialog',{name:'Treinar com bots?',exact:true}).getByRole('button',{name:'Começar treino',exact:true}).tap();
 await expect(touch.page.locator('.battle-console')).toBeVisible();
 const combat=touch.page.locator('.artillery-hud .ability-slots');
 await expect(combat.locator('[data-ability]')).toHaveCount(3);
 assert.deepEqual(await combat.locator('[data-ability]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-ability'))),['invisibility','homing','heal']);
 checks.push('combat follows saved slot order');
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({base,checks,errors,loadoutCommands:clients.map(client=>client.commands.filter(command=>command.type==='ability-loadout'))},null,2));
 console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

