import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Admin panel smoke test against a running game (Docker or Vite + server):
// wrong password is refused, login works, the dashboard and the map list render,
// the snow map opens in the editor, a piece moves, the draft saves and publishes,
// and GET /api/maps then serves the edited map; finally the map goes back to the original.
// Needs ADMIN_USER and ADMIN_PASSWORD matching the server's ADMIN_USERNAME / ADMIN_PASSWORD_HASH.
const base=process.env.BASE_URL??'http://127.0.0.1:8097',user=process.env.ADMIN_USER??'matheus',password=process.env.ADMIN_PASSWORD;
if(!password)throw new Error('Defina ADMIN_PASSWORD (a senha do painel) para rodar este teste.');
const output='test-results/admin';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/admin`);
 await page.getByLabel('Usuário').fill(user);await page.getByLabel('Senha').fill('senha-errada-123');await page.getByRole('button',{name:'Entrar'}).click();
 await page.getByText('Usuário ou senha incorretos.').waitFor();
 await page.getByLabel('Senha').fill(password);await page.getByRole('button',{name:'Entrar'}).click();
 await page.getByRole('heading',{name:'Visão geral'}).waitFor();await page.locator('.adm-card').first().waitFor();
 await page.screenshot({path:`${output}/dashboard.png`});
 const snowCard=page.locator('.adm-map',{hasText:'· snow'});
 await page.getByRole('link',{name:'Mapas'}).click();await snowCard.waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:`${output}/maps.png`});
 await snowCard.click();
 await page.locator('.adm-pieces button').first().waitFor({timeout:30000});
 await page.locator('.adm-warnings h4').waitFor();await page.waitForTimeout(1500);
 await page.screenshot({path:`${output}/editor.png`});
 // Zoom buttons and keys, and the sidebars fold away and come back.
 const zoom=page.locator('.adm-zoom'),fitted=await zoom.innerText();await page.getByRole('button',{name:'Aproximar ( + )'}).click();assert.notEqual(await zoom.innerText(),fitted);
 await page.keyboard.press('0');assert.equal(await zoom.innerText(),fitted);
 await page.keyboard.press('[');await page.locator('.adm-editor-left').waitFor({state:'hidden'});await page.keyboard.press('[');await page.locator('.adm-editor-left').waitFor();
 // Select the left tower in the layer list and nudge it with the keyboard (mirrored copy follows).
 await page.getByRole('button',{name:/^Itens/}).click();await page.locator('.adm-layers li',{hasText:'snow-tower'}).click();
 const x=page.locator('.adm-inspector input[type=number]').first(),before=Number(await x.inputValue());
 for(let n=0;n<4;n++)await page.keyboard.press('Shift+ArrowRight');
 assert.equal(Number(await x.inputValue()),before+40);
 await page.waitForTimeout(1200);await page.screenshot({path:`${output}/editor-selected.png`});
 await page.getByRole('button',{name:'Salvar'}).click();await page.getByText(/Rascunho salvo/).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Publicar'}).click();
 const anyway=page.getByRole('button',{name:'Publicar mesmo assim'});if(await anyway.isVisible({timeout:1500}).catch(()=>false))await anyway.click();
 await page.getByText(/Publicado/).waitFor({timeout:30000});
 const published=await page.evaluate(()=>fetch('/api/maps').then(r=>r.json()));
 const snow=published.maps.find(m=>m.id==='snow');assert.ok(snow,'snow publicado');assert.equal(snow.width,3072);assert.ok(snow.regions.some(r=>r.id==='snow-tower'));
 const terrain=await page.evaluate(url=>fetch(url).then(r=>r.status),snow.terrain);assert.equal(terrain,200);
 // Lobby editor opens and draws the plaza.
 await page.goto(`${base}/admin/mapas/praca-celeste`);await page.getByText('Entrada dos jogadores').first().waitFor();await page.waitForTimeout(1500);
 await page.screenshot({path:`${output}/lobby.png`});
 // Back to the original map so the test leaves the game as it was.
 await page.goto(`${base}/admin/mapas/snow`);await page.locator('.adm-pieces button').first().waitFor({timeout:30000});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Voltar ao original no jogo'}).click();await page.getByText(/mapa original/).waitFor();
 const after=await page.evaluate(()=>fetch('/api/maps').then(r=>r.json()));assert.ok(!after.maps.some(m=>m.id==='snow'));
 assert.deepEqual(errors,[]);
 console.log(`Painel OK. Capturas em ${output}/`);
}finally{await browser.close();}
