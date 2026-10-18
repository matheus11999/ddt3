// Pets against a real Postgres (DATABASE_URL or the local brasa database), with TEST-ONLY fixtures:
// versioned migrations, persistence across a restart, concurrent feeding, a battle result applied once,
// the snapshot in the saved profile. Every test player is deleted at the end (pets cascade with them).
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import './fixtures/pets';
import {Store} from '../server/store';
import {PetStore} from '../server/pets';
import {attributes} from '../shared/catalog';
import {PET_CONFIG} from '../shared/petConfig';

const store=new Store();await store.init();
const pets=new PetStore(store.pool,undefined,()=>0);await pets.init();await pets.init();
const created:string[]=[];
const guest=async()=>{const {profile}=await store.createGuest('male');created.push(profile.id);return profile;};
const setFood=async(id:string,food:Record<string,number>)=>{const p=(await store.getProfile(id))!;p.petFood=food;await store.pool.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);};
try{
 const migrations=await store.pool.query('SELECT version FROM pet_migrations ORDER BY version');assert.deepEqual(migrations.rows.map(r=>r.version),[1]);
 const owner=await guest(),other=await guest();
 assert.deepEqual((await pets.list(owner.id)).pets,[]);
 const {pet}=await pets.grant(owner.id,'test-pet',{source:'test'});
 const bare=attributes((await store.getProfile(owner.id))!.equipment,owner.level);
 await pets.equip(owner.id,pet.id);
 // Restart: a new store reads the same pet, and the saved profile carries the snapshot into every later read.
 const restarted=new PetStore(store.pool);await restarted.init();
 const after=(await restarted.list(owner.id)).pets;assert.equal(after.length,1);assert.equal(after[0].equipped,true);
 const saved=(await store.getProfile(owner.id))!;assert.equal(saved.equipment.pet?.id,pet.id);assert.equal(attributes(saved.equipment,owner.level).attack,bare.attack+100);
 // Other profile writers keep the snapshot (equipment saves rebuild the equipment from the stored row).
 await store.saveEquipment(owner.id,{...saved.equipment,pet:undefined});assert.equal((await store.getProfile(owner.id))!.equipment.pet?.id,pet.id);
 await assert.rejects(pets.equip(other.id,pet.id),/não é seu/);

 // Concurrent feedings: only the food that exists is spent.
 await store.pool.query('UPDATE player_pets SET vitality=0 WHERE id=$1',[pet.id]);await setFood(owner.id,{'pet-food-test':2});
 const results=await Promise.allSettled([1,2,3,4,5].map(()=>pets.feed(owner.id,pet.id,'pet-food-test',1)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
 assert.equal((await store.getProfile(owner.id))!.petFood['pet-food-test'],undefined);
 assert.equal((await pets.list(owner.id)).pets[0].vitality,60);
 assert.equal(Number((await store.pool.query('SELECT sum(quantity)::int AS n FROM pet_feedings WHERE pet_id=$1',[pet.id])).rows[0].n),2);
 assert.equal((await store.getProfile(owner.id))!.equipment.pet?.vitality,60);

 // A battle result delivered twice is applied once.
 const battle=randomUUID(),entry={ownerId:owner.id,petId:pet.id,mode:'pve' as const,won:true};
 const [first,second]=await Promise.all([pets.settleBattle(battle,[entry]),pets.settleBattle(battle,[entry])]);
 assert.equal(first.size+second.size,1);
 const settled=(await pets.list(owner.id)).pets[0];assert.equal(settled.xp,PET_CONFIG.progression.sources.pveWin);assert.equal(settled.vitality,60-PET_CONFIG.vitality.battleCost.pve);
 assert.equal(Number((await store.pool.query('SELECT count(*)::int AS n FROM pet_battle_results WHERE battle_id=$1',[battle])).rows[0].n),1);

 // Releasing removes the pet but keeps the audit trail.
 await pets.unequip(owner.id,pet.id);await pets.release(owner.id,pet.id,pet.name);
 assert.deepEqual((await pets.list(owner.id)).pets,[]);assert.equal((await store.getProfile(owner.id))!.equipment.pet,undefined);
 const kinds=(await store.pool.query('SELECT kind FROM pet_events WHERE pet_id=$1 ORDER BY at',[pet.id])).rows.map(r=>r.kind);
 for(const kind of ['PET_OBTAINED','PET_EQUIPPED','PET_FED','PET_BATTLE_SETTLED','PET_RELEASED'])assert.ok(kinds.includes(kind),kind);
 console.log('pets integration ok');
}finally{
 if(created.length)await store.pool.query('DELETE FROM players WHERE id=ANY($1::uuid[])',[created]);
 await store.pool.end();
}
