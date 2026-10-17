import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Only creates, mutates and deletes its own tagged throwaway guests.
const script=String.raw`
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from './server/store.ts';
import {SLOTS,isEmptyItem} from './shared/catalog.ts';
const store=new Store(),matchId=randomUUID();let id,femaleId;
try {
 const created=await store.createGuest('male');id=created.profile.id;await store.rename(id,'TEST Economy Integration');
 const starter=await store.getProfile(id);
 assert.ok(starter.inventory.every(item=>!isEmptyItem(item)));
 assert.ok(SLOTS.every(slot=>isEmptyItem(starter.equipment[slot])||starter.inventory.includes(starter.equipment[slot])));
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
 const hats=['hat-thunder','hat-tide'];
 assert.ok(hats.every(hat=>!profile.inventory.includes(hat)));
 const balance=profile.gold;await store.buy(id,hats);profile=await store.getProfile(id);
 assert.equal(profile.gold,balance-280);assert.ok(hats.every(hat=>profile.inventory.includes(hat)));
 for(const hat of hats){await store.saveEquipment(id,{...profile.equipment,hat});assert.equal((await store.getProfile(id)).equipment.hat,hat);}
 const maleBefore=await store.getProfile(id);await assert.rejects(store.buy(id,['hat-ruby']),/gênero/);assert.deepEqual(await store.getProfile(id),maleBefore);
 const female=await store.createGuest('female');femaleId=female.profile.id;await store.rename(femaleId,'TEST Economy Feminine');
 const femaleStarter=await store.getProfile(femaleId);assert.equal(femaleStarter.gender,'female');assert.ok(femaleStarter.inventory.every(item=>!isEmptyItem(item)));
 // This tagged fixture removes only its starter beret, so both feminine hats
 // can be purchased and equipped through the same real transactions as the men.
 const femaleSeed={...femaleStarter,inventory:femaleStarter.inventory.filter(item=>item!=='hat-ruby'),equipment:{...femaleStarter.equipment,hat:'hat-none'}};
 await store.pool.query('UPDATE players SET profile=$2 WHERE id=$1 AND name=$3',[femaleId,femaleSeed,'TEST Economy Feminine']);
 const femaleHats=['hat-ruby','hat-tropical'];await store.buy(femaleId,femaleHats);let femaleProfile=await store.getProfile(femaleId);
 assert.equal(femaleProfile.gold,femaleStarter.gold-360);assert.ok(femaleHats.every(hat=>femaleProfile.inventory.includes(hat)));
 for(const hat of femaleHats){await store.saveEquipment(femaleId,{...femaleProfile.equipment,hat});assert.equal((await store.getProfile(femaleId)).equipment.hat,hat);}
 femaleProfile=await store.getProfile(femaleId);await assert.rejects(store.buy(femaleId,['hat-thunder']),/gênero/);assert.deepEqual(await store.getProfile(femaleId),femaleProfile);
 console.log(JSON.stringify({ok:true,starterKit:true,noEmptyInventoryItems:true,legacyXpPromoted:true,concurrentShopPurchase:true,atomicInsufficientCart:true,newHatsPurchasedAndEquipped:true,genderedProfiles:2,oppositeGenderPurchaseRejected:true,concurrentRewardIdempotency:true,cap70:true}));
} finally {
 await store.pool.query('DELETE FROM matches WHERE id=$1',[matchId]);
 if(id)await store.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[id,'TEST Economy Integration']);
 if(femaleId)await store.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[femaleId,'TEST Economy Feminine']);
 await store.pool.end();
}
`;
const result=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:script,encoding:'utf8',timeout:30000});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);assert.equal(result.status,0,'PostgreSQL economy integration failed');
