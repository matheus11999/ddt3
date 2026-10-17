import {boostsForShot,powTridentRule} from '../shared/weaponKit';
import {chargeFromDamage,POWER_MAX,POWER_CUT_IN_MS,POWER_DAMAGE_MULTIPLIER,POWER_BLAST_MULTIPLIER,POWER_CRATER_MULTIPLIER} from '../shared/power';
import {CARD_PRIZES,REWARD_CARD_COUNT,REWARD_PICK_MS,REWARD_RESULT_MS,REWARD_RETURN_MS} from '../shared/rewards';
import type {CardPrize,MatchBonuses} from '../shared/rewards';
import {randomInt,randomUUID} from 'node:crypto';
import {LOBBY_SPAWN,LOBBY_WALK_SPEED} from '../shared/lobby';
import {attributes,BOOSTS,CATALOG,targetSlotForItem,DEFAULT_EQUIPMENT,isEmptyItem,SMITH_POSITION,WEAPONS,weaponFragmentCount,weaponStats} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import type {Battle,Command,Fighter,LobbyPlayer,Profile,RankingEntry,Room,RoomInvitation,RoomInviteResult,Seat,ServerEvent,Shot,ShotHit,TerrainMark} from '../shared/protocol';
import {crater,createTerrain,ground,packTerrain,shatter,terrainMaterial,trajectory,volley,walkPosition,WORLD} from '../shared/physics';
import type {TrajectoryResult} from '../shared/physics';
import type {ProfileStore} from './store';
import {getMap,canonicalMap,MAP_IDS} from '../shared/maps';
import {criticalFromRoll,damageAtImpact,impactExposure,shotModifiers,VOLLEY_CADENCE_MS} from '../shared/combat';
import {initialSlots,modeForSlots,MAX_PARTY_SIZE} from '../shared/rooms';
import {HEAL_AMOUNT,HIDDEN_POSITION,homingTargets,initialAbilities,INVISIBILITY_TURNS,normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityEffect,AbilityId} from '../shared/abilities';
import {flightLanding} from '../shared/physics';
import {adjustAimToTerrain,aimSource,clampAimAngle,weaponAimLimits} from '../shared/aim';
import {createFall,fallPosition,fallVelocity} from '../shared/fall';
export interface Peer {profile:Profile;send:(event:ServerEvent)=>void;connected:boolean;roomId:string|null;arenaOpen:boolean;channel:number;x:number;y:number;targetX:number;targetY:number;lastSeen:number;lastWalk:number;lastAim?:number;}
interface PendingImpact {at:number;projectileIndex:number;hits:ShotHit[];mark:TerrainMark;flight?:boolean;fragment?:boolean;}
interface PendingRoomInvitation {invite:RoomInvitation;playerId:string;}
const ROOM_INVITE_TTL_MS=60000,ROOM_INVITE_SEND_MS=2000,ROOM_INVITE_PAIR_MS=30000,ROOM_INVITE_LIST_MS=1000,ONLINE_LIST_MS=2000,ONLINE_LIST_LIMIT=100;
const SPECTATOR_BLOCKED_COMMANDS=new Set<Command['type']>(['ability-loadout','ready','queue','cancel-queue','start','practice-start','bot','room-slot','room-rename','kick','room-spectator-slot','spectator-kick','room-invite','room-invite-list','power','ability','flight','boost','aim','walk','fire','pass','reward-pick','rematch']);
interface Match {key:string;roomIds:string[];practiceParty?:boolean;invisibilityActivated?:Map<string,number>;pendingPower?:{playerId:string;angle:number;power:number;at:number};state:Battle;terrain:Uint8Array;resolveAt:number;botAt:number;createdAt:number;rewardDeck?:CardPrize[];savingRewards?:boolean;retryRewardsAt?:number;activeShot?:Shot;pendingImpacts?:PendingImpact[];}
/** POW × Tridente per weapon (shared/weaponKit.ts): some weapons refuse the pair, others already fire it as POW. */
function tridentWithPower(weapon:string){
 const rule=powTridentRule(weapon);
 if(rule==='exclusivo')throw Error('Esta arma não combina Power com Tridente.');
 if(rule==='pow-tridente')throw Error('O Power desta arma já dispara o Tridente.');
}

