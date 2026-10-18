import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';

// Leilão preview against a running game (Vite + server, or Docker): a few sellers list items and stones
// in gold and Cupons, then a player with Cupons browses, opens the menu, right-clicks a seller and sells.
// Screenshots in test-results/auction/. DATABASE_URL points at the game's Postgres (gives the player Cupons).
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/auction';await mkdir(output,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa'});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[];
const setWallet=(id,gold,coupons,items=[],upgrades={})=>db.query(`UPDATE players SET profile=profile||jsonb_build_object('gold',$2::int,'coupons',$3::int,'inventory',(profile->'inventory')||$4::jsonb,'upgrades',(profile->'upgrades')||$5::jsonb) WHERE id=$1`,[id,gold,coupons,JSON.stringify(items),JSON.stringify(upgrades)]);

/** A seller in their own browser: names themselves and lists what the plan says, over the game's socket. */
async function seller(name,gender,plan,items=[],upgrades={}){
 const context=await browser.newContext(),page=await context.newPage();await page.goto(base);
 const profile=await page.evaluate(async gender=>(await (await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender})})).json()).profile,gender);
 await setWallet(profile.id,5000,0,items,upgrades);
 await page.evaluate(async({name,plan})=>{
  const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
  let profile=null;const wait=type=>new Promise(resolve=>{const on=event=>{const data=JSON.parse(event.data);if(data.type==='profile'||data.type==='welcome')profile=data.profile;if(data.type===type||data.type==='error'){ws.removeEventListener('message',on);resolve(data);}};ws.addEventListener('message',on);});
  const welcome=wait('welcome');await new Promise(resolve=>ws.addEventListener('open',resolve));await welcome;
  ws.send(JSON.stringify({type:'rename',name}));await wait('profile');
  const worn=new Set(Object.values(profile.equipment).filter(v=>typeof v==='string'));
  for(const step of plan){
   let source=step.source;
   if(step.slot){const key=profile.inventory.find(k=>k.startsWith(step.slot)&&!worn.has(k));if(!key)continue;source={kind:'item',key};}
   ws.send(JSON.stringify({type:'auction-sell',source,currency:step.currency,price:step.price,hours:step.hours}));await wait('auction-result');await new Promise(r=>setTimeout(r,850));
  }
  ws.close();
 },{name,plan});
 await context.close();
}
try{
 await seller('Luna Brasa','female',[{slot:'hat-mage',currency:'coupons',price:120,hours:24},{source:{kind:'stone',level:3,amount:5},currency:'gold',price:450,hours:8},{slot:'hair-wavy',currency:'gold',price:900,hours:2}],['hat-mage','hair-wavy']);
 await seller('Kaio Trovão','male',[{source:{kind:'stone',level:5,amount:2},currency:'coupons',price:80,hours:24},{source:{kind:'composition',stone:'attack-2',amount:1},currency:'gold',price:300,hours:8},{slot:'face-',currency:'coupons',price:45,hours:8}],['face-taunt']);
 await seller('Mel Arqueira','female',[{source:{kind:'stone',level:1,amount:20},currency:'gold',price:200,hours:2},{slot:'brick~2',currency:'coupons',price:350,hours:24},{source:{kind:'stone',level:4,amount:3},currency:'gold',price:700,hours:24}],['brick~2'],{'brick~2':12});
 await seller('Bia Faísca','female',[{slot:'glasses-',currency:'coupons',price:60,hours:8},{slot:'hat-tropical',currency:'gold',price:1500,hours:24},{source:{kind:'stone',level:2,amount:10},currency:'gold',price:260,hours:8}],['glasses-cat','hat-tropical']);

 const page=await browser.newPage({viewport:{width:1536,height:864}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 const me=await page.evaluate(async()=>(await (await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender:'female'})})).json()).profile);
 await setWallet(me.id,3200,1250,['hat-ruby','glasses-sport']);await page.reload();
 const button=page.locator('.lobby-dock-button.auction');await button.waitFor({timeout:30000});await page.waitForTimeout(1500);
 await page.screenshot({path:`${output}/lobby.png`});
 await button.click();const win=page.locator('.auction-window');await win.locator('tbody tr[data-listing]').first().waitFor();await page.waitForTimeout(900);
 await page.screenshot({path:`${output}/comprar.png`});
 await win.getByRole('button',{name:'Vestuário'}).click();await win.getByRole('button',{name:'Beleza'}).click();await win.getByRole('button',{name:'Pedra de Upgrade'}).click();await page.waitForTimeout(700);
 await page.screenshot({path:`${output}/categorias.png`});
 await win.getByRole('button',{name:'Todos os itens'}).click();await page.waitForTimeout(500);
 const sellerCell=win.locator('.auction-seller').first();await sellerCell.click({button:'right'});await page.waitForTimeout(400);
 await page.screenshot({path:`${output}/vendedor-menu.png`});
 await page.keyboard.press('Escape');await page.mouse.click(5,5);await page.waitForTimeout(200);
 if(!(await win.isVisible())){await button.click();await win.locator('tbody tr[data-listing]').first().waitFor();}
 await win.locator('tbody tr[data-listing]',{hasText:'Cupons'}).first().or(win.locator('tbody tr[data-listing] .auction-price.coupons').first()).first().waitFor().catch(()=>{});
 const buy=win.locator('tbody tr[data-listing] .auction-buy-button:not([disabled])').first();await buy.click();await win.locator('.auction-confirm').waitFor();await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/confirmar.png`});
 await win.locator('.auction-confirm').getByRole('button',{name:'Comprar'}).click();await win.locator('.auction-confirm').waitFor({state:'detached'});await page.waitForTimeout(500);
 await page.screenshot({path:`${output}/comprado.png`});
 await win.getByRole('button',{name:'Vender'}).click();await win.locator('.auction-bag-cell').first().click();
 await win.getByRole('button',{name:'Cupons'}).click();await win.getByLabel('Preço').fill('250');await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/vender.png`});
 await win.getByRole('button',{name:'Anunciar'}).click();await win.locator('.auction-mine li').first().waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:`${output}/anunciado.png`});
 // Someone buys my listing: the bell rings with the sale and the payment waits in the mail.
 const buyerContext=await browser.newContext(),buyerPage=await buyerContext.newPage();await buyerPage.goto(base);
 const buyer=await buyerPage.evaluate(async()=>(await (await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender:'female'})})).json()).profile);
 await setWallet(buyer.id,1000,1000);await db.query(`UPDATE players SET name='Nina Cometa' WHERE id=$1`,[buyer.id]);
 const {rows:[own]}=await db.query(`SELECT id,currency,price FROM auction_listings WHERE seller_id=$1 AND status='active' ORDER BY id DESC LIMIT 1`,[me.id]);
 await buyerPage.evaluate(async own=>{const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
  await new Promise(resolve=>ws.addEventListener('message',function on(e){if(JSON.parse(e.data).type==='welcome'){ws.removeEventListener('message',on);resolve();}}));
  ws.send(JSON.stringify({type:'auction-buy',id:Number(own.id),currency:own.currency,price:Number(own.price)}));
  await new Promise(resolve=>ws.addEventListener('message',e=>{const t=JSON.parse(e.data).type;if(t==='auction-result'||t==='error')resolve();}));ws.close();},own);
 await buyerContext.close();
 await win.locator('.auction-bell b').waitFor();await page.waitForTimeout(400);
 await win.locator('.auction-bell').click();await win.locator('.auction-notices li').first().waitFor();await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/notificacoes.png`});
 await win.locator('.auction-bell').click();
 // "Enviar mensagem" on a seller: the window closes and the chat writes privately to them.
 await win.getByRole('button',{name:'Comprar'}).first().click();await win.locator('.auction-seller').first().waitFor();
 await win.locator('tr:not(:has(.auction-own)) .auction-seller').first().click({button:'right'});await page.getByRole('menuitem',{name:'Enviar mensagem'}).click();
 await page.locator('.chat-target').waitFor();await page.waitForTimeout(400);
 await page.screenshot({path:`${output}/mensagem.png`});
 await page.locator('.lobby-dock-button.bag').click();await page.locator('.bag-wallet').waitFor();await page.waitForTimeout(900);
 await page.screenshot({path:`${output}/mochila.png`});
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`Prévias em ${output}/`);
}finally{await browser.close();await db.end();}
