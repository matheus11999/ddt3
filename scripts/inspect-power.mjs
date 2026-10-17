// Visual/component fixture. Server rules are exercised in tests/power.test.ts.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='test-results/power',base=process.env.BASE_URL??'http://127.0.0.1:5177';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/power-review.html',r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/src/fonts.css"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/styles-fantasy.css"></head><body><main class="game-frame" style="width:1536px;height:864px;transform:translate(-50%,-50%)"><div id="hud"></div></main></body></html>'}));
 await page.goto(base+'/power-review.html');
 await page.evaluate(async()=>{
  const runtime=(await import('/@react-refresh')).default;runtime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
  const code=await(await fetch('/src/components/BattleHud.tsx')).text(),main=await(await fetch('/src/main.tsx')).text();
  const clientPath=code.match(/from "(\/src\/client.ts[^\"]*)"/)[1],catalogPath=code.match(/from "(\/shared\/catalog.ts[^\"]*)"/)[1],reactPath=main.match(/from "([^\"]*\/react\.js[^\"]*)"/)[1],domPath=main.match(/from "([^\"]*\/react-dom_client.js[^\"]*)"/)[1];
  const {client}=await import(clientPath),{DEFAULT_EQUIPMENT}=await import(catalogPath),{BattleHud}=await import('/src/components/BattleHud.tsx'),{Scene}=await import('/src/game/Scene.tsx'),{createTerrain,ground}=await import('/shared/physics.ts');
  const r=(await import(reactPath)).default,d=(await import(domPath)).default,React=r.__esModule?r.default:r,ReactDOM=d.__esModule?d.default:d;
  const terrain=createTerrain('snow'),players=[{id:'p0',name:'Faísca',team:0,x:385},{id:'p1',name:'Tempestade',team:1,x:1040}].map(p=>({...p,level:42,slot:0,ready:true,bot:false,connected:true,hp:1900,maxHp:2400,stamina:300,maxStamina:300,facing:p.team===0?1:-1,equipment:{...DEFAULT_EQUIPMENT,weapon:'dynamite'},boosts:[],powerCharge:p.team===0?65:30,powerArmed:false,y:ground(terrain,p.x)}));
  client.update({profile:{id:'p0'},status:'online',offset:0,battle:{id:'power-visual-fixture',roomId:'fixture',players,turnId:'p0',turnNumber:4,phase:'aiming',winner:null,deadline:Date.now()+30000,map:'snow',wind:1.2}});
  window.powerClient=client;window.commands=[];client.send=command=>{window.commands.push(command);if(command.type==='power'){const b=client.state.battle;client.update({battle:{...b,players:b.players.map(p=>p.id==='p0'?{...p,powerCharge:0,powerArmed:true}:p)}});}};
  ReactDOM.createRoot(document.getElementById('hud')).render(React.createElement(React.Fragment,null,React.createElement(Scene,{angle:45,onArena:()=>{},onForge:()=>{}}),React.createElement(BattleHud,{angle:45,setAngle:()=>{},blocked:false})));
 });
 await page.waitForSelector('.combat-power');await page.waitForTimeout(2200);await expect(page.getByRole('button',{name:'Ativar Power, 65 de 100'})).toBeDisabled();await page.screenshot({path:output+'/charging.png'});
 await page.evaluate(()=>{const c=window.powerClient;c.update({battle:{...c.state.battle,players:c.state.battle.players.map(p=>p.id==='p0'?{...p,powerCharge:100}:p)}});});
 const button=page.getByRole('button',{name:'Ativar Power, 100 de 100'});await expect(button).toBeEnabled();await page.screenshot({path:output+'/ready.png'});await button.click();
 await expect(page.getByRole('button',{name:'Power preparado'})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.down('Space');await page.waitForTimeout(170);await page.keyboard.up('Space');await expect.poll(()=>page.evaluate(()=>window.commands.filter(c=>c.type==='fire').length)).toBe(1);
 await page.evaluate(()=>{const c=window.powerClient;c.update({battle:{...c.state.battle,phase:'resolving',powerCutIn:{id:'cutin-visual',playerId:'p0',endsAt:Date.now()+1400}}});});await expect(page.getByRole('status',{name:'Faísca dispara Power'})).toHaveCount(1);await page.waitForTimeout(400);await page.screenshot({path:output+'/cut-in.png'});
 await page.waitForTimeout(1100);await expect(page.getByRole('status',{name:'Faísca dispara Power'})).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{const c=window.powerClient;c.update({battle:{...c.state.battle,powerCutIn:{id:'reduced',playerId:'p0',endsAt:Date.now()+1400}}});});
 const animations=await page.locator('.power-cut-in').evaluate(el=>getComputedStyle(el).animationName);if(animations!=='none')throw Error('Reduced motion cut-in still animates');
 const layouts=[];
 await page.evaluate(()=>{const c=window.powerClient;c.update({battle:{...c.state.battle,phase:'aiming',powerCutIn:undefined}});});
 for(const [width,height] of [[1536,864],[1280,720],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(({width,height})=>{document.querySelector('.game-frame').style.transform=`translate(-50%,-50%) scale(${Math.min(width/1536,height/864)})`;},{width,height});
  const layout=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom};};return{meter:rect('.power-track'),power:rect('.combat-power'),actions:rect('.battle-actions'),frame:rect('.game-frame')};});
  if(layout.meter.right>=layout.actions.x||layout.actions.right>=layout.power.x||layout.power.bottom>layout.frame.bottom)throw Error('Power overlaps combat controls');layouts.push({width,height,...layout});
  if(width===390)await page.screenshot({path:output+'/mobile.png'});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(output+'/report.json',JSON.stringify({fixture:true,errors,layouts,checks:['partial disabled','full enabled','activation state','click activation then Space fires once','cut-in only before server deadline','reduced motion']},null,2));console.log('Power visual fixture passed; screenshots in '+output);
}finally{await browser.close();}
