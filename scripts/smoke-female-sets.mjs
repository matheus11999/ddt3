import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {enterGame} from './character-helpers.mjs';

// Buys and wears a female shop set on a fresh local character (Docker dev at 8097), then photographs the lobby:
// the server must accept the purchase and the equipment and keep it after a reload; a male character is refused.
// Usage: node scripts/smoke-female-sets.mjs [item ...]   (defaults to the Estrela Pop set)
const base=process.env.BASE_URL??'http://127.0.0.1:8097/?dev=live',output='test-results/female-sets';
const items=process.argv.slice(2).length?process.argv.slice(2):['outfit-idol','face-idol','hair-idol','hat-idol','glasses-idol'];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const sql=query=>{const r=spawnSync('docker',['exec','brasa-postgres-1','psql','-U','brasa','-d','brasa','-At','-c',query],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
async function client(gender){const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();await enterGame(page,base,gender);await page.waitForLoadState('networkidle');return {context,page};}
async function profile({context}){const r=await context.request.post(new URL('/api/session',base).href,{headers:{Origin:new URL(base).origin}});return (await r.json()).profile;}
async function send({context},commands){
 const session=(await context.cookies(base)).find(c=>c.name==='brasa_session');
 const socket=new WebSocket(new URL('/ws',base).href.replace(/^http/,'ws'),{headers:{Origin:new URL(base).origin,Cookie:`brasa_session=${session.value}`}});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 const errors=[];socket.on('message',raw=>{const e=JSON.parse(String(raw));if(e.type==='error')errors.push(e.message);});
 for(const command of commands){socket.send(JSON.stringify(command));await new Promise(r=>setTimeout(r,700));}
 socket.close();return errors;
}
try{
 const female=await client('female');let p=await profile(female);
 assert.equal(p.equipment.outfit,'outfit-explorer','new women start in the Exploradora da Aurora');
 sql(`UPDATE players SET name='TEST-FEM-${p.id.slice(0,8)}',profile=jsonb_set(profile,'{gold}','5000'::jsonb) WHERE id='${p.id}' AND created_at>now()-interval '5 minutes'`);
 await female.page.goto('about:blank');await female.page.waitForTimeout(32000);await enterGame(female.page,base,'female');
 p=await profile(female);assert.ok(p.gold>=3000,`gold ${p.gold}`);
 const errors=await send(female,[{type:'shop-buy',items},...items.map(item=>({type:'equip',item}))]);
 assert.deepEqual(errors,[],`server refused: ${errors.join('; ')}`);
 p=await profile(female);for(const item of items)assert.equal(p.equipment[{outfit:'outfit',face:'face',hair:'hair',hat:'hat',glasses:'glasses'}[item.split('-')[0]]],item,`${item} not worn`);
 await female.page.reload();await female.page.waitForLoadState('networkidle');await female.page.waitForTimeout(2500);
 await female.page.screenshot({path:`${output}/${items[0]}-lobby.png`});
 const male=await client('male');const refused=await send(male,[{type:'shop-buy',items:[items[0]]}]);
 assert.ok(refused.length,'a male character must not buy a female item');
 console.log(JSON.stringify({ok:true,player:p.name,worn:items,screenshot:`${output}/${items[0]}-lobby.png`,maleRefused:refused[0]}));
}finally{await browser.close();}
