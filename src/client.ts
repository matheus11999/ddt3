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
import type {AuctionCurrency,AuctionMine,AuctionPage,AuctionResult,AuctionSource} from '../shared/auction';
import type {GuildState,GuildSummary} from '../shared/guilds';
import type {PetResult,PetsState} from '../shared/petProtocol';
import type {PetApplication} from '../shared/petSkills';
import {PET_EFFECT_MAX_MS} from './game/petEffects';
import type {GuildBoard,HallBoard,HallCategory,HallGuildProfile,HallLegends,HallPeriod,HallPlayerProfile,LegendBoard} from '../shared/hall';
import type {WorldBossRanking,WorldBossStatus} from '../shared/worldBoss';
export type GuildTab='home'|'shop'|'storage'|'manage'|'members';
export type AuctionQuery={category?:string;page:number;search?:string};
/** Right click on another player (portraits, plaza, rooms, online list, chat): the menu, then its window. */
export type PlayerTarget={id:string;name:string;context:'lobby'|'hall'|'room'|'battle'|'chat'|'ranking'|'auction'};
export type PlayerPanel=(PlayerTarget&{kind:'menu';x:number;y:number})|(PlayerTarget&{kind:'info'|'report'})|null;
import type {MatchLoading} from '../shared/protocol';
import type {Battle,ChatLine,Command,LobbyPlayer,OnlinePlayer,Profile,RankingEntry,Room,RoomInvitePlayer,RoomInvitation,RoomInviteResult,ServerEvent,Shot,ForgeResult,CompositionResult,SynthesisResult,ShopResult,ColorChange,ColorResult} from '../shared/protocol';
import type {AutoFishingSummary,FishRanking,FishingView,Zone} from '../shared/fishing';
export type FishShopTab='buy'|'sell'|'collection';
export interface State {/** Praça Celeste or the Pescaria; `players` are the walkers of this zone. */zone:Zone;/** My fishing session at a spot (null: not fishing). */fishing:FishingView|null;/** Last trade at the Casa de Pesca. */fishBuy:{offer:string;quantity:number;at:number}|null;/** Last sale of fish at the Casa de Pesca. */fishSold:{sold:number;points:number;at:number}|null;fishShopOpen:boolean;/** The Casa de Pesca's tab: Comprar, Vender or Coleção. */fishShopTab:FishShopTab;/** The Pescaria's Sacola (fish caught, rods and baits). */fishBagOpen:boolean;/** The tally of the automatic run just switched off (its window), null when closed. */fishAutoSummary:AutoFishingSummary|null;/** The loading screen between finding a match and its battle (null outside it); `loadingDropped` says the player was left out for loading too slowly. */loading:MatchLoading|null;loadingDropped:{kind:MatchLoading['kind'];at:number}|null;/** Pets: the window, my pets (null until loaded), the last result and the latest pet skills seen in battle. */petsOpen:boolean;pets:PetsState|null;petResult:{result:PetResult;at:number}|null;petPending:boolean;petEffects:{at:number;applications:PetApplication[]}[];/** Hall da Fama: the window, the board on screen, the open profile or guild, the legends and the last change the server announced. */hallOpen:boolean;hallBoard:HallBoard|null;hallProfile:HallPlayerProfile|null;hallGuild:HallGuildProfile|null;hallLegends:HallLegends|null;hallChanged:{categories:HallCategory[];at:number}|null;/** Chefão Mundial: the event (null until the server says), its window and the window's table. */worldBoss:WorldBossStatus|null;worldBossOpen:boolean;worldBossRanking:WorldBossRanking|null;/** Guildas: the window and its tab, my guild (null until loaded), the guild list and the last confirmation. */guildOpen:boolean;guildTab:GuildTab;guild:GuildState|null;guildList:GuildSummary[]|null;guildMessage:{text:string;at:number}|null;guildPending:boolean;/** The Leilão window: the page on screen, my listings and notices, and the last sale/purchase. */auctionOpen:boolean;auctionPage:AuctionPage|null;auctionMine:AuctionMine;auctionResult:(AuctionResult&{at:number})|null;auctionPending:boolean;/** Who the chat writes to privately ("Enviar mensagem" in the player menu). */chatTarget:{id:string;name:string}|null;/** The Correio window and its inbox (newest first). */mailOpen:boolean;mails:MailMessage[];mailUnread:number;mailLoaded:boolean;mailClaim:(MailClaimResult&{at:number})|null;mailPending:boolean;playerPanel:PlayerPanel;playerInfo:PlayerInfo|null;reportResult:{playerId:string;name:string;at:number}|null;ranking:RankingEntry[];/** The week's heaviest fish, shown at the side of the Pescaria. */fishRanking:FishRanking|null;onlinePlayers:OnlinePlayer[];onlineTotal:number;invitePlayers:RoomInvitePlayer[];inviteListRoomId:string|null;roomInvitations:RoomInvitation[];inviteResults:RoomInviteResult[];abilityLoadoutDraft:AbilityLoadout|null;abilityLoadoutPending:boolean;abilityEffects:AbilityEffect[];impacts:Extract<ServerEvent,{type:'impact'}>[];customizationEquipment:Equipment|null;customizationPending:boolean;status:'connecting'|'online'|'offline'|'replaced'|'signed-out';/** When the last welcome (the whole game state) arrived: the loading cover waits for it after a reconnect. */welcomeAt:number;needsCharacter:boolean;creatingCharacter:boolean;profile:Profile|null;players:LobbyPlayer[];rooms:Room[];room:Room|null;battle:Battle|null;chat:ChatLine[];online:number;arenaOnline:number;channel:number;latency:number;offset:number;shot:Shot|null;shotReceivedAt:number;shotBaseline:Record<string,{x:number;y:number;hp:number}>;error:string|null;colorResult:ColorResult|null;discardResult:{item:string;at:number}|null;forgeResult:ForgeResult|null;compositionResult:CompositionResult|null;synthesisResult:SynthesisResult|null;shopResult:ShopResult|null;/** When the server last refused a release (its clock times the force bar): the HUD lets the bar charge again. */shotRetry:number;}
/** The zone each player was last in on this browser, so a reload or a server restart puts them back. */
const ZONE_KEY='brasa-zone:';
/** Tells the loading cover a zone change was asked (`screenCurtain.ts` covers the screen until the new zone is complete). */
const goingTo=(zone:Zone)=>window.dispatchEvent(new CustomEvent<Zone>(ZONE_GOING,{detail:zone}));
export const ZONE_GOING='brasa-zone-going';
function rememberZone(id:string|undefined,zone:Zone){if(!id)return;try{localStorage.setItem(ZONE_KEY+id,zone);}catch{/* storage off */}}
function savedZone(id:string):Zone|null{try{return localStorage.getItem(ZONE_KEY+id) as Zone|null;}catch{return null;}}
/** Where I stood in the Pescaria, to come back to the same place after a reload or a server restart. */
const SPOT_KEY='brasa-fishing-at:';
function rememberSpot(id:string,x:number,y:number){try{localStorage.setItem(SPOT_KEY+id,JSON.stringify({x:Math.round(x),y:Math.round(y)}));}catch{/* storage off */}}
function savedSpot(id:string):{x:number;y:number}|undefined{try{const v=JSON.parse(localStorage.getItem(SPOT_KEY+id)??'null');return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?{x:v.x,y:v.y}:undefined;}catch{return undefined;}}

