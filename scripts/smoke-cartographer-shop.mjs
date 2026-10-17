import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097/?dev=live';
const output='test-results/cartographer-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const clients=[],errors=[],checks=[];
async function create(gender,options={}){
 const context=await browser.newContext({viewport:{width:1536,height:864},...options}),page=await context.newPage(),client={gender,context,page,commands:[]};clients.push(client);
 page.on('pageerror',error=>errors.push(`${gender}: ${error.message}`));
 page.on('websocket',socket=>socket.on('framesent',frame=>{try{client.commands.push(JSON.parse(String(frame.payload)));}catch{}}));
 await enterGame(page,base,gender);await page.waitForLoadState('networkidle');
 client.initial=await profile(client);assert.equal(client.initial.gender,gender);return client;
}
async function profile(client){const response=await client.context.request.post(new URL('/api/session',base).href,{headers:{Origin:new URL(base).origin}});assert.equal(response.status(),200);return (await response.json()).profile;}
async function shop(client){await client.page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();const dialog=client.page.getByRole('dialog',{name:'Loja da Brasa'});await expect(dialog).toBeVisible();return dialog;}
async function category(dialog,label){await dialog.getByRole('navigation',{name:'Categorias da loja'}).getByRole('button',{name:label,exact:true}).click();}
async function offer(dialog,id){const result=dialog.locator(`[data-shop-item="${id}"]`);await expect(result).toBeVisible();return result;}
async function forgedCommands(client,commands){
 const cookies=await client.context.cookies(base),session=cookies.find(cookie=>cookie.name==='brasa_session');assert.ok(session);
 const socket=new WebSocket(new URL('/ws',base).href.replace(/^http/,'ws'),{headers:{Origin:new URL(base).origin,Cookie:`brasa_session=${session.value}`}});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 try{for(const command of commands){const result=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`No server response for ${JSON.stringify(command)}`)),10000);const listener=raw=>{const event=JSON.parse(String(raw));if(event.type==='error'){clearTimeout(timeout);socket.off('message',listener);resolve(event);}};socket.on('message',listener);});socket.send(JSON.stringify(command));const response=await result;assert.match(response.message,/gênero/);}}finally{socket.close();}
}
try{
 const male=await create('male'),{page}=male;
 // Only this newly created QA account receives the exact amount needed for the test.
 const name=`TEST-CARTO-${male.initial.id.slice(0,8)}`;
 const seed=`import assert from 'node:assert/strict';import {Store} from './server/store.ts';const store=new Store();try{const result=await store.pool.query("UPDATE players SET name=$3,profile=jsonb_set(profile,'{gold}','680'::jsonb) WHERE id=$1 AND name=$2 AND created_at>now()-interval '5 minutes' RETURNING id",[${JSON.stringify(male.initial.id)},${JSON.stringify(male.initial.name)},${JSON.stringify(name)}]);assert.equal(result.rowCount,1);}finally{await store.pool.end();}`;
 const fixture=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:seed,encoding:'utf8',timeout:30000});assert.equal(fixture.status,0,fixture.stderr);
 // Existing live peers intentionally retain their authoritative snapshot for 30s.
 // Let this *test* peer expire before reconnecting to the seeded PostgreSQL row.
 await page.goto('about:blank');await page.waitForTimeout(32000);await enterGame(page,base,'male');
 male.initial=await profile(male);const initial=male.initial;
 assert.ok(initial.gold>=680,`Fresh account has ${initial.gold} Brasa; requires 680 for transactional purchase`);
 let dialog=await shop(male);
 await expect(dialog.getByRole('group',{name:'Coleções da loja'}).getByRole('button',{name:'Masculino',exact:true})).toHaveAttribute('aria-pressed','true');
 const items=[['outfit-cartographer','Cartógrafo da Aurora','Roupas'],['hair-horizon','Corte Horizonte','Complementos'],['glasses-navigator','Óculos de Navegação','Complementos']];
 for(const [id,name,group] of items){await category(dialog,group);const card=await offer(dialog,id);await expect(card).toHaveAttribute('data-item-gender','male');await dialog.getByRole('button',{name:`Experimentar ${name}`,exact:true}).click();await expect(card).toHaveClass(/trying/);}
 await page.screenshot({path:`${output}/shop-preview-desktop.png`});
 // Buy all three at once; the trial is local, while purchase must be atomic on the server.
 for(const [,name,group] of items){await category(dialog,group);await dialog.getByRole('button',{name:`Adicionar ${name} ao carrinho`,exact:true}).click();}
 assert.deepEqual((await profile(male)).equipment,initial.equipment,'Trying on items must not equip them');
 await dialog.getByRole('button',{name:'Ver carrinho 3',exact:true}).click();await expect(dialog.locator('.shop-checkout-total')).toContainText('680');
 await dialog.getByRole('button',{name:'Comprar tudo',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Itens guardados na mochila!');
 const purchased=await profile(male);assert.equal(purchased.gold,initial.gold-680);for(const [id] of items)assert.ok(purchased.inventory.includes(id),id);assert.deepEqual(purchased.equipment,initial.equipment);
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();let bag=page.getByRole('dialog',{name:'Mochila'});await expect(bag).toBeVisible();
 for(const [id,name,,slot] of items.map(([id,name,group])=>[id,name,group,id.startsWith('outfit')?'outfit':id.startsWith('hair')?'hair':'glasses'])){
  await bag.getByRole('combobox',{name:'Categoria'}).selectOption(slot);
  await bag.getByRole('button',{name,exact:true}).click();
  await expect.poll(async()=>(await profile(male)).equipment[slot]).toBe(id);
  await expect(bag.locator(`[data-slot="${slot}"]`)).toHaveAttribute('aria-label',new RegExp(name));
 }
 await page.screenshot({path:`${output}/inventory-equipped-desktop.png`});
 await bag.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.bottom-dock')).toBeVisible();let restored=await profile(male);for(const [id,,,slot] of items.map(([id,name,group])=>[id,name,group,id.startsWith('outfit')?'outfit':id.startsWith('hair')?'hair':'glasses']))assert.equal(restored.equipment[slot],id);
 await page.locator('.bottom-dock').getByRole('button',{name:/Mochila/}).click();bag=page.getByRole('dialog',{name:'Mochila'});await page.screenshot({path:`${output}/inventory-reloaded-desktop.png`});await bag.getByRole('button',{name:'Fechar',exact:true}).click();
 checks.push('male shop filter, local trial, one 680-Brasa transaction, immediate equipment and persistence after reload');

 const female=await create('female');dialog=await shop(female);await dialog.getByRole('group',{name:'Coleções da loja'}).getByRole('button',{name:'Masculino',exact:true}).click();
 for(const [id,name,group] of items){await category(dialog,group);const card=await offer(dialog,id);await expect(card).toHaveAttribute('data-gender-locked','true');await expect(dialog.getByRole('button',{name:`Experimentar ${name}`,exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:`Adicionar ${name} ao carrinho`,exact:true})).toBeDisabled();}
 await female.page.screenshot({path:`${output}/female-locked.png`});assert.deepEqual((await profile(female)).equipment,female.initial.equipment);assert.equal(female.commands.filter(command=>command.type==='shop-buy'||command.type==='customize').length,0);
 // Simulate legacy ownership only in this freshly created female test account.
 // The server must reject equipping these IDs even when they appear in inventory.
 await female.page.goto('about:blank');
 const seedOpposite=`import assert from 'node:assert/strict';import {Store} from './server/store.ts';const store=new Store();try{const result=await store.pool.query("UPDATE players SET profile=jsonb_set(profile,'{inventory}',(profile->'inventory')||$3::jsonb) WHERE id=$1 AND name=$2 AND created_at>now()-interval '5 minutes' RETURNING id",[${JSON.stringify(female.initial.id)},${JSON.stringify(female.initial.name)},JSON.stringify(${JSON.stringify(items.map(([id])=>id))})]);assert.equal(result.rowCount,1);}finally{await store.pool.end();}`;
 const ownedFixture=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:seedOpposite,encoding:'utf8',timeout:30000});assert.equal(ownedFixture.status,0,ownedFixture.stderr);
 await female.page.waitForTimeout(32000);
 const femaleBefore=await profile(female);for(const [id] of items)assert.ok(femaleBefore.inventory.includes(id));
 await forgedCommands(female,[{type:'shop-buy',items:['outfit-cartographer']},...items.map(([id])=>({type:'equip',item:id}))]);
 const femaleAfter=await profile(female);assert.deepEqual(femaleAfter.equipment,femaleBefore.equipment);assert.equal(femaleAfter.gold,femaleBefore.gold);
 checks.push('female shop locks all three; server rejects forged purchase and equipment even with legacy ownership');

 const mobile=await create('male',{viewport:{width:844,height:390},isMobile:true,hasTouch:true});dialog=await shop(mobile);for(const [id,name,group] of items){await category(dialog,group);await offer(dialog,id);await dialog.getByRole('button',{name:`Experimentar ${name}`,exact:true}).click();}
 await mobile.page.screenshot({path:`${output}/shop-preview-landscape.png`});
 assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 checks.push('all three assets preview in mobile landscape without horizontal overflow');

 assert.deepEqual(errors,[]);const report={passed:true,base,checks,testPlayerIds:clients.map(client=>client.initial.id),errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){for(const client of clients)await client.page.screenshot({path:`${output}/failure-${client.gender}-${clients.indexOf(client)}.png`}).catch(()=>{});throw error;}
finally{await browser.close();}
