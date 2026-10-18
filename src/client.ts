import {syncPublishedMaps} from './publishedMaps';
import {useSyncExternalStore} from 'react';
import type {CharacterGender,Equipment} from '../shared/catalog';
import {CustomizationQueue} from './customization';
import {equippedColors} from '../shared/colors';
import type {BodyColorPart} from '../shared/colors';
import type {CustomizationPatch} from './customization';
import {normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityEffect,AbilityLoadout} from '../shared/abilities';
import {AbilityLoadoutQueue} from './abilityLoadout';
import {readRoomInvite} from './roomInvite';
import {recoveredImpacts,shotClock} from './game/shotPlayback';
import type {PlayerInfo} from '../shared/reports';
import type {MailClaimResult,MailMessage} from '../shared/mail';
/** Right click on another player (portraits, plaza, rooms, online list, chat): the menu, then its window. */
export type PlayerTarget={id:string;name:string;context:'lobby'|'hall'|'room'|'battle'|'chat'|'ranking'};
export type PlayerPanel=(PlayerTarget&{kind:'menu';x:number;y:number})|(PlayerTarget&{kind:'info'|'report'})|null;
import type {Battle,ChatLine,Command,LobbyPlayer,OnlinePlayer,Profile,RankingEntry,Room,RoomInvitePlayer,RoomInvitation,RoomInviteResult,ServerEvent,Shot,ForgeResult,CompositionResult,ShopResult,ColorChange,ColorResult} from '../shared/protocol';
export interface State {/** The Correio window and its inbox (newest first). */mailOpen:boolean;mails:MailMessage[];mailUnread:number;mailLoaded:boolean;mailClaim:(MailClaimResult&{at:number})|null;mailPending:boolean;playerPanel:PlayerPanel;playerInfo:PlayerInfo|null;reportResult:{playerId:string;name:string;at:number}|null;ranking:RankingEntry[];onlinePlayers:OnlinePlayer[];onlineTotal:number;invitePlayers:RoomInvitePlayer[];inviteListRoomId:string|null;roomInvitations:RoomInvitation[];inviteResults:RoomInviteResult[];abilityLoadoutDraft:AbilityLoadout|null;abilityLoadoutPending:boolean;abilityEffects:AbilityEffect[];impacts:Extract<ServerEvent,{type:'impact'}>[];customizationEquipment:Equipment|null;customizationPending:boolean;status:'connecting'|'online'|'offline'|'replaced';needsCharacter:boolean;creatingCharacter:boolean;profile:Profile|null;players:LobbyPlayer[];rooms:Room[];room:Room|null;battle:Battle|null;chat:ChatLine[];online:number;arenaOnline:number;channel:number;latency:number;offset:number;shot:Shot|null;shotReceivedAt:number;shotBaseline:Record<string,{x:number;y:number;hp:number}>;error:string|null;colorResult:ColorResult|null;discardResult:{item:string;at:number}|null;forgeResult:ForgeResult|null;compositionResult:CompositionResult|null;shopResult:ShopResult|null;}
class Client {
 state:State={mailOpen:false,mails:[],mailUnread:0,mailLoaded:false,mailClaim:null,mailPending:false,playerPanel:null,playerInfo:null,reportResult:null,ranking:[],onlinePlayers:[],onlineTotal:0,invitePlayers:[],inviteListRoomId:null,roomInvitations:[],inviteResults:[],abilityLoadoutDraft:null,abilityLoadoutPending:false,abilityEffects:[],impacts:[],customizationEquipment:null,customizationPending:false,status:'connecting',needsCharacter:false,creatingCharacter:false,profile:null,players:[],rooms:[],room:null,battle:null,chat:[],online:0,arenaOnline:0,channel:1,latency:0,offset:0,shot:null,shotReceivedAt:0,shotBaseline:{},error:null,colorResult:null,discardResult:null,forgeResult:null,compositionResult:null,shopResult:null};
 private listeners=new Set<()=>void>();private ws:WebSocket|null=null;private started=false;private retry=0;private reconnectTimer=0;private pingTimer=0;
 private loadoutTimer=0;
 private inviteHandled=false;
 private abilityLoadoutQueue=new AbilityLoadoutQueue(()=>normalizeAbilityLoadout(this.state.profile?.abilityLoadout),command=>{
  clearTimeout(this.loadoutTimer);
  this.loadoutTimer=window.setTimeout(()=>{this.abilityLoadoutQueue.cancel();this.update({error:'A conexão demorou. Conferindo suas habilidades…'});this.ws?.close();},12000);
  this.send(command);
 },(abilityLoadoutDraft,abilityLoadoutPending)=>this.update({abilityLoadoutDraft,abilityLoadoutPending}));
 setAbilityLoadout(slots:AbilityLoadout){
  if(!this.state.profile||this.state.battle||this.state.room?.status!=='waiting'||this.state.status!=='online'||this.ws?.readyState!==WebSocket.OPEN)return;
  this.update({error:null});this.abilityLoadoutQueue.apply(slots);
 }
 private customizationTimer=0;
 private customizationQueue=new CustomizationQueue(()=>this.state.profile!.equipment,command=>{
  clearTimeout(this.customizationTimer);
  this.customizationTimer=window.setTimeout(()=>{
   this.customizationQueue.cancel();this.update({error:'A conexão demorou. Conferindo seus equipamentos…'});this.ws?.close();
  },12000);
  this.send(command);
 },(equipment,customizationPending)=>{
  // Optimistic outfits show each copy's own ticket color before the server confirms.
  const profile=this.state.profile,customizationEquipment=equipment&&profile?{...equipment,colors:equippedColors(equipment,profile.itemColors)}:equipment;
  this.update({customizationEquipment,customizationPending});
 });
 /** Opens the player menu at the pointer; bots and empty seats have none. */
 openPlayerMenu(event:{clientX:number;clientY:number;preventDefault?:()=>void},target:PlayerTarget){
  event.preventDefault?.();if(!this.state.profile||!/^(bot-)?[0-9a-f-]{36}$/i.test(target.id))return;
  this.update({playerPanel:{...target,kind:'menu',x:event.clientX,y:event.clientY}});
 }
 openPlayerPanel(kind:'info'|'report',target:PlayerTarget){
  this.update({playerPanel:{...target,kind},...(kind==='info'?{playerInfo:this.state.playerInfo?.id===target.id?this.state.playerInfo:null}:{reportResult:null})});
  if(kind==='info')this.send({type:'player-info',playerId:target.id});
 }
 closePlayerPanel(){this.update({playerPanel:null});}
 openMail(){this.update({mailOpen:true,mailClaim:null});this.send({type:'mail-list'});}
 closeMail(){this.update({mailOpen:false});}
 readMail(id:number){const mail=this.state.mails.find(m=>m.id===id);if(mail&&!mail.read){this.update({mails:this.state.mails.map(m=>m.id===id?{...m,read:true}:m)});this.send({type:'mail-read',id});}}
 /** Receives one letter's attachments, or every letter's ("Receber tudo"). */
 claimMail(id?:number){if(this.state.mailPending)return;this.update({error:null,mailClaim:null,mailPending:true});this.send({type:'mail-claim',...(id!==undefined?{id}:{})});}
 deleteMail(id:number){this.update({error:null});this.send({type:'mail-delete',id});}
 paint(changes:ColorChange[]){this.update({error:null,colorResult:null});this.send({type:'paint',changes});}
 discard(item:string){this.update({error:null});this.send({type:'discard',item});}
 customize(patch:CustomizationPatch){
  if(!this.state.profile||this.state.battle||this.state.status!=='online'||this.ws?.readyState!==WebSocket.OPEN)return;
  this.update({error:null});this.customizationQueue.apply(patch);
 }
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 snapshot=()=>this.state;
 update(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(f=>f());}
 async start(){if(this.started)return;this.started=true;void syncPublishedMaps();this.update({status:'connecting',error:null});try{const r=await fetch('/api/session',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível entrar. Tente novamente.');const {profile}=await r.json();if(!profile){this.update({needsCharacter:true});return;}this.update({profile,needsCharacter:false});this.connect();}catch(e){this.update({status:'offline',error:e instanceof DOMException&&e.name==='TimeoutError'?'O servidor demorou a responder. Toque em tentar novamente.':(e as Error).message});this.started=false;}}
 async createCharacter(gender:CharacterGender){
  if(this.state.profile||this.state.creatingCharacter||!this.state.needsCharacter)return;
  this.update({creatingCharacter:true,error:null});
  try{
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok||!result.profile)throw Error(result.error??'Não foi possível criar seu personagem.');
   this.update({profile:result.profile,needsCharacter:false,creatingCharacter:false});this.connect();
  }catch(error){this.update({creatingCharacter:false,error:error instanceof DOMException&&error.name==='TimeoutError'?'O servidor demorou a responder. Tente novamente.':(error as Error).message});}
 }
 private connect(){
  this.update({status:'connecting',invitePlayers:[],inviteListRoomId:null,roomInvitations:[],inviteResults:[]});const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);this.ws=ws;
  const connectTimeout=window.setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN)ws.close();},10000);
  ws.onopen=()=>{clearTimeout(connectTimeout);this.retry=0;this.update({status:'online',error:null});this.pingTimer=window.setInterval(()=>this.send({type:'ping',time:Date.now()}),5000);};
  ws.onmessage=e=>{let event:ServerEvent;try{event=JSON.parse(e.data);}catch{return;}this.receive(event);};
  ws.onclose=e=>{clearTimeout(connectTimeout);clearInterval(this.pingTimer);clearTimeout(this.loadoutTimer);this.abilityLoadoutQueue.cancel();clearTimeout(this.customizationTimer);this.customizationQueue.cancel();if(e.code===4001){this.update({status:'replaced',roomInvitations:[],invitePlayers:[],inviteListRoomId:null});return;}this.update({status:'offline',roomInvitations:[],invitePlayers:[],inviteListRoomId:null});this.reconnectTimer=window.setTimeout(()=>this.connect(),Math.min(10000,1000*2**this.retry++));};
  ws.onerror=()=>ws.close();
 }
 private receive(e:ServerEvent){switch(e.type){
  case 'welcome':{const offset=e.serverTime-Date.now(),shot=e.battle?.activeShot??null;this.update({abilityEffects:[],profile:e.profile,players:e.players,rooms:e.rooms,arenaOnline:e.arenaOnline??0,ranking:e.ranking??[],room:e.room,battle:e.battle,channel:e.channel,offset,shot,shotReceivedAt:shot?shotClock(shot,offset):0,shotBaseline:{},impacts:shot?recoveredImpacts(shot):[]});
   if(!this.inviteHandled){this.inviteHandled=true;const invite=readRoomInvite(location.href);if(invite.cleanUrl!==location.href)history.replaceState(history.state,'',invite.cleanUrl);if(invite.roomId&&!e.room&&!e.battle)this.send({type:'join',roomId:invite.roomId});else if(invite.roomId&&e.room?.id!==invite.roomId)this.update({error:'Saia da sua sala atual antes de aceitar outro convite.'});}
   break;}
  case 'profile':this.update({profile:e.profile});if(e.requestId&&this.customizationQueue.matches(e.requestId)){clearTimeout(this.customizationTimer);this.customizationQueue.acknowledge(e.requestId);}if(e.requestId&&this.abilityLoadoutQueue.matches(e.requestId)){clearTimeout(this.loadoutTimer);this.abilityLoadoutQueue.acknowledge(e.requestId);}break;
  case 'shop-result':this.update({shopResult:e.result});break;
  case 'forge-result':this.update({forgeResult:e.result});break;
  case 'color-result':this.update({colorResult:e.result});break;
  case 'discard-result':this.update({discardResult:{item:e.item,at:Date.now()}});break;
  case 'composition-result':this.update({compositionResult:e.result});break;
  case 'lobby':this.update({players:e.players,online:e.online});break;
  case 'rooms':this.update({rooms:e.rooms});break;
  case 'arena-population':this.update({arenaOnline:e.count});break;
  case 'ranking':this.update({ranking:e.ranking});break;
  case 'maps':void syncPublishedMaps();break;
  case 'online-players':this.update({onlinePlayers:e.players,onlineTotal:e.total});break;
  case 'room-invite-list':if(this.state.room?.id===e.roomId)this.update({invitePlayers:e.players,inviteListRoomId:e.roomId});break;
  case 'room-invitation':if(!this.state.room&&!this.state.battle&&e.invite.expiresAt>Date.now()+this.state.offset)this.update({roomInvitations:[...this.state.roomInvitations.filter(invite=>invite.id!==e.invite.id),e.invite].slice(-5)});break;
  case 'room-invite-result':this.update({inviteResults:[...this.state.inviteResults.slice(-19),e],...(e.status!=='sent'?{roomInvitations:this.state.roomInvitations.filter(invite=>invite.id!==e.inviteId)}:{})});break;
  case 'room':this.update({room:e.room,...(e.room?{roomInvitations:[]}:{}),...(e.room?.id!==this.state.room?.id?{invitePlayers:[],inviteListRoomId:null,inviteResults:[]}:{})});break;
  case 'battle':{
   const changed=e.battle?.id!==this.state.battle?.id,active=e.battle?.activeShot;
   const shot=active??(!e.battle||!!e.battle.powerCutIn||changed||(e.battle.terrain!==undefined&&e.battle.phase!=='resolving')?null:this.state.shot);
   this.update({...changed?{abilityEffects:[]}:{},shot,...(active&&active.id!==this.state.shot?.id?{shotReceivedAt:shotClock(active,this.state.offset),impacts:recoveredImpacts(active)}:changed?{impacts:[]}:{}),battle:e.battle?{...e.battle,terrain:e.battle.terrain??(!changed?this.state.battle?.terrain:undefined)}:null});break;
  }
  case 'shot':this.update({shot:e.shot,shotReceivedAt:shotClock(e.shot,this.state.offset),shotBaseline:Object.fromEntries((this.state.battle?.players??[]).map(p=>[p.id,{x:p.x,y:p.y,hp:p.hp}]))});break;
  case 'impact':{
   if(this.state.impacts.some(impact=>impact.shotId===e.shotId&&impact.projectileIndex===e.projectileIndex))break;
   const shot=this.state.shot;
   this.update({impacts:[...this.state.impacts.slice(-31),e],...(shot?.id===e.shotId?{shot:{...shot,impacted:[...new Set([...shot.impacted,e.projectileIndex])],hits:[...shot.hits.filter(hit=>hit.projectileIndex!==e.projectileIndex),...e.hits]}}:{})});break;
  }
  case 'ability-effect':{
   if(!this.state.battle||e.hidden)break;
   if(this.state.abilityEffects.some(effect=>effect.playerId===e.playerId&&effect.ability===e.ability&&effect.at===e.at))break;
   this.update({abilityEffects:[...this.state.abilityEffects.slice(-15),e]});break;
  }
  case 'player-info':this.update({playerInfo:e.info});break;
  case 'mail':this.update({mails:e.mails,mailUnread:e.unread,mailLoaded:true,mailPending:false});break;
  case 'mail-claim-result':this.update({mailClaim:{...e.result,at:Date.now()},mailPending:false});break;
  case 'report-result':this.update({reportResult:{playerId:e.playerId,name:e.name,at:Date.now()}});break;
  case 'chat':this.update({chat:[...this.state.chat.slice(-79),e.message]});break;
  case 'error':if(this.state.mailPending)this.update({mailPending:false});if(e.requestId&&this.abilityLoadoutQueue.reject(e.requestId))clearTimeout(this.loadoutTimer);if(e.requestId&&this.customizationQueue.reject(e.requestId))clearTimeout(this.customizationTimer);this.update({error:e.message});break;
  case 'pong':this.update({latency:Date.now()-e.time,offset:e.serverTime-(e.time+Date.now())/2});break;
 }}
 send(c:Command){if(c.type==='room-invite-list')this.update({invitePlayers:[],inviteListRoomId:null});if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(c));else this.update({error:'Reconectando ao servidor…'});}
 retryNow(){clearTimeout(this.reconnectTimer);this.started=false;this.start();}
 stop(){
  clearTimeout(this.reconnectTimer);clearInterval(this.pingTimer);clearTimeout(this.loadoutTimer);clearTimeout(this.customizationTimer);
  if(this.ws){this.ws.onclose=null;this.ws.onmessage=null;this.ws.onerror=null;this.ws.onopen=null;this.ws.close();}
  this.ws=null;this.started=false;
 }
}
export const client=new Client();
export const useGame=()=>useSyncExternalStore(client.subscribe,client.snapshot);
// React components keep hot refresh; replacing the stateful socket service must
// remount the app so no component remains subscribed to its previous singleton.
if(import.meta.hot){
 import.meta.hot.dispose(()=>client.stop());
 import.meta.hot.accept(()=>window.location.reload());
}