class Client {
 state:State={zone:'plaza',fishing:null,fishBuy:null,fishSold:null,fishShopOpen:false,fishShopTab:'buy',fishBagOpen:false,fishAutoSummary:null,loading:null,loadingDropped:null,petsOpen:false,pets:null,petResult:null,petPending:false,petEffects:[],hallOpen:false,hallBoard:null,hallProfile:null,hallGuild:null,hallLegends:null,hallChanged:null,worldBoss:null,worldBossOpen:false,worldBossRanking:null,guildOpen:false,guildTab:'home',guild:null,guildList:null,guildMessage:null,guildPending:false,auctionOpen:false,auctionPage:null,auctionMine:{listings:[],notices:[],unseen:0},auctionResult:null,auctionPending:false,chatTarget:null,mailOpen:false,mails:[],mailUnread:0,mailLoaded:false,mailClaim:null,mailPending:false,playerPanel:null,playerInfo:null,reportResult:null,ranking:[],fishRanking:null,onlinePlayers:[],onlineTotal:0,invitePlayers:[],inviteListRoomId:null,roomInvitations:[],inviteResults:[],abilityLoadoutDraft:null,abilityLoadoutPending:false,abilityEffects:[],impacts:[],customizationEquipment:null,customizationPending:false,status:'connecting',welcomeAt:0,needsCharacter:false,creatingCharacter:false,profile:null,players:[],rooms:[],room:null,battle:null,chat:[],online:0,arenaOnline:0,channel:1,latency:0,offset:0,shot:null,shotReceivedAt:0,shotBaseline:{},error:null,colorResult:null,discardResult:null,forgeResult:null,compositionResult:null,synthesisResult:null,shopResult:null,shotRetry:0};
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
 private auctionQuery:AuctionQuery={page:1};
 openAuction(){this.update({auctionOpen:true,auctionResult:null});this.send({type:'auction-mine'});this.auctionList(this.auctionQuery);}
 closeAuction(){this.update({auctionOpen:false});}
 openHall(){this.update({hallOpen:true,hallProfile:null,hallGuild:null});}
 closeHall(){this.update({hallOpen:false,hallProfile:null,hallGuild:null});}
 hallQuery(q:{category:HallCategory;period?:HallPeriod;board?:GuildBoard;page?:number}){this.send({type:'hall-board',...q});}
 hallPlayer(playerId:string|null){this.update({hallProfile:null,hallGuild:null});if(playerId)this.send({type:'hall-profile',playerId});}
 hallGuildProfile(guildId:number|null){this.update({hallGuild:null,hallProfile:null});if(guildId)this.send({type:'hall-guild',guildId});}
 hallLegendsQuery(board:LegendBoard,key?:string){this.send({type:'hall-legends',board,...(key?{key}:{})});}
 openGuild(tab:GuildTab='home'){this.update({guildOpen:true,guildTab:tab,guildMessage:null});this.send({type:'guild-state'});}
 closeGuild(){this.update({guildOpen:false});}
 openPets(){this.update({petsOpen:true,petResult:null});this.send({type:'pet-list'});}
 closePets(){this.update({petsOpen:false});}
 /** Walks through the gate between Praça Celeste and the Pescaria. */
 goTo(zone:Zone){if(this.state.zone!==zone&&!this.state.room&&!this.state.battle){goingTo(zone);this.send({type:'zone',zone});}}
 openFishShop(tab:FishShopTab='buy'){this.update({fishShopOpen:true,fishShopTab:tab,fishBagOpen:false,fishBuy:null,fishSold:null});}
 setFishShopTab(tab:FishShopTab){this.update({fishShopTab:tab});}
 openFishBag(){this.update({fishBagOpen:true,fishShopOpen:false});}
 closeFishBag(){this.update({fishBagOpen:false});}
 closeFishAutoSummary(){this.update({fishAutoSummary:null});}
 closeFishShop(){this.update({fishShopOpen:false});}
 /** One pet action at a time; the server answers with the new list and a result. */
 petAction(c:Extract<Command,{type:`pet-${string}`}>){if(this.state.petPending)return;this.update({error:null,petPending:true});this.send(c);}
 openWorldBoss(){this.update({worldBossOpen:true});this.send({type:'world-boss-ranking'});}
 closeWorldBoss(){this.update({worldBossOpen:false});}
 refreshWorldBoss(){if(this.state.worldBossOpen&&this.ws?.readyState===WebSocket.OPEN)this.send({type:'world-boss-ranking'});}
 enterWorldBoss(){this.update({error:null});this.send({type:'world-boss-enter'});}
 /** A guild action that changes the bag or the guild: one at a time, the server answers with the new state. */
 guildAction(c:Extract<Command,{type:`guild-${string}`}>){if(this.state.guildPending)return;this.update({error:null,guildPending:true});this.send(c);}
 auctionList(query:AuctionQuery){this.auctionQuery=query;this.send({type:'auction-list',page:query.page,...(query.category?{category:query.category}:{}),...(query.search?.trim()?{search:query.search.trim()}:{})});}
 auctionRefresh(){this.auctionList(this.auctionQuery);}
 auctionSell(source:AuctionSource,currency:AuctionCurrency,price:number,hours:2|8|24){if(this.state.auctionPending)return;this.update({error:null,auctionResult:null,auctionPending:true});this.send({type:'auction-sell',source,currency,price,hours});}
 auctionBuy(id:number,currency:AuctionCurrency,price:number){if(this.state.auctionPending)return;this.update({error:null,auctionResult:null,auctionPending:true});this.send({type:'auction-buy',id,currency,price});}
 auctionCancel(id:number){if(this.state.auctionPending)return;this.update({error:null,auctionPending:true});this.send({type:'auction-cancel',id});}
 auctionSeen(){if(this.state.auctionMine.unseen){this.update({auctionMine:{...this.state.auctionMine,unseen:0,notices:this.state.auctionMine.notices.map(n=>({...n,seen:true}))}});this.send({type:'auction-seen'});}}
 /** "Enviar mensagem": the chat writes privately to this player; windows close so the chat is in view. */
 messagePlayer(target:{id:string;name:string}){this.update({chatTarget:{id:target.id,name:target.name},playerPanel:null,auctionOpen:false,mailOpen:false});window.dispatchEvent(new Event('brasa-chat-focus'));}
 clearChatTarget(){this.update({chatTarget:null});}
 readMail(id:number){const mail=this.state.mails.find(m=>m.id===id);if(mail&&!mail.read){this.update({mails:this.state.mails.map(m=>m.id===id?{...m,read:true}:m)});this.send({type:'mail-read',id});}}
 /** Receives one letter's attachments, or every letter's ("Receber tudo"). */
 claimMail(id?:number){if(this.state.mailPending)return;this.update({error:null,mailClaim:null,mailPending:true});this.send({type:'mail-claim',...(id!==undefined?{id}:{})});}
 deleteMail(id:number){this.update({error:null});this.send({type:'mail-delete',id});}
 deleteReadMail(){this.update({error:null});this.send({type:'mail-delete-read'});}
 paint(changes:ColorChange[]){this.update({error:null,colorResult:null});this.send({type:'paint',changes});}
 discard(item:string){this.update({error:null});this.send({type:'discard',item});}
 customize(patch:CustomizationPatch){
  if(!this.state.profile||this.state.battle||this.state.status!=='online'||this.ws?.readyState!==WebSocket.OPEN)return;
  this.update({error:null});this.customizationQueue.apply(patch);
 }
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 snapshot=()=>this.state;
 update(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(f=>f());}
 async start(){if(this.started)return;this.started=true;void syncPublishedMaps();this.update({status:'connecting',error:null});try{const r=await fetch('/api/session',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível entrar. Tente novamente.');const {profile,signIn}=await r.json();if(signIn){location.replace('/jogador?entrar');return;}if(!profile){this.update({needsCharacter:true});return;}this.update({profile,needsCharacter:false});this.connect();}catch(e){this.update({status:'offline',error:e instanceof DOMException&&e.name==='TimeoutError'?'O servidor demorou a responder. Toque em tentar novamente.':(e as Error).message});this.started=false;}}
 /** Creation screen: is this name valid and free on this server? */
 async checkCharacterName(name:string):Promise<{ok:boolean;error?:string}>{const r=await fetch(`/api/character-name?name=${encodeURIComponent(name)}`,{signal:AbortSignal.timeout(8000)});return r.ok?r.json():{ok:false,error:"Não deu para conferir o nome agora."};}
 async createCharacter(gender:CharacterGender,name:string){
  if(this.state.profile||this.state.creatingCharacter||!this.state.needsCharacter)return;
  this.update({creatingCharacter:true,error:null});
  try{
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gender,name}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok||!result.profile)throw Error(result.error??'Não foi possível criar seu personagem.');
   this.update({profile:result.profile,needsCharacter:false,creatingCharacter:false});this.connect();
  }catch(error){this.update({creatingCharacter:false,error:error instanceof DOMException&&error.name==='TimeoutError'?'O servidor demorou a responder. Tente novamente.':(error as Error).message});}
 }
 private connect(){
  this.update({status:'connecting',invitePlayers:[],inviteListRoomId:null,roomInvitations:[],inviteResults:[]});const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);this.ws=ws;
  const connectTimeout=window.setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN)ws.close();},10000);
  ws.onopen=()=>{clearTimeout(connectTimeout);this.retry=0;this.update({status:'online',error:null});this.send({type:'client-features',loading:true});const ping=()=>this.send({type:'ping',time:Date.now()});ping();this.pingTimer=window.setInterval(ping,3000);};
  ws.onmessage=e=>{let event:ServerEvent;try{event=JSON.parse(e.data);}catch{return;}this.receive(event);};
  ws.onclose=e=>{clearTimeout(connectTimeout);clearInterval(this.pingTimer);clearTimeout(this.loadoutTimer);this.abilityLoadoutQueue.cancel();clearTimeout(this.customizationTimer);this.customizationQueue.cancel();if(e.code===4001){this.update({status:'replaced',roomInvitations:[],invitePlayers:[],inviteListRoomId:null});return;}if(e.code===4003){this.update({status:'signed-out',roomInvitations:[],invitePlayers:[],inviteListRoomId:null});return;}this.update({status:'offline',roomInvitations:[],invitePlayers:[],inviteListRoomId:null});this.reconnectTimer=window.setTimeout(()=>this.connect(),Math.min(10000,1000*2**this.retry++));};
  ws.onerror=()=>ws.close();
 }
 private receive(e:ServerEvent){switch(e.type){
  case 'welcome':{const offset=e.serverTime-Date.now(),shot=e.battle?.activeShot??null;this.update({welcomeAt:performance.now(),loading:null,abilityEffects:[],profile:e.profile,players:e.players,rooms:e.rooms,arenaOnline:e.arenaOnline??0,ranking:e.ranking??[],fishRanking:e.fishRanking??null,worldBoss:e.worldBoss??null,room:e.room,battle:e.battle,channel:e.channel,zone:e.zone??'plaza',fishing:null,offset,shot,shotReceivedAt:shot?shotClock(shot,offset):0,shotBaseline:{},impacts:shot?recoveredImpacts(shot):[]});
   // Atualizar a página ou reiniciar o servidor devolve à Pescaria quem estava nela (pedido do matheus).
   if((e.zone??'plaza')==='plaza'&&!e.room&&!e.battle&&savedZone(e.profile.id)==='fishing'){const at=savedSpot(e.profile.id);goingTo('fishing');this.send({type:'zone',zone:'fishing',...(at?{at}:{})});}
   if(!this.inviteHandled){this.inviteHandled=true;const invite=readRoomInvite(location.href);if(invite.cleanUrl!==location.href)history.replaceState(history.state,'',invite.cleanUrl);if(invite.roomId&&!e.room&&!e.battle)this.send({type:'join',roomId:invite.roomId});else if(invite.roomId&&e.room?.id!==invite.roomId)this.update({error:'Saia da sua sala atual antes de aceitar outro convite.'});}
   break;}
  case 'profile':this.update({profile:e.profile});if(e.requestId&&this.customizationQueue.matches(e.requestId)){clearTimeout(this.customizationTimer);this.customizationQueue.acknowledge(e.requestId);}if(e.requestId&&this.abilityLoadoutQueue.matches(e.requestId)){clearTimeout(this.loadoutTimer);this.abilityLoadoutQueue.acknowledge(e.requestId);}break;
  case 'shop-result':this.update({shopResult:e.result});break;
  case 'forge-result':this.update({forgeResult:e.result});break;
  case 'color-result':this.update({colorResult:e.result});break;
  case 'discard-result':this.update({discardResult:{item:e.item,at:Date.now()}});break;
  case 'composition-result':this.update({compositionResult:e.result});break;
  case 'synthesis-result':this.update({synthesisResult:e.result});break;
  case 'lobby':this.update({players:e.players,online:e.online});break;
  case 'lobby-moves':{const moves=new Map(e.moves.map(m=>[m.id,m]));const me=this.state.profile&&this.state.zone==='fishing'?moves.get(this.state.profile.id):undefined;if(me)rememberSpot(this.state.profile!.id,me.x,me.y);this.update({players:this.state.players.map(p=>{const m=moves.get(p.id);if(!m)return p;const {fishing:_,...rest}=p;return m.fishing?{...rest,x:m.x,y:m.y,fishing:m.fishing}:{...rest,x:m.x,y:m.y};})});break;}
  case 'zone':{this.update({zone:e.zone,players:e.players,fishing:null,fishShopOpen:false,fishBagOpen:false});const id=this.state.profile?.id;rememberZone(id,e.zone);const me=id&&e.zone==='fishing'?e.players.find(p=>p.id===id):undefined;if(me)rememberSpot(id!,me.x,me.y);break;}
  case 'fishing':this.update({fishing:e.fishing});break;
  case 'fish-auto-summary':this.update({fishAutoSummary:e.summary});break;
  case 'fish-sell-result':this.update({fishSold:{sold:e.sold,points:e.points,at:Date.now()}});break;
  case 'fish-buy-result':this.update({fishBuy:{offer:e.offer,quantity:e.quantity,at:Date.now()}});break;
  case 'rooms':this.update({rooms:e.rooms});break;
  case 'arena-population':this.update({arenaOnline:e.count});break;
  case 'ranking':this.update({ranking:e.ranking});break;
  case 'fish-ranking':this.update({fishRanking:e.ranking});break;
  case 'world-boss':{const changed=e.status.occurrenceId!==this.state.worldBoss?.occurrenceId||e.status.phase!==this.state.worldBoss?.phase;this.update({worldBoss:e.status,...(e.status.phase==='idle'?{worldBossOpen:false}:{})});if(changed)this.refreshWorldBoss();break;}
  case 'world-boss-ranking':this.update({worldBossRanking:e.ranking});break;
  // The attempt ended (fell, or the event closed): back in the plaza with the event window open, nothing else to show.
  case 'world-boss-closed':this.openWorldBoss();break;
  case 'maps':void syncPublishedMaps();break;
  case 'online-players':this.update({onlinePlayers:e.players,onlineTotal:e.total});break;
  case 'room-invite-list':if(this.state.room?.id===e.roomId)this.update({invitePlayers:e.players,inviteListRoomId:e.roomId});break;
  case 'room-invitation':if(!this.state.room&&!this.state.battle&&e.invite.expiresAt>Date.now()+this.state.offset)this.update({roomInvitations:[...this.state.roomInvitations.filter(invite=>invite.id!==e.invite.id),e.invite].slice(-5)});break;
  case 'room-invite-result':this.update({inviteResults:[...this.state.inviteResults.slice(-19),e],...(e.status!=='sent'?{roomInvitations:this.state.roomInvitations.filter(invite=>invite.id!==e.inviteId)}:{})});break;
  case 'loading':this.update({loading:e.loading,...(e.dropped?{loadingDropped:{kind:e.dropped,at:Date.now()}}:{})});break;
  case 'room':this.update({...(!e.room||e.room.status!=='playing'?{loading:null}:{}),room:e.room,...(e.room?{roomInvitations:[]}:{}),...(e.room?.id!==this.state.room?.id?{invitePlayers:[],inviteListRoomId:null,inviteResults:[],chat:this.state.chat.filter(m=>m.channel!=='room')}:{})});break;
  case 'battle':{
   const changed=e.battle?.id!==this.state.battle?.id,active=e.battle?.activeShot;
   const shot=active??(!e.battle||!!e.battle.powerCutIn||changed||(e.battle.terrain!==undefined&&e.battle.phase!=='resolving')?null:this.state.shot);
   this.update({...e.battle?{loading:null}:{},...changed?{abilityEffects:[]}:{},shot,...(active&&active.id!==this.state.shot?.id?{shotReceivedAt:shotClock(active,this.state.offset),impacts:recoveredImpacts(active)}:changed?{impacts:[]}:{}),battle:e.battle?{...e.battle,terrain:e.battle.terrain??(!changed?this.state.battle?.terrain:undefined)}:null});break;
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
  case 'pets':{const {type:_type,...pets}=e;this.update({pets});break;}
  case 'pet-result':this.update({petResult:{result:e.result,at:Date.now()},petPending:false});break;
  // A late or clock-skewed event still plays from its start: the art begins when it arrives.
  case 'pet-effect':this.update({petEffects:[...this.state.petEffects.filter(x=>Date.now()+this.state.offset-x.at<PET_EFFECT_MAX_MS).slice(-11),{at:Math.max(e.at,Date.now()+this.state.offset),applications:e.applications}]});break;
  case 'guild':{const {type:_type,...guild}=e;this.update({guild,guildPending:false});break;}
  case 'guild-list':this.update({guildList:e.guilds});break;
  case 'hall-board':this.update({hallBoard:e.board});break;
  case 'hall-profile':this.update({hallProfile:e.profile});break;
  case 'hall-guild':this.update({hallGuild:e.guild});break;
  case 'hall-legends':this.update({hallLegends:e.legends});break;
  case 'hall-changed':if(this.state.hallOpen)this.update({hallChanged:{categories:e.categories,at:Date.now()}});break;
  case 'guild-result':this.update({guildMessage:{text:e.message,at:Date.now()},guildPending:false});break;
  case 'auction-page':this.update({auctionPage:e.page});break;
  // Something changed in my listings (a sale, a purchase, a withdrawal): the open table refreshes too.
  case 'auction-mine':{const {type:_type,...mine}=e;this.update({auctionMine:mine});if(this.state.auctionOpen)this.auctionRefresh();break;}
  case 'auction-result':this.update({auctionResult:{...e.result,at:Date.now()},auctionPending:false});break;
  case 'mail':this.update({mails:e.mails,mailUnread:e.unread,mailLoaded:true,mailPending:false});break;
  case 'mail-claim-result':this.update({mailClaim:{...e.result,at:Date.now()},mailPending:false});break;
  case 'report-result':this.update({reportResult:{playerId:e.playerId,name:e.name,at:Date.now()}});break;
  // A whisper with nobody picked yet: the chat answers that player.
  case 'chat':{const m=e.message,from=m.channel==='private'&&m.playerId&&m.playerId!==this.state.profile?.id&&!this.state.chatTarget?{id:m.playerId,name:m.name}:null;this.update({chat:[...this.state.chat.slice(-79),m],...(from?{chatTarget:from}:{})});break;}
  case 'error':if(this.state.mailPending)this.update({mailPending:false});if(this.state.petPending)this.update({petPending:false});if(this.state.guildPending)this.update({guildPending:false});if(this.state.auctionPending)this.update({auctionPending:false});if(e.requestId&&this.abilityLoadoutQueue.reject(e.requestId))clearTimeout(this.loadoutTimer);if(e.requestId&&this.customizationQueue.reject(e.requestId))clearTimeout(this.customizationTimer);this.update({error:e.message,...(e.retryShot?{shotRetry:Date.now()}:{})});break;
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
