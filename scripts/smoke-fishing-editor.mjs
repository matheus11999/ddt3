import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// The Pescaria editor in the admin panel against a running game: opens /admin/mapas/pescaria,
// moves a lake (its pieces follow), turns and grows a piece, adds a lotus from the palette, saves,
// publishes and checks GET /api/maps serves the new layout; finally the Pescaria goes back to the original.
// Needs ADMIN_PASSWORD (and ADMIN_USER, default matheus) matching the server's ADMIN_USERNAME / ADMIN_PASSWORD_HASH.
const base=process.env.BASE_URL??'http://127.0.0.1:8097',user=process.env.ADMIN_USER??'matheus',password=process.env.ADMIN_PASSWORD;
if(!password)throw new Error('Defina ADMIN_PASSWORD (a senha do painel) para rodar este teste.');
const output='test-results/admin-fishing';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>void d.accept());
const maps=async()=>(await page.request.get(`${base}/api/maps`)).json();
try{
 await page.goto(`${base}/admin`);
 await page.getByLabel('Usuário').fill(user);await page.getByLabel('Senha').fill(password);await page.getByRole('button',{name:'Entrar'}).click();
 await page.getByRole('heading',{name:'Visão geral'}).waitFor();
 await page.getByRole('link',{name:'Mapas'}).click();
 const card=page.locator('.adm-map',{hasText:'pescaria'});await card.waitFor();await card.click();
 await page.locator('.adm-warnings h4').waitFor();await page.waitForTimeout(2500);
 await page.screenshot({path:`${output}/01-editor.png`});
 // Select the Poço Azul in the list, then drag it on the canvas: the sign beside it goes along.
 await page.locator('.adm-layers li',{hasText:'Poço Azul'}).click();
 const x=page.locator('.adm-inspector input[type=number]').first(),before=Number(await x.inputValue());
 const canvas=page.locator('.adm-stage canvas'),box=(await canvas.boundingBox());
 // Use the inspector to move it (the canvas scale depends on the window).
 await x.fill(String(before+200));await page.waitForTimeout(300);
 assert.equal(Number(await x.inputValue()),before+200);
 // Add a lotus from the palette and turn it with the inspector.
 await page.getByLabel('Buscar peça').fill('lótus');await page.locator('.adm-pieces button',{hasText:'Lótus 1'}).click();
 await page.locator('.adm-inspector h3',{hasText:'Lótus 1'}).waitFor();
 const turn=page.locator('.adm-inspector .adm-range input[type=number]').nth(1);await turn.fill('30');
 const grow=page.locator('.adm-inspector .adm-range input[type=number]').first();await grow.fill('150');
 // Show the walking rules and zoom on the selection.
 await page.locator('button[title^="Mostrar onde dá para andar"]').click();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let n=0;n<5;n++){await page.mouse.wheel(0,-240);await page.waitForTimeout(80);}
 await page.waitForTimeout(1200);await page.screenshot({path:`${output}/02-lotus-and-rules.png`});
 await page.getByRole('button',{name:'Salvar'}).click();await page.getByText(/Rascunho salvo/).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Publicar'}).click();await page.getByText(/Publicado/).waitFor({timeout:30000});
 const live=await maps();assert.equal(live.fishing?.id,'pescaria');
 const well=live.fishing.fishing.lakes.find(l=>l.id==='profundo');assert.equal(well.x,before+200);
 const lotus=live.fishing.fishing.items.filter(i=>i.prop==='lotus-1').at(-1);assert.equal(lotus.rotation,30);assert.equal(lotus.scale,1.5);
 // Back to the original.
 await page.locator('.adm-stage canvas').click({position:{x:5,y:5}});
 await page.getByRole('button',{name:'Voltar ao original no jogo'}).click();await page.getByText(/voltou ao original/).waitFor({timeout:30000});
 assert.equal((await maps()).fishing,null);
 assert.deepEqual(errors,[]);
 console.log('fishing editor ok');
}finally{await browser.close();}
