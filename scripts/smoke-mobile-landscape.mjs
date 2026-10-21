import {createArenaRoom,startPractice} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/mobile-landscape';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
const errors=[],commands=[],checks=[];page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>socket.on('framesent',frame=>{try{commands.push(JSON.parse(String(frame.payload)));}catch{}}));
const gate=()=>page.getByRole('alertdialog',{name:'Vire o celular',exact:true});
const profile=async()=>(await(await context.request.get(base+'/api/session')).json()).profile;
async function visibleControl(control){await expect(control).toBeVisible();const rect=await control.boundingBox(),size=page.viewportSize();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width+1&&rect.y+rect.height<=size.height+1,`control outside viewport: ${await control.getAttribute('aria-label')??await control.innerText()}`);}
async function close(name){const modal=page.getByRole('dialog',{name,exact:true});await visibleControl(modal.getByRole('button',{name:'Fechar',exact:true}));await modal.getByRole('button',{name:'Fechar',exact:true}).click();}
async function animationFrames(){await page.evaluate(()=>new Promise(resolve=>{let frames=0;function draw(){if(++frames>=12)resolve();else requestAnimationFrame(draw);}requestAnimationFrame(draw);}));}
try{
 await page.goto(base,{waitUntil:'networkidle'});await expect(gate()).toBeVisible();assert.equal(await profile(),null);
 await page.locator('.character-creation').getByRole('button',{name:'Criar personagem',exact:true}).click({force:true});assert.equal(await profile(),null,'portrait gate blocks creation input');
 await page.screenshot({path:`${output}/portrait.png`});
 await page.setViewportSize({width:844,height:390});await expect(gate()).toHaveCount(0);await expect(page.locator('html')).toHaveClass(/mobile-landscape/);
 const creation=page.locator('.character-creation');await visibleControl(creation.getByRole('button',{name:'Criar personagem',exact:true}));await page.screenshot({path:`${output}/creation.png`});
 await creation.getByRole('button',{name:'Criar personagem',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();const original=await profile();
 checks.push('touch portrait blocks creation; rotating reveals a usable creation screen without reload');
 for(const size of [{width:844,height:390},{width:932,height:430},{width:667,height:375}]){
  await page.setViewportSize(size);await expect(gate()).toHaveCount(0);await page.locator('.bottom-dock').getByRole('button',{name:'Mochila',exact:true}).click();
  const bag=page.getByRole('dialog',{name:'Mochila',exact:true});await visibleControl(bag.getByRole('button',{name:'Abrir ferreiro',exact:true}));await visibleControl(bag.getByRole('button',{name:'Fechar',exact:true}));await expect(bag.getByRole('button',{name:/Salvar personalização|Restaurar visual|^Remover /})).toHaveCount(0);
  const columns=await bag.locator('.inventory-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(columns,2);
  await page.waitForLoadState('networkidle');await animationFrames();const canvas=bag.locator('.dressing-room>canvas');assert.ok((await profile()).equipment.upgrade<5,'static pixel check uses a fresh profile without an animated aura');const still=await canvas.evaluate(el=>el.toDataURL());await animationFrames();assert.ok(await canvas.evaluate(el=>el.toDataURL())===still,'body remains still after lazy artwork loads');
  await page.screenshot({path:`${output}/bag-${size.width}.png`});
  if(size.width===844){
   await bag.getByRole('combobox',{name:'Categoria'}).selectOption('costume');await bag.getByRole('button',{name:'Pintinho do Trovão',exact:true}).click();
   await page.setViewportSize({width:390,height:844});await expect(gate()).toBeVisible();await page.setViewportSize(size);await expect(gate()).toHaveCount(0);await expect(bag.locator('[data-slot="costume"]')).toHaveAttribute('aria-label','Fantasia: Pintinho do Trovão');await expect.poll(async()=>(await profile()).equipment.costume,{timeout:15000}).toBe('costume-thunder-chick');assert.equal((await profile()).id,original.id);await expect(bag.locator('.equipment-status')).toHaveText('Visual equipado');await bag.locator('[data-slot="costume"]').dblclick();await expect.poll(async()=>(await profile()).equipment.costume).toBe('costume-none');await expect(bag.locator('.equipment-status')).toHaveText('Visual equipado');
   checks.push('rotation preserves the open inventory and immediate equipment update without recreating the profile; slot double-click removes it');
  }
  await close('Mochila');await page.locator('.bottom-dock').getByRole('button',{name:'Loja',exact:true}).click();
  const shop=page.getByRole('dialog',{name:'Loja da Brasa',exact:true});await visibleControl(shop.getByRole('button',{name:'Próxima página',exact:true}));await shop.getByRole('navigation',{name:'Categorias da loja'}).getByRole('button',{name:'Fantasias',exact:true}).click();await expect(shop.locator('[data-shop-item]')).toHaveCount(2);await page.screenshot({path:`${output}/shop-${size.width}.png`});
  await shop.getByRole('navigation',{name:'Categorias da loja'}).getByRole('button',{name:'Armas',exact:true}).click();await shop.getByRole('button',{name:'Comprar Quebra-Tijolos',exact:true}).click();await visibleControl(shop.getByRole('alertdialog',{name:'Confirmar compra'}).getByRole('button',{name:'Confirmar',exact:true}));await page.screenshot({path:`${output}/confirm-${size.width}.png`});await shop.getByRole('button',{name:'Cancelar',exact:true}).click();await close('Loja da Brasa');
  await page.locator('.bottom-dock').getByRole('button',{name:'Mochila',exact:true}).click();await page.getByRole('button',{name:'Abrir ferreiro',exact:true}).click();const forge=page.getByRole('dialog',{name:'Ferreiro',exact:true});await expect(forge).toBeVisible({timeout:15000});await visibleControl(forge.getByRole('button',{name:'Fortalecer',exact:true}));await page.screenshot({path:`${output}/forge-${size.width}.png`});
  await forge.getByRole('tab',{name:'Composição',exact:true}).click();await visibleControl(forge.getByRole('button',{name:'Compor atributo',exact:true}));await page.screenshot({path:`${output}/composition-${size.width}.png`});await close('Ferreiro');
  await page.locator('.bottom-dock').getByRole('button',{name:'Arena',exact:true}).click();await visibleControl(page.getByRole('button',{name:'Criar sala',exact:true}));await visibleControl(page.getByRole('button',{name:'Sair da arena',exact:true}));await page.screenshot({path:`${output}/arena-${size.width}.png`});
  await createArenaRoom(page);await visibleControl(page.getByRole('button',{name:'Buscar partida',exact:true}));await visibleControl(page.getByRole('button',{name:'Sair da sala',exact:true}));await page.screenshot({path:`${output}/party-${size.width}.png`});await page.getByRole('button',{name:'Sair da sala',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  checks.push(`${size.width}×${size.height}: two-pane inventory, shop, forge and party actions remain inside the viewport`);
 }
 await page.setViewportSize({width:844,height:390});await page.locator('.bottom-dock').getByRole('button',{name:'Arena',exact:true}).click();await startPractice(page);
 const meter=page.getByRole('meter',{name:'Força do disparo',exact:true});await expect(meter).toHaveAttribute('aria-disabled','false');await page.screenshot({path:`${output}/battle.png`});
 await page.locator('.world-canvas').click({position:{x:300,y:180}});await page.keyboard.down('ArrowRight');await expect.poll(()=>commands.filter(command=>command.type==='walk').length).toBeGreaterThan(0);
 await page.setViewportSize({width:390,height:844});await expect(gate()).toBeVisible();await page.keyboard.up('ArrowRight');const walkCount=commands.filter(command=>command.type==='walk').length;await page.setViewportSize({width:844,height:390});await expect(gate()).toHaveCount(0);await page.waitForTimeout(400);assert.equal(commands.filter(command=>command.type==='walk').length,walkCount,'held movement is cleared during rotation');
 const session=await context.newCDPSession(page),rect=await meter.boundingBox(),fires=commands.filter(command=>command.type==='fire').length;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});await expect(meter).toHaveAttribute('data-charging','true');
 await page.setViewportSize({width:390,height:844});await expect(gate()).toBeVisible();await expect(meter).toHaveAttribute('data-charging','false');await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.keyboard.press('Space');await page.setViewportSize({width:844,height:390});await expect(gate()).toHaveCount(0);await page.waitForTimeout(250);assert.equal(commands.filter(command=>command.type==='fire').length,fires,'rotation cancels touch charge without firing');
 checks.push('rotating clears held movement and touch charge, blocks portrait inputs, and sends no accidental shot');
 const touchHold=async(locator,ms)=>{const box=await locator.boundingBox();const point={x:box.x+box.width/2,y:box.y+box.height/2};await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.waitForTimeout(ms);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 for(const name of ['Andar para a esquerda','Andar para a direita']){const button=page.getByRole('button',{name,exact:true});await visibleControl(button);const box=await button.boundingBox();assert.ok(box.width>=48&&box.height>=48,`${name} is finger-sized`);}
 const fireButton=page.getByRole('button',{name:'Disparar: segure para carregar a força e solte',exact:true});await visibleControl(fireButton);
 const walksBefore=commands.filter(command=>command.type==='walk'&&command.direction===1).length;await touchHold(page.getByRole('button',{name:'Andar para a direita',exact:true}),700);
 assert.ok(commands.filter(command=>command.type==='walk'&&command.direction===1).length>walksBefore+2,'holding the right arrow walks');const walksAfter=commands.filter(command=>command.type==='walk').length;await page.waitForTimeout(400);assert.equal(commands.filter(command=>command.type==='walk').length,walksAfter,'releasing the arrow stops walking');
 await page.screenshot({path:`${output}/battle-touch.png`});
 const firesBefore=commands.filter(command=>command.type==='fire').length;const fireBox=await fireButton.boundingBox();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fireBox.x+fireBox.width/2,y:fireBox.y+fireBox.height/2}]});await expect(meter).toHaveAttribute('data-charging','true');await page.waitForTimeout(900);await page.screenshot({path:`${output}/battle-charging.png`});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>commands.filter(command=>command.type==='fire').length).toBe(firesBefore+1);const shot=commands.filter(command=>command.type==='fire').at(-1);assert.ok(shot.power>20,'held fire button charges the force');
 checks.push('touch walk arrows walk while held and stop on release; the fire button charges while held and fires on release');
 await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();
 const desktop=await browser.newContext({viewport:{width:390,height:844},hasTouch:false});const desktopPage=await desktop.newPage();await desktopPage.goto(base);await expect(desktopPage.locator('.character-creation')).toBeVisible();await expect(desktopPage.getByRole('alertdialog',{name:'Vire o celular'})).toHaveCount(0);await desktop.close();checks.push('a narrow desktop window is not orientation-gated');
 assert.deepEqual(errors,[]);const report={passed:true,base,checks,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await browser.close();}
