// Guildas against a real Postgres (DATABASE_URL or the local brasa database): founding, joining, upgrades in order,
// the members-only shop, the shared Depósito and GvG Riqueza counted once per battle.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store';
import {MailStore} from '../server/mail';
import {AuctionStore} from '../server/auction';
import {GuildStore} from '../server/guilds';
import {BUILDING_LEVEL_COSTS,GUILD_CREATE_COST,GUILD_LEVEL_COSTS} from '../shared/guilds';

const store=new Store();await store.init();
await new MailStore(store.pool).init();await new AuctionStore(store.pool).init();
const guilds=new GuildStore(store.pool);await guilds.init();
const gold=async(id:string,amount:number)=>{const p=(await store.getProfile(id))!;p.gold=amount;await store.pool.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);};
try{
 const owner=(await store.createGuest('male')).profile,member=(await store.createGuest('female')).profile,rival=(await store.createGuest('male')).profile;
 const name=`Teste ${randomUUID().slice(0,6)}`;
 await gold(owner.id,GUILD_CREATE_COST-1);await assert.rejects(guilds.create(owner.id,name),/custa/);
 await gold(owner.id,GUILD_CREATE_COST+100);
 const {guildId,profile}=await guilds.create(owner.id,name);assert.equal(profile.gold,100);
 await assert.rejects(guilds.create(rival.id,name.toUpperCase()),/(Já existe|custa)/);
 assert.deepEqual(await guilds.membership(owner.id),{guildId,name,role:'owner',smith:0});

 // Asking to join, and only the owner answers.
 await guilds.apply(member.id,guildId);assert.deepEqual((await guilds.state(member.id)).applied,[guildId]);
 await assert.rejects(guilds.answer(member.id,member.id,true),/não faz parte/);
 assert.equal((await guilds.state(owner.id)).guild!.applications!.length,1);
 await guilds.answer(owner.id,member.id,true);
 const view=(await guilds.state(member.id)).guild!;assert.equal(view.members.length,2);assert.equal(view.applications,undefined);
 await assert.rejects(guilds.upgrade(member.id,'guild'),/permissão/);

 // Level 0: nothing can be raised without Riqueza, and buildings wait for the guild level.
 await assert.rejects(guilds.upgrade(owner.id,'guild'),/Faltam/);
 const match=randomUUID();
 assert.equal(await guilds.gvgWin(match,guildId,[owner.id,member.id],100),true);
 assert.equal(await guilds.gvgWin(match,guildId,[owner.id,member.id],100),false);
 let g=(await guilds.state(owner.id)).guild!;assert.equal(g.riqueza,200);assert.deepEqual(g.members.map(m=>m.contribution),[100,100]);assert.deepEqual(g.members.map(m=>m.today),[100,100]);
 // Daily missions: progress only for members, claimed once, reward to the member and the guild.
 assert.deepEqual(await guilds.missionProgress([member.id,rival.id],'forge',2),[member.id]);
 await assert.rejects(guilds.claimMission(member.id,'play'),/Termine/);
 assert.deepEqual(await guilds.claimMission(member.id,'forge'),{guildId,reward:4});await assert.rejects(guilds.claimMission(member.id,'forge'),/já recebeu/);
 const mine=(await guilds.state(member.id)).guild!;assert.deepEqual(mine.daily.claimed,['forge']);assert.equal(mine.members.find(m=>m.id===member.id)!.today,104);assert.equal(mine.riqueza,204);assert.equal(mine.ownerName,owner.name);
 await assert.rejects(guilds.upgrade(owner.id,'shop'),/nível da guilda \(0\)/);
 await guilds.upgrade(owner.id,'guild');await guilds.upgrade(owner.id,'shop');
 g=(await guilds.state(owner.id)).guild!;assert.equal(g.level,1);assert.equal(g.buildings.shop,1);assert.equal(g.riqueza,204-GUILD_LEVEL_COSTS[0]-BUILDING_LEVEL_COSTS[0]);
 await assert.rejects(guilds.upgrade(owner.id,'shop'),/nível da guilda \(1\)/);

 // Members-only shop: the necklace for gold.
 await gold(member.id,900);const bought=await guilds.buy(member.id,'necklace-guild-1');assert.equal(bought.profile.gold,100);assert.ok(bought.profile.inventory.includes('necklace-guild-1'));
 await assert.rejects(guilds.buy(rival.id,'necklace-guild-1'),/não faz parte/);

 // Depósito closed at level 0, then shared by every member.
 await assert.rejects(guilds.deposit(member.id,{kind:'item',key:'necklace-guild-1'}),/Construa o Depósito/);
 await guilds.gvgWin(randomUUID(),guildId,[owner.id],BUILDING_LEVEL_COSTS[0]);await guilds.upgrade(owner.id,'storage');
 const deposited=await guilds.deposit(member.id,{kind:'item',key:'necklace-guild-1'});assert.ok(!deposited.profile.inventory.includes('necklace-guild-1'));
 const stored=(await guilds.state(owner.id)).guild!.storage;assert.equal(stored.length,1);assert.equal(stored[0].by,member.name);
 const taken=await guilds.withdraw(owner.id,stored[0].id);assert.ok(taken.profile.inventory.includes('necklace-guild-1'));
 await assert.rejects(guilds.withdraw(member.id,stored[0].id),/já retirou/);

 // Cargos: a Recrutador answers requests but cannot kick; the Vice-Líder can, except the leader; only the leader edits ranks.
 const recruit=(await store.createGuest('male')).profile,newbie=(await store.createGuest('female')).profile;
 await guilds.apply(recruit.id,guildId);await guilds.answer(owner.id,recruit.id,true);
 assert.equal((await guilds.state(recruit.id)).guild!.applications,undefined);
 await guilds.setRank(owner.id,recruit.id,2);assert.equal((await guilds.state(recruit.id)).guild!.myRank,2);
 await guilds.apply(newbie.id,guildId);assert.equal((await guilds.state(recruit.id)).guild!.applications!.length,1);
 await guilds.answer(recruit.id,newbie.id,true);
 await assert.rejects(guilds.kick(recruit.id,newbie.id),/permissão/);
 await guilds.setRank(owner.id,member.id,1);
 await assert.rejects(guilds.kick(member.id,owner.id),/abaixo do seu/);await assert.rejects(guilds.setRank(member.id,recruit.id,1),/abaixo do seu/);
 await guilds.kick(member.id,newbie.id);await assert.rejects(guilds.disband(member.id),/Só o líder/);
 const ranks=(await guilds.state(owner.id)).guild!.ranks.map(r=>r.id===2?{...r,name:'Comandante',permissions:['recruit' as const,'kick' as const]}:r);
 await assert.rejects(guilds.saveRanks(member.id,ranks),/Só o líder/);
 await guilds.saveRanks(owner.id,ranks);const renamed=(await guilds.state(recruit.id)).guild!;
 assert.equal(renamed.ranks[2].name,'Comandante');assert.deepEqual(renamed.ranks[2].permissions,['recruit','kick']);assert.equal(renamed.ranks[0].permissions.length,5);
 await assert.rejects(guilds.saveRanks(owner.id,ranks.map(r=>({...r,name:'Igual'}))),/nome diferente/);
 await guilds.kick(member.id,recruit.id);

 // The owner leaving hands the guild over; the last one out closes it.
 await guilds.kick(member.id,owner.id).then(()=>assert.fail('member kicked owner'),e=>assert.match(e.message,/abaixo do seu/));
 await guilds.leave(owner.id);assert.equal((await guilds.membership(member.id))!.role,'owner');assert.equal((await guilds.state(member.id)).guild!.myRank,0);
 const closed=await guilds.leave(member.id);assert.equal(closed.dissolved,true);assert.equal(await guilds.membership(member.id),null);
 assert.ok(!(await guilds.list(name)).length);
 // The leader can also close the guild outright.
 const other=`Fim ${randomUUID().slice(0,6)}`;await gold(rival.id,GUILD_CREATE_COST);const made=await guilds.create(rival.id,other);
 await guilds.apply(owner.id,made.guildId);await guilds.answer(rival.id,owner.id,true);
 const gone=await guilds.disband(rival.id);assert.deepEqual([...gone.members].sort(),[owner.id,rival.id].sort());assert.equal(await guilds.membership(owner.id),null);
 console.log('guilds integration ok');
}finally{await store.pool.end();}
