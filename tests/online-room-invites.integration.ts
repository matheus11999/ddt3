import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {BASE_URL,createSession,TestClient,pause} from './integration';
import type {Profile} from '../shared/protocol';

const clients:TestClient[]=[],checks:string[]=[];
try{
 const response=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const sessions=await Promise.all(Array.from({length:4},()=>createSession()));clients.push(...sessions.map(session=>new TestClient(session)));
 await Promise.all(clients.map(client=>client.wait('welcome')));
 for(const [index,client] of clients.entries())await client.request({type:'rename',name:`TEST Convite ${index}`},'profile');
 const [host,target,otherHost,other]=clients,targetProfile=structuredClone(target.profile);
 const room=(await host.request({type:'create'},'room',event=>!!event.room)).room!;
 await host.request({type:'room-slot',slot:1,open:true},'room',event=>event.room?.openSlots.includes(1)===true);
 const secondRoom=(await otherHost.request({type:'create'},'room',event=>!!event.room)).room!;
 await otherHost.request({type:'room-slot',slot:1,open:true},'room',event=>event.room?.openSlots.includes(1)===true);
 const list=await host.request({type:'room-invite-list'},'room-invite-list');assert.equal(list.roomId,room.id);
 assert.ok(list.players.some(player=>player.id===target.profile.id));assert.ok(list.players.some(player=>player.id===other.profile.id));assert.ok(list.players.every(player=>![host.profile.id,otherHost.profile.id].includes(player.id)));
 assert.ok(list.players.every(player=>Object.keys(player).sort().join(',')==='id,level,name'));
 assert.equal((await host.request({type:'room-invite',playerId:target.profile.id,fromId:otherHost.profile.id} as Record<string,unknown>,'error')).message,'Comando inválido.');
 assert.match((await target.request({type:'room-invite-list'},'error')).message,/sala primeiro/);
 checks.push('real online list excludes occupied players, exposes only public fields and rejects forged sender identity');

 const receivedMark=target.sequence,sent=await host.request({type:'room-invite',playerId:target.profile.id},'room-invite-result',event=>event.status==='sent');
 const invite=(await target.wait('room-invitation',event=>event.invite.id===sent.inviteId,receivedMark)).invite;
 assert.equal(invite.roomId,room.id);assert.equal(invite.roomNumber,room.number);assert.equal(invite.fromId,host.profile.id);
 assert.match((await other.request({type:'room-invite-answer',inviteId:invite.id,accept:true},'error')).message,/inválido/);
 const hostMark=host.sequence,targetMark=target.sequence;
 const accepted=await target.request({type:'room-invite-answer',inviteId:invite.id,accept:true},'room-invite-result',event=>event.inviteId===invite.id&&event.status==='accepted');assert.equal(accepted.roomId,room.id);
 await host.wait('room-invite-result',event=>event.inviteId===invite.id&&event.status==='accepted',hostMark);
 const joined=(await target.wait('room',event=>event.room?.id===room.id,targetMark)).room!;assert.equal(joined.players.length,2);assert.equal(joined.players.find(player=>player.id===target.profile.id)!.slot,1);
 assert.match((await target.request({type:'room-invite-answer',inviteId:invite.id,accept:true},'error')).message,/encerrado/);
 assert.match((await host.request({type:'room-invite',playerId:other.profile.id},'error')).message,/cheia/);
 assert.match((await target.request({type:'room-invite',playerId:other.profile.id},'error')).message,/líder/);
 checks.push('private delivery, recipient-only one-time acceptance and atomic room entry with both acknowledgements');

 const otherMark=other.sequence,secondSent=await otherHost.request({type:'room-invite',playerId:other.profile.id},'room-invite-result',event=>event.status==='sent');
 const secondInvite=(await other.wait('room-invitation',event=>event.invite.id===secondSent.inviteId,otherMark)).invite;assert.equal(secondInvite.roomId,secondRoom.id);
 await other.request({type:'room-invite-answer',inviteId:secondInvite.id,accept:false},'room-invite-result',event=>event.status==='declined');
 const rateError=await otherHost.request({type:'room-invite',playerId:other.profile.id},'error');assert.match(rateError.message,/2 segundos|30 segundos/);
 await target.close();clients[1]=new TestClient(sessions[1]);const restored=await clients[1].wait('welcome');assert.equal(restored.room?.id,room.id);assert.equal(restored.room?.number,room.number);assert.deepEqual(restored.profile,targetProfile);
 const persistedResponse=await fetch(`${BASE_URL}/api/session`,{headers:{Cookie:sessions[1].cookie},signal:AbortSignal.timeout(10000)});assert.equal(persistedResponse.status,200);assert.deepEqual((await persistedResponse.json() as {profile:Profile}).profile,targetProfile);
 checks.push('decline and resend cooldown; accepted membership survives reconnect without modifying durable equipment, currency or loadout');

 await clients[1].request({type:'leave'},'room',event=>event.room===null);
 // This is a documented server cooldown, not a readiness guess. The following
 // requests still await concrete invitation/room acknowledgements.
 await pause(Math.max(0,invite.expiresAt-60000+2100-Date.now()));
 const finalMark=other.sequence,lastSent=await host.request({type:'room-invite',playerId:other.profile.id},'room-invite-result',event=>event.status==='sent');
 await other.wait('room-invitation',event=>event.invite.id===lastSent.inviteId,finalMark);
 await clients[1].request({type:'join',roomId:room.id},'room',event=>event.room?.id===room.id);
 await other.wait('room-invite-result',event=>event.inviteId===lastSent.inviteId&&event.status==='unavailable',finalMark);
 assert.match((await other.request({type:'room-invite-answer',inviteId:lastSent.inviteId,accept:true},'error')).message,/encerrado/);
 const ownRoom=(await other.request({type:'create'},'room',event=>!!event.room)).room!;assert.notEqual(ownRoom.id,room.id);
 checks.push('a pending invitation reserves no seat and closes when someone else fills the vacancy');
 const report={ok:true,baseUrl:BASE_URL,clients:4,checks};await mkdir('test-results/online-room-invites',{recursive:true});await writeFile('test-results/online-room-invites/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
 for(const client of clients){if(client.socket.readyState===1)await client.request({type:'leave'},'room',event=>event.room===null).catch(()=>{});await client.close();}
}
