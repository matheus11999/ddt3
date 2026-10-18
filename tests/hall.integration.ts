// Hall da Fama against a real Postgres (DATABASE_URL or the local brasa database). Each run uses its own board scope,
// so PvP boards, closings and titles start empty; Poder/Evolução boards are global and are checked by relative order.
// Covers the 20 acceptance scenarios of docs/hall-of-fame.md.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store';
import {MailStore} from '../server/mail';
import {AuctionStore} from '../server/auction';
import {GuildStore} from '../server/guilds';
import {HallStore} from '../server/hall';
import type {MatchRecord} from '../server/hall';
import {GUILD_CREATE_COST} from '../shared/guilds';
import {DEFAULT_HALL_CONFIG} from '../shared/hall';
import type {Profile} from '../shared/protocol';

const store=new Store();await store.init();
await new MailStore(store.pool).init();await new AuctionStore(store.pool).init();
const guilds=new GuildStore(store.pool);await guilds.init();
const scope=`t${randomUUID().slice(0,8)}`;
let hall=new HallStore(store.pool,scope);await hall.init();store.hall=hall;
hall.config={...structuredClone(DEFAULT_HALL_CONFIG),closeGraceSeconds:300};
const pool=store.pool;
const step=(name:string)=>console.log(`✓ ${name}`);

