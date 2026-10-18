import {boostsForShot,powBoostConflict} from '../shared/weaponKit';
import {powerUpConflict} from '../shared/powerUps';
import {chargeFromDamage,POWER_MAX,POWER_CUT_IN_MS,POWER_DAMAGE_MULTIPLIER,POWER_BLAST_MULTIPLIER,POWER_CRATER_MULTIPLIER} from '../shared/power';
import {CARD_PRIZES,REWARD_CARD_COUNT,REWARD_PICK_MS,REWARD_RESULT_MS,REWARD_RETURN_MS} from '../shared/rewards';
import type {CardPrize,MatchBonuses} from '../shared/rewards';
import {randomInt,randomUUID} from 'node:crypto';
import {LOBBY_SPAWN,LOBBY_WALK_SPEED,lobbyFree,lobbyStep} from '../shared/lobby';
import {attributes,BOOSTS,CATALOG,SLOTS,equippedCopy,targetSlotForItem,DEFAULT_EQUIPMENT,isEmptyItem,SMITH_POSITION,WEAPONS,weaponFragmentCount,weaponStats} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import type {Battle,Command,Fighter,LobbyPlayer,Profile,RankingEntry,Room,RoomInvitation,RoomInviteResult,Seat,ServerEvent,Shot,ShotHit,TerrainMark} from '../shared/protocol';
import {crater,createTerrain,directHitDig,type TerrainDig,weaponRoughness,ground,packTerrain,shatter,terrainMaterial,terrainWidth,trajectory,volley,walkPosition,WORLD} from '../shared/physics';
import type {TrajectoryResult} from '../shared/physics';
import type {ProfileStore} from './store';
import {getMap,canonicalMap,MAP_DEFAULT,pinMap,pvpRotation} from '../shared/maps';
import {nextByDelay,startDelayTurn,timeDelay,TURN_SECONDS} from '../shared/turnDelay';
import {clampHp,PASS_DELAY} from '../shared/stats';
import {criticalFromRoll,damageAtImpact,impactExposure,shotModifiers,TURN_GAP_MS,VOLLEY_CADENCE_MS} from '../shared/combat';
import {initialSlots,modeForSlots,MAX_PARTY_SIZE} from '../shared/rooms';
import {ABILITIES,HEAL_AMOUNT,HIDDEN_POSITION,homingTargets,initialAbilities,INVISIBILITY_TURNS,normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityEffect,AbilityId} from '../shared/abilities';
import {flightLanding} from '../shared/physics';
import {adjustAimToTerrain,aimSource,clampAimAngle,weaponAimLimits} from '../shared/aim';
import {createFall,fallPosition,fallVelocity} from '../shared/fall';
import {REPORT_CHAT_WINDOW_MS} from '../shared/reports';
import type {PlayerInfo,ReportChatLine} from '../shared/reports';
import type {ReportSink} from './reports';
import type {MailBox} from './mail';
import type {AuctionHouse} from './auction';
import type {GuildHall,Membership} from './guilds';
import {GVG_CONTRIBUTION,smithBonus} from '../shared/guilds';
import type {PlayerPresence} from '../shared/adminPlayers';
import {getExpedition,expeditionStages,MONSTERS} from '../shared/expeditions';
import type {Difficulty,StageDef} from '../shared/expeditions';
import {MONSTER_ATTACK_MS,MONSTER_BITE_WINDUP_MS,MONSTER_MOVE_MS,MONSTER_TURN_END_MS,MONSTER_TURN_ID,nextInstanceActor,planMonsterTurn,QUEEN_DRAW_MS} from '../shared/instanceTurn';
import type {InstanceRound} from '../shared/instanceTurn';
import {monsterDamage} from '../shared/combat';
import {ARROW,monsterFighter,queenAim,setupStage,stageDeck} from './expedition';
export interface Peer {/** Brought back from a saved state after a restart: waits for its player with the saved profile until they reconnect. */restored?:boolean;profile:Profile;send:(event:ServerEvent)=>void;connected:boolean;roomId:string|null;arenaOpen:boolean;channel:number;x:number;y:number;targetX:number;targetY:number;lastSeen:number;lastWalk:number;lastAim?:number;lastFace?:number;}
interface PendingImpact {at:number;projectileIndex:number;hits:ShotHit[];mark:TerrainMark;flight?:boolean;fragment?:boolean;}
interface PendingRoomInvitation {invite:RoomInvitation;playerId:string;}
/** An expedition run: its stages, the current round of the instance turn and the monster turn's timed events. */
interface ExpeditionRun {expedition:string;difficulty:Difficulty;stages:readonly StageDef[];stage:number;order:string[];round:InstanceRound;events:{at:number;run:()=>void}[];won?:boolean;}
/** How long a dropped player keeps their place: the whole match while it runs (up to 5 min away), a bit longer after a restart. */
const RECONNECT_MS=30000,RESTORED_RECONNECT_MS=120000,MATCH_RECONNECT_MS=300000;
/** A match as saved for a restart: plain JSON, without the terrain (saved apart, only when it changes) or the timed events of a shot. */
export type SavedMatch=Omit<Match,'terrain'|'invisibilityActivated'|'pendingImpacts'|'activeShot'|'pendingPower'|'savingRewards'|'instance'>&{invisibilityActivated?:[string,number][];instance?:Omit<ExpeditionRun,'events'>};
export interface SavedGame {savedAt:number;nextRoomNumber:number;rooms:Room[];roomMatches:[string,string][];peers:{id:string;roomId:string;channel:number;profile:Profile}[];}
const ROOM_INVITE_TTL_MS=60000,ROOM_INVITE_SEND_MS=2000,ROOM_INVITE_PAIR_MS=30000,ROOM_INVITE_LIST_MS=1000,ONLINE_LIST_MS=2000,ONLINE_LIST_LIMIT=100,PLAYER_INFO_MS=300,CHAT_LOG_LIMIT=300;
const SPECTATOR_BLOCKED_COMMANDS=new Set<Command['type']>(['expedition-select','ability-loadout','ready','queue','cancel-queue','start','practice-start','room-gvg','bot','room-slot','room-rename','kick','room-spectator-slot','spectator-kick','room-invite','room-invite-list','power','ability','flight','boost','aim','walk','face','fire','pass','reward-pick','rematch']);
interface Match {key:string;roomIds:string[];practiceParty?:boolean;invisibilityActivated?:Map<string,number>;pendingPower?:{playerId:string;angle:number;power:number;at:number};state:Battle;terrain:Uint8Array;resolveAt:number;botAt:number;createdAt:number;rewardDeck?:CardPrize[];savingRewards?:boolean;retryRewardsAt?:number;activeShot?:Shot;pendingImpacts?:PendingImpact[];instance?:ExpeditionRun;/** GvG battle: the guild of team 0 and of team 1; the winners add Riqueza to theirs. */gvg?:[number,number];}

