import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {BASE_URL,TestClient} from './integration';
import type {TestSession} from './integration';
import {attributes,canEquipItem,isEmptyItem,SLOTS,STARTER_COSTUMES} from '../shared/catalog';
import type {CharacterGender} from '../shared/catalog';
import type {Profile} from '../shared/protocol';

function databaseScript(script:string){
 const result=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:script,encoding:'utf8',timeout:30000,windowsHide:true});
 assert.equal(result.status,0,`PostgreSQL gender checks failed: ${result.stderr||result.error||result.stdout}`);return JSON.parse(result.stdout.trim());
}
async function readProfile(session:TestSession){const response=await fetch(`${BASE_URL}/api/session`,{headers:{Cookie:session.cookie},signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);return (await response.json() as {profile:Profile}).profile;}
async function createGender(gender:CharacterGender):Promise<TestSession>{
 const response=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:BASE_URL,'Content-Type':'application/json'},body:JSON.stringify({gender}),signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);const header=response.headers.get('set-cookie')??'';assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=Strict/i);const cookie=header.split(';')[0];const {profile}=await response.json() as {profile:Profile};assert.equal(profile.gender,gender);return {profile,cookie};
}

async function run(){
 const started=performance.now(),clients:TestClient[]=[],checks:string[]=[],sessions:TestSession[]=[];
 try{
  const anonymous=await fetch(`${BASE_URL}/api/session`);assert.equal(anonymous.status,200);assert.equal((await anonymous.json() as {profile:null}).profile,null);
  for(const body of [undefined,{}, {gender:'unisex'}, {gender:'other'}, {gender:null}, {gender:'male',gold:9999}]){
   const response=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:BASE_URL,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
   assert.equal(response.status,400);assert.equal(response.headers.get('set-cookie'),null);
  }
  checks.push('new session requires a valid, explicit gender and rejects extra profile fields');
  for(const gender of ['male','female'] as const){
   const session=await createGender(gender);sessions.push(session);const client=new TestClient(session);clients.push(client);const welcome=await client.wait('welcome');
   assert.equal(welcome.profile.gender,gender);assert.ok(SLOTS.every(slot=>canEquipItem(welcome.profile.equipment[slot],gender)));assert.ok(welcome.profile.inventory.every(id=>canEquipItem(id,gender)));
   await client.request({type:'rename',name:`TEST-G-${gender[0]}-${client.profile.id.slice(0,8)}`},'profile');
   const before=await readProfile(session);assert.equal(before.gender,gender);assert.equal(before.gold,500);
   for(const body of [undefined,{gender}]){
    const refresh=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:BASE_URL,Cookie:session.cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    assert.equal(refresh.status,200);assert.equal((await refresh.json() as {profile:Profile}).profile.id,before.id);assert.equal(refresh.headers.get('set-cookie'),null);
   }
   const changed=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:BASE_URL,Cookie:session.cookie,'Content-Type':'application/json'},body:JSON.stringify({gender:gender==='male'?'female':'male'})});
   assert.equal(changed.status,409);assert.equal(changed.headers.get('set-cookie'),null);assert.deepEqual(await readProfile(session),before);
   const items=Object.fromEntries(SLOTS.map(slot=>[slot,before.equipment[slot]])) as Record<typeof SLOTS[number],string>;
   for(const command of [{type:'gender',gender:'female'},{type:'equip',item:'ember',gender:'female'},{type:'customize',selection:{items,gender:'female'}},{type:'shop-buy',items:['volt'],gender:'female'}])assert.equal((await client.request(command,'error')).message,'Comando inválido.');
   const opposite=gender==='male'?'face-wink':'face-taunt';
   assert.match((await client.request({type:'shop-buy',items:['volt',opposite]},'error')).message,/gênero/);assert.deepEqual(await readProfile(session),before);
   const purchases=gender==='male'?['face-taunt','hat-thunder']:['face-wink','hat-tropical'];
   const purchase=await client.request({type:'shop-buy',items:purchases},'shop-result');assert.equal(purchase.result.spent,gender==='male'?320:360);
   for(const item of purchases)await client.request({type:'equip',item},'profile');
   const after=await readProfile(session);assert.equal(after.gender,gender);assert.equal(after.equipment.face,purchases[0]);assert.equal(after.equipment.hat,purchases[1]);assert.equal(after.gold,500-purchase.result.spent);
  }
  assert.deepEqual(sessions[0].profile.stones,sessions[1].profile.stones);assert.deepEqual(sessions[0].profile.compositionStones,sessions[1].profile.compositionStones);
  checks.push('male/female creation, equal resources, immutable existing sessions, forged WebSocket rejection, atomic compatible purchases and persisted equipment');

  // Add owned opposite items only to the two tagged test accounts. Ownership must not bypass gender.
  const targets=clients.map(client=>({id:client.profile.id,name:client.profile.name,gender:client.profile.gender}));
  databaseScript(`
   import assert from 'node:assert/strict';import {Store} from './server/store.ts';import {starterEquipment} from './shared/catalog.ts';
   const store=new Store(),targets=${JSON.stringify(targets)};
   try{for(const target of targets){const p=await store.getProfile(target.id);assert.equal(p.name,target.name);assert.ok(p.name.startsWith('TEST-G-'));const other=starterEquipment(target.gender==='male'?'female':'male');for(const slot of ['face','outfit','hat','hair'])if(!p.inventory.includes(other[slot]))p.inventory.push(other[slot]);const saved=await store.pool.query('UPDATE players SET profile=$3 WHERE id=$1 AND name=$2',[target.id,target.name,p]);assert.equal(saved.rowCount,1);}console.log(JSON.stringify({seeded:true}));}finally{await store.pool.end();}
  `);
  for(let index=0;index<clients.length;index++){
   await clients[index].close();clients[index]=new TestClient(sessions[index]);const client=clients[index],welcome=await client.wait('welcome'),gender=welcome.profile.gender;
   const before=await readProfile(sessions[index]);assert.equal(before.gender,gender);
   const opposite=gender==='male'?{face:'face-smile',outfit:'outfit-dancer',hat:'hat-ruby',hair:'hair-ponytail'}:{face:'face-brave',outfit:'outfit-surfer',hat:'hat-cap',hair:'hair-undercut'};
   for(const item of Object.values(opposite)){assert.ok(before.inventory.includes(item));assert.match((await client.request({type:'equip',item},'error')).message,/gênero/);}
   const items=Object.fromEntries(SLOTS.map(slot=>[slot,before.equipment[slot]])) as Record<typeof SLOTS[number],string>;
   assert.match((await client.request({type:'customize',selection:{items:{...items,...opposite},dyes:{hat:'coral'}}},'error')).message,/gênero/);assert.deepEqual(await readProfile(sessions[index]),before);
   await client.request({type:'dye',slot:'hat',color:'coral'},'profile');const dyed=await readProfile(sessions[index]);assert.equal(dyed.gender,gender);assert.equal(dyed.equipment.dyes?.hat,'coral');assert.equal(dyed.equipment.face,before.equipment.face);
  }
  checks.push('owned opposite-gender face/outfit/hat/hair cannot equip, full customization rolls back, compatible dye remains valid after reconnect');

  for(const [index,client] of clients.entries()){
   const before=await readProfile(sessions[index]),costume=STARTER_COSTUMES[index];assert.ok(STARTER_COSTUMES.every(id=>before.inventory.includes(id)));assert.ok(before.inventory.every(id=>!isEmptyItem(id)));
   const items={...Object.fromEntries(SLOTS.map(slot=>[slot,before.equipment[slot]])),costume} as Record<typeof SLOTS[number],string>;
   const observer=clients[index===0?1:0],mark=observer.sequence;
   await client.request({type:'customize',selection:{items,visibility:{hat:false,glasses:false,costume:true}}},'profile');
   await observer.wait('lobby',e=>e.players.some(p=>p.id===client.profile.id&&p.equipment.costume===costume&&p.equipment.visibility?.hat===false),mark);
   const saved=await readProfile(sessions[index]);assert.equal(saved.equipment.costume,costume);assert.deepEqual(saved.equipment.visibility,{hat:false,glasses:false,costume:true});assert.deepEqual(attributes(saved.equipment),attributes(before.equipment));assert.deepEqual(saved.inventory,before.inventory);
   const noSlots={...items,hat:'hat-none',glasses:'glasses-none',costume:'costume-none'};
   await client.request({type:'customize',selection:{items:noSlots,visibility:{costume:false}}},'profile');const cleared=await readProfile(sessions[index]);assert.equal(cleared.equipment.costume,'costume-none');assert.equal(cleared.equipment.hat,'hat-none');assert.ok(cleared.inventory.every(id=>!isEmptyItem(id)));
   await client.request({type:'customize',selection:{items,visibility:{hat:false,glasses:false,costume:true}}},'profile');
   const room=(await client.request({type:'create',practice:true,name:'TEST Costume freeze'},'room',e=>!!e.room)).room!;
   await client.request({type:'bot'},'room',e=>e.room?.players.length===2);const battle=(await client.request({type:'start'},'battle',e=>e.battle?.roomId===room.id)).battle!;
   const fighter=battle.players.find(p=>p.id===client.profile.id)!;assert.equal(fighter.equipment.costume,costume);assert.equal(fighter.equipment.visibility?.hat,false);
   const locked=await readProfile(sessions[index]);assert.match((await client.request({type:'customize',selection:{items,visibility:{costume:false}}},'error')).message,/entre as batalhas/);assert.deepEqual(await readProfile(sessions[index]),locked);
   await client.request({type:'leave'},'room',e=>e.room===null);
  }
  checks.push('both starter costumes are unisex, visibility persists and broadcasts without changing attributes, empty sentinels never become inventory items, and appearance stays frozen in battle');

  const database=databaseScript(`
   import assert from 'node:assert/strict';import {Store,normalizeProfile} from './server/store.ts';import {CONTENT_VERSION,starterEquipment,canEquipItem,isEmptyItem,SLOTS,STARTER_COSTUMES} from './shared/catalog.ts';
   const store=new Store();let id,name;
   try{
    const guest=await store.createGuest('female');id=guest.profile.id;name='TEST-G-DB-'+id.slice(0,8);await store.rename(id,name);
    const raw={...guest.profile,gold:1000,contentVersion:10,equipment:{...starterEquipment('male'),outfit:'outfit-dancer'},inventory:['ember','face-brave','face-smile','outfit-dancer','outfit-surfer','hat-cap','hat-ruby','hair-undercut','hair-ponytail','glasses-none','wristband-none','bracelet-none'],stones:{'1':0,'2':2},compositionStones:{'attack-1':0}};delete raw.gender;
    await store.pool.query('UPDATE players SET profile=$3 WHERE id=$1 AND name=$2',[id,name,raw]);
    let p=await store.getProfile(id);assert.equal(p.gender,'female');assert.equal(p.gold,1000);assert.equal(p.stones['1'],0);assert.equal(p.stones['2'],2);assert.equal(p.compositionStones['attack-1'],0);assert.ok(raw.inventory.filter(item=>!isEmptyItem(item)).every(item=>p.inventory.includes(item)));assert.ok(SLOTS.every(slot=>canEquipItem(p.equipment[slot],'female')));assert.deepEqual(normalizeProfile(p),p);assert.ok(STARTER_COSTUMES.every(item=>p.inventory.includes(item)));assert.equal(p.equipment.costume,'costume-none');assert.ok(p.inventory.every(item=>!isEmptyItem(item)));
    await store.saveEquipment(id,p.equipment);const persisted=(await store.pool.query('SELECT profile FROM players WHERE id=$1 AND name=$2',[id,name])).rows[0].profile;assert.equal(persisted.gender,'female');assert.equal(persisted.contentVersion,CONTENT_VERSION);
    const before=await store.getProfile(id);await assert.rejects(store.saveEquipment(id,{...before.equipment,outfit:'outfit-surfer'}),/gênero/);assert.deepEqual(await store.getProfile(id),before);
    await assert.rejects(store.buy(id,['volt','face-taunt']),/gênero/);assert.deepEqual(await store.getProfile(id),before);
    const results=await Promise.allSettled([store.buy(id,['face-taunt']),store.buy(id,['glasses-sport'])]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);p=await store.getProfile(id);assert.equal(p.gold,before.gold-140);assert.ok(p.inventory.includes('glasses-sport'));assert.ok(!p.inventory.includes('face-taunt'));assert.equal(p.gender,'female');
    console.log(JSON.stringify({legacyGenderPersists:true,resourcesPreserved:true,ownedMismatchRejected:true,cartAtomicity:true,concurrentPurchaseProtected:true,costumeMigration:true,emptyInventorySentinelsRemoved:true}));
   }finally{if(id&&name)await store.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[id,name]);await store.pool.end();}
  `);
  const report={ok:true,baseUrl:BASE_URL,checks,database,durationMs:Math.round(performance.now()-started),testPlayerIds:sessions.map(s=>s.profile.id)};
  await mkdir('test-results',{recursive:true});await writeFile('test-results/gender-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{for(const client of clients){if(client.socket.readyState===WebSocket.OPEN)client.send({type:'leave'});await client.close();}}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