export class Game {
 peers=new Map<string,Peer>();rooms=new Map<string,Room>();matches=new Map<string,Match>();
 // Parties keep their identity throughout a match; opponents are never merged into a room.
 private nextRoomNumber=1;private roomMatches=new Map<string,string>();private queueIds=new Set<string>();private profileChanges=new Set<string>();
 private lastTick=Date.now();private lobbyTick=0;private roomsDirty=false;private arenaPopulation=0;
 private ranking:RankingEntry[]=[];private rankingAt=0;private rankingLoading:Promise<void>|null=null;
 private roomInvitations=new Map<string,PendingRoomInvitation>();private inviteSentAt=new Map<string,number>();private invitePairAt=new Map<string,number>();private inviteListAt=new Map<string,number>();private onlineListAt=new Map<string,number>();
 constructor(private store:ProfileStore,private report:(e:unknown)=>void=console.error,private criticalRoll:()=>number=()=>randomInt(1_000_000)/1_000_000){}
 connect(profile:Profile,send:Peer['send']){
  let p=this.peers.get(profile.id);
  // A session read may have started before a pending commit. The live peer owns
  // the authoritative profile; reconnecting must not restore an older snapshot.
  if(p){p.send=send;p.connected=true;p.arenaOpen=false;p.lastSeen=Date.now();}
  else {let channel=1;while([...this.peers.values()].filter(x=>x.channel===channel).length>=60)channel++;p={profile,send,connected:true,roomId:null,arenaOpen:false,channel,x:LOBBY_SPAWN.x-60+Math.random()*120,y:LOBBY_SPAWN.y,targetX:LOBBY_SPAWN.x,targetY:LOBBY_SPAWN.y,lastSeen:Date.now(),lastWalk:0};p.targetX=p.x;this.peers.set(profile.id,p);}
  const room=p.roomId?this.rooms.get(p.roomId):undefined;const match=room?this.matchForRoom(room.id):undefined;
  if(room){const seat=this.roomMembers(room).find(s=>s.id===profile.id);if(seat)seat.connected=true;const fighter=match?.state.players.find(s=>s.id===profile.id);if(fighter)fighter.connected=true;this.broadcastRoom(room);}
  send({type:'welcome',profile:p.profile,players:this.lobby(p.channel),rooms:[...this.rooms.values()],room:room??null,battle:match?this.snapshot(match,true,profile.id):null,serverTime:Date.now(),channel:p.channel,arenaOnline:this.countArena(),ranking:this.ranking});
  this.pruneInvitations();for(const pending of this.roomInvitations.values())if(pending.playerId===profile.id)this.emit(p,{type:'room-invitation',invite:{...pending.invite}});
  this.sendLobby(p.channel);this.publishArenaPopulation();return p;
 }
 disconnect(id:string){const p=this.peers.get(id);if(!p)return;p.connected=false;p.arenaOpen=false;p.lastSeen=Date.now();if(p.roomId){const r=this.rooms.get(p.roomId);const s=r?.players.find(x=>x.id===id);if(s){s.connected=false;s.ready=false;}const observer=r?.spectators?.find(x=>x.id===id);if(observer)observer.connected=false;const fighter=this.matchForRoom(p.roomId)?.state.players.find(s=>s.id===id);if(fighter)fighter.connected=false;if(r){if(!observer)this.cancelSearch(r);this.broadcastRoom(r);}}this.pruneInvitations();this.sendLobby(p.channel);this.publishArenaPopulation();}
 lobby(channel:number):LobbyPlayer[]{return [...this.peers.values()].filter(p=>p.connected&&!p.roomId&&p.channel===channel).map(p=>({id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:p.profile.equipment,x:p.x,y:p.y}));}
 private emit(p:Peer,e:ServerEvent){if(p.connected)p.send(e);}
 private sendLobby(channel:number){const players=this.lobby(channel);const online=[...this.peers.values()].filter(p=>p.connected).length;for(const p of this.peers.values())if(p.channel===channel&&!p.roomId)this.emit(p,{type:'lobby',players,online});}
 private broadcastRooms(){for(const p of this.peers.values())this.emit(p,{type:'rooms',rooms:[...this.rooms.values()]});this.roomsDirty=false;}
 private countArena(){return [...this.peers.values()].filter(p=>p.connected&&(p.arenaOpen||(p.roomId!==null&&this.rooms.has(p.roomId)))).length;}
 private publishArenaPopulation(){const count=this.countArena();if(count===this.arenaPopulation)return;this.arenaPopulation=count;for(const peer of this.peers.values())this.emit(peer,{type:'arena-population',count});}
 private roomMembers(room:Room){return [...room.players,...(room.spectators??[])];}
 private isSpectator(p:Peer){return !!p.roomId&&!!this.rooms.get(p.roomId)?.spectators?.some(s=>s.id===p.profile.id);}
 private broadcastRoom(room:Room){for(const s of this.roomMembers(room)){const p=this.peers.get(s.id);if(p?.roomId===room.id)this.emit(p,{type:'room',room});}this.roomsDirty=true;}
 private matchForRoom(roomId:string){const key=this.roomMatches.get(roomId);return key?this.matches.get(key):undefined;}
 private inMatch(p:Peer|undefined,m:Match):p is Peer{return !!p?.roomId&&this.matchForRoom(p.roomId)===m;}
 private matchPeers(m:Match){const ids=new Set<string>();for(const id of m.roomIds){const room=this.rooms.get(id);if(room)for(const member of this.roomMembers(room))ids.add(member.id);}return [...ids].map(id=>this.peers.get(id)).filter((peer):peer is Peer=>this.inMatch(peer,m));}
 private hiddenFrom(m:Match,id:string,viewer:string){const fighter=m.state.players.find(f=>f.id===id),audience=m.state.players.find(f=>f.id===viewer);return !!fighter&&(fighter.invisibleTurns??0)>0&&fighter.team!==audience?.team;}
 private visibleHits(m:Match,hits:ShotHit[],viewer:string){return hits.map(hit=>this.hiddenFrom(m,hit.id,viewer)?{...hit,hidden:true,x:HIDDEN_POSITION,y:HIDDEN_POSITION}:{...hit});}
 private visibleShot(m:Match,shot:Shot,viewer:string):Shot {return {...shot,hits:this.visibleHits(m,shot.hits,viewer),...(this.hiddenFrom(m,shot.shooterId,viewer)?{hidden:true,projectiles:[]}:{})};}
 private broadcastBattle(m:Match,withTerrain=false){for(const peer of this.matchPeers(m))this.emit(peer,{type:'battle',battle:this.snapshot(m,withTerrain||m.state.phase==='finished',peer.profile.id)});}
 private snapshot(m:Match,withTerrain=false,viewer=''):Battle {
  const players=m.state.players.map(f=>{if(!this.hiddenFrom(m,f.id,viewer))return {...f};const redacted={...f,hidden:true,x:HIDDEN_POSITION,y:HIDDEN_POSITION,facing:1 as const};delete redacted.aimAngle;delete redacted.aimSlope;delete redacted.chargePower;delete redacted.charging;delete redacted.fall;return redacted;});
  return {...m.state,players,terrainMarks:[...(m.state.terrainMarks??[])],...(withTerrain?{terrain:Buffer.from(packTerrain(m.terrain)).toString('base64'),...(m.activeShot?{activeShot:this.visibleShot(m,m.activeShot,viewer)}:{})}:{})};
 }
 private abilityEffect(m:Match,effect:AbilityEffect){for(const peer of this.matchPeers(m))this.emit(peer,{type:'ability-effect',...effect,...(this.hiddenFrom(m,effect.playerId,peer.profile.id)?{hidden:true,x:HIDDEN_POSITION,y:HIDDEN_POSITION}:{})});}
 private room(p:Peer){const room=p.roomId?this.rooms.get(p.roomId):undefined;if(!room)throw Error('Entre em uma sala primeiro.');return room;}
 private turn(p:Peer){const room=this.room(p),m=this.matchForRoom(room.id);if(!m||m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');if(m.state.turnId!==p.profile.id)throw Error('Aguarde a sua vez.');if(Date.now()>m.state.deadline)throw Error('O tempo do turno terminou.');const f=m.state.players.find(x=>x.id===p.profile.id);if(!f)throw Error('Você está assistindo a esta partida.');if(f.hp<=0)throw Error('Seu personagem está fora de combate.');if(f.fall&&Date.now()<f.fall.startedAt+f.fall.duration)throw Error('Aguarde seu personagem pousar.');return {m,f};}
 private seat(p:Peer,team:0|1,slot:number):Seat{return {id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:{...p.profile.equipment},abilityLoadout:normalizeAbilityLoadout(p.profile.abilityLoadout),ready:false,bot:false,team,slot,connected:true};}
 private vacantSeat(room:Room):{team:0|1;slot:number}{
  if(!room.practice){const slot=room.openSlots.find(index=>!room.players.some(p=>p.slot===index));if(slot===undefined)throw Error('Esta equipe está cheia. Peça ao líder para abrir outra vaga.');return {team:0,slot};}
  const teams: (0|1)[]=[0,1];teams.sort((a,b)=>room.players.filter(p=>p.team===a).length-room.players.filter(p=>p.team===b).length);
  for(const team of teams){const slot=room.openSlots.find(index=>!room.players.some(p=>p.team===team&&p.slot===index));if(slot!==undefined)return {team,slot};}
  throw Error('Esta sala está cheia.');
 }
 private join(p:Peer,roomId:string){
  if(p.roomId)throw Error('Você já está em uma sala.');const room=this.rooms.get(roomId);if(!room||room.status!=='waiting')throw Error('Esta sala não está disponível.');
  const {team,slot}=this.vacantSeat(room);room.players.push(this.seat(p,team,slot));p.roomId=room.id;if(!room.practice)this.updateParty(room);this.broadcastRoom(room);this.sendLobby(p.channel);this.publishArenaPopulation();
 }
 private spectate(p:Peer,roomId:string){
  if(p.roomId)throw Error('Saia da sala atual antes de assistir outra.');const room=this.rooms.get(roomId);if(!room||!['waiting','playing'].includes(room.status))throw Error('Esta sala não está disponível para assistir.');
  const slot=room.spectatorSlots?.find(index=>!room.spectators?.some(s=>s.slot===index));if(slot!==0&&slot!==1)throw Error('Não há lugar aberto para espectadores nesta sala.');
  (room.spectators??=[]).push({id:p.profile.id,name:p.profile.name,level:p.profile.level,slot,connected:true});p.roomId=room.id;
  this.broadcastRoom(room);const match=this.matchForRoom(room.id);this.emit(p,{type:'battle',battle:match?this.snapshot(match,true,p.profile.id):null});this.sendLobby(p.channel);this.publishArenaPopulation();
 }
 private detach(p:Peer){p.roomId=null;this.emit(p,{type:'room',room:null});this.emit(p,{type:'battle',battle:null});this.roomsDirty=true;this.sendLobby(p.channel);this.publishArenaPopulation();}
 private invitationRoom(p:Peer){const room=this.room(p);if(room.hostId!==p.profile.id)throw Error('Somente o líder pode convidar jogadores.');if(room.status!=='waiting')throw Error('Convide jogadores enquanto a sala aguarda.');this.vacantSeat(room);return room;}
 private invitationAvailable(pending:PendingRoomInvitation){
  const {invite,playerId}=pending,from=this.peers.get(invite.fromId),target=this.peers.get(playerId),room=this.rooms.get(invite.roomId);
  if(!from?.connected||!target?.connected||from.roomId!==room?.id||target.roomId||!room||room.hostId!==invite.fromId||room.status!=='waiting')return false;
  try{this.vacantSeat(room);return true;}catch{return false;}
 }
 private finishInvitation(pending:PendingRoomInvitation,status:Exclude<RoomInviteResult['status'],'sent'>){
  if(!this.roomInvitations.delete(pending.invite.id))return;
  const messages={accepted:'Convite aceito.',declined:'Convite recusado.',expired:'O convite expirou.',unavailable:'Este convite não está mais disponível.'};
  const event:ServerEvent={type:'room-invite-result',inviteId:pending.invite.id,playerId:pending.playerId,roomId:pending.invite.roomId,status,message:messages[status]};
  for(const id of [pending.invite.fromId,pending.playerId]){const peer=this.peers.get(id);if(peer)this.emit(peer,event);}
 }
 private pruneInvitations(now=Date.now()){
  for(const pending of this.roomInvitations.values()){
   if(now>=pending.invite.expiresAt)this.finishInvitation(pending,'expired');
   else if(!this.invitationAvailable(pending))this.finishInvitation(pending,'unavailable');
  }
  for(const [key,at] of this.invitePairAt)if(now-at>=ROOM_INVITE_PAIR_MS)this.invitePairAt.delete(key);
  for(const rates of [this.inviteSentAt,this.inviteListAt,this.onlineListAt])for(const [id,at] of rates)if(now-at>=ROOM_INVITE_PAIR_MS)rates.delete(id);
 }
 private invitePlayer(p:Peer,playerId:string){
  this.pruneInvitations();const room=this.invitationRoom(p),now=Date.now(),id=p.profile.id,target=this.peers.get(playerId);
  if(playerId===id)throw Error('Escolha outro jogador para convidar.');
  if(!target?.connected||target.roomId)throw Error('Este jogador não está disponível para um convite.');
  if([...this.roomInvitations.values()].some(value=>value.invite.fromId===id&&value.playerId===playerId))throw Error('Você já enviou um convite para este jogador.');
  if(now-(this.inviteSentAt.get(id)??-Infinity)<ROOM_INVITE_SEND_MS)throw Error('Aguarde 2 segundos antes de enviar outro convite.');
  const pair=`${id}:${playerId}`;if(now-(this.invitePairAt.get(pair)??-Infinity)<ROOM_INVITE_PAIR_MS)throw Error('Aguarde 30 segundos para convidar este jogador novamente.');
  const pending=[...this.roomInvitations.values()];if(pending.filter(value=>value.invite.fromId===id).length>=3)throw Error('Aguarde a resposta dos convites enviados.');
  if(pending.filter(value=>value.playerId===playerId).length>=5)throw Error('Este jogador já está recebendo outros convites.');
  const invite:RoomInvitation={id:randomUUID(),roomId:room.id,roomNumber:room.number,roomName:room.name,fromId:id,fromName:p.profile.name,expiresAt:now+ROOM_INVITE_TTL_MS};
  this.roomInvitations.set(invite.id,{invite,playerId});this.inviteSentAt.set(id,now);this.invitePairAt.set(pair,now);
  this.emit(target,{type:'room-invitation',invite:{...invite}});this.emit(p,{type:'room-invite-result',inviteId:invite.id,roomId:room.id,playerId,status:'sent',message:'Convite enviado.'});
 }
 private answerInvitation(p:Peer,inviteId:string,accept:boolean){
  const pending=this.roomInvitations.get(inviteId);if(!pending||pending.playerId!==p.profile.id)throw Error('Convite inválido ou encerrado.');
  if(Date.now()>=pending.invite.expiresAt){this.finishInvitation(pending,'expired');return;}
  if(!this.invitationAvailable(pending)){this.finishInvitation(pending,'unavailable');return;}
  if(!accept){this.finishInvitation(pending,'declined');return;}
  // No await between revalidation and joining: two invitations cannot claim one seat.
  this.join(p,pending.invite.roomId);this.finishInvitation(pending,'accepted');
 }
 async command(id:string,c:Command){
  const p=this.peers.get(id);if(!p||!p.connected)return;
  try{
   if(this.isSpectator(p)&&SPECTATOR_BLOCKED_COMMANDS.has(c.type))throw Error('Você está assistindo. Apenas participantes podem usar esta ação.');
   switch(c.type){
    case 'arena-presence':if(p.arenaOpen!==c.open){p.arenaOpen=c.open;this.publishArenaPopulation();}return;
    case 'online-list':{
     // Everyone connected, on any channel, highest level first; the hall shows the list next to the rooms.
     const now=Date.now();if(now-(this.onlineListAt.get(id)??-Infinity)<ONLINE_LIST_MS)return;this.onlineListAt.set(id,now);
     const all=[...this.peers.values()].filter(peer=>peer.connected).map(peer=>({id:peer.profile.id,name:peer.profile.name,level:peer.profile.level,gender:peer.profile.gender})).sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
     this.emit(p,{type:'online-players',players:all.slice(0,ONLINE_LIST_LIMIT),total:all.length});return;
    }
    case 'room-invite-list':{
     const room=this.invitationRoom(p),now=Date.now();if(now-(this.inviteListAt.get(id)??-Infinity)<ROOM_INVITE_LIST_MS)throw Error('Aguarde um instante antes de atualizar a lista.');this.inviteListAt.set(id,now);
     const players=[...this.peers.values()].filter(peer=>peer.connected&&!peer.roomId&&peer.profile.id!==id).map(peer=>({id:peer.profile.id,name:peer.profile.name,level:peer.profile.level})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
     this.emit(p,{type:'room-invite-list',roomId:room.id,players});break;
    }
    case 'room-invite':this.invitePlayer(p,c.playerId);break;
    case 'room-invite-answer':this.answerInvitation(p,c.inviteId,c.accept);break;
    case 'ping':this.emit(p,{type:'pong',time:c.time,serverTime:Date.now()});return;
    case 'move':if(!p.roomId){p.targetX=c.x;p.targetY=c.y;}return;
    case 'rename':if(p.roomId)throw Error('Volte à praça para mudar seu nome.');await this.store.rename(id,c.name);p.profile.name=c.name;this.emit(p,{type:'profile',profile:p.profile});this.sendLobby(p.channel);return;
    case 'ability-loadout':{
     const room=this.room(p);if(room.status!=='waiting')throw Error('Ajuste suas habilidades enquanto a sala aguarda.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);room.players.forEach(player=>player.ready=player.bot);this.broadcastRoom(room);
     try{p.profile=await this.store.saveAbilityLoadout(id,c.slots);}finally{this.profileChanges.delete(id);}
     this.emit(p,{type:'profile',profile:p.profile,...(c.requestId!==undefined?{requestId:c.requestId}:{})});
     // A new socket can leave/join while the old socket awaits persistence.
     const currentRoom=p.roomId?this.rooms.get(p.roomId):undefined;
     if(currentRoom?.status==='waiting'){const seat=currentRoom.players.find(player=>player.id===id);if(seat){seat.abilityLoadout=normalizeAbilityLoadout(p.profile.abilityLoadout);currentRoom.players.forEach(player=>player.ready=player.bot);}this.broadcastRoom(currentRoom);}break;
    }
    case 'customize':
    case 'dye':
    case 'equip':{
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Troque seus equipamentos entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     const equipment=c.type==='customize'?{...p.profile.equipment,...c.selection.items,dyes:c.selection.dyes??{},visibility:c.selection.visibility??p.profile.equipment.visibility,copies:c.selection.copies??p.profile.equipment.copies}:{...p.profile.equipment};
     if(c.type==='customize'){/* All slots and ownership are checked atomically by the store. */}
     else if(c.type==='dye')equipment.dyes={...equipment.dyes,[c.slot]:c.color};
     else {const item=CATALOG[c.item];if(!item||(!isEmptyItem(item)&&!p.profile.inventory.includes(c.item)))throw Error('Este item não está na sua mochila.');equipment[targetSlotForItem(equipment,item)]=item.id;}
     // Cancel before awaiting persistence, so a pending outfit cannot race a queue match.
     this.profileChanges.add(id);if(p.roomId&&!this.isSpectator(p)){const r=this.room(p);this.cancelSearch(r);r.players.forEach(s=>s.ready=s.bot);this.broadcastRoom(r);}
     try{p.profile=await this.store.saveEquipment(id,equipment);}finally{this.profileChanges.delete(id);}
     this.emit(p,{type:'profile',profile:p.profile,...(c.type==='customize'&&c.requestId!==undefined?{requestId:c.requestId}:{})});if(p.roomId){const r=this.room(p);const s=r.players.find(s=>s.id===id);if(s){s.equipment={...p.profile.equipment};s.ready=false;}this.broadcastRoom(r);}this.sendLobby(p.channel);return;
    }
    case 'shop-buy':{
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Visite a loja entre as batalhas.');
     const outcome=await this.store.buy(id,c.items);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'shop-result',result:outcome.result});break;
    }
    case 'forge':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para fortalecer sua arma.');
     if(Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.forge(id,c.item,c.stones);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'forge-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'compose':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para compor seu equipamento.');
     if(Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.compose(id,c.item,c.stone);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'composition-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'create':{
     if(p.roomId)throw Error('Saia da sala atual antes de criar outra.');if(this.rooms.size>=200)throw Error('A arena está cheia. Tente novamente em breve.');
     const practice=c.practice===true,mode=practice?(c.mode??'1v1'):'1v1';
     const room:Room={id:randomUUID(),number:this.nextRoomNumber++,name:c.name??`Sala de ${p.profile.name}`.slice(0,24),hostId:id,practice,mode,openSlots:practice?initialSlots(mode):[0],spectatorSlots:[],spectators:[],map:practice?canonicalMap(c.map??'garden'):'garden',status:'waiting',players:[this.seat(p,0,0)]};this.rooms.set(room.id,room);p.roomId=room.id;this.broadcastRoom(room);this.sendLobby(p.channel);this.publishArenaPopulation();break;
    }
    case 'join':{
     this.join(p,c.roomId);break;
    }
    case 'spectate':this.spectate(p,c.roomId);break;
    case 'room-spectator-slot':{
     const room=this.room(p);if(room.hostId!==id)throw Error('Somente o líder pode abrir lugares para espectadores.');
     if(c.slot!==0&&c.slot!==1)throw Error('Lugar de espectador inválido.');
     const slots=room.spectatorSlots??[];if(slots.includes(c.slot)===c.open)break;
     if(!c.open&&room.spectators?.some(s=>s.slot===c.slot))throw Error('Retire o espectador antes de fechar este lugar.');
     room.spectatorSlots=c.open?[...slots,c.slot].sort():slots.filter(slot=>slot!==c.slot);this.broadcastRoom(room);break;
    }
    case 'spectator-kick':{
     const room=this.room(p);if(room.hostId!==id)throw Error('Somente o líder pode retirar espectadores.');
     const target=room.spectators?.find(s=>s.id===c.playerId);if(!target)throw Error('Este espectador não está nesta sala.');
     const peer=this.peers.get(target.id);if(peer?.roomId===room.id){this.leave(peer);this.emit(peer,{type:'error',message:'Você foi retirado dos espectadores pelo líder.'});}else{room.spectators=room.spectators!.filter(s=>s.id!==target.id);this.broadcastRoom(room);}break;
    }
    case 'room-rename':{
     const room=this.room(p);if(room.hostId!==id)throw Error('Somente o líder pode renomear a sala.');
     if(room.status!=='waiting')throw Error('Renomeie a sala entre as batalhas.');
     room.name=c.name;this.broadcastRoom(room);break;
    }
    case 'room-slot':{
     const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode alterar os espaços.');
     if(r.status!=='waiting')throw Error('Altere os espaços entre as batalhas.');
     if(c.slot<1||c.slot>3||!Number.isInteger(c.slot))throw Error('O primeiro espaço de cada equipe permanece aberto.');
     if(r.openSlots.includes(c.slot)===c.open)break;
     if(!c.open&&r.players.some(s=>s.slot===c.slot&&!s.bot))throw Error('Este espaço está ocupado por um jogador. Aguarde ele sair.');
     if(c.open)r.openSlots=[...r.openSlots,c.slot].sort((a,b)=>a-b);
     else {r.openSlots=r.openSlots.filter(slot=>slot!==c.slot);r.players=r.players.filter(s=>s.slot!==c.slot);}
     r.mode=modeForSlots(r.openSlots.length);r.players.forEach(s=>s.ready=s.bot);this.broadcastRoom(r);break;
    }
    case 'kick':{
     const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode remover jogadores.');
     if(r.status!=='waiting')throw Error('Remova jogadores somente entre as batalhas.');
     if(c.playerId===id)throw Error('Use Sair da sala para deixar a equipe.');
     const seat=r.players.find(s=>s.id===c.playerId);if(!seat)throw Error('Este jogador não está nesta sala.');
     r.players.forEach(s=>s.ready=s.bot);
     const target=this.peers.get(seat.id);
     if(!seat.bot&&target?.roomId===r.id){this.leave(target);this.emit(target,{type:'error',message:'Você foi removido da sala pelo líder.'});}
     else {r.players=r.players.filter(s=>s.id!==seat.id);this.broadcastRoom(r);}
     break;
    }
    case 'leave':this.leave(p);break;
    case 'ready':{const r=this.room(p);if(r.status==='playing')throw Error('A partida já começou.');if(r.status==='searching'){this.cancelSearch(r);this.broadcastRoom(r);break;}if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');const s=r.players.find(x=>x.id===id)!;s.ready=!s.ready;this.broadcastRoom(r);break;}
    case 'bot':{
     const r=this.room(p);if(r.hostId!==id||r.status!=='waiting')throw Error('Somente o líder pode adicionar um bot.');
     if(!r.practice)throw Error('Bots estão disponíveis somente no treino.');
     const {team,slot}=this.vacantSeat(r),n=r.players.filter(x=>x.bot).length;
     r.players.push({id:`bot-${randomUUID()}`,name:['Pipoca','Faísca','Fagulha'][n%3]+' · BOT',level:p.profile.level,equipment:{...DEFAULT_EQUIPMENT,weapon:WEAPONS[(n+1)%3].id},ready:true,bot:true,team,slot,connected:true});this.broadcastRoom(r);break;
    }
    case 'queue':this.queue(p);break;
    case 'cancel-queue':{const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode cancelar a busca.');if(r.status!=='searching')throw Error('A equipe não está buscando partida.');this.cancelSearch(r);this.broadcastRoom(r);break;}
    case 'start':this.start(p);break;
    case 'practice-start':this.practiceStart(p);break;
    case 'ability':{const {m,f}=this.turn(p);this.useAbility(m,f,c.ability);this.broadcastBattle(m);break;}
    case 'flight':{const {m,f}=this.turn(p);if(c.active&&(f.boosts.length||f.powerArmed||f.homingArmed))throw Error('Voo não combina com ferramentas, Power ou mira assistida.');f.flightArmed=c.active;f.charging=false;f.aimAngle=clampAimAngle(aimSource(f),f.aimSlope??0,f.aimAngle??45);this.broadcastBattle(m);break;}
    case 'power':{const {m,f}=this.turn(p);this.armPower(f);this.broadcastBattle(m);break;}
    case 'boost':{const {m,f}=this.turn(p);this.boost(f,c.boost);this.broadcastBattle(m);break;}
    case 'aim':{
     const {m,f}=this.turn(p);if(Date.now()-(p.lastAim??0)<100)return;p.lastAim=Date.now();
     adjustAimToTerrain(f,m.terrain);f.aimAngle=clampAimAngle(aimSource(f),f.aimSlope??0,c.angle);f.chargePower=c.power;f.charging=c.charging;this.broadcastBattle(m);break;
    }
    case 'walk':{
     const {m,f}=this.turn(p);if(Date.now()-p.lastWalk<65)return;p.lastWalk=Date.now();if(f.stamina<3)throw Error('Vigor insuficiente.');
     f.facing=c.direction;const destination=walkPosition(m.terrain,f,c.direction);if(destination){const fromY=f.y;f.x=destination.x;f.y=destination.y;f.stamina-=3;if(f.y>WORLD.height){f.y=WORLD.height+150;f.hp=0;}this.animateFall(f,fromY,Date.now());}adjustAimToTerrain(f,m.terrain);if(!this.checkWin(m))this.broadcastBattle(m);break;
    }
    case 'fire':{const {m,f}=this.turn(p);adjustAimToTerrain(f,m.terrain);this.fire(m,f,clampAimAngle(aimSource(f),f.aimSlope??0,c.angle),c.power);break;}
    case 'pass':{const {m}=this.turn(p);this.nextTurn(m);break;}
    case 'reward-pick':{
     const r=this.room(p),m=this.matchForRoom(r.id),rewards=m?.state.rewards;
     if(!m||m.state.phase!=='finished'||!rewards||rewards.phase!=='picking'||Date.now()>=rewards.deadline)throw Error('A escolha de cartas terminou.');
     if(Date.now()<(rewards.opensAt??0))throw Error('Aguarde a abertura das cartas.');
     if(!m.state.players.some(f=>f.id===id&&!f.bot&&!f.left))throw Error('Você não participou desta batalha.');
     if(rewards.cards.some(card=>card.playerId===id))throw Error('Sua carta já está reservada.');
     const card=rewards.cards[c.card];if(!card||!Number.isInteger(c.card))throw Error('Carta inválida.');
     if(card.playerId)throw Error('Esta carta já foi escolhida.');
     // Claim synchronously, before any await: competing commands cannot claim the same slot.
     card.playerId=id;if(m.state.players.filter(player=>!player.bot&&!player.left).every(player=>rewards.cards.some(card=>card.playerId===player.id)))this.revealRewards(m);else this.broadcastBattle(m);break;
    }
    case 'rematch':{
     const r=this.room(p),m=this.matchForRoom(r.id);if(r.hostId!==id)throw Error('Aguarde o líder da sala.');if(!m&&r.status==='waiting'){this.broadcastRoom(r);break;}if(!m||m.state.phase!=='finished')throw Error('A batalha ainda está acontecendo.');if(!m.state.rewards?.saved||Date.now()<(m.state.rewards.revealedAt??Infinity)+REWARD_RETURN_MS)throw Error('Aguarde a revelação e o recebimento das recompensas.');this.returnParties(m);break;
    }
    case 'chat':{
     const msg={id:randomUUID(),name:p.profile.name,text:c.text,channel:c.channel,time:Date.now()};
     if(c.channel==='room'){const r=this.room(p),m=this.matchForRoom(r.id);const recipients=m&&m.state.phase!=='finished'?this.matchPeers(m):this.roomMembers(r).map(s=>this.peers.get(s.id)).filter((peer):peer is Peer=>!!peer&&peer.roomId===r.id);for(const peer of recipients)this.emit(peer,{type:'chat',message:msg});}
     else for(const peer of this.peers.values())if(peer.channel===p.channel)this.emit(peer,{type:'chat',message:msg});break;
    }
   }
   this.pruneInvitations();if(this.roomsDirty)this.broadcastRooms();
  }catch(e){this.emit(p,{type:'error',message:e instanceof Error?e.message:'Não foi possível concluir a ação.',...((c.type==='customize'||c.type==='ability-loadout')&&c.requestId!==undefined?{requestId:c.requestId}:{})});}
 }
 private leave(p:Peer){
  if(!p.roomId)return;const r=this.rooms.get(p.roomId),m=this.matchForRoom(p.roomId);
  if(r?.spectators?.some(s=>s.id===p.profile.id)){r.spectators=r.spectators.filter(s=>s.id!==p.profile.id);this.detach(p);this.broadcastRoom(r);return;}
  if(r){this.cancelSearch(r);r.players=r.players.filter(s=>s.id!==p.profile.id);if(m){const f=m.state.players.find(f=>f.id===p.profile.id);if(f&&m.state.phase==='finished')f.connected=false;else if(f){f.hp=0;f.connected=false;f.powerArmed=false;f.left=true;}if(!this.checkWin(m)&&m.state.turnId===p.profile.id&&m.state.phase==='aiming')this.nextTurn(m);else this.broadcastBattle(m);}
   if(!r.players.some(s=>!s.bot)){for(const spectator of r.spectators??[]){const peer=this.peers.get(spectator.id);if(peer?.roomId===r.id)this.detach(peer);}r.spectators=[];this.rooms.delete(r.id);this.roomMatches.delete(r.id);if(m)this.cleanupMatch(m);}
   else{if(r.hostId===p.profile.id)r.hostId=r.players.find(s=>!s.bot)!.id;if(!r.practice&&r.status!=='playing')this.updateParty(r);this.broadcastRoom(r);}
  }
  this.detach(p);
 }
 private updateParty(r:Room){r.mode=modeForSlots(r.openSlots.length);if(!r.players.some(player=>player.slot===0)){const host=r.players.find(player=>player.id===r.hostId);if(host)host.slot=0;}r.players.forEach(s=>{s.team=0;s.ready=false;});}
 private cancelSearch(r:Room){this.queueIds.delete(r.id);delete r.searchStartedAt;if(r.status==='searching'){r.status='waiting';r.players.forEach(s=>s.ready=false);this.roomsDirty=true;}}
 private queueEligible(r:Room){return !r.practice&&r.players.length===r.openSlots.length&&r.openSlots.length>=1&&r.openSlots.length<=MAX_PARTY_SIZE&&r.openSlots.every(slot=>r.players.filter(player=>player.slot===slot).length===1)&&r.players.every(s=>!s.bot&&s.connected&&(s.id===r.hostId||s.ready)&&!this.profileChanges.has(s.id)&&this.peers.get(s.id)?.connected&&this.peers.get(s.id)?.roomId===r.id);}
 private queue(p:Peer){
  const r=this.room(p);if(r.hostId!==p.profile.id)throw Error('Somente o líder pode buscar partida.');if(r.practice)throw Error('O treino não usa a busca de partidas.');if(r.status!=='waiting')throw Error('A equipe já está buscando ou jogando.');
  if(!this.queueEligible(r))throw Error('Preencha todas as vagas abertas e aguarde todos ficarem conectados e prontos.');
  r.mode=modeForSlots(r.openSlots.length);r.status='searching';r.searchStartedAt=Date.now();this.queueIds.add(r.id);this.broadcastRoom(r);
  // Synchronous validation and reservation prevent simultaneous queues from consuming a party twice.
  for(const otherId of this.queueIds){
   if(otherId===r.id)continue;const other=this.rooms.get(otherId);
   if(!other||other.status!=='searching'){this.queueIds.delete(otherId);continue;}
   if(!this.queueEligible(other)){this.cancelSearch(other);this.broadcastRoom(other);continue;}
   if(other.players.length!==r.players.length)continue;
   this.launchMatch([other,r]);break;
  }
 }
 private cleanupMatch(m:Match){if(m.state.rewards?.saved&&m.roomIds.every(id=>this.roomMatches.get(id)!==m.key))this.matches.delete(m.key);}
 private returnParties(m:Match){
  if(!m.state.rewards?.saved)return;
  for(const id of m.roomIds){const room=this.rooms.get(id);if(!room||this.matchForRoom(id)!==m)continue;this.roomMatches.delete(id);room.status='waiting';delete room.matchStartedAt;delete room.searchStartedAt;room.players.forEach(player=>player.ready=player.bot);if(!room.practice)this.updateParty(room);for(const seat of this.roomMembers(room)){const peer=this.peers.get(seat.id);if(peer?.roomId===id)this.emit(peer,{type:'battle',battle:null});}this.broadcastRoom(room);}
  this.cleanupMatch(m);
 }
 private start(p:Peer){
  const r=this.room(p);if(!r.practice){this.queue(p);return;}if(r.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar.');if(r.status!=='waiting')throw Error('A partida já começou.');
  const capacity=r.openSlots.length*2;if(r.players.length!==capacity)throw Error(`A sala precisa de ${capacity} jogadores. Você pode adicionar bots.`);
  if(r.openSlots.some(slot=>[0,1].some(team=>r.players.filter(s=>s.team===team&&s.slot===slot).length!==1)))throw Error('Preencha os espaços abertos das duas equipes.');
  if(r.players.some(s=>!s.connected||this.profileChanges.has(s.id)||(!s.ready&&s.id!==r.hostId)))throw Error('Aguarde todos ficarem prontos.');
  this.launchMatch([r]);
 }
 private practiceStart(p:Peer){
  const room=this.room(p);if(room.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar o treino.');if(room.status!=='waiting')throw Error('Inicie o treino entre as partidas.');
  if(room.practice){this.start(p);return;}
  if(room.players.some(player=>!player.connected||this.profileChanges.has(player.id)||!this.peers.get(player.id)?.connected))throw Error('Aguarde todos ficarem conectados.');
  const seats:Seat[]=room.players.map(player=>({...player,team:0}));let n=0;
  for(const team of [0,1] as const)for(const slot of room.openSlots)if(!seats.some(player=>player.team===team&&player.slot===slot)){seats.push({id:`bot-${randomUUID()}`,name:['Pipoca','Faísca','Fagulha','Brasa'][n%4]+' · BOT',level:p.profile.level,equipment:{...DEFAULT_EQUIPMENT,weapon:WEAPONS[n++%WEAPONS.length].id},ready:true,bot:true,team,slot,connected:true});}
  this.launchMatch([room],seats);
 }
 private launchMatch(rooms:Room[],practiceSeats?:Seat[]){
  const r=rooms[0],map=rooms.length===2||practiceSeats?MAP_IDS[randomInt(MAP_IDS.length)]:r.map;
  const seats:Seat[]=practiceSeats??(rooms.length===2?rooms.flatMap((room,team)=>[...room.players].sort((a,b)=>a.slot-b.slot).map(s=>({...s,team:team as 0|1}))):r.players);
  const terrain=createTerrain(map);const fighters:Fighter[]=seats.map(s=>{const stats=attributes(s.equipment);const x=getMap(map).spawns[s.team][s.slot],abilityLoadout=normalizeAbilityLoadout(s.abilityLoadout);return {...s,equipment:structuredClone(s.equipment),abilityLoadout,x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:s.team===0?1:-1,boosts:[],powerCharge:0,powerArmed:false,abilities:initialAbilities(abilityLoadout),homingArmed:false,flightArmed:false,invisibleTurns:0};});
  fighters.forEach(fighter=>adjustAimToTerrain(fighter,terrain));
  fighters.sort((a,b)=>attributes(b.equipment).agility-attributes(a.equipment).agility);
  // In practice, the human takes the first turn so controls can be learned immediately.
  const first=seats.some(s=>s.bot)?fighters.find(f=>!f.bot)!:fighters[0];
  const key=this.matches.has(r.id)?randomUUID():r.id;
  const m:Match={key,roomIds:rooms.map(room=>room.id),practiceParty:!!practiceSeats,state:{id:randomUUID(),roomId:r.id,map,players:fighters,turnId:first.id,turnNumber:1,wind:this.wind(),deadline:Date.now()+30000,phase:'aiming',winner:null},terrain,resolveAt:0,botAt:Date.now()+2000,createdAt:Date.now()};
  this.matches.set(key,m);for(const room of rooms){this.queueIds.delete(room.id);room.status='playing';delete room.searchStartedAt;room.matchStartedAt=m.createdAt;room.map=map;this.roomMatches.set(room.id,key);this.broadcastRoom(room);}this.broadcastBattle(m,true);
 }
 private wind(){return Math.round((Math.random()*2-1)*35)/10;}
 private boost(f:Fighter,id:BoostId){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar ferramentas.');
  const b=BOOSTS.find(b=>b.id===id)!;
  if(id==='trident'&&f.boosts.includes(id))throw Error('O tridente já foi usado neste turno.');
  if(id==='trident'&&f.powerArmed)tridentWithPower(f.equipment.weapon);
  if(f.stamina<b.cost)throw Error('Vigor insuficiente.');f.stamina-=b.cost;f.boosts.push(id);
 }
 private armPower(f:Fighter){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar Power.');
  if(f.powerArmed)throw Error('Power já está preparado para este tiro.');
  if((f.powerCharge??0)<POWER_MAX)throw Error('Acumule 100 de Power para ativar.');
  if(f.boosts.includes('trident'))tridentWithPower(f.equipment.weapon);
  f.powerCharge=0;f.powerArmed=true;
 }
 private useAbility(m:Match,f:Fighter,ability:AbilityId){
  // Heal and invisibility act at once and combine with flight; homing guides a shot, which flight replaces.
  if(f.flightArmed&&ability==='homing')throw Error('Cancele o voo antes de usar a mira assistida.');
  if(!normalizeAbilityLoadout(f.abilityLoadout).includes(ability))throw Error('Esta habilidade não está equipada.');
  f.abilities??=initialAbilities(f.abilityLoadout);if(f.abilities[ability]<=0)throw Error('Esta habilidade já foi usada nesta partida.');
  if(ability==='heal'&&f.hp>=f.maxHp)throw Error('Sua vida já está completa.');
  if(ability==='homing'&&f.homingArmed)throw Error('A mira assistida já está preparada.');
  f.abilities[ability]--;let amount:number|undefined;
  if(ability==='heal'){amount=Math.min(HEAL_AMOUNT,f.maxHp-f.hp);f.hp+=amount;}
  if(ability==='homing')f.homingArmed=true;
  if(ability==='invisibility'){f.invisibleTurns=INVISIBILITY_TURNS;m.invisibilityActivated??=new Map();m.invisibilityActivated.set(f.id,m.state.turnNumber);}
  this.abilityEffect(m,{playerId:f.id,ability,x:f.x,y:f.y,amount,at:Date.now()});
 }
 private fire(m:Match,f:Fighter,angle:number,power:number){
  if(f.flightArmed){this.fireFlight(m,f,angle,power);return;}
  if(f.powerArmed){
   f.powerArmed=false;f.charging=false;
   const at=Date.now()+POWER_CUT_IN_MS;
   m.pendingPower={playerId:f.id,angle,power,at};
   m.state.powerCutIn={id:randomUUID(),playerId:f.id,endsAt:at};
   m.state.phase='resolving';m.resolveAt=Infinity;this.broadcastBattle(m);return;
  }
  this.resolveFire(m,f,angle,power,false);
 }
 private fireFlight(m:Match,f:Fighter,angle:number,power:number){
  const weapon={...weaponStats(WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)!,f.equipment.upgrade),projectileRadius:6},result=trajectory(m.terrain,f,angle,power,m.state.wind,weapon),startedAt=Date.now(),id=randomUUID();
  f.flightArmed=false;f.charging=false;f.aimAngle=angle;f.chargePower=power;
  const shot:Shot={id,shooterId:f.id,startedAt,duration:result.flightTime+450,hits:[],impacted:[],projectiles:[{kind:'flight',effect:weapon.effect,points:result.points,delay:0,flightTime:result.flightTime,impact:{x:result.x,y:result.y,radius:0,...terrainMaterial(m.state.map,result.x,result.y)}}]};
  m.activeShot=shot;m.pendingImpacts=[{at:startedAt+result.flightTime,projectileIndex:0,hits:[],flight:true,mark:{id:`${id}:0`,x:result.x,y:result.y,radius:0,effect:weapon.effect,level:f.equipment.upgrade}}];m.state.phase='resolving';m.resolveAt=startedAt+shot.duration;
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});this.broadcastBattle(m);
 }
 private resolveFire(m:Match,f:Fighter,angle:number,power:number,powered:boolean,startedAt=Date.now()){
  f.aimAngle=angle;f.chargePower=power;f.charging=false;
  const w=weaponStats(WEAPONS.find(w=>w.id===f.equipment.weapon)!,f.equipment.upgrade);
  if(powered){w.crater*=POWER_CRATER_MULTIPLIER;w.blast*=POWER_BLAST_MULTIPLIER;}
  const homing=f.homingArmed;f.homingArmed=false;
  const modifiers=shotModifiers(boostsForShot(f.equipment.weapon,f.boosts,powered)),shot:Shot={powered,id:randomUUID(),shooterId:f.id,projectiles:[],hits:[],duration:0,startedAt,impacted:[]};
  const simulated:Match={...m,terrain:m.terrain.slice(),state:{...m.state,players:structuredClone(m.state.players)}},shooter=simulated.state.players.find(player=>player.id===f.id)!;
  const angles=Array.from({length:modifiers.volleys},()=>modifiers.spread.map(spread=>angle+spread)).flat(),delays=angles.map((_,index)=>Math.floor(index/modifiers.spread.length)*VOLLEY_CADENCE_MS),impacts:Shot['projectiles'][number]['impact'][]=[],pending:PendingImpact[]=[];
  const planImpact=(result:TrajectoryResult,index:number,delay:number,radius:number,blast:number,damageScale:number,fragment=false):Shot['projectiles'][number]['impact']=>{
   const impact={x:result.x,y:result.y,radius,...terrainMaterial(m.state.map,result.x,result.y),...(w.demolition?{demolition:w.demolition}:{})};
   const hits:ShotHit[]=[];
   for(const target of simulated.state.players){
    if(target.hp<=0)continue;const exposure=impactExposure(target,result,blast);if(exposure.attenuation<=0)continue;
    const critical=criticalFromRoll(attributes(f.equipment).luck,this.criticalRoll()),damage=damageAtImpact(f.equipment,target.equipment,{attenuation:exposure.attenuation,shotMultiplier:modifiers.projectileMultiplier*damageScale,boostMultiplier:modifiers.damageMultiplier*(powered?POWER_DAMAGE_MULTIPLIER:1),critical});
    if(damage<=0)continue;
    target.hp=Math.max(0,target.hp-damage);hits.push({id:target.id,damage,x:target.x,y:target.y-85,projectileIndex:index,critical,kind:exposure.kind,quality:exposure.quality});
   }
   crater(simulated.terrain,result.x,result.y,radius,m.state.map,w.demolition??0);this.settle(simulated);
   pending.push({at:startedAt+delay+result.flightTime,projectileIndex:index,hits,fragment,mark:{id:`${shot.id}:${index}`,x:result.x,y:result.y,radius,effect:w.effect,level:f.equipment.upgrade}});
   return impact;
  };
  const results=volley(simulated.terrain,shooter,angles,power,m.state.wind,w,simulated.state.players.filter(player=>player.id!==f.id),(result,index)=>{
   impacts[index]=planImpact(result,index,delays[index],w.crater,w.blast,1);
  },delays,homing?{projectileIndex:0,targets:homingTargets(simulated.state.players,shooter)}:undefined);
  shot.projectiles=results.map((result,index)=>({points:result.points,delay:delays[index],flightTime:result.flightTime,impact:impacts[index],effect:w.effect,powered}));
  const shardCount=weaponFragmentCount(w,f.equipment.upgrade,powered);
  if(shardCount&&w.fragments)for(let parent=0;parent<results.length;parent++){
   const result=results[parent];if(result.x<0||result.x>WORLD.width||result.y>WORLD.height)continue;
   const start=delays[parent]+result.flightTime,base=shot.projectiles.length,shardImpacts:Shot['projectiles'][number]['impact'][]=[];
   const pieces=shatter(simulated.terrain,{x:result.x,y:result.y},shardCount,shooter.facing,w,m.state.wind,simulated.state.players.filter(player=>player.id!==f.id&&player.id!==result.hitId),(piece,index)=>{
    shardImpacts[index]=planImpact(piece,base+index,start,w.fragments!.crater,w.fragments!.blast,w.fragments!.damage,true);
   });
   pieces.forEach((piece,index)=>shot.projectiles.push({points:piece.points,delay:start,flightTime:piece.flightTime,impact:shardImpacts[index],effect:w.effect,powered,fragment:true}));
  }
  shot.duration=Math.max(...shot.projectiles.map(projectile=>projectile.delay+projectile.flightTime))+450;m.activeShot=shot;m.pendingImpacts=pending.sort((a,b)=>a.at-b.at||a.projectileIndex-b.projectileIndex);m.state.phase='resolving';m.resolveAt=startedAt+shot.duration;
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});
  this.broadcastBattle(m);
 }
 private applyImpact(m:Match,impact:PendingImpact){
  const shot=m.activeShot;if(!shot||m.state.phase!=='resolving'||shot.impacted.includes(impact.projectileIndex))return;
  const shooter=m.state.players.find(player=>player.id===shot.shooterId)!,hits:ShotHit[]=[];
  if(impact.flight){
   const landing=shooter.hp>0?flightLanding(m.terrain,impact.mark,m.state.players.filter(player=>player.id!==shooter.id)):null;
   if(landing){Object.assign(shooter,landing);delete shooter.fall;adjustAimToTerrain(shooter,m.terrain);this.abilityEffect(m,{playerId:shooter.id,ability:'flight',...landing,at:impact.at});}
   shot.impacted.push(impact.projectileIndex);for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:[]});this.broadcastBattle(m,true);return;
  }
  for(const planned of impact.hits){
   const target=m.state.players.find(player=>player.id===planned.id);if(!target||target.hp<=0)continue;
   const damage=Math.min(target.hp,planned.damage);if(damage<=0)continue;target.hp-=damage;if(target.hp<=0)target.powerArmed=false;
   if(target.team!==shooter.team){if(shooter.hp>0)shooter.powerCharge=chargeFromDamage(shooter.powerCharge??0,damage,target.maxHp);target.powerCharge=chargeFromDamage(target.powerCharge??0,damage,target.maxHp,true);}
   hits.push({...planned,damage,x:target.x,y:target.y-85});
  }
  const projectile=shot.projectiles[impact.projectileIndex];crater(m.terrain,impact.mark.x,impact.mark.y,impact.mark.radius,m.state.map,projectile?.impact.demolition??0);
  const standing=m.state.players.filter(player=>player.hp>0).map(player=>({id:player.id,hp:player.hp,x:player.x,y:player.y}));this.settle(m,impact.at);
  for(const before of standing){const target=m.state.players.find(player=>player.id===before.id)!;if(target.hp<=0){target.powerArmed=false;hits.push({id:target.id,damage:before.hp,x:before.x,y:before.y-85,projectileIndex:impact.projectileIndex,critical:false,kind:'fall',quality:1});}}
  if(!impact.fragment)m.state.terrainMarks=[...(m.state.terrainMarks??[]),impact.mark].slice(-48);shot.hits.push(...hits);shot.impacted.push(impact.projectileIndex);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:this.visibleHits(m,hits,peer.profile.id)});
  if(!this.checkWin(m))this.broadcastBattle(m,true);
 }
 private animateFall(target:Fighter,fromY:number,at:number){
  const previous=target.fall,falling=previous&&at<previous.startedAt+previous.duration;
  if(previous&&!falling)delete target.fall;
  if(target.y-fromY<9)return;
  target.fall=createFall(falling?fallPosition(previous,at):fromY,target.y,at,target.y>WORLD.height,falling?fallVelocity(previous,at):0);
 }
 private settle(m:Match,at?:number){for(const target of m.state.players){
  const fromY=target.y;target.y=ground(m.terrain,target.x,Math.max(0,target.y-3));if(target.y>WORLD.height){target.y=WORLD.height+150;target.hp=0;}
  if(at!==undefined){this.animateFall(target,fromY,at);if(target.fall)m.resolveAt=Math.max(m.resolveAt,target.fall.startedAt+target.fall.duration);}
  adjustAimToTerrain(target,m.terrain);
 }}
 private nextTurn(m:Match){
  if(this.checkWin(m))return;
  const s=m.state,withTerrain=s.phase==='resolving';const index=s.players.findIndex(p=>p.id===s.turnId);let next=index;
  const outgoing=s.players[index];if((outgoing.invisibleTurns??0)>0&&m.invisibilityActivated?.get(outgoing.id)!==s.turnNumber)outgoing.invisibleTurns!--;
  for(let n=1;n<=s.players.length;n++){const candidate=(index+n)%s.players.length;if(s.players[candidate].hp>0){next=candidate;break;}}
  delete m.pendingPower;delete m.activeShot;delete m.pendingImpacts;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});const f=s.players[next];f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+30000;m.botAt=Date.now()+1800;this.broadcastBattle(m,withTerrain);
 }
 private checkWin(m:Match){
  if(m.state.phase==='finished')return true;
  const teams=new Set(m.state.players.filter(p=>p.hp>0).map(p=>p.team));
  const exhausted=m.state.turnNumber>=80;
  if(teams.size>1&&!exhausted)return false;
  delete m.pendingPower;delete m.pendingImpacts;delete m.state.powerCutIn;m.state.players.forEach(f=>{f.powerArmed=false;f.flightArmed=false;f.homingArmed=false;});
  m.state.phase='finished';m.state.winner=teams.size===1?[...teams][0]:null;
  m.rewardDeck=Array.from({length:REWARD_CARD_COUNT},()=>({...CARD_PRIZES[randomInt(CARD_PRIZES.length)]}));
  const opensAt=Math.max(Date.now(),...m.state.players.map(player=>player.fall?player.fall.startedAt+player.fall.duration:0))+REWARD_RESULT_MS;m.state.rewards={opensAt,deadline:opensAt+REWARD_PICK_MS,phase:'picking',saved:false,cards:Array.from({length:REWARD_CARD_COUNT},(_,index)=>({index}))};
  // Bot choices occupy real slots too; prizes stay exclusively on the server until reveal.
  for(const bot of m.state.players.filter(f=>f.bot))this.autoPick(m,bot.id);
  this.broadcastBattle(m,true);
  return true;
 }
 private autoPick(m:Match,id:string){
  const cards=m.state.rewards!.cards;if(cards.some(card=>card.playerId===id))return;
  const free=cards.filter(card=>!card.playerId);if(free.length){const card=free[randomInt(free.length)];card.playerId=id;card.automatic=true;}
 }
 private revealRewards(m:Match,now=Date.now()){
  const rewards=m.state.rewards!;
  if(rewards.phase==='revealed')return;
  for(const player of m.state.players)if(!player.left)this.autoPick(m,player.id);
  for(const card of rewards.cards)card.prize={...m.rewardDeck![card.index]};
  rewards.phase='revealed';rewards.revealedAt=now;this.broadcastBattle(m);this.saveRewards(m);
 }
 private saveRewards(m:Match){
  const rewards=m.state.rewards;if(!rewards||rewards.saved||m.savingRewards)return;
  m.savingRewards=true;
  // Fallen fighters who stayed to watch keep their reward; those who left forfeit it.
  const humans=m.state.players.filter(p=>!p.bot&&!p.left),winners=humans.filter(p=>p.team===m.state.winner).map(p=>p.id);
  const bonuses:MatchBonuses=Object.fromEntries(rewards.cards.filter(card=>card.playerId&&card.prize&&humans.some(p=>p.id===card.playerId)).map(card=>[card.playerId!,card.prize!]));
  this.store.finishMatch(m.state.id,winners,humans.map(p=>p.id),bonuses).then(async()=>{
   for(const f of humans){const p=this.peers.get(f.id);if(p){const profile=await this.store.getProfile(f.id);if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});const seat=p.roomId?this.rooms.get(p.roomId)?.players.find(s=>s.id===f.id):undefined;if(seat)seat.level=profile.level;}}}
   rewards.saved=true;void this.refreshRanking();this.broadcastBattle(m);for(const roomId of m.roomIds){const room=this.rooms.get(roomId);if(room&&this.matchForRoom(roomId)===m)this.broadcastRoom(room);}
  }).catch(error=>{this.report(error);m.retryRewardsAt=Date.now()+2000;}).finally(()=>{m.savingRewards=false;});
 }
 /** Reloads the day's podium and tells everyone when it changed; also rolls over at midnight. */
 refreshRanking():Promise<void>{
  if(!this.store.dailyRanking)return Promise.resolve();
  if(this.rankingLoading)return this.rankingLoading.then(():Promise<void>=>this.refreshRanking());
  this.rankingAt=Date.now();
  this.rankingLoading=this.store.dailyRanking().then(ranking=>{
   if(JSON.stringify(ranking)===JSON.stringify(this.ranking))return;
   this.ranking=ranking;for(const peer of this.peers.values())this.emit(peer,{type:'ranking',ranking});
  }).catch(this.report).finally(()=>{this.rankingLoading=null;});
  return this.rankingLoading;
 }
 private bot(m:Match,f:Fighter){
  const target=m.state.players.filter(p=>p.team!==f.team&&p.hp>0&&!(p.invisibleTurns??0)).sort((a,b)=>a.hp-b.hp)[0];if(!target){this.nextTurn(m);return;}f.facing=target.x>f.x?1:-1;
  const w=WEAPONS.find(w=>w.id===f.equipment.weapon)!;adjustAimToTerrain(f,m.terrain);const limits=weaponAimLimits(w,f.aimSlope??0);let best={score:Infinity,angle:clampAimAngle(w,f.aimSlope??0,45),power:60};
  // A bounded ballistic search, at most 396 trajectories per bot turn.
  for(let angle=limits.minAngle;angle<=limits.maxAngle;angle+=5)for(let power=18;power<=98;power+=3){const r=trajectory(m.terrain,f,angle,power,m.state.wind,w,[target]);const score=Math.hypot(r.x-target.x,r.y-target.y);if(score<best.score)best={score,angle,power};}
  if((f.powerCharge??0)>=POWER_MAX)this.armPower(f);
  this.boost(f,'damage30');this.fire(m,f,best.angle,Math.max(5,Math.min(100,best.power+(Math.random()-.5)*3)));
 }
 tick(now=Date.now()){
  this.pruneInvitations(now);
  if(now-this.rankingAt>=60000)void this.refreshRanking();
  const dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;
  const channels=new Set<number>();
  for(const [id,p] of this.peers){
   if(!p.connected&&now-p.lastSeen>30000&&!this.profileChanges.has(id)){this.leave(p);this.peers.delete(id);continue;}
   if(p.connected&&!p.roomId){const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy);if(d>1){const step=Math.min(d,LOBBY_WALK_SPEED*dt);p.x+=dx/d*step;p.y+=dy/d*step;channels.add(p.channel);}}
  }
  if(++this.lobbyTick%2===0)for(const channel of channels)this.sendLobby(channel);
  for(const m of this.matches.values()){
   if(m.state.phase==='finished'&&m.state.rewards){const rewards=m.state.rewards;if(rewards.phase==='picking'&&now>=rewards.deadline)this.revealRewards(m,now);else if(rewards.phase==='revealed'&&!rewards.saved&&now>=(m.retryRewardsAt??0))this.saveRewards(m);if(rewards.saved&&now>=(rewards.revealedAt??Infinity)+REWARD_RETURN_MS)this.returnParties(m);this.cleanupMatch(m);}
   if(m.pendingPower&&now>=m.pendingPower.at){const pending=m.pendingPower;delete m.pendingPower;delete m.state.powerCutIn;const shooter=m.state.players.find(f=>f.id===pending.playerId);if(shooter&&shooter.hp>0&&m.state.phase==='resolving')this.resolveFire(m,shooter,pending.angle,pending.power,true,now);else if(m.state.phase!=='finished')this.nextTurn(m);}
   while(m.state.phase==='resolving'&&m.pendingImpacts?.length&&m.pendingImpacts[0].at<=now){const impact=m.pendingImpacts.shift()!;this.applyImpact(m,impact);}
   if(m.state.phase==='resolving'&&now>=m.resolveAt)this.nextTurn(m);
   else if(m.state.phase==='aiming'){
    if(now>=m.state.deadline)this.nextTurn(m);
    else{const f=m.state.players.find(p=>p.id===m.state.turnId);if(f?.bot&&now>=m.botAt){m.botAt=Infinity;this.bot(m,f);}}
   }
  }
  if(this.roomsDirty)this.broadcastRooms();
 }
}
