import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Only creates, mutates and deletes its own tagged throwaway guest.
const script=String.raw`
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from './server/store.ts';
import {DEFAULT_EQUIPMENT,UNEQUIP} from './shared/catalog.ts';
const store=new Store(),matchId=randomUUID();let id;
try {
 const created=await store.createGuest();id=created.profile.id;await store.rename(id,'TEST Economy Integration');
 const starter=await store.getProfile(id);
 assert.ok(Object.values(UNEQUIP).every(item=>starter.inventory.includes(item)));
 assert.ok(!starter.inventory.includes('volt')&&!starter.inventory.includes('outfit-dancer'));
 assert.ok(starter.compositionStones['attack-1']>0);
 const seed={...starter,gold:1000,level:50,xp:18540};
 await store.pool.query('UPDATE players SET profile=$2 WHERE id=$1 AND name=$3',[id,seed,'TEST Economy Integration']);
 assert.equal((await store.getProfile(id)).level,62);
 const purchases=await Promise.allSettled([store.buy(id,['volt']),store.buy(id,['volt'])]);
 assert.equal(purchases.filter(p=>p.status==='fulfilled').length,1);
 let profile=await store.getProfile(id);assert.equal(profile.gold,640);assert.equal(profile.inventory.filter(item=>item==='volt').length,1);
 const before=structuredClone(profile);await assert.rejects(store.buy(id,['crystal','outfit-executive']),/insuficientes/);assert.deepEqual(await store.getProfile(id),before);
 const maxSeed={...profile,level:69,xp:20690};await store.pool.query('UPDATE players SET profile=$2 WHERE id=$1 AND name=$3',[id,maxSeed,'TEST Economy Integration']);
 const bonus={[id]:{kind:'coins',amount:150}};
 await Promise.all([store.finishMatch(matchId,[id],[id],bonus),store.finishMatch(matchId,[id],[id],bonus)]);
 profile=await store.getProfile(id);assert.equal(profile.gold,870);assert.equal(profile.xp,20810);assert.equal(profile.level,70);assert.equal(profile.matches,1);assert.equal(profile.wins,1);
 await store.finishMatch(matchId,[id],[id],bonus);assert.deepEqual(await store.getProfile(id),profile);
 const hats=['hat-thunder','hat-tide','hat-ruby','hat-tropical'];
 assert.ok(hats.every(hat=>!profile.inventory.includes(hat)));
 const balance=profile.gold;await store.buy(id,hats);profile=await store.getProfile(id);
 assert.equal(profile.gold,balance-640);assert.ok(hats.every(hat=>profile.inventory.includes(hat)));
 for(const hat of hats){await store.saveEquipment(id,{...profile.equipment,hat});assert.equal((await store.getProfile(id)).equipment.hat,hat);}
 console.log(JSON.stringify({ok:true,starterKit:true,legacyXpPromoted:true,concurrentShopPurchase:true,atomicInsufficientCart:true,newHatsPurchasedAndEquipped:true,concurrentRewardIdempotency:true,cap70:true}));
} finally {
 await store.pool.query('DELETE FROM matches WHERE id=$1',[matchId]);
 if(id)await store.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[id,'TEST Economy Integration']);
 await store.pool.end();
}
`;
const result=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:script,encoding:'utf8',timeout:30000});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);assert.equal(result.status,0,'PostgreSQL economy integration failed');
