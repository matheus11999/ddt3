import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL??'http://127.0.0.1:8097';
const out='test-results/forge-refinement-v2';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
const reports=[];
for(const [width,height] of [[1536,864],[1280,720],[844,390],[667,375]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await context.request.post(base+'/api/session',{headers:{Origin:base},data:{gender:'male'}}),guest=(await response.json()).profile;
 // Expand only this freshly created QA account, never an existing player.
 const fixture=`import assert from 'node:assert/strict';import {Store} from './server/store.ts';import {ITEMS} from './shared/catalog.ts';import {canCompose} from './shared/composition.ts';const store=new Store();try{const result=await store.pool.query("UPDATE players SET name=$3,profile=jsonb_set(profile,'{inventory}',$4::jsonb) WHERE id=$1 AND name=$2 AND created_at>now()-interval '1 minute' RETURNING id",[${JSON.stringify(guest.id)},${JSON.stringify(guest.name)},'TEST-FORGE-'+${JSON.stringify(guest.id)}.slice(0,8),JSON.stringify([...new Set([...${JSON.stringify(guest.inventory)},...ITEMS.filter(canCompose).map(i=>i.id)])])]);assert.equal(result.rowCount,1);}finally{await store.pool.end();}`;
 const seeded=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:fixture,encoding:'utf8',timeout:30000});assert.equal(seeded.status,0,seeded.stderr);
 const before=(await (await context.request.post(base+'/api/session',{headers:{Origin:base},data:{gender:'male'}})).json()).profile;
 await enterGame(page,base);await page.locator('.bottom-dock').getByRole('button',{name:/Ferreiro/}).click();
 const forge=page.getByRole('dialog',{name:'Ferreiro'});await expect(forge).toBeVisible();
 for(const mode of ['strengthen','compose']){
  if(mode==='compose')await forge.getByRole('tab',{name:'Composição'}).click();
  await forge.locator('.forge-stock-item').first().click();
  if(mode==='strengthen'){
   await forge.locator('.forge-stock-stone').first().click();
   await forge.locator('.forge-socket').first().click();
   await expect(forge.locator('.forge-socket').first()).toBeDisabled();
   if(width>=900)await forge.locator('.forge-stock-stone').first().dragTo(forge.locator('.forge-materials'));
   else await forge.locator('.forge-stock-stone').first().click();
   await expect(forge.locator('.forge-socket').first()).toBeEnabled();
  }
  else {
   await expect(forge.locator('.forge-stock-item')).toHaveCount(16);
   await expect(forge.getByRole('button',{name:'Próximos equipamentos'})).toHaveCount(0);
   await expect(forge.getByRole('button',{name:'Equipamentos anteriores'})).toHaveCount(0);
   await forge.getByRole('button',{name:'Defesa',exact:true}).click();
   await forge.locator('.composition-stock-stone:not(:disabled)').first().click();
   await expect(forge.locator('.composition-preview')).toContainText('+10');
   await forge.getByRole('button',{name:'Ataque',exact:true}).click();
   await forge.locator('.composition-stock-stone:not(:disabled)').first().click();
   await forge.locator('.composition-selected-stone').click();
   await expect(forge.locator('.composition-selected-stone')).toBeDisabled();
   if(width>=900)await forge.locator('.composition-stock-stone:not(:disabled)').first().dragTo(forge.locator('.forge-materials'));
   else await forge.locator('.composition-stock-stone:not(:disabled)').first().click();
   await expect(forge.locator('.composition-selected-stone')).toBeEnabled();
  }
  await page.waitForTimeout(500); // Wait for the chance-bar transition before visual QA.
  await page.screenshot({path:`${out}/${process.env.BEFORE?'before-':''}${mode}-${width}.png`});
  const geometry=await forge.evaluate(el=>({scrolling:[...el.querySelectorAll('*')].filter(n=>n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(n).overflowY)).map(n=>n.className),cards:[...el.querySelectorAll('.forge-stock-item,.forge-stock-stone,.composition-stock-stone')].map(n=>{const b=n.getBoundingClientRect();return{width:b.width,height:b.height}}),submit:(()=>{const b=el.querySelector('.forge-submit').getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height}})()}));
  reports.push({width,height,mode,geometry,errors});
  assert.equal(geometry.scrolling.length,0,'workshop must fit without internal scrolling');
  assert.ok(geometry.cards.every(c=>Math.abs(c.width-c.height)<1),'inventory and mineral cards must remain square');
  assert.ok(geometry.submit.y+geometry.submit.height<height,'submit must remain visible');
  const bottom=await forge.locator('.forge-stock').evaluate(el=>{const bottom=el.getBoundingClientRect().bottom;return [...el.querySelectorAll('.composition-tier>span,.forge-stock-stone')].every(n=>n.getBoundingClientRect().bottom<=bottom);});
  assert.ok(bottom,'material captions must not be clipped by the panel');
  await forge.getByRole('button',{name:'Retirar equipamento da bigorna'}).click();
  await expect(forge.locator('.forge-weapon-target')).toHaveAttribute('data-card-empty','true');
 }
 const after=(await (await context.request.post(base+'/api/session',{headers:{Origin:base},data:{gender:'male'}})).json()).profile;
 for(const field of ['gold','stones','compositionStones','upgrades','compositions'])assert.deepEqual(after[field],before[field],`${field} must not change while selecting previews`);
 assert.deepEqual(errors,[]);
 await context.close();
}
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));await browser.close();console.log(JSON.stringify(reports));
