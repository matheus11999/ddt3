import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {BASE_URL,createSession,pause,TestClient} from './integration';

const CLIENTS=Number(process.env.LOAD_CLIENTS??24),ROUNDS=Number(process.env.LOAD_ROUNDS??12);
assert.ok(Number.isInteger(CLIENTS)&&CLIENTS>=1&&CLIENTS<=60,'LOAD_CLIENTS must be 1..60');
assert.ok(Number.isInteger(ROUNDS)&&ROUNDS>=1&&ROUNDS<=60,'LOAD_ROUNDS must be 1..60');

async function run(){
 const started=performance.now(),clients:TestClient[]=[],latencies:number[]=[];let rejected=0;
 try{
  const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);
  const sessions=await Promise.all(Array.from({length:CLIENTS},()=>createSession()));
  clients.push(...sessions.map(session=>new TestClient(session)));
  await Promise.all(clients.map(client=>client.wait('welcome')));
  await Promise.all(clients.map((client,index)=>client.request({type:'rename',name:`TEST-L${index}-${client.profile.id.slice(0,6)}`},'profile')));
  const readyAt=performance.now();
  for(let round=0;round<ROUNDS;round++){
   await Promise.all(clients.map(async(client,index)=>{
    const time=Date.now()+index/1000,mark=client.sequence,start=performance.now();
    client.send({type:'ping',time});await client.wait('pong',event=>event.time===time,mark,10000);latencies.push(performance.now()-start);
    client.send({type:'move',x:400+(index*37+round*41)%900,y:540+(index*13+round*11)%160});
   }));
   await pause(120);
  }
  await Promise.all(clients.map(async client=>{
   const malformed=await client.request({type:'fire',angle:45,power:5000},'error');assert.equal(malformed.message,'Comando inválido.');
   const validButForbidden=await client.request({type:'fire',angle:45,power:50},'error');assert.match(validButForbidden.message,/sala primeiro/);rejected+=2;
  }));
  const liveHealth=await fetch(`${BASE_URL}/api/health`);const live=await liveHealth.json() as {online:number};assert.ok(live.online>=CLIENTS);
  latencies.sort((a,b)=>a-b);const percentile=(p:number)=>Math.round(latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*p)-1)]*100)/100;
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,concurrentClients:CLIENTS,rounds:ROUNDS,samples:latencies.length,latencyMs:{p50:percentile(.5),p95:percentile(.95),max:percentile(1)},rejectedCommands:rejected,onlineObserved:live.online,setupMs:Math.round(readyAt-started),exerciseMs:Math.round(performance.now()-readyAt),totalMs:Math.round(performance.now()-started),scope:'local lobby presence, movement, ping and validation; not a production capacity benchmark'},null,2));
 }finally{await Promise.all(clients.map(client=>client.close()));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