const T=(iso:string)=>new Date(iso).getTime();
const player=async(name:string,gender:'male'|'female'='male'):Promise<Profile>=>{const p=(await store.createGuest(gender)).profile;await store.rename(p.id,name);return {...p,name};};
const setProfile=async(id:string,change:(p:Profile)=>void)=>{const p=(await store.getProfile(id))!;change(p);await pool.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);};
const settle=async()=>{while(await hall.refreshStandings()>0);};
let counter=0;
/** One battle: team 0 against team 1, the winner team (or null for a draw), when it ended. */
const battle=async(team0:string[],team1:string[],winner:0|1|null,at:number,extra:Partial<MatchRecord>={})=>{
 const rec:MatchRecord={matchId:randomUUID(),kind:'pvp',mode:`${team0.length}v${team1.length}`,winnerTeam:winner,startedAt:at-120_000,finishedAt:at,
  participants:[...team0.map(id=>({id,team:0 as const,left:false})),...team1.map(id=>({id,team:1 as const,left:false}))],...extra};
 const c=await pool.connect();try{await c.query('BEGIN');const ok=await hall.record(c,rec);await c.query('COMMIT');counter++;return {rec,ok};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
};
const totals=async(id:string,period:string,key:string)=>(await pool.query('SELECT wins,losses,distinct_wins FROM pvp_totals WHERE scope=$1 AND period=$2 AND period_key=$3 AND player_id=$4',[scope,period,key,id])).rows[0]??null;
const top=async(period:'day'|'week'|'all',viewer:string,page=1)=>{
 // Boards ask for "now"; the test reads stored periods directly through the same SQL order.
 const r=await pool.query(`SELECT player_id::text AS id,wins,losses FROM pvp_totals t WHERE scope=$1 AND period=$2 AND period_key=$3 ORDER BY t.wins DESC,t.distinct_wins DESC,t.losses ASC,t.reached_at ASC NULLS LAST,t.player_id LIMIT 10 OFFSET $4`,[scope,period,viewer,(page-1)*10]);
 return r.rows.map(row=>row.id as string);
};
const gold=async(id:string,amount:number)=>setProfile(id,p=>{p.gold=amount;});
const mails=async(id:string)=>num((await pool.query("SELECT count(*) FROM player_mail WHERE player_id=$1 AND sender='Hall da Fama'",[id])).rows[0].count);
function num(v:unknown){return Number(v??0);}

try{
 const [ana,bia,caio,davi,eva,fabi]=await Promise.all(['Ana','Bia','Caio','Davi','Eva','Fabi'].map(n=>player(`${n}${scope.slice(1,5)}`)));
 // Monday 05/01/2026 in Brasília (UTC−3).
 const MON='2026-01-05',TUE='2026-01-06';

 // 1. Different numbers of wins: more wins ranks higher.
 await battle([ana.id],[bia.id],0,T('2026-01-05T15:00:00Z'));
 await battle([ana.id],[caio.id],0,T('2026-01-05T15:10:00Z'));
 await battle([bia.id],[caio.id],0,T('2026-01-05T15:20:00Z'));
 assert.deepEqual((await top('day',MON,1)).slice(0,3),[ana.id,bia.id,caio.id]);
 step('1. mais vitórias fica na frente');

 // 2. A tie on wins: distinct opponents, then fewer losses, then who got there first.
 const [g1,g2,g3,g4]=await Promise.all(['Gil','Guto','Gabi','Gina'].map(n=>player(`${n}${scope.slice(1,5)}`)));
 await battle([g1.id],[g3.id],0,T('2026-01-07T12:00:00Z'));await battle([g1.id],[g3.id],0,T('2026-01-07T12:05:00Z'));// g1: 2 wins, 1 distinct
 await battle([g2.id],[g3.id],0,T('2026-01-07T12:10:00Z'));await battle([g2.id],[g4.id],0,T('2026-01-07T12:15:00Z'));// g2: 2 wins, 2 distinct
 let order=await top('day','2026-01-07');assert.deepEqual(order.slice(0,2),[g2.id,g1.id]);
 await battle([g4.id],[g1.id],0,T('2026-01-07T12:20:00Z'));// g1 now has a loss; still behind g2
 await battle([g3.id],[g4.id],0,T('2026-01-07T12:30:00Z'));await battle([g3.id],[g2.id],0,T('2026-01-07T12:31:00Z'));// g3: 2 wins, 2 distinct, 2 losses; g2 1 loss
 order=await top('day','2026-01-07');assert.deepEqual(order.slice(0,3),[g2.id,g3.id,g1.id]);
 step('2. empate decidido por adversários distintos, derrotas e horário');

 // 3. Poder follows the current equipment, also downwards; 4. the player needs no connection to stay ranked.
 await settle();
 const powerOf=async(id:string)=>num((await pool.query('SELECT power FROM player_standings WHERE player_id=$1',[id])).rows[0]?.power);
 const before=await powerOf(ana.id);
 await setProfile(ana.id,p=>{p.upgrades[p.equipment.weapon]=12;});await settle();
 const strong=await powerOf(ana.id);assert.ok(strong>before,`forge raises Poder (${before} → ${strong})`);
 await setProfile(ana.id,p=>{p.upgrades[p.equipment.weapon]=0;});await settle();
 assert.equal(await powerOf(ana.id),before,'Poder drops back when the forge level is gone (not the best ever)');
 const board=await hall.board(bia.id,{category:'power'});assert.ok(board.me&&board.me.rank>0&&board.rows.length>0);
 step('3. Poder cai quando o equipamento piora; 4. jogador offline continua no ranking');

 // 5. Midnight: two battles ending 0.2 s apart land on different days of the same week.
 await battle([davi.id],[eva.id],0,T('2026-01-06T02:59:59.900Z'));
 await battle([eva.id],[davi.id],0,T('2026-01-06T03:00:00.100Z'));
 assert.equal((await totals(davi.id,'day',MON)).wins,1);assert.equal((await totals(eva.id,'day',TUE)).wins,1);
 assert.equal((await totals(davi.id,'week',MON)).wins,1);assert.equal((await totals(eva.id,'week',MON)).wins,1);
 step('5. virada do dia com batalhas simultâneas');

 // 6. The week turns at Monday 00:00 in Brasília.
 await battle([fabi.id],[eva.id],0,T('2026-01-12T02:59:59Z'));// Sunday 23:59:59
 await battle([fabi.id],[eva.id],0,T('2026-01-12T03:00:01Z'));// Monday 00:00:01
 assert.equal((await totals(fabi.id,'week','2026-01-05')).wins,1);assert.equal((await totals(fabi.id,'week','2026-01-12')).wins,1);
 assert.equal((await totals(fabi.id,'all','all')).wins,2);
 step('6. virada da semana na segunda-feira 00h');

 // 7/8. Contributions stay with the guild of the moment; a new guild only gets new wins.
 await gold(caio.id,GUILD_CREATE_COST*2);await gold(davi.id,GUILD_CREATE_COST*2);
 const red=(await guilds.create(caio.id,`R${scope.slice(1,8)}`)).guildId,blue=(await guilds.create(davi.id,`B${scope.slice(1,8)}`)).guildId;
 await guilds.apply(bia.id,red);await guilds.answer(caio.id,bia.id,true);
 await battle([bia.id],[ana.id],0,T('2026-01-14T15:00:00Z'));
 await guilds.leave(bia.id);await guilds.apply(bia.id,blue);await guilds.answer(davi.id,bia.id,true);
 await battle([bia.id],[ana.id],0,T('2026-01-14T15:10:00Z'));
 const guildWins=async(guild:number)=>num((await pool.query("SELECT sum(wins) AS n FROM guild_pvp_totals WHERE scope=$1 AND period='all' AND guild_id=$2",[scope,guild])).rows[0].n);
 assert.equal(await guildWins(red),1);assert.equal(await guildWins(blue),1);
 step('7. sair da guilda não apaga a contribuição; 8. a nova guilda só ganha vitórias novas');

 // 10. The same result twice counts once, also through the battle save.
 const dup=await battle([ana.id],[fabi.id],0,T('2026-01-15T15:00:00Z'));
 const again=await (async()=>{const c=await pool.connect();try{await c.query('BEGIN');const ok=await hall.record(c,dup.rec);await c.query('COMMIT');return ok;}finally{c.release();}})();
 assert.equal(again,false);
 const viaStore={...dup.rec,matchId:randomUUID()};
 await store.finishMatch(viaStore.matchId,[ana.id],[ana.id,fabi.id],{},viaStore);await store.finishMatch(viaStore.matchId,[ana.id],[ana.id,fabi.id],{},viaStore);
 assert.equal((await totals(ana.id,'day','2026-01-15')).wins,2);
 step('10. o mesmo resultado processado duas vezes conta uma vez');

 // 18. 2×2: each winner gets a win, each loser a loss; a leaver of the losing side gets the loss too.
 const team=await battle([g1.id,g2.id],[g3.id,g4.id],1,T('2026-01-16T15:00:00Z'),{participants:[{id:g1.id,team:0,left:true},{id:g2.id,team:0,left:false},{id:g3.id,team:1,left:false},{id:g4.id,team:1,left:false}]});
 assert.ok(team.ok);
 for(const [id,w,l] of [[g1.id,0,1],[g2.id,0,1],[g3.id,1,0],[g4.id,1,0]] as const){const t=await totals(id,'day','2026-01-16');assert.deepEqual([t.wins,t.losses],[w,l]);}
 step('18. partida por equipes contabiliza cada membro');

 // 19. Training with bots does not count by default; with the setting on it counts for the player, never the guild.
 await battle([caio.id],[],0,T('2026-01-16T16:00:00Z'),{kind:'practice'});
 assert.equal(await totals(caio.id,'day','2026-01-16'),null);
 hall.config.countPractice=true;
 await battle([caio.id],[],0,T('2026-01-16T16:05:00Z'),{kind:'practice'});
 assert.equal((await totals(caio.id,'day','2026-01-16')).wins,1);
 assert.equal(num((await pool.query("SELECT count(*) FROM guild_pvp_totals WHERE scope=$1 AND period='day' AND period_key='2026-01-16' AND player_id=$2",[scope,caio.id])).rows[0].count),0);
 hall.config.countPractice=false;
 step('19. batalha contra bots só conta com a configuração ligada, e nunca para a guilda');

 // 9. A 50-member guild against a 10-member one: only the strongest count.
 const strongIds:string[]=[];
 for(let i=0;i<3;i++){const p=await player(`Forte${i}${scope.slice(1,4)}`);strongIds.push(p.id);await setProfile(p.id,q=>{q.upgrades[q.equipment.weapon]=15;q.level=70;});}
 await settle();
 hall.config.guildPowerMembers=2;
 const rows=await (hall as unknown as {guildBoard:(db:unknown,b:string,p:string,k:string)=>Promise<{id:string;score:number}[]>}).guildBoard(pool,'power','all','all');
 const redRow=rows.find(r=>r.id===String(red))!;const redMembers=(await pool.query('SELECT s.power FROM guild_members gm JOIN player_standings s ON s.player_id=gm.player_id WHERE gm.guild_id=$1 ORDER BY s.power DESC',[red])).rows.map(r=>num(r.power));
 assert.equal(redRow.score,redMembers.slice(0,2).reduce((a,b)=>a+b,0));
 hall.config.guildPowerMembers=DEFAULT_HALL_CONFIG.guildPowerMembers;
 step('9. Poder da guilda soma só os membros mais fortes (limite configurável)');

 // 13. A fraudulent battle comes out of the boards and the alerts; restoring it brings it back.
 hall.config.alerts={...hall.config.alerts,pairPerDay:3,shortBattleSeconds:30};
 let last:MatchRecord|null=null;
 for(let i=0;i<3;i++)last=(await battle([eva.id],[fabi.id],0,T(`2026-01-20T15:0${i}:00Z`),{startedAt:T(`2026-01-20T15:0${i}:00Z`)-10_000})).rec;
 const alerts=await pool.query("SELECT kind FROM hall_alerts WHERE match_id=$1",[last!.matchId]);
 assert.ok(alerts.rows.some(r=>r.kind==='pair'),'repeated pair flagged');assert.ok(alerts.rows.some(r=>r.kind==='short'),'short battle flagged');
 assert.equal((await totals(eva.id,'day','2026-01-20')).wins,3);
 await hall.voidMatch(last!.matchId,'Combinação de resultados','teste');
 assert.equal((await totals(eva.id,'day','2026-01-20')).wins,2);assert.equal((await totals(fabi.id,'day','2026-01-20')).losses,2);
 await assert.rejects(hall.voidMatch(last!.matchId,'de novo','teste'),/já foi excluída/);
 await hall.voidMatch(last!.matchId,'Revisado','teste',true);assert.equal((await totals(eva.id,'day','2026-01-20')).wins,3);
 assert.ok(num((await pool.query("SELECT count(*) FROM hall_audit WHERE action IN ('void','restore') AND detail->>'matchId'=$1",[last!.matchId])).rows[0].count)>=2);
 hall.config.alerts={...DEFAULT_HALL_CONFIG.alerts};
 step('13. partida fraudulenta removida e recontada, com auditoria');

 // The incremental totals equal a full recount from the results.
 const snapshotTotals=async()=>(await pool.query("SELECT period,period_key,player_id::text,wins,losses,distinct_wins FROM pvp_totals WHERE scope=$1 ORDER BY 1,2,3",[scope])).rows;
 const snapshotGuilds=async()=>(await pool.query("SELECT period,period_key,guild_id,player_id::text,wins FROM guild_pvp_totals WHERE scope=$1 ORDER BY 1,2,3,4",[scope])).rows;
 const incremental=await snapshotTotals(),incrementalGuilds=await snapshotGuilds();
 await hall.rebuild('teste');
 assert.deepEqual(await snapshotTotals(),incremental);assert.deepEqual(await snapshotGuilds(),incrementalGuilds);
 step('recontagem a partir dos eventos bate com a contagem incremental');

 // Closing 05/01 to 07/01: snapshot, titles and rewards; a late battle of a closed day only counts overall.
 const closeAt=T('2026-01-08T03:00:00Z')+301_000;
 const closed=await hall.closeDue(closeAt);assert.equal(closed,3,'three days closed');
 const daySnap=(await pool.query("SELECT rows FROM hall_snapshots WHERE scope=$1 AND board='pvp-day' AND period_key=$2",[scope,MON])).rows[0].rows;
 // Davi won his only battle there at 23:59:59.9 (no loss), so he passes Bia (one loss).
 assert.deepEqual(daySnap.slice(0,3).map((r:{id:string})=>r.id),[ana.id,davi.id,bia.id]);
 const late=await battle([caio.id],[ana.id],0,T('2026-01-05T20:00:00Z'));assert.ok(late.ok);
 assert.equal((await totals(caio.id,'day',MON))?.wins??0,0,'a closed day does not change');
 assert.equal(num((await pool.query('SELECT skip_day FROM pvp_results WHERE match_id=$1 AND player_id=$2',[late.rec.matchId,caio.id])).rows[0].skip_day?1:0),1);
 const stillSnap=(await pool.query("SELECT rows FROM hall_snapshots WHERE scope=$1 AND board='pvp-day' AND period_key=$2",[scope,MON])).rows[0].rows;assert.deepEqual(stillSnap,daySnap);
 step('virada segura: resultado atrasado não altera um dia já oficializado');

 // 14. Rewards: delivered once, even when asked again or by a second process.
 const first=await hall.deliverRewards();const second=await hall.deliverRewards();
 assert.ok(first.includes(ana.id));assert.deepEqual(second,[]);
 const anaMails=await mails(ana.id);assert.ok(anaMails>=1);
 assert.equal(await mails(ana.id),anaMails);
 assert.equal(num((await pool.query("SELECT count(*) FROM hall_rewards r JOIN hall_snapshots s ON s.id=r.snapshot_id WHERE s.scope=$1 AND r.subject_id=$2 AND s.period_key=$3",[scope,ana.id,MON])).rows[0].count),1);
 step('14. recompensa entregue não é entregue de novo');

 // 11/15. A restart (new process) during the weekly closing: nothing closes twice, boards come back the same.
 const boardBefore=await hall.legends('pvp-day');
 hall=new HallStore(store.pool,scope);await hall.init();hall.config={...structuredClone(DEFAULT_HALL_CONFIG)};store.hall=hall;
 assert.deepEqual(await hall.legends('pvp-day'),boardBefore);
 const weekEnd=T('2026-01-12T03:00:00Z')+301_000;
 // Two processes racing the same closing: one closes the week, the other finds nothing to do.
 const other=new HallStore(store.pool,scope);other.config=hall.config;
 const [x,y]=await Promise.all([hall.closeDue(weekEnd),other.closeDue(weekEnd)]);
 assert.ok(x+y>=1);
 assert.equal(num((await pool.query("SELECT count(*) FROM hall_snapshots WHERE scope=$1 AND board='pvp-week' AND period_key=$2",[scope,MON])).rows[0].count),1);
 assert.equal(num((await pool.query("SELECT count(*) FROM hall_snapshots WHERE scope=$1 AND board='guild-week' AND period_key=$2",[scope,MON])).rows[0].count),1);
 step('11. reinício durante o fechamento semanal não duplica; 15. rankings iguais após reiniciar');

 // 20. A guild renamed or dissolved after a title keeps its title under the old name.
 await hall.closeDue(T('2026-01-19T03:00:00Z')+301_000);// closes the week of 12/01 and its days
 await hall.closeDue(T('2026-01-26T03:00:00Z')+301_000);
 const guildTitle=(await pool.query("SELECT subject_id,name FROM hall_titles WHERE scope=$1 AND board='guild-week' ORDER BY id LIMIT 1",[scope])).rows[0];
 assert.ok(guildTitle,'a guild won a weekly title');
 await pool.query("UPDATE guilds SET name=name||'x' WHERE id=$1",[Number(guildTitle.subject_id)]);
 assert.equal((await hall.legends('guild-week')).leaders.find(l=>l.id===guildTitle.subject_id)?.name,guildTitle.name);
 await guilds.disband((await pool.query('SELECT owner_id::text FROM guilds WHERE id=$1',[Number(guildTitle.subject_id)])).rows[0].owner_id);
 assert.equal((await hall.legends('guild-week')).leaders.find(l=>l.id===guildTitle.subject_id)?.name,guildTitle.name);
 step('20. guilda renomeada ou dissolvida mantém o título');

 // 17. Several weeks later the old weeks still read exactly as they closed.
 const weeks=await hall.legends('pvp-week');assert.ok(weeks.periods.length>=3,`${weeks.periods.length} weeks`);
 const oldest=await hall.legends('pvp-week','2026-01-05');
 await store.rename(ana.id,`Renomeada${scope.slice(1,4)}`);await settle();
 assert.deepEqual((await hall.legends('pvp-week','2026-01-05')).rows,oldest.rows);
 assert.ok(oldest.rows[0].name.length>0);
 const counts=(await hall.profile(ana.id))!.titleCounts;assert.ok(counts['pvp-day'][1]>=1,'Ana counts her daily title');
 step('17. semanas antigas continuam corretas depois de várias semanas');

 // 12/16. Hundreds of players: someone at position 500 sees their place quickly.
 const crowd:string[]=[];
 const values:string[]=[],args:unknown[]=[];
 for(let i=0;i<520;i++){const id=randomUUID();crowd.push(id);values.push(`($${args.length+1}::uuid,$${args.length+2},$${args.length+3})`);args.push(id,`Massa${i}`,{id,name:`Massa${i}`,gender:'male',xp:i*10});}
 await pool.query(`INSERT INTO players(id,name,profile) VALUES ${values.join(',')}`,args);
 await settle();
 const weekKey=(await hall.board(ana.id,{category:'pvp',period:'week'})).periodKey!;
 const rowsSql:string[]=[],rowArgs:unknown[]=[scope,weekKey];
 crowd.forEach((id,i)=>{rowsSql.push(`($1,'week',$2,$${rowArgs.length+1}::uuid,$${rowArgs.length+2},0,0,now())`);rowArgs.push(id,1000-i);});
 await pool.query(`INSERT INTO pvp_totals(scope,period,period_key,player_id,wins,losses,distinct_wins,reached_at) VALUES ${rowsSql.join(',')}`,rowArgs);
 const started=performance.now();
 const view=await hall.board(crowd[499],{category:'pvp',period:'week',page:5});
 const elapsed=performance.now()-started;
 assert.equal(view.me?.rank,500);assert.equal(view.rows.length,10);assert.equal(view.rows[0].rank,41);assert.equal(view.pages,5);
 assert.ok(elapsed<1500,`board with 520 players took ${Math.round(elapsed)} ms`);
 const levelView=await hall.board(crowd[0],{category:'level'});assert.ok((levelView.me?.rank??0)>0);
 step(`12. posição 500 consultada (${Math.round(elapsed)} ms); 16. centenas de jogadores`);
 await pool.query('DELETE FROM pvp_totals WHERE scope=$1 AND player_id=ANY($2::uuid[])',[scope,crowd]);
 await pool.query('DELETE FROM players WHERE id=ANY($1::uuid[])',[crowd]);

 // Profiles and guild pages answer.
 const profile=(await hall.profile(bia.id))!;assert.ok(profile.pvp.all.battles>0);
 const blueProfile=(await hall.guildProfile(blue))!;assert.ok(blueProfile.members.length>=2);
 step('perfil de jogador e de guilda');
 console.log(`Hall da Fama: ${counter} batalhas registradas, todos os cenários passaram.`);
}finally{
 await store.pool.end();
}