export class Game {
 peers=new Map<string,Peer>();rooms=new Map<string,Room>();matches=new Map<string,Match>();
 // Parties keep their identity throughout a match; opponents are never merged into a room.
 private nextRoomNumber=1;private roomMatches=new Map<string,string>();private queueIds=new Set<string>();private profileChanges=new Set<string>();
 private lastTick=Date.now();private lobbyTick=0;private roomsDirty=false;private arenaPopulation=0;
 private ranking:RankingEntry[]=[];private rankingAt=0;private rankingLoading:Promise<void>|null=null;
 /** Where reports go (the admin panel's store); without it reports are refused. */
 reports?:ReportSink;
 /** Player mail (server/mail.ts); without it the inbox stays empty. */
 mail?:MailBox;
 /** The Leilão (server/auction.ts); without it the auction house is closed. */
 auction?:AuctionHouse;
 /** Guildas (server/guilds.ts); without it guilds are closed. */
 guilds?:GuildHall;
 /** Each player's guild as last loaded: the name on their room card, the forge bonus and GvG pairing. */
 private memberships=new Map<string,Membership|null>();
 /** Each player's own chat lines of the last 30 minutes, sent along with a report against them. */
 private chatLog=new Map<string,ReportChatLine[]>();private chatLogPrunedAt=0;private playerInfoAt=new Map<string,number>();
 private roomInvitations=new Map<string,PendingRoomInvitation>();private inviteSentAt=new Map<string,number>();private invitePairAt=new Map<string,number>();private inviteListAt=new Map<string,number>();private onlineListAt=new Map<string,number>();
 constructor(private store:ProfileStore,private report:(e:unknown)=>void=console.error,private criticalRoll:()=>number=()=>randomInt(1_000_000)/1_000_000){}
 connect(profile:Profile,send:Peer['send']){
  let p=this.peers.get(profile.id);
  // A session read may have started before a pending commit. The live peer owns
  // the authoritative profile; reconnecting must not restore an older snapshot.
  if(p){p.send=send;p.connected=true;p.arenaOpen=false;p.lastSeen=Date.now();if(p.restored){p.profile=profile;delete p.restored;}}
  else {let channel=1;while([...this.peers.values()].filter(x=>x.channel===channel).length>=60)channel++;p={profile,send,connected:true,roomId:null,arenaOpen:false,channel,x:LOBBY_SPAWN.x-60+Math.random()*120,y:LOBBY_SPAWN.y,targetX:LOBBY_SPAWN.x,targetY:LOBBY_SPAWN.y,lastSeen:Date.now(),lastWalk:0};p.targetX=p.x;this.peers.set(profile.id,p);}
  const room=p.roomId?this.rooms.get(p.roomId):undefined;const match=room?this.matchForRoom(room.id):undefined;
  if(room){const seat=this.roomMembers(room).find(s=>s.id===profile.id);if(seat)seat.connected=true;const fighter=match?.state.players.find(s=>s.id===profile.id);if(fighter)fighter.connected=true;this.broadcastRoom(room);}
  send({type:'welcome',profile:p.profile,players:this.lobby(p.channel),rooms:[...this.rooms.values()],room:room??null,battle:match?this.snapshot(match,true,profile.id):null,serverTime:Date.now(),channel:p.channel,arenaOnline:this.countArena(),ranking:this.ranking});
  this.pruneInvitations();for(const pending of this.roomInvitations.values())if(pending.playerId===profile.id)this.emit(p,{type:'room-invitation',invite:{...pending.invite}});
  this.sendLobby(p.channel);this.publishArenaPopulation();void this.sendInbox(p).catch(this.report);void this.sendAuctionMine(p).catch(this.report);void this.refreshGuildMember(profile.id).catch(this.report);return p;
 }
 /** Sends a player their inbox (on connect, and when the admin panel mails them). */
 private async sendInbox(p:Peer){if(!this.mail||!p.connected)return;const {mails,unread}=await this.mail.inbox(p.profile.id);this.emit(p,{type:'mail',mails,unread});}
 /** A seller's listings and notices (the bell counts the unseen ones). */
 private async sendAuctionMine(p:Peer){if(!this.auction||!p.connected)return;this.emit(p,{type:'auction-mine',...await this.auction.mine(p.profile.id)});}
 /** Closes the listings whose time ran out (goods go back by mail) and tells online sellers. */
 async auctionSweep(){
  if(!this.auction)return;
  for(const id of await this.auction.expireDue()){const p=this.peers.get(id);if(p?.connected){await this.sendInbox(p);await this.sendAuctionMine(p);}}
 }
 private requireGuilds(){if(!this.guilds)throw Error('As guildas estão fechadas no momento.');return this.guilds;}
 private async sendGuild(p:Peer){if(!this.guilds||!p.connected)return;this.emit(p,{type:'guild',...await this.guilds.state(p.profile.id)});}
 /** Reloads one player's guild: the name on their room card, the forge bonus and, when online, their guild window. */
 private async refreshGuildMember(playerId:string){
  if(!this.guilds)return;
  const membership=await this.guilds.membership(playerId);this.memberships.set(playerId,membership);
  const p=this.peers.get(playerId);if(!p)return;
  const room=p.roomId?this.rooms.get(p.roomId):undefined,seat=room?.players.find(s=>s.id===playerId);
  if(room&&seat&&seat.guild!==membership?.name){if(membership)seat.guild=membership.name;else delete seat.guild;this.broadcastRoom(room);}
  await this.sendGuild(p);
 }
 /** After a guild changes, every online member (and anyone who just joined or left) sees it. */
 private async refreshGuild(guildId:number,also:string[]=[]){
  if(!this.guilds)return;const ids=new Set([...await this.guilds.memberIds(guildId),...also]);
  await Promise.all([...ids].filter(id=>this.peers.get(id)?.connected).map(id=>this.refreshGuildMember(id)));
 }
 /** The one guild every player of a party belongs to, or null. */
 private partyGuild(room:Room){const ids=new Set(room.players.map(s=>this.memberships.get(s.id)?.guildId??null));const [only]=ids;return ids.size===1&&only!=null?only:null;}
 /** New mail from the admin panel reaches an online player right away. */
 async mailArrived(playerId:string){const p=this.peers.get(playerId);if(p?.connected)await this.sendInbox(p);}
 /** Where each connected player is, for the admin panel's player table. */
 presence():Map<string,PlayerPresence>{
  const result=new Map<string,PlayerPresence>();
  for(const [id,p] of this.peers){if(!p.connected)continue;const room=p.roomId?this.rooms.get(p.roomId):undefined;result.set(id,!room?'lobby':this.matchForRoom(room.id)?'battle':'room');}
  return result;
 }
 disconnect(id:string){const p=this.peers.get(id);if(!p)return;p.connected=false;p.arenaOpen=false;p.lastSeen=Date.now();if(p.roomId){const r=this.rooms.get(p.roomId);const s=r?.players.find(x=>x.id===id);if(s){s.connected=false;s.ready=false;}const observer=r?.spectators?.find(x=>x.id===id);if(observer)observer.connected=false;const fighter=this.matchForRoom(p.roomId)?.state.players.find(s=>s.id===id);if(fighter)fighter.connected=false;if(r){if(!observer)this.cancelSearch(r);this.broadcastRoom(r);}}this.pruneInvitations();this.sendLobby(p.channel);this.publishArenaPopulation();}
 /** A fighter of a running match keeps their place while away (their turns just time out); anyone else has 30 s. */
 private reconnectWindow(p:Peer){
  const m=p.roomId?this.matchForRoom(p.roomId):undefined,fighter=m?.state.players.find(f=>f.id===p.profile.id);
  if(m&&m.state.phase!=='finished'&&fighter&&!fighter.left)return MATCH_RECONNECT_MS;
  return p.restored?RESTORED_RECONNECT_MS:RECONNECT_MS;
 }
 /** Everything a restart must keep: rooms, who sits where and each match as of its last stable moment.
  * A match in the middle of a shot is left out (`stable:false`) so the saved copy stays at the start of that turn. */
 savedState(now=Date.now()){
  const game:SavedGame={savedAt:now,nextRoomNumber:this.nextRoomNumber,rooms:[...this.rooms.values()],roomMatches:[...this.roomMatches],
   peers:[...this.peers.values()].filter(p=>p.roomId&&this.rooms.has(p.roomId)).map(p=>({id:p.profile.id,roomId:p.roomId!,channel:p.channel,profile:p.profile}))};
  const matches=[...this.matches.values()].map(m=>{
   if(m.state.phase==='resolving')return {key:m.key,stable:false as const};
   const {terrain,invisibilityActivated,pendingImpacts:_impacts,activeShot:_shot,pendingPower:_power,savingRewards:_saving,instance,...rest}=m;
   const match:SavedMatch={...rest,...(invisibilityActivated?{invisibilityActivated:[...invisibilityActivated]}:{}),...(instance?{instance:{...instance,events:undefined} as Omit<ExpeditionRun,'events'>}:{})};
   return {key:m.key,stable:true as const,match,terrain,terrainTag:`${m.state.turnNumber}:${m.state.phase}`};
  });
  return {game,matches};
 }
 /** Brings a saved state back after a restart. Everyone starts disconnected and keeps their seat until they reconnect;
  * the clocks continue from where they stopped, with at least 15 s left on the turn. */
 restore(game:SavedGame,matches:{match:SavedMatch;terrain:Uint8Array}[],now=Date.now()){
  const shift=Math.max(0,now-game.savedAt);
  this.nextRoomNumber=Math.max(this.nextRoomNumber,game.nextRoomNumber);
  for(const saved of matches){
   const {invisibilityActivated,instance,...rest}=saved.match,s=rest.state;
   const m:Match={...rest,terrain:saved.terrain,resolveAt:0,...(invisibilityActivated?{invisibilityActivated:new Map(invisibilityActivated)}:{}),...(instance?{instance:{...instance,events:[]}}:{})};
   delete m.retryRewardsAt;delete s.powerCutIn;delete s.activeShot;delete s.terrain;
   for(const f of s.players){if(!f.bot&&!f.monster)f.connected=false;f.charging=false;delete f.fall;}
   if(s.phase==='aiming'){s.deadline=now+Math.min(30000,Math.max(15000,s.deadline-game.savedAt));m.botAt=now+2500;}
   if(s.instance){s.instance.introUntil+=shift;delete s.instance.monsterTurn;delete s.instance.speech;}
   if(s.rewards){if(s.rewards.opensAt!==undefined)s.rewards.opensAt+=shift;s.rewards.deadline+=shift;if(s.rewards.revealedAt!==undefined)s.rewards.revealedAt+=shift;}
   this.matches.set(m.key,m);
  }
  for(const room of game.rooms){
   for(const seat of room.players)if(!seat.bot){seat.connected=false;seat.ready=false;}
   for(const spectator of room.spectators??[])spectator.connected=false;
   if(room.status==='searching'){room.status='waiting';delete room.searchStartedAt;}
   this.rooms.set(room.id,room);
  }
  for(const [roomId,key] of game.roomMatches)if(this.rooms.has(roomId)&&this.matches.has(key))this.roomMatches.set(roomId,key);
  // A room whose match was not saved goes back to waiting instead of pointing at nothing.
  for(const room of this.rooms.values())if(room.status==='playing'&&!this.roomMatches.has(room.id)){room.status='waiting';delete room.matchStartedAt;}
  for(const saved of game.peers){
   if(this.peers.has(saved.id)||!this.rooms.has(saved.roomId))continue;
   this.peers.set(saved.id,{restored:true,profile:saved.profile,send:()=>{},connected:false,roomId:saved.roomId,arenaOpen:false,channel:saved.channel,x:LOBBY_SPAWN.x,y:LOBBY_SPAWN.y,targetX:LOBBY_SPAWN.x,targetY:LOBBY_SPAWN.y,lastSeen:now,lastWalk:0});
  }
  // Rooms nobody can come back to (no saved seat holder) are dropped.
  for(const room of [...this.rooms.values()])if(!room.players.some(seat=>!seat.bot&&this.peers.get(seat.id)?.roomId===room.id)){this.rooms.delete(room.id);this.roomMatches.delete(room.id);}
  for(const m of [...this.matches.values()])if(!m.roomIds.some(id=>this.roomMatches.get(id)===m.key)&&m.state.rewards?.saved)this.matches.delete(m.key);
  this.roomsDirty=true;
 }
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
 /** The caller's own living fighter while a match is aiming, whoever has the turn. */
 /** The caller's live fighter; turning in place may skip the aiming check and also works while a shot resolves or the monsters move. */
 private fighter(p:Peer,anyPhase=false){const room=this.room(p),m=this.matchForRoom(room.id);if(!m||m.state.phase==='finished'||!anyPhase&&m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');const f=m.state.players.find(x=>x.id===p.profile.id);if(!f)throw Error('Você está assistindo a esta partida.');if(f.hp<=0||f.left)throw Error('Seu personagem está fora de combate.');if(f.fall&&Date.now()<f.fall.startedAt+f.fall.duration)throw Error('Aguarde seu personagem pousar.');return {m,f};}
 private turn(p:Peer){const room=this.room(p),m=this.matchForRoom(room.id);if(!m||m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');if(m.state.turnId!==p.profile.id)throw Error('Aguarde a sua vez.');if(m.state.instance&&Date.now()<m.state.instance.introUntil)throw Error('Aguarde os monstros chegarem.');if(Date.now()>m.state.deadline)throw Error('O tempo do turno terminou.');const f=m.state.players.find(x=>x.id===p.profile.id);if(!f)throw Error('Você está assistindo a esta partida.');if(f.hp<=0)throw Error('Seu personagem está fora de combate.');if(f.fall&&Date.now()<f.fall.startedAt+f.fall.duration)throw Error('Aguarde seu personagem pousar.');return {m,f};}
 private seat(p:Peer,team:0|1,slot:number):Seat{return {id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:{...p.profile.equipment},abilityLoadout:normalizeAbilityLoadout(p.profile.abilityLoadout),ready:false,bot:false,team,slot,connected:true,...(this.memberships.get(p.profile.id)?{guild:this.memberships.get(p.profile.id)!.name}:{})};}
 private vacantSeat(room:Room):{team:0|1;slot:number}{
  if(!room.practice){const slot=room.openSlots.find(index=>!room.players.some(p=>p.slot===index));if(slot===undefined)throw Error('Esta equipe está cheia. Peça ao líder para abrir outra vaga.');return {team:0,slot};}
  const teams: (0|1)[]=[0,1];teams.sort((a,b)=>room.players.filter(p=>p.team===a).length-room.players.filter(p=>p.team===b).length);
  for(const team of teams){const slot=room.openSlots.find(index=>!room.players.some(p=>p.team===team&&p.slot===index));if(slot!==undefined)return {team,slot};}
  throw Error('Esta sala está cheia.');
 }
 private join(p:Peer,roomId:string){
  if(p.roomId)throw Error('Você já está em uma sala.');const room=this.rooms.get(roomId);if(!room||room.status!=='waiting')throw Error('Esta sala não está disponível.');
  if(room.gvg){const host=this.memberships.get(room.hostId);if(!host||this.memberships.get(p.profile.id)?.guildId!==host.guildId)throw Error(`Esta sala está buscando GvG: só entram membros da guilda ${host?.name??'do líder'}.`);}
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
  for(const rates of [this.inviteSentAt,this.inviteListAt,this.onlineListAt,this.playerInfoAt])for(const [id,at] of rates)if(now-at>=ROOM_INVITE_PAIR_MS)rates.delete(id);
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
 private logChat(id:string,line:ReportChatLine){const lines=this.recentChat(id,line.at);lines.push(line);if(lines.length>CHAT_LOG_LIMIT)lines.splice(0,lines.length-CHAT_LOG_LIMIT);this.chatLog.set(id,lines);}
 /** The player's chat lines of the last 30 minutes, oldest first; older lines are dropped for good. */
 recentChat(id:string,now=Date.now()):ReportChatLine[]{
  const lines=(this.chatLog.get(id)??[]).filter(line=>now-line.at<=REPORT_CHAT_WINDOW_MS);
  if(lines.length)this.chatLog.set(id,lines);else this.chatLog.delete(id);return lines;
 }
 /** Read-only view of what a player wears (online or not), for the player info window. */
 private async playerInfo(playerId:string):Promise<PlayerInfo|null>{
  if(playerId.startsWith('bot-'))return this.botInfo(playerId);
  const peer=this.peers.get(playerId),profile=peer?.profile??await this.store.getProfile(playerId);if(!profile)return null;
  const worn=[...new Set(SLOTS.map(slot=>equippedCopy(profile.equipment,slot)))];
  const pick=<T,>(source:Record<string,T>)=>Object.fromEntries(worn.filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]));
  return {id:profile.id,name:profile.name,level:profile.level,gender:profile.gender,wins:profile.wins,matches:profile.matches,online:!!peer?.connected,equipment:structuredClone(profile.equipment),upgrades:pick(profile.upgrades),compositions:pick(profile.compositions),itemColors:pick(profile.itemColors)};
 }
 /** A bot exists only in its room or match: what it wears there. */
 private botInfo(id:string):PlayerInfo|null{
  const seat=[...[...this.matches.values()].flatMap(m=>m.state.players),...[...this.rooms.values()].flatMap(r=>r.players)].find(s=>s.id===id&&s.bot);if(!seat)return null;
  const equipment=structuredClone(seat.equipment);
  return {id,name:seat.name,level:seat.level,gender:'male',wins:0,matches:0,online:true,bot:true,equipment,upgrades:{[equippedCopy(equipment,'weapon')]:equipment.upgrade??0},compositions:{},itemColors:{}};
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
    case 'move':if(!p.roomId){const target=lobbyFree(c.x,c.y);p.targetX=target.x;p.targetY=target.y;}return;
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
    case 'equip':{
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Troque seus equipamentos entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     const equipment=c.type==='customize'?{...p.profile.equipment,...c.selection.items,visibility:c.selection.visibility??p.profile.equipment.visibility,copies:c.selection.copies??p.profile.equipment.copies}:{...p.profile.equipment};
     if(c.type==='customize'){/* All slots and ownership are checked atomically by the store. */}
     else {const item=CATALOG[c.item];if(!item||(!isEmptyItem(item)&&!p.profile.inventory.includes(c.item)))throw Error('Este item não está na sua mochila.');equipment[targetSlotForItem(equipment,item)]=item.id;}
     // Cancel before awaiting persistence, so a pending outfit cannot race a queue match.
     this.profileChanges.add(id);if(p.roomId&&!this.isSpectator(p)){const r=this.room(p);this.cancelSearch(r);r.players.forEach(s=>s.ready=s.bot);this.broadcastRoom(r);}
     try{p.profile=await this.store.saveEquipment(id,equipment);}finally{this.profileChanges.delete(id);}
     this.emit(p,{type:'profile',profile:p.profile,...(c.type==='customize'&&c.requestId!==undefined?{requestId:c.requestId}:{})});if(p.roomId){const r=this.room(p);const s=r.players.find(s=>s.id===id);if(s){s.equipment={...p.profile.equipment};s.ready=false;}this.broadcastRoom(r);}this.sendLobby(p.channel);return;
    }
    case 'shop-buy':{
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Visite a loja entre as batalhas.');
     const outcome=await this.store.buy(id,c.items,c.quantity);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'shop-result',result:outcome.result});break;
    }
    case 'paint':
    case 'discard':{
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Mexa na mochila entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     const store=this.store;if(!store.paint||!store.discard)throw Error('Indisponível no momento.');
     this.profileChanges.add(id);
     try{
      if(c.type==='discard'){p.profile=await store.discard(id,c.item);this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'discard-result',item:c.item});}
      else{const outcome=await store.paint(id,c.changes);p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'color-result',result:outcome.result});}
     }finally{this.profileChanges.delete(id);}
     // Other players see the new look right away, in the plaza and in the waiting room.
     if(p.roomId){const r=this.room(p);const seat=r.players.find(s=>s.id===id);if(seat)seat.equipment={...p.profile.equipment};this.broadcastRoom(r);}this.sendLobby(p.channel);return;
    }
    case 'forge':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para fortalecer sua arma.');
     // Guild members also reach the forge from the guild window; the Ferreiro da Guilda adds to the chance.
     const guild=this.memberships.get(id);
     if(!guild&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.forge(id,c.item,c.stones,smithBonus(guild?.smith??0));p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'forge-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'compose':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para compor seu equipamento.');
     const guild=this.memberships.get(id);
     if(!guild&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.compose(id,c.item,c.stone,smithBonus(guild?.smith??0));p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'composition-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'create':{
     if(p.roomId)throw Error('Saia da sala atual antes de criar outra.');if(this.rooms.size>=200)throw Error('A arena está cheia. Tente novamente em breve.');
     const practice=c.practice===true,mode=practice?(c.mode??'1v1'):'1v1';
     const room:Room={id:randomUUID(),number:this.nextRoomNumber++,name:c.name??`Sala de ${p.profile.name}`.slice(0,24),hostId:id,practice,mode,openSlots:practice?initialSlots(mode):[0],spectatorSlots:[],spectators:[],map:practice?canonicalMap(c.map??MAP_DEFAULT.id):MAP_DEFAULT.id,status:'waiting',players:[this.seat(p,0,0)]};this.rooms.set(room.id,room);p.roomId=room.id;this.broadcastRoom(room);this.sendLobby(p.channel);this.publishArenaPopulation();break;
    }
    case 'create-expedition':{
     if(p.roomId)throw Error('Saia da sala atual antes de criar outra.');if(this.rooms.size>=200)throw Error('As salas estão cheias. Tente novamente em breve.');
     const room:Room={id:randomUUID(),number:this.nextRoomNumber++,name:`Expedição de ${p.profile.name}`.slice(0,24),hostId:id,kind:'expedition',expedition:null,mode:'4v4',openSlots:[0,1,2,3],spectatorSlots:[],spectators:[],map:MAP_DEFAULT.id,status:'waiting',players:[this.seat(p,0,0)]};
     this.rooms.set(room.id,room);p.roomId=room.id;this.broadcastRoom(room);this.sendLobby(p.channel);this.publishArenaPopulation();break;
    }
    case 'expedition-select':{
     const room=this.room(p);if(room.kind!=='expedition')throw Error('Escolha expedições numa sala da Central de Expedições.');
     if(room.hostId!==id)throw Error('Somente o líder escolhe a expedição.');if(room.status!=='waiting')throw Error('Escolha a expedição entre as batalhas.');
     const expedition=getExpedition(c.expedition);if(!expedition)throw Error('Expedição desconhecida.');
     if(!expeditionStages(expedition.id,c.difficulty).length)throw Error('Esta dificuldade chega em breve.');
     const low=room.players.find(player=>player.level<expedition.minLevel);if(low)throw Error(`${low.name} precisa do nível ${expedition.minLevel}.`);
     const stage=c.stage??0;if(stage>=expeditionStages(expedition.id,c.difficulty).length)throw Error('Estágio desconhecido.');
     room.expedition={id:expedition.id,difficulty:c.difficulty,stage};room.players.forEach(player=>player.ready=false);this.broadcastRoom(room);break;
    }
    case 'join':{
     this.join(p,c.roomId);break;
    }
    case 'spectate':if(this.rooms.get(c.roomId)?.kind==='expedition')throw Error('Expedições não têm espectadores.');this.spectate(p,c.roomId);break;
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
     const r=this.room(p);if(r.hostId!==id||r.status!=='waiting')throw Error('Somente o líder pode adicionar um bot.');if(r.kind==='expedition')throw Error('Expedições são só para aventureiros.');
     if(!r.practice)throw Error('Bots estão disponíveis somente no treino.');
     const {team,slot}=this.vacantSeat(r),n=r.players.filter(x=>x.bot).length;
     r.players.push({id:`bot-${randomUUID()}`,name:['Pipoca','Faísca','Fagulha'][n%3]+' · BOT',level:p.profile.level,equipment:{...DEFAULT_EQUIPMENT,weapon:WEAPONS[(n+1)%WEAPONS.length].id},ready:true,bot:true,team,slot,connected:true});this.broadcastRoom(r);break;
    }
    case 'queue':this.queue(p);break;
    case 'cancel-queue':{const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode cancelar a busca.');if(r.status!=='searching')throw Error('A equipe não está buscando partida.');this.cancelSearch(r);this.broadcastRoom(r);break;}
    case 'start':if(this.room(p).kind==='expedition')this.startExpedition(p);else this.start(p);break;
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
     const {m,f}=this.turn(p);if(Date.now()-p.lastWalk<65)return;p.lastWalk=Date.now();
     // The first press toward the other side only turns around, for free.
     if(f.facing!==c.direction){f.facing=c.direction;adjustAimToTerrain(f,m.terrain);this.broadcastBattle(m);break;}
     if(f.stamina<3)throw Error('Vigor insuficiente.');const destination=walkPosition(m.terrain,f,c.direction);if(destination){const fromY=f.y;f.x=destination.x;f.y=destination.y;f.stamina-=3;if(f.y>WORLD.height){f.y=WORLD.height+150;f.hp=0;}this.animateFall(f,fromY,Date.now());}adjustAimToTerrain(f,m.terrain);if(!this.checkWin(m))this.broadcastBattle(m);break;
    }
    case 'face':{
     // Turning in place costs no stamina and works at any time of the match (anyone's turn, a shot in flight, the monsters' turn); it never moves the fighter.
     const {m,f}=this.fighter(p,true);if(f.facing===c.direction||Date.now()-(p.lastFace??0)<65)return;p.lastFace=Date.now();
     f.facing=c.direction;adjustAimToTerrain(f,m.terrain);this.broadcastBattle(m);break;
    }
    case 'fire':{const {m,f}=this.turn(p);adjustAimToTerrain(f,m.terrain);this.fire(m,f,clampAimAngle(aimSource(f),f.aimSlope??0,c.angle),c.power);break;}
    case 'pass':{const {m,f}=this.turn(p);f.delay=(f.delay??0)+PASS_DELAY;this.nextTurn(m);break;}
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
     const msg={id:randomUUID(),playerId:id,name:p.profile.name,text:c.text,channel:c.channel,time:Date.now()};
     if(c.channel==='private'){
      const target=c.to?this.peers.get(c.to):undefined;
      if(!c.to||c.to===id)throw Error('Escolha para quem enviar a mensagem.');
      if(!target?.connected)throw Error('Este jogador não está online agora.');
      const line={...msg,toId:target.profile.id,toName:target.profile.name};this.logChat(id,{at:msg.time,channel:'private',text:c.text,to:target.profile.name});
      this.emit(p,{type:'chat',message:line});this.emit(target,{type:'chat',message:line});
     }
     else if(c.channel==='room'){const r=this.room(p);this.logChat(id,{at:msg.time,channel:'room',text:c.text,room:r.number});const m=this.matchForRoom(r.id);const recipients=m&&m.state.phase!=='finished'?this.matchPeers(m):this.roomMembers(r).map(s=>this.peers.get(s.id)).filter((peer):peer is Peer=>!!peer&&peer.roomId===r.id);for(const peer of recipients)this.emit(peer,{type:'chat',message:msg});}
     else{this.logChat(id,{at:msg.time,channel:'world',text:c.text});for(const peer of this.peers.values())if(peer.channel===p.channel)this.emit(peer,{type:'chat',message:msg});}break;
    }
    case 'auction-list':{
     if(!this.auction)throw Error('O leilão está fechado no momento.');
     this.emit(p,{type:'auction-page',page:await this.auction.list({category:c.category,page:c.page,search:c.search,gender:p.profile.gender})});return;
    }
    case 'auction-mine':await this.sendAuctionMine(p);return;
    case 'auction-seen':if(this.auction){await this.auction.seen(id);await this.sendAuctionMine(p);}return;
    case 'auction-sell':
    case 'auction-buy':
    case 'auction-cancel':{
     if(!this.auction)throw Error('O leilão está fechado no momento.');
     if(c.type!=='auction-cancel'&&p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Use o leilão entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);
     try{
      if(c.type==='auction-cancel'){const listing=await this.auction.cancel(id,c.id);this.emit(p,{type:'auction-result',result:{action:'cancel',listing}});await this.sendInbox(p);}
      else if(c.type==='auction-sell'){const outcome=await this.auction.sell(id,{source:c.source,currency:c.currency,price:c.price,hours:c.hours});p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'auction-result',result:{action:'sell',listing:outcome.listing}});}
      else{
       const outcome=await this.auction.buy(id,c.id,c.currency,c.price);p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'auction-result',result:{action:'buy',listing:outcome.listing}});
       // The seller hears the bell and finds the payment in the mail right away.
       const seller=this.peers.get(outcome.listing.sellerId);if(seller?.connected){await this.sendInbox(seller);await this.sendAuctionMine(seller);}
      }
     }finally{this.profileChanges.delete(id);}
     await this.sendAuctionMine(p);return;
    }
    case 'guild-state':await this.sendGuild(p);return;
    case 'guild-list':this.emit(p,{type:'guild-list',guilds:await this.requireGuilds().list(c.search)});return;
    case 'guild-create':{
     const guilds=this.requireGuilds();if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);try{const outcome=await guilds.create(id,c.name);p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});}finally{this.profileChanges.delete(id);}
     await this.refreshGuildMember(id);this.emit(p,{type:'guild-result',message:'Guilda fundada!'});return;
    }
    case 'guild-apply':{
     const {ownerId}=await this.requireGuilds().apply(id,c.id);await this.sendGuild(p);
     if(this.peers.get(ownerId)?.connected)await this.sendGuild(this.peers.get(ownerId)!);
     this.emit(p,{type:'guild-result',message:'Pedido enviado ao dono da guilda.'});return;
    }
    case 'guild-cancel-apply':await this.requireGuilds().cancelApply(id,c.id);await this.sendGuild(p);await this.refreshGuild(c.id);return;
    case 'guild-answer':{
     const {guildId}=await this.requireGuilds().answer(id,c.playerId,c.accept);await this.refreshGuild(guildId,[c.playerId]);
     const peer=this.peers.get(c.playerId);if(c.accept&&peer)this.emit(peer,{type:'guild-result',message:'Você entrou na guilda!'});return;
    }
    case 'guild-kick':{const {guildId}=await this.requireGuilds().kick(id,c.playerId);await this.refreshGuild(guildId,[c.playerId]);return;}
    case 'guild-leave':{
     const guilds=this.requireGuilds();if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);let guildId:number,dissolved:boolean;try{({guildId,dissolved}=await guilds.leave(id));if(dissolved){const profile=await this.store.getProfile(id);if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});}}}finally{this.profileChanges.delete(id);}
     await this.refreshGuild(guildId,[id]);this.emit(p,{type:'guild-result',message:dissolved?'A guilda foi encerrada.':'Você saiu da guilda.'});return;
    }
    case 'guild-upgrade':{
     const {guildId,level}=await this.requireGuilds().upgrade(id,c.target);await this.refreshGuild(guildId);
     this.emit(p,{type:'guild-result',message:`${c.target==='guild'?'Guilda':c.target==='shop'?'Loja':c.target==='smith'?'Ferreiro':'Depósito'} agora no nível ${level}!`});return;
    }
    case 'guild-buy':
    case 'guild-deposit':
    case 'guild-withdraw':{
     const guilds=this.requireGuilds();
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Use a guilda entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);let guildId:number|undefined;
     try{
      const outcome=c.type==='guild-buy'?await guilds.buy(id,c.item):c.type==='guild-deposit'?await guilds.deposit(id,c.source):await guilds.withdraw(id,c.id);
      p.profile=outcome.profile;guildId='guildId' in outcome?outcome.guildId as number:undefined;this.emit(p,{type:'profile',profile:p.profile});
     }finally{this.profileChanges.delete(id);}
     if(guildId!==undefined)await this.refreshGuild(guildId);
     this.emit(p,{type:'guild-result',message:c.type==='guild-buy'?'Compra concluída! O item está na sua mochila.':c.type==='guild-deposit'?'Item guardado no depósito.':'Item retirado para a sua mochila.'});return;
    }
    case 'room-gvg':{
     const r=this.room(p);if(r.kind==='expedition'||r.practice)throw Error('O GvG vale só para as salas PvP.');
     if(r.hostId!==id)throw Error('Somente o líder pode ligar o GvG.');if(r.status!=='waiting')throw Error('Pare a busca para mudar o GvG.');
     if(c.active&&!this.memberships.get(id))throw Error('Entre em uma guilda para buscar batalhas GvG.');
     if(c.active){const guild=this.memberships.get(id)!.guildId;if(r.players.some(s=>this.memberships.get(s.id)?.guildId!==guild))throw Error('No GvG, todos da sala precisam ser da sua guilda.');r.gvg=true;}else delete r.gvg;
     this.broadcastRoom(r);break;
    }
    case 'mail-list':await this.sendInbox(p);return;
    case 'mail-read':if(!this.mail)throw Error('Correio indisponível no momento.');await this.mail.markRead(id,c.id);await this.sendInbox(p);return;
    case 'mail-delete':if(!this.mail)throw Error('Correio indisponível no momento.');await this.mail.remove(id,c.id);await this.sendInbox(p);return;
    case 'mail-claim':{
     if(!this.mail)throw Error('Correio indisponível no momento.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);
     try{const outcome=await this.mail.claim(id,c.id===undefined?null:[c.id]);p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'mail-claim-result',result:outcome.result});}
     finally{this.profileChanges.delete(id);}
     await this.sendInbox(p);return;
    }
    case 'player-info':{
     const now=Date.now();if(now-(this.playerInfoAt.get(id)??-Infinity)<PLAYER_INFO_MS)return;this.playerInfoAt.set(id,now);
     const info=await this.playerInfo(c.playerId);if(!info)throw Error('Jogador não encontrado.');
     this.emit(p,{type:'player-info',info});return;
    }
    case 'report':{
     if(c.playerId===id)throw Error('Você não pode denunciar a si mesmo.');
     if(!this.reports)throw Error('Denúncias indisponíveis no momento.');
     const target=this.peers.get(c.playerId)?.profile??await this.store.getProfile(c.playerId);if(!target)throw Error('Jogador não encontrado.');
     await this.reports.submit({reporterId:id,reporterName:p.profile.name,targetId:target.id,targetName:target.name,targetLevel:target.level,reason:c.reason,details:c.details??'',context:c.context??'',chat:this.recentChat(target.id)});
     this.emit(p,{type:'report-result',playerId:target.id,name:target.name});return;
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
 private queueEligible(r:Room){return !r.practice&&r.players.length===r.openSlots.length&&r.openSlots.length>=1&&r.openSlots.length<=MAX_PARTY_SIZE&&r.openSlots.every(slot=>r.players.filter(player=>player.slot===slot).length===1)&&r.players.every(s=>!s.bot&&s.connected&&(s.id===r.hostId||s.ready)&&!this.profileChanges.has(s.id)&&this.peers.get(s.id)?.connected&&this.peers.get(s.id)?.roomId===r.id)&&(!r.gvg||this.partyGuild(r)!==null);}
 private queue(p:Peer){
  const r=this.room(p);if(r.kind==='expedition'){this.startExpedition(p);return;}if(r.hostId!==p.profile.id)throw Error('Somente o líder pode buscar partida.');if(r.practice)throw Error('O treino não usa a busca de partidas.');if(r.status!=='waiting')throw Error('A equipe já está buscando ou jogando.');
  if(r.gvg&&this.partyGuild(r)===null)throw Error('No GvG, todos da sala precisam ser da mesma guilda.');
  if(!this.queueEligible(r))throw Error('Preencha todas as vagas abertas e aguarde todos ficarem conectados e prontos.');
  r.mode=modeForSlots(r.openSlots.length);r.status='searching';r.searchStartedAt=Date.now();this.queueIds.add(r.id);this.broadcastRoom(r);
  // Synchronous validation and reservation prevent simultaneous queues from consuming a party twice.
  for(const otherId of this.queueIds){
   if(otherId===r.id)continue;const other=this.rooms.get(otherId);
   if(!other||other.status!=='searching'){this.queueIds.delete(otherId);continue;}
   if(!this.queueEligible(other)){this.cancelSearch(other);this.broadcastRoom(other);continue;}
   if(other.players.length!==r.players.length)continue;
   // GvG parties only meet GvG parties of another guild; normal parties never meet them.
   if(!!other.gvg!==!!r.gvg||r.gvg&&this.partyGuild(other)===this.partyGuild(r))continue;
   this.launchMatch([other,r]);break;
  }
 }
 /** Map versions running matches play (`snow@12`): kept while an admin publishes newer ones. */
 pinnedMaps(){return [...new Set([...this.matches.values()].map(m=>m.state.map))];}
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
  const room=this.room(p);if(room.kind==='expedition')throw Error('Na expedição, use Iniciar.');if(room.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar o treino.');if(room.status!=='waiting')throw Error('Inicie o treino entre as partidas.');
  if(room.practice){this.start(p);return;}
  if(room.players.some(player=>!player.connected||this.profileChanges.has(player.id)||!this.peers.get(player.id)?.connected))throw Error('Aguarde todos ficarem conectados.');
  const seats:Seat[]=room.players.map(player=>({...player,team:0}));let n=0;
  for(const team of [0,1] as const)for(const slot of room.openSlots)if(!seats.some(player=>player.team===team&&player.slot===slot)){seats.push({id:`bot-${randomUUID()}`,name:['Pipoca','Faísca','Fagulha','Brasa'][n%4]+' · BOT',level:p.profile.level,equipment:{...DEFAULT_EQUIPMENT,weapon:WEAPONS[n++%WEAPONS.length].id},ready:true,bot:true,team,slot,connected:true});}
  this.launchMatch([room],seats);
 }
 private launchMatch(rooms:Room[],practiceSeats?:Seat[]){
  const r=rooms[0],rotation=pvpRotation(),map=rooms.length===2||practiceSeats?rotation[randomInt(rotation.length)]:r.map;
  const seats:Seat[]=practiceSeats??(rooms.length===2?rooms.flatMap((room,team)=>[...room.players].sort((a,b)=>a.slot-b.slot).map(s=>({...s,team:team as 0|1}))):r.players);
  // The match keeps this version of the map even if the admin panel publishes a new one meanwhile.
  const played=pinMap(map),terrain=createTerrain(played);const fighters:Fighter[]=seats.map(s=>{const stats=attributes(s.equipment,s.level);const x=getMap(played).spawns[s.team][s.slot],abilityLoadout=normalizeAbilityLoadout(s.abilityLoadout);return {...s,equipment:structuredClone(s.equipment),abilityLoadout,x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:s.team===0?1:-1,boosts:[],powerCharge:0,powerArmed:false,abilities:initialAbilities(abilityLoadout),homingArmed:false,flightArmed:false,invisibleTurns:0,delay:stats.delay};});
  fighters.forEach(fighter=>adjustAimToTerrain(fighter,terrain));
  // Roster order (Agilidade first) only breaks Delay ties; everyone starts at their base Delay.
  fighters.sort((a,b)=>attributes(b.equipment).agility-attributes(a.equipment).agility);
  // In practice, the human takes the first turn so controls can be learned immediately.
  const first=seats.some(s=>s.bot)?fighters.find(f=>!f.bot)!:nextByDelay(fighters)!;startDelayTurn(fighters,first,this.baseDelay(first));
  const key=this.matches.has(r.id)?randomUUID():r.id;
  const m:Match={key,roomIds:rooms.map(room=>room.id),practiceParty:!!practiceSeats,state:{id:randomUUID(),roomId:r.id,map:played,players:fighters,turnId:first.id,turnNumber:1,wind:this.wind(),deadline:Date.now()+TURN_SECONDS*1000,phase:'aiming',winner:null},terrain,resolveAt:0,botAt:Date.now()+2000,createdAt:Date.now()};
  if(rooms.length===2&&rooms.every(room=>room.gvg)){const guilds=rooms.map(room=>this.partyGuild(room));if(guilds.every(g=>g!==null))m.gvg=guilds as [number,number];}
  this.matches.set(key,m);for(const room of rooms){this.queueIds.delete(room.id);room.status='playing';delete room.searchStartedAt;room.matchStartedAt=m.createdAt;room.map=map;this.roomMatches.set(room.id,key);this.broadcastRoom(room);}this.broadcastBattle(m,true);
 }
 private startExpedition(p:Peer){
  const room=this.room(p);if(room.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar a expedição.');if(room.status!=='waiting')throw Error('A expedição já começou.');
  if(!room.expedition)throw Error('Escolha uma expedição primeiro.');
  if(room.players.some(s=>!s.connected||this.profileChanges.has(s.id)||!this.peers.get(s.id)?.connected||(!s.ready&&s.id!==room.hostId)))throw Error('Aguarde todos ficarem prontos.');
  this.launchExpedition(room,Math.min(room.expedition.stage??0,expeditionStages(room.expedition.id,room.expedition.difficulty).length-1));
 }
 /** Opens a stage: a new battle (new map) for the room's party. Each stage is its own start from the room. */
 private launchExpedition(room:Room,stageIndex:number){
  const choice=room.expedition!,stages=expeditionStages(choice.id,choice.difficulty);
  const seats=room.players.filter(seat=>!seat.bot);
  const played=pinMap(stages[stageIndex].map as Battle['map']),terrain=createTerrain(played),now=Date.now(),setup=setupStage(seats,choice.id,choice.difficulty,stageIndex,terrain,now);
  setup.fighters.forEach(fighter=>{if(!fighter.monster)adjustAimToTerrain(fighter,terrain);});
  const run:ExpeditionRun={expedition:choice.id,difficulty:choice.difficulty,stages,stage:stageIndex,order:setup.order,round:{round:1,acted:[]},events:[]};
  const state:Battle={id:randomUUID(),roomId:room.id,map:played,players:setup.fighters,turnId:setup.order[0],turnNumber:1,wind:this.wind(),deadline:setup.instance.introUntil+30000,phase:'aiming',winner:null,instance:setup.instance};
  const key=this.matches.has(room.id)?randomUUID():room.id;
  const m:Match={key,roomIds:[room.id],state,terrain,resolveAt:0,botAt:Infinity,createdAt:now,instance:run};
  this.matches.set(key,m);this.queueIds.delete(room.id);room.status='playing';room.matchStartedAt=now;room.map=setup.map;this.roomMatches.set(room.id,key);this.broadcastRoom(room);this.broadcastBattle(m,true);
 }
 /** Instance turn: each living adventurer once per round, then the monsters together (shared/instanceTurn.ts). */
 private nextInstanceTurn(m:Match){
  const run=m.instance!,s=m.state,withTerrain=s.phase==='resolving';
  if(s.turnId===MONSTER_TURN_ID){run.round={round:run.round.round+1,acted:[]};delete s.instance!.monsterTurn;}
  else{if(!run.round.acted.includes(s.turnId))run.round.acted.push(s.turnId);const outgoing=s.players.find(f=>f.id===s.turnId);if(outgoing&&(outgoing.invisibleTurns??0)>0&&m.invisibilityActivated?.get(outgoing.id)!==s.turnNumber)outgoing.invisibleTurns!--;}
  delete m.pendingPower;delete m.activeShot;delete m.pendingImpacts;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});
  s.instance!.round=run.round.round;
  const order=run.order.map(id=>s.players.find(f=>f.id===id)).filter((f):f is Fighter=>!!f),next=nextInstanceActor(order,run.round);
  if(next.kind==='monsters'){this.startMonsterTurn(m);return;}
  const f=s.players.find(player=>player.id===next.id)!;f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+TURN_SECONDS*1000;this.broadcastBattle(m,withTerrain);
 }
 /** The monsters' shared turn: everyone walks at once, those already beside an adventurer bite, the queen shoots and summons. */
 private startMonsterTurn(m:Match){
  const s=m.state,run=m.instance!,now=Date.now(),turnId=randomUUID();
  s.turnId=MONSTER_TURN_ID;s.turnNumber++;s.phase='resolving';
  // The queen acts first (draws, shoots, the camera follows her arrow), then the ants walk and bite.
  const queen=s.players.find(f=>f.id===s.instance!.boss&&f.hp>0),stage=run.stages[run.stage];let arrowAt:number|undefined,walkAt=now;
  if(queen){const arrow=this.queenShot(m,queen);if(arrow){arrowAt=now+QUEEN_DRAW_MS;run.events.push({at:arrowAt,run:()=>this.queenArrow(m,queen.id,arrow)});walkAt=arrowAt+arrow.result.flightTime+600;}}
  // Invisible adventurers cannot be chased.
  const plan=planMonsterTurn(m.terrain,s.players.filter(f=>f.team===1||!(f.invisibleTurns??0)));
  for(const move of plan.moves){const f=s.players.find(x=>x.id===move.id);if(!f)continue;f.x=move.to[0];f.y=move.to[1];f.facing=move.facing;}
  const walking=plan.moves.some(move=>move.from[0]!==move.to[0]);
  let at=walkAt+(walking?MONSTER_MOVE_MS:300)+MONSTER_BITE_WINDUP_MS,end=walkAt+(walking?MONSTER_MOVE_MS:600);
  const bites=plan.bites.map((bite,index)=>({...bite,at:at+index*110}));
  bites.forEach((bite,index)=>{run.events.push({at:bite.at,run:()=>{
   const monster=s.players.find(f=>f.id===bite.id),target=s.players.find(f=>f.id===bite.targetId);if(!monster||monster.hp<=0||!target||target.hp<=0||!monster.monster)return;
   const damage=Math.min(target.hp,monsterDamage(MONSTERS[monster.monster].attack,target.equipment,1,monster.level));target.hp-=damage;if(target.hp<=0)target.powerArmed=false;
   target.powerCharge=chargeFromDamage(target.powerCharge??0,damage,target.maxHp,true);
   const hit:ShotHit={id:target.id,damage,x:target.x,y:target.y-85,projectileIndex:index,critical:false,kind:'direct',quality:1};
   for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:`bite:${turnId}`,projectileIndex:index,at:bite.at,hits:this.visibleHits(m,[hit],peer.profile.id)});
   this.broadcastBattle(m);
  }});});
  if(bites.length){at=bites.at(-1)!.at+260;end=Math.max(end,at+MONSTER_ATTACK_MS-MONSTER_MOVE_MS);}
  else at=Math.max(at,end);
  const summons:{id:string;at:number}[]=[];
  if(queen&&stage.boss&&run.round.round%stage.boss.summonEvery===0){
   const nest=s.instance!.nest??{x:queen.x-200,y:queen.y},alive=s.players.filter(f=>f.team===1&&f.hp>0&&f.id!==queen.id).length;
   for(let n=0;n<Math.min(stage.boss.summonCount,stage.boss.summonLimit-alive);n++){
    const kind=stage.boss.summonKinds[randomInt(stage.boss.summonKinds.length)],x=nest.x+(n?-1:1)*n*36,players=s.players.filter(f=>f.team===0&&!f.left).length;
    const minion=monsterFighter(kind,x,ground(m.terrain,x,Math.max(0,nest.y-40)),queen.level,players,s.players.length,-1);minion.hp=0;
    const summonAt=at+n*350;summons.push({id:minion.id,at:summonAt});s.players.push(minion);
    // The ant exists from the start of the turn (so clients can preload it) but only comes alive when it leaves the nest.
    run.events.push({at:summonAt,run:()=>{minion.hp=minion.maxHp;this.broadcastBattle(m);}});
   }
   if(summons.length){at=summons.at(-1)!.at+900;end=Math.max(end,at);}
  }
  if(arrowAt!==undefined)end=Math.max(end,walkAt);
  s.instance!.monsterTurn={id:turnId,startedAt:walkAt,moves:plan.moves,bites,summons,...(arrowAt!==undefined?{arrowAt}:{})};
  run.events.sort((a,b)=>a.at-b.at);m.resolveAt=end+MONSTER_TURN_END_MS;this.broadcastBattle(m);
 }
 /** The queen's aim for this monster turn, worked out when the turn opens so the ants can wait for the arrow to land. */
 private queenShot(m:Match,queen:Fighter){
  const s=m.state,aim=queenAim(m.terrain,queen,s.players.filter(f=>f.team===0),s.wind);if(!aim)return null;queen.facing=aim.facing;
  return {aim,result:trajectory(m.terrain,aim.origin,aim.angle,aim.power,s.wind,ARROW,s.players.filter(f=>f.team===0))};
 }
 private queenArrow(m:Match,queenId:string,{aim,result}:NonNullable<ReturnType<Game['queenShot']>>){
  const s=m.state,queen=s.players.find(f=>f.id===queenId);if(!queen||queen.hp<=0||s.phase!=='resolving')return;
  queen.facing=aim.facing;const startedAt=Date.now(),id=randomUUID();
  const hits:ShotHit[]=[];
  for(const target of s.players){if(target.team!==0||target.hp<=0)continue;const exposure=impactExposure(target,result,ARROW.blast);if(exposure.attenuation<=0)continue;
   hits.push({id:target.id,damage:monsterDamage(MONSTERS['ant-queen'].attack,target.equipment,exposure.attenuation,queen.level),x:target.x,y:target.y-85,projectileIndex:0,critical:false,kind:exposure.kind,quality:exposure.quality});}
  const shot:Shot={id,shooterId:queen.id,startedAt,duration:result.flightTime+450,hits:[],impacted:[],projectiles:[{points:result.points,delay:0,flightTime:result.flightTime,impact:{x:result.x,y:result.y,radius:0},effect:'brick',monster:'arrow'}]};
  m.activeShot=shot;m.pendingImpacts=[{at:startedAt+result.flightTime,projectileIndex:0,hits,fragment:true,mark:{id:`${id}:0`,x:result.x,y:result.y,radius:0,effect:'brick',level:0}}];
  m.resolveAt=Math.max(m.resolveAt,startedAt+shot.duration+MONSTER_TURN_END_MS);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});this.broadcastBattle(m);
 }
 /** Base Delay a fighter adds when their turn starts, from their match equipment. */
 private baseDelay(f:Fighter){return attributes(f.equipment,f.level).delay;}
 private wind(){return Math.round((Math.random()*2-1)*35)/10;}
 private boost(f:Fighter,id:BoostId){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar ferramentas.');
  const b=BOOSTS.find(b=>b.id===id)!;
  const combination=powerUpConflict(f.boosts,id);if(combination)throw Error(combination);
  // POW × Tridente follows the weapon's rule (shared/weaponKit.ts).
  const conflict=f.powerArmed?powBoostConflict(f.equipment.weapon,id):undefined;if(conflict)throw Error(conflict);
  if(f.stamina<b.cost)throw Error('Vigor insuficiente.');f.stamina-=b.cost;f.delay=(f.delay??0)+b.delay;f.boosts.push(id);
 }
 private armPower(f:Fighter){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar Power.');
  if(f.powerArmed)throw Error('Power já está preparado para este tiro.');
  if((f.powerCharge??0)<POWER_MAX)throw Error('Acumule 100 de Power para ativar.');
  const conflict=f.boosts.map(id=>powBoostConflict(f.equipment.weapon,id)).find(Boolean);if(conflict)throw Error(conflict);
  f.powerCharge=0;f.powerArmed=true;
 }
 private useAbility(m:Match,f:Fighter,ability:AbilityId){
  // Heal and invisibility act at once and combine with flight; homing guides a shot, which flight replaces.
  if(f.flightArmed&&ability==='homing')throw Error('Cancele o voo antes de usar a mira assistida.');
  if(!normalizeAbilityLoadout(f.abilityLoadout).includes(ability))throw Error('Esta habilidade não está equipada.');
  f.abilities??=initialAbilities(f.abilityLoadout);if(f.abilities[ability]<=0)throw Error('Esta habilidade já foi usada nesta partida.');
  if(ability==='heal'&&f.hp>=f.maxHp)throw Error('Sua vida já está completa.');
  if(ability==='homing'&&f.homingArmed)throw Error('A mira assistida já está preparada.');
  f.abilities[ability]--;f.delay=(f.delay??0)+(ABILITIES.find(entry=>entry.id===ability)?.delay??0);let amount:number|undefined;
  if(ability==='heal'){const healed=clampHp(f.hp+HEAL_AMOUNT,f.maxHp);amount=healed-f.hp;f.hp=healed;}
  if(ability==='homing')f.homingArmed=true;
  if(ability==='invisibility'){f.invisibleTurns=INVISIBILITY_TURNS;m.invisibilityActivated??=new Map();m.invisibilityActivated.set(f.id,m.state.turnNumber);}
  this.abilityEffect(m,{playerId:f.id,ability,x:f.x,y:f.y,amount,at:Date.now()});
 }
 private fire(m:Match,f:Fighter,angle:number,power:number){
  // Delay for the seconds used this turn and for the shot itself (DDTank PrepareShoot + ball/weapon Delay).
  f.delay=(f.delay??0)+timeDelay(Date.now()-(m.state.deadline-TURN_SECONDS*1000))+(WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)?.shotDelay??0);
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
  m.activeShot=shot;m.pendingImpacts=[{at:startedAt+result.flightTime,projectileIndex:0,hits:[],flight:true,mark:{id:`${id}:0`,x:result.x,y:result.y,radius:0,effect:weapon.effect,level:f.equipment.upgrade}}];m.state.phase='resolving';m.resolveAt=startedAt+shot.duration+TURN_GAP_MS;
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
   // A shot that hits a fighter in full still digs a little, under the target's feet.
   const victim=result.hitId?simulated.state.players.find(player=>player.id===result.hitId):undefined;
   const dig=victim?directHitDig(result.x,victim.y,radius):undefined;
   const rough=weaponRoughness(w),impact={x:result.x,y:result.y,radius,roughness:rough,...terrainMaterial(m.state.map,result.x,result.y),...(dig?{dig}:{})},hole:TerrainDig=dig??impact;
   const hits:ShotHit[]=[];
   for(const target of simulated.state.players){
    if(target.hp<=0)continue;const exposure=impactExposure(target,result,blast);if(exposure.attenuation<=0)continue;
    const critical=criticalFromRoll(attributes(f.equipment,f.level).luck,this.criticalRoll());let damage=damageAtImpact(f.equipment,target.equipment,{attackerLevel:f.level,attenuation:exposure.attenuation,shotMultiplier:modifiers.projectileMultiplier*damageScale,boostMultiplier:modifiers.damageMultiplier*(powered?POWER_DAMAGE_MULTIPLIER:1),critical});
    if(target.monster)damage=Math.round(damage/MONSTERS[target.monster].toughness);
    if(damage<=0)continue;
    hits.push({id:target.id,damage,x:target.x,y:target.y-85,projectileIndex:index,critical,kind:exposure.kind,quality:exposure.quality});
   }
   // A fighter killed here is gone for the projectiles still in the air: they fly through it to the ground or the next target.
   for(const hit of hits){const target=simulated.state.players.find(player=>player.id===hit.id)!;target.hp=Math.max(0,target.hp-hit.damage);}
   crater(simulated.terrain,hole.x,hole.y,hole.radius,m.state.map,rough,hole.stretch);this.settle(simulated);
   pending.push({at:startedAt+delay+result.flightTime,projectileIndex:index,hits,fragment,mark:{id:`${shot.id}:${index}`,x:hole.x,y:hole.y,radius:hole.radius,roughness:rough,...(hole.stretch?{stretch:hole.stretch}:{}),...(impact.destructible===false?{scorch:true}:{}),effect:w.effect,level:f.equipment.upgrade}});
   return impact;
  };
  const results=volley(simulated.terrain,shooter,angles,power,m.state.wind,w,simulated.state.players.filter(player=>player.id!==f.id),(result,index)=>{
   impacts[index]=planImpact(result,index,delays[index],w.crater,w.blast,1);
  },delays,homing?{targets:homingTargets(simulated.state.players,shooter)}:undefined);
  shot.projectiles=results.map((result,index)=>({points:result.points,delay:delays[index],flightTime:result.flightTime,impact:impacts[index],effect:w.effect,powered}));
  const shardCount=weaponFragmentCount(w,f.equipment.upgrade,powered);
  if(shardCount&&w.fragments)for(let parent=0;parent<results.length;parent++){
   const result=results[parent];if(result.x<0||result.x>terrainWidth(m.terrain)||result.y>WORLD.height)continue;
   const start=delays[parent]+result.flightTime,base=shot.projectiles.length,shardImpacts:Shot['projectiles'][number]['impact'][]=[];
   const pieces=shatter(simulated.terrain,{x:result.x,y:result.y},shardCount,shooter.facing,w,m.state.wind,simulated.state.players.filter(player=>player.id!==f.id&&player.id!==result.hitId),(piece,index)=>{
    shardImpacts[index]=planImpact(piece,base+index,start,w.fragments!.crater,w.fragments!.blast,w.fragments!.damage,true);
   });
   pieces.forEach((piece,index)=>shot.projectiles.push({points:piece.points,delay:start,flightTime:piece.flightTime,impact:shardImpacts[index],effect:w.effect,powered,fragment:true}));
  }
  shot.duration=Math.max(...shot.projectiles.map(projectile=>projectile.delay+projectile.flightTime))+450;m.activeShot=shot;m.pendingImpacts=pending.sort((a,b)=>a.at-b.at||a.projectileIndex-b.projectileIndex);m.state.phase='resolving';m.resolveAt=startedAt+shot.duration+TURN_GAP_MS;
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});
  this.broadcastBattle(m);
 }
 private applyImpact(m:Match,impact:PendingImpact){
  const shot=m.activeShot;if(!shot||m.state.phase!=='resolving'||shot.impacted.includes(impact.projectileIndex))return;
  const shooter=m.state.players.find(player=>player.id===shot.shooterId)!,hits:ShotHit[]=[];
  if(impact.flight){
   const landing=shooter.hp>0?flightLanding(m.terrain,{...impact.mark,points:shot.projectiles[impact.projectileIndex]?.points}):null;
   if(landing){
    shooter.x=landing.x;shooter.y=landing.y;
    if(shooter.y>WORLD.height){hits.push({id:shooter.id,damage:shooter.hp,x:landing.x,y:landing.fromY-85,projectileIndex:impact.projectileIndex,critical:false,kind:'fall',quality:1});shooter.y=WORLD.height+150;shooter.hp=0;shooter.powerArmed=false;}
    this.animateFall(shooter,landing.fromY,impact.at);if(shooter.fall)m.resolveAt=Math.max(m.resolveAt,shooter.fall.startedAt+shooter.fall.duration+TURN_GAP_MS);
    adjustAimToTerrain(shooter,m.terrain);this.abilityEffect(m,{playerId:shooter.id,ability:'flight',x:landing.x,y:landing.fromY,at:impact.at});
   }
   shot.hits.push(...hits);shot.impacted.push(impact.projectileIndex);for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:this.visibleHits(m,hits,peer.profile.id)});this.broadcastBattle(m,true);return;
  }
  for(const planned of impact.hits){
   // Hits are only planned on fighters still alive when the projectile lands (killed ones are let through).
   const target=m.state.players.find(player=>player.id===planned.id);if(!target||target.y>WORLD.height||planned.damage<=0)continue;
   const absorbed=Math.min(target.hp,planned.damage);target.hp-=absorbed;if(target.hp<=0)target.powerArmed=false;
   if(absorbed>0&&target.team!==shooter.team){if(shooter.hp>0)shooter.powerCharge=chargeFromDamage(shooter.powerCharge??0,absorbed,target.maxHp);target.powerCharge=chargeFromDamage(target.powerCharge??0,absorbed,target.maxHp,true);}
   hits.push({...planned,x:target.x,y:target.y-85});
  }
  const dug=crater(m.terrain,impact.mark.x,impact.mark.y,impact.mark.radius,m.state.map,impact.mark.roughness,impact.mark.stretch);
  const standing=m.state.players.filter(player=>player.hp>0).map(player=>({id:player.id,hp:player.hp,x:player.x,y:player.y}));this.settle(m,impact.at);
  for(const before of standing){const target=m.state.players.find(player=>player.id===before.id)!;if(target.hp<=0){target.powerArmed=false;hits.push({id:target.id,damage:before.hp,x:before.x,y:before.y-85,projectileIndex:impact.projectileIndex,critical:false,kind:'fall',quality:1});}}
  // Unbreakable instance ground (the anthill) keeps no burn marks either.
  if(!impact.fragment&&(dug>0||!m.state.instance))m.state.terrainMarks=[...(m.state.terrainMarks??[]),impact.mark].slice(-48);shot.hits.push(...hits);shot.impacted.push(impact.projectileIndex);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:this.visibleHits(m,hits,peer.profile.id)});
  // The match only ends in nextTurn, once every projectile of the shot has landed and settled.
  this.broadcastBattle(m,true);
 }
 private animateFall(target:Fighter,fromY:number,at:number){
  const previous=target.fall,falling=previous&&at<previous.startedAt+previous.duration;
  if(previous&&!falling)delete target.fall;
  if(target.y-fromY<9)return;
  target.fall=createFall(falling?fallPosition(previous,at):fromY,target.y,at,target.y>WORLD.height,falling?fallVelocity(previous,at):0);
 }
 private settle(m:Match,at?:number){for(const target of m.state.players){
  const fromY=target.y;target.y=ground(m.terrain,target.x,Math.max(0,target.y-3));if(target.y>WORLD.height){target.y=WORLD.height+150;target.hp=0;}
  if(at!==undefined){this.animateFall(target,fromY,at);if(target.fall)m.resolveAt=Math.max(m.resolveAt,target.fall.startedAt+target.fall.duration+TURN_GAP_MS);}
  adjustAimToTerrain(target,m.terrain);
 }}
 private nextTurn(m:Match){
  if(this.checkWin(m))return;
  if(m.instance){this.nextInstanceTurn(m);return;}
  const s=m.state,withTerrain=s.phase==='resolving';
  const outgoing=s.players.find(p=>p.id===s.turnId);if(outgoing&&(outgoing.invisibleTurns??0)>0&&m.invisibilityActivated?.get(outgoing.id)!==s.turnNumber)outgoing.invisibleTurns!--;
  // The living fighter with the lowest accumulated Delay plays, possibly the same one again (shared/turnDelay.ts).
  const f=nextByDelay(s.players,s.turnId)??outgoing!;startDelayTurn(s.players,f,this.baseDelay(f));
  delete m.pendingPower;delete m.activeShot;delete m.pendingImpacts;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+TURN_SECONDS*1000;m.botAt=Date.now()+1800;this.broadcastBattle(m,withTerrain);
 }
 private checkWin(m:Match){
  if(m.state.phase==='finished')return true;
  if(m.instance)return this.checkInstanceEnd(m);
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
 /** A stage ends when every monster falls (or, with a boss, the queen), or when the whole party is down. */
 private checkInstanceEnd(m:Match){
  const s=m.state,run=m.instance!,boss=s.players.find(f=>f.id===s.instance?.boss);
  const party=s.players.filter(f=>f.team===0&&f.hp>0&&!f.left).length,monsters=s.players.filter(f=>f.team===1&&f.hp>0).length;
  const won=party>0&&(boss?boss.hp<=0:monsters===0),lost=party===0||s.turnNumber>=150;
  if(!won&&!lost)return false;
  // A pending monster turn cannot strike after the end.
  run.events=[];delete m.pendingPower;delete m.pendingImpacts;delete s.powerCutIn;
  if(won)for(const f of s.players)if(f.team===1&&f.hp>0){f.hp=0;}
  s.players.forEach(f=>{f.powerArmed=false;f.flightArmed=false;f.homingArmed=false;});
  s.phase='finished';s.winner=won?0:1;run.won=won;
  const stage=run.stages[run.stage],cards=won?stage.cards:0;m.rewardDeck=won?stageDeck(stage):[];
  const opensAt=Math.max(Date.now(),...s.players.map(player=>player.fall?player.fall.startedAt+player.fall.duration:0))+REWARD_RESULT_MS;
  s.rewards={opensAt,deadline:opensAt+(cards?REWARD_PICK_MS:0),phase:'picking',saved:false,cards:Array.from({length:cards},(_,index)=>({index}))};
  this.broadcastBattle(m,true);return true;
 }
 private autoPick(m:Match,id:string){
  const cards=m.state.rewards!.cards;if(cards.some(card=>card.playerId===id))return;
  const free=cards.filter(card=>!card.playerId);if(free.length){const card=free[randomInt(free.length)];card.playerId=id;card.automatic=true;}
 }
 private revealRewards(m:Match,now=Date.now()){
  const rewards=m.state.rewards!;
  if(rewards.phase==='revealed')return;
  for(const player of m.state.players)if(!player.left&&!player.monster)this.autoPick(m,player.id);
  for(const card of rewards.cards)card.prize={...m.rewardDeck![card.index]};
  rewards.phase='revealed';rewards.revealedAt=now;this.broadcastBattle(m);this.saveRewards(m);
 }
 private saveRewards(m:Match){
  const rewards=m.state.rewards;if(!rewards||rewards.saved||m.savingRewards)return;
  m.savingRewards=true;
  // Fallen fighters who stayed to watch keep their reward; those who left forfeit it.
  const humans=m.state.players.filter(p=>!p.bot&&!p.left),winners=humans.filter(p=>p.team===m.state.winner).map(p=>p.id);
  const bonuses:MatchBonuses=Object.fromEntries(rewards.cards.filter(card=>card.playerId&&card.prize&&humans.some(p=>p.id===card.playerId)).map(card=>[card.playerId!,card.prize!]));
  const run=m.instance,award=run?.won?run.stages[run.stage].award:{coins:0,xp:0};
  const saving=run?(this.store.finishExpedition?.(m.state.id,humans.map(p=>p.id),award,bonuses)??Promise.resolve()):this.store.finishMatch(m.state.id,winners,humans.map(p=>p.id),bonuses);
  // GvG: every winner adds Riqueza to their guild (once per battle, like the match rewards).
  const gvgGuild=m.gvg&&m.state.winner!==null&&winners.length?m.gvg[m.state.winner]:undefined;
  saving.then(async()=>{
   if(gvgGuild!==undefined&&this.guilds&&await this.guilds.gvgWin(m.state.id,gvgGuild,winners,GVG_CONTRIBUTION)){
    for(const winner of winners){const peer=this.peers.get(winner);if(peer)this.emit(peer,{type:'guild-result',message:`Vitória GvG! +${GVG_CONTRIBUTION} de Riqueza para a guilda.`});}
    await this.refreshGuild(gvgGuild);
   }
   for(const f of humans){const p=this.peers.get(f.id);if(p){const profile=await this.store.getProfile(f.id);if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});const seat=p.roomId?this.rooms.get(p.roomId)?.players.find(s=>s.id===f.id):undefined;if(seat)seat.level=profile.level;}}}
   rewards.saved=true;if(!run)void this.refreshRanking();this.broadcastBattle(m);for(const roomId of m.roomIds){const room=this.rooms.get(roomId);if(room&&this.matchForRoom(roomId)===m)this.broadcastRoom(room);}
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
  if(now-this.chatLogPrunedAt>=60000){this.chatLogPrunedAt=now;for(const id of [...this.chatLog.keys()])this.recentChat(id,now);}
  if(now-this.rankingAt>=60000)void this.refreshRanking();
  const dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;
  const channels=new Set<number>();
  for(const [id,p] of this.peers){
   if(!p.connected&&now-p.lastSeen>this.reconnectWindow(p)&&!this.profileChanges.has(id)){this.leave(p);this.peers.delete(id);continue;}
   if(p.connected&&!p.roomId){const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy);if(d>1){const next=lobbyStep(p,{x:p.targetX,y:p.targetY},LOBBY_WALK_SPEED*dt);p.x=next.x;p.y=next.y;channels.add(p.channel);}}
  }
  if(++this.lobbyTick%2===0)for(const channel of channels)this.sendLobby(channel);
  for(const m of this.matches.values()){
   if(m.state.phase==='finished'&&m.state.rewards){const rewards=m.state.rewards;if(rewards.phase==='picking'&&now>=rewards.deadline)this.revealRewards(m,now);else if(rewards.phase==='revealed'&&!rewards.saved&&now>=(m.retryRewardsAt??0))this.saveRewards(m);if(rewards.saved&&now>=(rewards.revealedAt??Infinity)+REWARD_RETURN_MS){const run=m.instance,room=this.rooms.get(m.roomIds[0]);// Every stage ends back in the room; a win moves the room's choice on to the next stage (the last one starts over).
    if(run&&room?.expedition&&this.matchForRoom(room.id)===m&&run.won)room.expedition.stage=run.stage+1<run.stages.length?run.stage+1:0;this.returnParties(m);}this.cleanupMatch(m);}
   if(m.pendingPower&&now>=m.pendingPower.at){const pending=m.pendingPower;delete m.pendingPower;delete m.state.powerCutIn;const shooter=m.state.players.find(f=>f.id===pending.playerId);if(shooter&&shooter.hp>0&&m.state.phase==='resolving')this.resolveFire(m,shooter,pending.angle,pending.power,true,now);else if(m.state.phase!=='finished')this.nextTurn(m);}
   while(m.state.phase==='resolving'&&m.instance?.events.length&&m.instance.events[0].at<=now)m.instance.events.shift()!.run();
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
