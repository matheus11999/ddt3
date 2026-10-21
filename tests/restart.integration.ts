// Restarts the real server in the middle of a match and checks that the player gets the same match back.
// Needs PostgreSQL and Redis (DATABASE_URL, REDIS_URL); starts and stops the server itself on PORT (default 4117).
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import type {Battle} from '../shared/protocol';

const port=Number(process.env.PORT??4117),base=`http://127.0.0.1:${port}`;
process.env.BASE_URL=base;
// Loaded after BASE_URL is set: the helpers read it on import.
const {createSession,pause,TestClient}=await import('./integration');
function start(){
 const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port),ALLOWED_ORIGINS:base},stdio:['ignore','ignore','inherit']});
 return child;
}
async function healthy(){for(let i=0;i<100;i++){try{if((await fetch(`${base}/api/health`)).ok)return;}catch{}await pause(150);}throw Error('server did not start');}
const stop=(child:ChildProcess,signal:NodeJS.Signals)=>new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill(signal);});

async function run(){
 server=start();await healthy();
 const session=await createSession();let client=new TestClient(session);debug=client;await client.wait('welcome');
 const created=await client.request({type:'create',practice:true,name:'TEST Reinicio'},'room',e=>!!e.room);
 await client.request({type:'bot'},'room',e=>e.room?.players.length===2);
 const first=await client.request({type:'start'},'battle',e=>!!e.battle);const battleId=first.battle!.id;
 // Spend a turn so there is progress to keep: shoot, then wait for the bot's turn to come and go.
 await client.charge(55,50);await client.request({type:'fire',angle:50,power:55},'battle',e=>e.battle?.phase==='aiming'&&e.battle.turnNumber>=2,15000);
 const mine=await client.wait('battle',e=>e.battle?.phase==='aiming'&&e.battle.turnId===session.profile.id&&e.battle.turnNumber>=3,0,20000);
 const before=mine.battle as Battle;await pause(800);

 for(const signal of ['SIGTERM','SIGKILL'] as const){
  await stop(server,signal);await client.close();
  server=start();await healthy();
  client=new TestClient(session);const back=await client.wait('welcome');
  assert.equal(back.room?.id,created.room!.id,`${signal}: volta para a mesma sala`);
  const battle=back.battle as Battle;assert.equal(battle?.id,battleId,`${signal}: volta para a mesma partida`);
  assert.ok(battle.terrain,`${signal}: recebe o terreno`);assert.ok(battle.turnNumber>=before.turnNumber);
  for(const f of before.players)assert.equal(battle.players.find(p=>p.id===f.id)?.hp,f.hp,`${signal}: vida de ${f.name}`);
  assert.equal(battle.players.find(p=>p.id===session.profile.id)?.connected,true);
  console.log(`${signal}: partida ${battleId} restaurada no turno ${battle.turnNumber}`);
  await pause(800);
 }
 await client.close();await stop(server,'SIGTERM');
}
let server:ChildProcess|null=null,debug:{events:{event:{type:string}}[]}|null=null;
run().then(()=>process.exit(0),error=>{console.error(error,'\nÚltimos eventos:',JSON.stringify(debug?.events.slice(-5).map(e=>e.event)??[]).slice(-1500));server?.kill('SIGKILL');process.exit(1);});
