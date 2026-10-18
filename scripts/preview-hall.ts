// Hall da Fama preview against a running game (Vite + server, or Docker). WRITES TEST DATA into the game's
// database (DATABASE_URL): about fifteen made-up adventurers, two guilds and PvP results for today, this week and
// last week, which then closes so the Lendas have something to show. Use only on a local development database.
// Screenshots in test-results/hall/. Usage: npx tsx scripts/preview-hall.ts
import {chromium} from '@playwright/test';
import type {Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store';
import {GuildStore} from '../server/guilds';
import {HallStore} from '../server/hall';
import type {MatchRecord} from '../server/hall';
import {GUILD_CREATE_COST} from '../shared/guilds';
import type {Profile} from '../shared/protocol';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/hall';await mkdir(output,{recursive:true});
const store=new Store(),guilds=new GuildStore(store.pool),hall=new HallStore(store.pool);await hall.loadConfig();
const pool=store.pool;
const edit=async(id:string,change:(p:Profile)=>void)=>{const p=(await store.getProfile(id))!;change(p);await pool.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);};
const NAMES=['DragonKing','Thunder','Shadow','Phoenix','Lumina','Faísca','Brasinha','Tempestade','Cometa','Nébula','Rubi','Aurora','Trovão','Safira'];
const players:Profile[]=[];
for(const [i,name] of NAMES.entries()){
 const p=(await store.createGuest(i%3===1?'female':'male')).profile;await store.rename(p.id,name);
 await edit(p.id,q=>{q.level=Math.max(1,62-i*4);q.xp=(q.level-1)*300+i*37;q.upgrades[q.equipment.weapon]=Math.max(0,15-i);q.gold=GUILD_CREATE_COST*2;});
 players.push({...p,name});
}
const red=(await guilds.create(players[0].id,`Fênix ${randomUUID().slice(0,3)}`)).guildId,blue=(await guilds.create(players[1].id,`Lobos ${randomUUID().slice(0,3)}`)).guildId;
for(const [i,p] of players.slice(2,12).entries()){const g=i%2?blue:red,owner=g===red?players[0]:players[1];await guilds.apply(p.id,g);await guilds.answer(owner.id,p.id,true);}

const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1536,height:864}});
await page.goto(base);
const me=await page.evaluate(async()=>(await (await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender:'male'})})).json()).profile as {id:string});
await store.rename(me.id,'Matheus');await edit(me.id,q=>{q.level=34;q.xp=33*300+120;});

const battle=async(a:string[],b:string[],winner:0|1,at:number)=>{
 const rec:MatchRecord={matchId:randomUUID(),kind:'pvp',mode:`${a.length}v${b.length}`,winnerTeam:winner,startedAt:at-180_000,finishedAt:at,participants:[...a.map(id=>({id,team:0 as const,left:false})),...b.map(id=>({id,team:1 as const,left:false}))]};
 const c=await pool.connect();try{await c.query('BEGIN');await hall.record(c,rec);await c.query('COMMIT');}finally{c.release();}
};
const now=Date.now(),ids=[...players.map(p=>p.id),me.id];
// Stronger names win more often: today, earlier this week and last week (which closes below).
for(const [offset,count] of [[0,60],[2*86400_000,50],[8*86400_000,70]] as const)for(let i=0;i<count;i++){
 const x=Math.floor(Math.random()**1.6*ids.length),y=(x+1+Math.floor(Math.random()*(ids.length-1)))%ids.length;
 await battle([ids[x]],[ids[y]],Math.random()<.72?0:1,now-offset-Math.floor(Math.random()*6)*3600_000-60_000);
}
await battle([me.id],[players[13].id],0,now-30_000);await battle([me.id],[players[12].id],0,now-20_000);
await hall.closeDue(now);await hall.deliverRewards();
await new Promise(resolve=>setTimeout(resolve,5000));// the server measures the new profiles

const shot=async(p:Page,name:string)=>{await p.waitForTimeout(800);await p.screenshot({path:`${output}/${name}.png`});console.log(`${output}/${name}.png`);};
const open=async(p:Page)=>{await p.reload();await p.waitForSelector('.lobby-dock-button.hall');await p.click('.lobby-dock-button.hall');await p.waitForSelector('.hof-screen .hof-table');};
await open(page);await shot(page,'01-poder');
const cat=async(label:string)=>{await page.click(`.hof-cats button:has-text("${label}")`);await page.waitForTimeout(500);};
const side=async(label:string)=>{await page.click(`.hof-sides button:has-text("${label}")`);await page.waitForTimeout(600);};
await cat('PvP');await shot(page,'02-pvp-diario');
await page.click('.hof-periods button:has-text("Semanal")');await page.waitForTimeout(500);await page.click('.hof-table tbody tr >> nth=3');await shot(page,'03-pvp-semanal-4o');
await page.click('.hof-pager button:has-text("Próximo")').catch(()=>{});await shot(page,'04-pvp-pagina-2');
await side('Guildas');await shot(page,'05-guildas-poder');
await cat('PvP');await shot(page,'06-guildas-pvp');
await side('Jogadores');await cat('Nível');await shot(page,'07-nivel');
await cat('Conquistas');await shot(page,'08-conquistas');
await side('Lendas');await page.waitForTimeout(800);await shot(page,'09-lendas-semanal');
await side('Jogadores');await cat('PvP');await page.click('.hof-plate-actions button:has-text("Ver equipamento")');await shot(page,'13-ver-equipamento');
await page.close();
// Mobile, landscape.
const phone=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await phone.goto(base);await phone.evaluate(async()=>{await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender:'female'})});});
await open(phone);await phone.click('.hof-cats button:has-text("PvP")');await shot(phone,'12-celular');
await browser.close();await pool.end();
