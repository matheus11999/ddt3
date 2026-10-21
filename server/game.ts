import {boostsForShot,powBoostConflict} from '../shared/weaponKit';
import {powerUpConflict} from '../shared/powerUps';
import {ICE_FROZEN_TURNS,iceTargets,isFrozen,RAGE_CHARGE} from '../shared/ice';
import {chargeHoldsTurn} from '../shared/forceBar';
import {addPower,chargeOnDamage,POWER_ATTACK_CHARGE,POWER_MAX,POWER_PASS_CHARGE,POWER_CUT_IN_MS,POWER_DAMAGE_MULTIPLIER,POWER_BLAST_MULTIPLIER} from '../shared/power';
import {CARD_PRIZES,REWARD_CARD_COUNT,REWARD_PICK_MS,REWARD_RESULT_MS,REWARD_RETURN_MS} from '../shared/rewards';
import type {CardPrize,MatchBonuses} from '../shared/rewards';
import {randomInt,randomUUID} from 'node:crypto';
import {LOBBY_SPAWN,LOBBY_WALK_SPEED,lobbyFree,lobbyStep} from '../shared/lobby';
import {AUTO_BASE_MS,FISHING_IGNORED_STOP,AUTO_PER_HIT_MS,AUTO_QUALITY,STARTER_ROD,rollRodDrops,FISHING_SPAWN,FISHING_SPOTS,HOOK_LEAD_MS,PRESS_GRACE_MS,RESULT_MS,ROD_BY_ID,SPOT_REACH,autoChance,autoReward,biteWaitMs,catchPoints,catchXp,effectiveRod,fishChallenge,fishWeight,fishingFree,fishingLevel,fishingWeek,fishRarity,fishingStep,gradePress,normalizeFishing,pickFish,FISH_RANKING_SIZE} from '../shared/fishing';
import type {FishRanking} from '../shared/fishing';
import type {AutoFishingSummary,Fish,FishChallenge,FishingPhase,FishingPose,FishingSpot,FishingView,PressGrade,Zone} from '../shared/fishing';
import {attributes,battleEquipment,BOOSTS,CATALOG,SLOTS,equippedCopy,targetSlotForItem,DEFAULT_EQUIPMENT,isEmptyItem,SMITH_POSITION,WEAPONS,weaponFragmentCount,weaponStats} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import {LOADING_SECONDS} from '../shared/protocol';
import type {ChatLine,LoadingPlayer,MatchLoading} from '../shared/protocol';
import type {Battle,Command,Fighter,LobbyMove,LobbyPlayer,Profile,RankingEntry,Room,RoomInvitation,RoomInviteResult,Seat,ServerEvent,Shot,ShotHit,TerrainMark} from '../shared/protocol';
import {crater,createTerrain,DIRECT_HIT_CRATER,type TerrainDig,weaponRoughness,ground,packTerrain,shatter,terrainMaterial,terrainWidth,trajectory,upgradeTerrain,volley,walkPosition,supportBelow,WALK_COMMAND_MS,WORLD} from '../shared/physics';
import type {TrajectoryResult} from '../shared/physics';
import type {ProfileStore} from './store';
import {getMap,canonicalMap,MAP_DEFAULT,pinMap,pvpRotation} from '../shared/maps';
import {destructionProfile,powCraterRadius} from '../shared/destruction';
import {keepVisibleMarks} from '../shared/terrainMarks';
import {nextByDelay,startDelayTurn,timeDelay,TURN_SECONDS} from '../shared/turnDelay';
import {clampHp,criticalBonusMultiplier,PASS_DELAY} from '../shared/stats';
import {criticalFromRoll,damageAtImpact,impactExposure,shotModifiers,SPLASH_RADIUS_SCALE,TURN_GAP_MS,VOLLEY_CADENCE_MS} from '../shared/combat';
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
import type {GuildMissionId} from '../shared/guilds';
import type {GuildBoard,HallBoard,HallCategory,HallGuildProfile,HallLegends,HallPeriod,HallPlayerProfile,LegendBoard} from '../shared/hall';
import type {MatchRecord} from './hall';
import type {PlayerPresence} from '../shared/adminPlayers';
import {getExpedition,expeditionStages,MONSTERS} from '../shared/expeditions';
import type {Difficulty,StageDef} from '../shared/expeditions';
import {MONSTER_ATTACK_MS,MONSTER_BITE_WINDUP_MS,MONSTER_MOVE_MS,MONSTER_TURN_END_MS,MONSTER_TURN_ID,nextInstanceActor,planMonsterTurn,QUEEN_DRAW_MS} from '../shared/instanceTurn';
import type {InstanceRound} from '../shared/instanceTurn';
import {monsterDamage} from '../shared/combat';
import {ARROW,monsterFighter,queenAim,setupStage,stageDeck} from './expedition';
import type {BattlePetEntry,PetKeeper,PetOutcome} from './pets';
import {PET_CONFIG} from '../shared/petConfig';
import {activatePetSkill,blocked as petBlocked,consumeShotBonus,createBattlePet,dispatchAll,dispatchPetTrigger,drainShield,incomingPetDamage,outgoingPetFactor,armsSpecialShot,consumeSpecialShot,listensTo,specialShot,petStatBuffs,petTurnEnd,petTurnStart} from '../shared/petSkills';
import type {PetApplication,PetBlockedAction,PetEngineContext,PetTrigger} from '../shared/petSkills';
import {DRAGON_ACTIONS,DRAGON_BODY,DRAGON_FIGHTER_ID,DRAGON_TURN_ID,dragonRage,pickDragonAction,sweepReachAt,WORLD_BOSS_MAP} from '../shared/worldBoss';
import type {DragonAct,DragonAction,WorldBossEndReason,WorldBossStatus} from '../shared/worldBoss';
import type {WorldBossDamage,WorldBossRealm} from './worldBoss';
export interface Peer {/** Brought back from a saved state after a restart: waits for its player with the saved profile until they reconnect. */restored?:boolean;profile:Profile;send:(event:ServerEvent)=>void;connected:boolean;roomId:string|null;arenaOpen:boolean;channel:number;x:number;y:number;targetX:number;targetY:number;lastSeen:number;lastWalk:number;lastAim?:number;lastFace?:number;/** The client shows the loading screen and reports its progress before a battle. */loadingScreen?:boolean;/** Praça Celeste or the Pescaria (undefined = the plaza). */zone?:Zone;/** Casting at a spot of the Pescaria. */fishing?:FishingSession;/** Automatic fishing stays on between casts (AFK). */fishAuto?:boolean;/** Manual bars in a row that ran out without a single press: the line stops recasting at FISHING_IGNORED_STOP. */fishIgnored?:number;/** The running automatic session's tally (AutoFishingSummary), sent when automatic mode is switched off. */fishAutoRun?:AutoFishingSummary;/** Moved or changed fishing pose since the last `lobby-moves`. */lobbyDirty?:boolean;}
interface PendingImpact {at:number;projectileIndex:number;hits:ShotHit[];mark:TerrainMark;flight?:boolean;/** Gelo's ice ball: freezes, never digs or hurts. */ice?:boolean;fragment?:boolean;/** The pet's attack after the shot (no projectile): the shot-end trigger at this point. */petStrike?:{x:number;y:number};/** Raiva base of each hit, by target: the hit without its critical part (DDTank damageAmount, never the shown total). */rage?:Record<string,number>;}
/** Index of the pet's after-shot attack in the impact events (never a real projectile). */
const PET_STRIKE_INDEX=1000;
/** How long the pet's area attack plays before the turn may move on. */
const PET_STRIKE_MS=900;
interface PendingRoomInvitation {invite:RoomInvitation;playerId:string;}
/** An expedition run: its stages, the current round of the instance turn and the monster turn's timed events. */
/** A Chefão Mundial attempt: damage not yet sent to the global life and the dragon's timed blows. */
interface WorldBossRun {occurrenceId:string;pending:number;events:{at:number;run:()=>void}[];last?:DragonAction;}
interface ExpeditionRun {expedition:string;difficulty:Difficulty;stages:readonly StageDef[];stage:number;order:string[];round:InstanceRound;events:{at:number;run:()=>void}[];won?:boolean;}
/** How long a dropped player keeps their place: the whole match while it runs (up to 5 min away), a bit longer after a restart. */
const RECONNECT_MS=30000,RESTORED_RECONNECT_MS=120000,MATCH_RECONNECT_MS=300000;
/** A match as saved for a restart: plain JSON, without the terrain (saved apart, only when it changes) or the timed events of a shot. */
export type SavedMatch=Omit<Match,'terrain'|'invisibilityActivated'|'pendingImpacts'|'activeShot'|'pendingPower'|'savingRewards'|'instance'>&{invisibilityActivated?:[string,number][];instance?:Omit<ExpeditionRun,'events'>};
export interface SavedGame {savedAt:number;nextRoomNumber:number;rooms:Room[];roomMatches:[string,string][];peers:{id:string;roomId:string;channel:number;profile:Profile}[];}
const ROOM_INVITE_TTL_MS=60000,ROOM_INVITE_SEND_MS=2000,ROOM_INVITE_PAIR_MS=30000,ROOM_INVITE_LIST_MS=1000,ONLINE_LIST_MS=2000,ONLINE_LIST_LIMIT=100,PLAYER_INFO_MS=300,CHAT_LOG_LIMIT=300;
/** One cast at a spot: waiting for a bite, the bar, then the result on screen. */
interface FishingSession {spot:FishingSpot;phase:FishingPhase;since:number;biteAt:number;/** The rod this cast was thrown with (its prizes are rolled on the catch). */rod:string;fish?:Fish;challenge?:FishChallenge;start:number;press:number;misses:number;grades:PressGrade[];resolveAt:number;settling?:boolean;result?:FishingView['result'];}
/** Rooms, matches and hall sessions open only from Praça Celeste: the Pescaria has to walk back first. */
const PLAZA_ONLY_COMMANDS=new Set<Command['type']>(['create','create-expedition','join','spectate','world-boss-enter']);
const SPECTATOR_BLOCKED_COMMANDS=new Set<Command['type']>(['expedition-select','ability-loadout','ready','queue','cancel-queue','start','practice-start','room-gvg','bot','room-slot','room-rename','kick','room-spectator-slot','spectator-kick','room-invite','room-invite-list','power','ability','flight','boost','aim','walk','face','fire','pass','reward-pick','rematch','pet-skill']);
/** What the game reads from the Hall da Fama (tests use a fake). */
export interface HallService {
 board(viewerId:string,q:{category:HallCategory;period?:HallPeriod;board?:GuildBoard;page?:number}):Promise<HallBoard>;
 profile(playerId:string):Promise<HallPlayerProfile|null>;
 guildProfile(guildId:number):Promise<HallGuildProfile|null>;
 legends(board:LegendBoard,key?:string):Promise<HallLegends>;
}
const HALL_MIN_MS=150;
interface Match {key:string;roomIds:string[];practiceParty?:boolean;invisibilityActivated?:Map<string,number>;pendingPower?:{playerId:string;angle:number;power:number;at:number};state:Battle;terrain:Uint8Array;resolveAt:number;botAt:number;createdAt:number;rewardDeck?:CardPrize[];savingRewards?:boolean;retryRewardsAt?:number;activeShot?:Shot;pendingImpacts?:PendingImpact[];instance?:ExpeditionRun;worldBoss?:WorldBossRun;/** Practice (bots or a practice room): pets earn nothing unless PET_CONFIG.battles.practice. */practice?:boolean;/** Turn whose pet end-of-turn effects already ran. */petTurnEnded?:number;/** GvG battle: the guild of team 0 and of team 1; the winners add Riqueza to theirs. */gvg?:[number,number];/** When the last blow landed: the official end the Hall da Fama files the battle under. */finishedAt?:number;/** When the turn's player started holding the force bar (shared/forceBar.ts `chargeHoldsTurn`). */chargingSince?:number;/** Who fired this turn: earns POWER_ATTACK_CHARGE once, after the last projectile of the shot lands (shotRage). */shotRage?:string;}

/** A loading screen in progress: `begin` creates the battle from the rooms as they are when everyone is ready. */
interface PendingLoad {view:MatchLoading;roomIds:string[];waiting:Set<string>;begin:()=>void;}
export class Game {
 peers=new Map<string,Peer>();rooms=new Map<string,Room>();matches=new Map<string,Match>();
 /** Loading screens open between finding a match and its battle, by id, and which one each room waits on. */
 private loads=new Map<string,PendingLoad>();private roomLoads=new Map<string,string>();
 // Parties keep their identity throughout a match; opponents are never merged into a room.
 private nextRoomNumber=1;private roomMatches=new Map<string,string>();private queueIds=new Set<string>();private profileChanges=new Set<string>();
 private lastTick=Date.now();private lobbyTick=0;private roomsDirty=false;private arenaPopulation=0;
 private ranking:RankingEntry[]=[];private rankingAt=0;private rankingLoading:Promise<void>|null=null;
 /** The week's heaviest fish (Pescaria), refreshed with the podium and after catches that change it. */
 private fishRanking:FishRanking={week:fishingWeek(Date.now()),entries:[]};private fishRankingLoading:Promise<void>|null=null;
 /** Where reports go (the admin panel's store); without it reports are refused. */
 reports?:ReportSink;
 /** Player mail (server/mail.ts); without it the inbox stays empty. */
 mail?:MailBox;
 /** The Leilão (server/auction.ts); without it the auction house is closed. */
 auction?:AuctionHouse;
 /** Guildas (server/guilds.ts); without it guilds are closed. */
 guilds?:GuildHall;
 /** Pets (server/pets.ts); without it the pet window stays empty and battles run without pets. */
 pets?:PetKeeper;
 /** Server roll for pet skill chances, uniform in [0, 1). */
 petRoll:()=>number=()=>randomInt(1_000_000)/1_000_000;
 /** Hall da Fama (server/hall.ts); without it the hall is closed. */
 hall?:HallService;
 private hallAt=new Map<string,number>();private hallQueued=new Map<string,Command>();
 /** Chefão Mundial (server/worldBoss.ts); without it the event never opens. */
 worldBoss?:WorldBossRealm;
 /** Damage waiting to reach the global life, in order; each entry has its own ledger key, so a retry counts once. */
 private worldBossQueue:WorldBossDamage[]=[];private worldBossFlushing=false;private worldBossRetryAt=0;private worldBossDirty=false;private worldBossSentAt=0;private worldBossRankingAt=new Map<string,number>();
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
  send({type:'welcome',profile:p.profile,players:this.lobby(p.channel,p.zone),rooms:this.publicRooms(),room:room??null,battle:match?this.snapshot(match,true,profile.id):null,serverTime:Date.now(),channel:p.channel,zone:p.zone??'plaza',arenaOnline:this.countArena(),ranking:this.ranking,fishRanking:this.fishRanking,...(this.worldBoss?{worldBoss:this.worldBoss.status()}:{})});
  const load=room?this.loads.get(this.roomLoads.get(room.id)??''):undefined;if(load)this.emit(p,{type:'loading',loading:load.view});
  this.pruneInvitations();for(const pending of this.roomInvitations.values())if(pending.playerId===profile.id)this.emit(p,{type:'room-invitation',invite:{...pending.invite}});
  this.sendLobby(p.channel);this.publishArenaPopulation();void this.sendInbox(p).catch(this.report);void this.sendAuctionMine(p).catch(this.report);void this.refreshGuildMember(profile.id).catch(this.report);void this.sendPets(p).catch(this.report);return p;
 }
 // ── Pescaria (shared/fishing.ts has the numbers, server/fishing.ts the profile changes) ──
 /** Walks through the gate: the plaza and the Pescaria each list only their own walkers. */
 private changeZone(p:Peer,zone:Zone){
  if(p.roomId)throw Error('Saia da sala antes de ir para outro lugar.');
  if((p.zone??'plaza')===zone)return;
  // Nothing of the Pescaria follows the player out: the line, and automatic mode (the HUD comes back in manual).
  this.stopFishing(p,false);delete p.fishing;this.endAutoRun(p);delete p.fishAuto;
  const spawn=zone==='fishing'?FISHING_SPAWN:LOBBY_SPAWN;
  p.zone=zone==='plaza'?undefined:zone;p.x=p.targetX=spawn.x-40+Math.random()*80;p.y=p.targetY=spawn.y;
  this.emit(p,{type:'zone',zone,players:this.lobby(p.channel,zone)});this.sendLobby(p.channel);
 }
 /** Automatic mode switched off (or the player left the Pescaria): the run's summary window. */
 private endAutoRun(p:Peer){
  const run=p.fishAutoRun;delete p.fishAutoRun;if(!run||!p.connected)return;
  this.emit(p,{type:'fish-auto-summary',summary:{...run,fish:{...run.fish},until:Date.now()}});
 }
 private fishingView(f:FishingSession,auto:boolean):FishingView{
  return {spot:f.spot.id,phase:f.phase,auto,since:f.since,...(f.challenge&&f.phase==='bite'?{challenge:{...f.challenge,start:f.start,press:f.press,misses:f.misses,grades:[...f.grades]}}:{}),...(f.result?{result:f.result}:{})};
 }
 private emitFishing(p:Peer){this.emit(p,{type:'fishing',fishing:p.fishing?this.fishingView(p.fishing,!!p.fishAuto):null});}
 private castLine(p:Peer,spotId:string){
  if(p.zone!=='fishing'||p.roomId)throw Error('Vá até a Pescaria para pescar.');
  if(!this.store.fishSettle)throw Error('A pescaria está indisponível no momento.');
  const spot=FISHING_SPOTS.find(s=>s.id===spotId);if(!spot)throw Error('Esse lugar não dá para pescar.');
  if(Math.hypot(p.x-spot.x,p.y-spot.y)>SPOT_REACH)throw Error('Chegue mais perto da água.');
  const f=p.fishing;
  if(f&&f.spot.id!==spot.id)this.stopFishing(p,false);
  if(f&&(f.settling||f.phase==='waiting'||f.phase==='bite'))return;
  for(const other of this.peers.values())if(other!==p&&other.connected&&other.fishing?.spot.id===spot.id&&other.channel===p.channel)throw Error('Alguém já está pescando aí.');
  const fishing=normalizeFishing(p.profile.fishing),rod=ROD_BY_ID.get(fishing.rod)!,now=Date.now();
  p.x=p.targetX=spot.x;p.y=p.targetY=spot.y;
  p.fishing={spot,phase:'waiting',since:now,biteAt:now+biteWaitMs(rod,!!p.fishAuto,this.fishRoll()),rod:rod.id,start:0,press:0,misses:0,grades:[],resolveAt:0};
  this.emitFishing(p);this.sendLobby(p.channel);
 }
 /** Server roll for fishing, uniform in [0, 1). */
 fishRoll:()=>number=()=>randomInt(1_000_000)/1_000_000;
 private stopFishing(p:Peer,announce=true){
  const f=p.fishing;if(!f)return;
  // A bar already being saved finishes on its own.
  if(f.settling)return;
  delete p.fishing;
  if(f.phase==='bite')void this.settleFish(p,f,false,0,true).catch(this.report);
  if(announce){this.emitFishing(p);this.sendLobby(p.channel);}
 }
 private pressBar(p:Peer,at:number){
  const f=p.fishing;if(!f||f.phase!=='bite'||f.settling||!f.challenge||p.fishAuto)return;
  const now=Date.now(),stamp=Math.max(now-PRESS_GRACE_MS,Math.min(now,at));
  if(stamp<f.start)return;
  const grade=gradePress(f.challenge,f.press,stamp-f.start);f.grades.push(grade);delete p.fishIgnored;
  if(grade==='miss'){f.misses++;if(f.misses>=f.challenge.misses){void this.settleFish(p,f,false,0).catch(this.report);return;}}
  else{f.press++;if(f.press>=f.challenge.hits){const quality=f.grades.filter(g=>g==='perfect').length/f.challenge.hits;void this.settleFish(p,f,true,quality).catch(this.report);return;}}
  this.emitFishing(p);
 }
 /** Advances one player's cast; true when what others see changed. */
 private tickFishing(p:Peer,now:number):boolean{
  const f=p.fishing!;if(f.settling)return false;
  if(f.phase==='waiting'&&now>=f.biteAt){
   const fishing=normalizeFishing(p.profile.fishing),rod=effectiveRod(ROD_BY_ID.get(fishing.rod)!,fishingLevel(fishing.xp));
   f.fish=pickFish(f.spot.fish,rod,this.fishRoll());f.challenge=fishChallenge(f.fish,rod,randomInt(2**31));
   f.phase='bite';f.since=now;f.start=now+HOOK_LEAD_MS;f.resolveAt=now+AUTO_BASE_MS+AUTO_PER_HIT_MS*f.challenge.hits;
   this.emitFishing(p);return true;
  }
  if(f.phase==='bite'&&f.challenge&&f.fish){
   if(p.fishAuto&&now>=f.resolveAt){const fishing=normalizeFishing(p.profile.fishing),rod=effectiveRod(ROD_BY_ID.get(fishing.rod)!,fishingLevel(fishing.xp));void this.settleFish(p,f,this.fishRoll()<autoChance(f.fish,rod),AUTO_QUALITY,false,true).catch(this.report);return false;}
   if(!p.fishAuto&&now>f.start+f.challenge.limitMs){if(!f.grades.length)p.fishIgnored=(p.fishIgnored??0)+1;void this.settleFish(p,f,false,0).catch(this.report);return false;}
  }
  if(f.phase==='result'&&now>=f.since+RESULT_MS){
   // Walked off while the catch was being saved.
   if(Math.hypot(p.x-f.spot.x,p.y-f.spot.y)>SPOT_REACH){delete p.fishing;this.emitFishing(p);return true;}
   // Pedido do matheus (20/10): pegou ou escapou, a linha volta para a água sozinha, à mão e no automático.
   // Só para quando a barra à mão passa FISHING_IGNORED_STOP vezes seguidas sem nenhum toque (o jogador saiu).
   if(p.connected&&(p.fishAuto||(p.fishIgnored??0)<FISHING_IGNORED_STOP)){delete p.fishing;try{this.castLine(p,f.spot.id);}catch(e){this.emit(p,{type:'error',message:e instanceof Error?e.message:'Não foi possível lançar a linha.'});this.emitFishing(p);}return true;}
   delete p.fishIgnored;f.phase='idle';f.since=now;delete f.result;delete f.fish;delete f.challenge;this.emitFishing(p);return true;
  }
  return false;
 }
 /** Saves the end of a cast (catch, points, EXP, the rod's prizes) and shows the result. */
 private async settleFish(p:Peer,f:FishingSession,success:boolean,quality:number,silent=false,auto=false){
  if(f.settling)return;f.settling=true;
  const fish=f.fish;let caught,prize,prizeXp=0,prizeLevel:number|undefined;
  try{
   const kg=fish&&success?fishWeight(fish,this.fishRoll(),quality):0;
   const drops=fish&&success?rollRodDrops(ROD_BY_ID.get(f.rod)??ROD_BY_ID.get(STARTER_ROD)!,auto,this.fishRoll):[];
   const outcome=await this.store.fishSettle!(p.profile.id,{...(drops.length?{drops}:{}),...(auto?{auto:true}:{}),...(fish&&success?{fish:{id:fish.id,kg,...(auto?autoReward(fish,kg):{points:catchPoints(fish,kg,quality),xp:catchXp(fish,kg)})}}:{})});
   p.profile=outcome.profile;caught=outcome.catch;prize=outcome.prize;prizeXp=outcome.xp??0;prizeLevel=outcome.levelUp;this.emit(p,{type:'profile',profile:p.profile});
   const run=auto?p.fishAutoRun:undefined;
   if(run){run.casts++;
    if(prize){run[prize.kind]+=prize.amount;run.xp+=outcome.xp??0;}
    else if(caught){run.fish[caught.fish]=(run.fish[caught.fish]??0)+1;run.points+=caught.points;run.xp+=caught.xp;if(!run.best||caught.kg>run.best.kg)run.best={fish:caught.fish,kg:caught.kg};}
    else run.missed++;}
   // A new heaviest fish of the week for this player: the ranking changes when it makes the top or the player is on it.
   const r=outcome.weekRecord,board=this.fishRanking;
   if(r&&(r.week!==board.week||board.entries.length<FISH_RANKING_SIZE||r.kg>board.entries[board.entries.length-1].kg||board.entries.some(e=>e.id===p.profile.id)))void this.refreshFishRanking();
   // Épico e Lendário: o canal inteiro fica sabendo, no chat Mundo.
   const announce=(text:string)=>{const line:ChatLine={id:randomUUID(),name:'Pescaria',text,channel:'world',time:Date.now()};
    for(const peer of this.peers.values())if(peer.connected&&peer.channel===p.channel)this.emit(peer,{type:'chat',message:line});};
   if(caught&&fish&&fishRarity(fish).announce){const r=fishRarity(fish);announce(`${p.profile.name} pescou ${fish.name} (${r.name}, ${caught.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg)!`);}
   // Cupons e Fragmentos são raros: também vão para o chat Mundo.
   for(const d of prize?[prize]:[])if(d.kind!=='gold')announce(`${p.profile.name} pescou ${d.amount} ${d.kind==='coupons'?(d.amount===1?'Cupom':'Cupons'):d.amount===1?'Fragmento da Vara das Marés':'Fragmentos da Vara das Marés'}!`);
  }catch(e){this.report(e);success=false;}
  finally{f.settling=false;}
  if(silent||p.fishing!==f)return;
  f.phase='result';f.since=Date.now();f.result={success:!!(caught||prize),...(caught?{catch:caught}:{}),...(prize?{prize,xp:prizeXp,...(prizeLevel?{levelUp:prizeLevel}:{})}:{}),...(fish?{fish:fish.id}:{})};
  this.emitFishing(p);this.sendLobby(p.channel);
 }
 private requirePets(){if(!this.pets)throw Error('Os pets estão indisponíveis no momento.');return this.pets;}
 /** One-time pet gifts (the starter pet, shared/petContent.ts); the server entry sets them. */
 petGifts:readonly {key:string;species:string;food?:Readonly<Record<string,number>>}[]=[];
 private async sendPets(p:Peer){
  if(!this.pets||!p.connected)return;
  for(const gift of this.petGifts)if(!p.profile.petGifts?.includes(gift.key)){const outcome=await this.pets.gift(p.profile.id,{...gift,food:{...gift.food}});if(outcome){this.petOutcome(p,outcome);return;}}
  this.emit(p,{type:'pets',...await this.pets.list(p.profile.id)});
 }
 /** A pet action or battle result: the new profile (its equipment carries the active pet), the list, the result; the room sees the new look and stats. */
 private petOutcome(p:Peer,outcome:PetOutcome){
  p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'pets',...outcome.state});this.emit(p,{type:'pet-result',result:outcome.result});
  const room=p.roomId?this.rooms.get(p.roomId):undefined,seat=room?.players.find(s=>s.id===p.profile.id);
  if(room&&seat&&room.status!=='playing'){seat.equipment={...p.profile.equipment};this.broadcastRoom(room);}
  if(!p.roomId)this.sendLobby(p.channel);
 }
 // ── Pets in battle (shared/petSkills.ts does the rules; here they meet the match) ──
 private petContext(m:Match):PetEngineContext{
  return {fighters:m.state.players,mode:m.instance?'pve':'pvp',roll:this.petRoll,attackOf:f=>attributes(this.combatEquipment(f as Fighter),f.level).attack,
   // Only the fighter who takes the damage gains raiva (DDTank Player.TakeDamage); dealing it earns nothing.
   onDamage:(target,amount)=>{const t=target as Fighter;if(t.hp<=0)t.powerArmed=false;else chargeOnDamage(t,amount);}};
 }
 /** The fighter's equipment with this battle's pet attribute changes, for one calculation. */
 private combatEquipment(f:Fighter){const buffs=petStatBuffs(f);return buffs?{...f.equipment,battleBuffs:buffs}:f.equipment;}
 private petEffect(m:Match,applications:PetApplication[]){if(!applications.length)return;const at=Date.now();for(const peer of this.matchPeers(m))this.emit(peer,{type:'pet-effect',battleId:m.state.id,at,applications});}
 /** Battle start: each fighter's equipped, active pet gets its battle state (no pet: the fighter is untouched). */
 private armPets(m:Match,first:Fighter|undefined){
  const mode=m.instance?'pve':'pvp';let any=false;
  for(const f of m.state.players){if(f.bot||f.monster)continue;const snapshot=f.equipment.pet;if(!snapshot||snapshot.vitality<=0)continue;const pet=createBattlePet({petId:snapshot.id,species:snapshot.species,stage:snapshot.stage,skills:snapshot.skills},mode);if(pet){f.pet=pet;any=true;}}
  if(!any)return;const ctx=this.petContext(m);
  this.petEffect(m,[...dispatchAll(ctx,'battle-start'),...(first?petTurnStart(ctx,first):[])]);
 }
 private petTrigger(m:Match,trigger:PetTrigger,owner:Fighter,info:Parameters<typeof dispatchPetTrigger>[3]={},ctx=this.petContext(m)){return owner.pet?dispatchPetTrigger(ctx,trigger,owner,info):[];}
 /** End of the turn that just ran: lingering effects tick on whoever played (the monsters together on their turn). Once per turn. */
 private petTurnEnd(m:Match){
  const s=m.state;if(m.petTurnEnded===s.turnNumber||s.phase==='finished')return;m.petTurnEnded=s.turnNumber;
  const carriers=s.turnId===MONSTER_TURN_ID?s.players.filter(f=>f.monster):s.players.filter(f=>f.id===s.turnId);
  if(!carriers.some(f=>f.pet||f.petEffects?.length))return;
  const ctx=this.petContext(m);this.petEffect(m,carriers.flatMap(f=>petTurnEnd(ctx,f)));
 }
 private petTurnStart(m:Match,f:Fighter){if(f.pet||f.petEffects?.length)this.petEffect(m,petTurnStart(this.petContext(m),f));}
 /** A pet skill or debuff can keep a fighter from acting. */
 private assertPetFree(f:Fighter,action:PetBlockedAction){if(f.petEffects?.length&&petBlocked(f,action))throw Error('Um efeito impede esta ação neste turno.');}
 private usePetSkill(m:Match,f:Fighter,skill:string,target?:string){
  // A pet projectile replaces the shot: it never mixes with tools, POW, flight or homing.
  const slot=f.pet?.skills.find(s=>s.id===skill);
  if(slot&&armsSpecialShot(skill,slot.level)&&(f.boosts.length||f.powerArmed||f.homingArmed||f.flightArmed||specialShot(f)))throw Error('Este ataque do pet não combina com outros poderes neste turno.');
  const {applications}=activatePetSkill(this.petContext(m),f,skill,target);
  this.petEffect(m,applications);if(!this.checkWin(m))this.broadcastBattle(m);
 }
 /** Events of the hits that just landed, for the pets that listen (once per projectile; skills limit themselves per shot). */
 private petHits(m:Match,shooter:Fighter,shotId:string,hits:(ShotHit&{dealt:number;died:boolean})[]){
  if(!m.state.players.some(f=>f.pet))return;
  const ctx=this.petContext(m),out:PetApplication[]=[];
  for(const hit of hits){
   const target=m.state.players.find(f=>f.id===hit.id);if(!target)continue;
   const info={sourceId:shooter.id,targetId:target.id,amount:hit.dealt,critical:hit.critical,shotId};
   if(hit.dealt>0&&target.team!==shooter.team){out.push(...this.petTrigger(m,'hit',shooter,info,ctx),...this.petTrigger(m,'damage-dealt',shooter,info,ctx));if(hit.critical)out.push(...this.petTrigger(m,'critical',shooter,info,ctx));}
   if(hit.dealt>0){out.push(...this.petTrigger(m,'damaged',target,info,ctx),...this.petTrigger(m,'hp-below',target,info,ctx));if(hit.critical)out.push(...this.petTrigger(m,'critical-received',target,info,ctx));}
   if(hit.shield)out.push(...this.petTrigger(m,'absorbed',target,{...info,amount:hit.shield},ctx));
   if(hit.died){out.push(...this.petTrigger(m,'kill',shooter,info,ctx));for(const ally of m.state.players.filter(f=>f.team===target.team&&f.id!==target.id&&f.hp>0))out.push(...this.petTrigger(m,'ally-died',ally,info,ctx));}
  }
  if(new Set(hits.filter(h=>h.dealt>0).map(h=>h.id)).size>=2)out.push(...this.petTrigger(m,'multi-hit',shooter,{sourceId:shooter.id,shotId},ctx));
  this.petEffect(m,out);
 }
 /** End of a battle: EXP and vitality for the pets that fought (once per battle and pet, see PetStore ledger). */
 private async settlePets(m:Match,humans:Fighter[]){
  if(!this.pets||m.practice&&!PET_CONFIG.battles.practice)return;
  const run=m.instance,entries:BattlePetEntry[]=humans.filter(f=>f.pet&&f.equipment.pet).map(f=>({ownerId:f.id,petId:f.equipment.pet!.id,mode:run?'pve':'pvp',won:run?!!run.won:f.team===m.state.winner}));
  if(!entries.length)return;
  for(const [ownerId,outcome] of await this.pets.settleBattle(m.state.id,entries)){const peer=this.peers.get(ownerId);if(peer){peer.profile=outcome.profile;this.emit(peer,{type:'pets',...outcome.state});this.emit(peer,{type:'pet-result',result:outcome.result});}}
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
 private async sendGuild(p:Peer){
  if(!this.guilds||!p.connected)return;const state=await this.guilds.state(p.profile.id);
  if(state.guild)state.guild.members=state.guild.members.map(m=>({...m,online:!!this.peers.get(m.id)?.connected}));
  this.emit(p,{type:'guild',...state});
 }
 /** Daily guild missions: counts for the members among these players and refreshes their window. Never throws,
  * so a hiccup here cannot replay a battle's rewards. */
 private async guildMission(playerIds:string[],mission:GuildMissionId,amount=1){
  if(!this.guilds)return;const members=playerIds.filter(id=>this.memberships.get(id));if(!members.length)return;
  try{for(const id of await this.guilds.missionProgress(members,mission,amount)){const peer=this.peers.get(id);if(peer)await this.sendGuild(peer);}}catch(error){this.report(error);}
 }
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
 disconnect(id:string){const p=this.peers.get(id);if(!p)return;p.connected=false;if(p.fishing&&!p.fishing.settling)delete p.fishing;p.arenaOpen=false;p.lastSeen=Date.now();if(p.roomId){const r=this.rooms.get(p.roomId);const s=r?.players.find(x=>x.id===id);if(s){s.connected=false;s.ready=false;}const observer=r?.spectators?.find(x=>x.id===id);if(observer)observer.connected=false;const fighter=this.matchForRoom(p.roomId)?.state.players.find(s=>s.id===id);if(fighter)fighter.connected=false;if(r){if(!observer)this.cancelSearch(r);this.broadcastRoom(r);}}this.pruneInvitations();this.sendLobby(p.channel);this.publishArenaPopulation();}
 /** A fighter of a running match keeps their place while away (their turns just time out); anyone else has 30 s. */
 private reconnectWindow(p:Peer){
  const m=p.roomId?this.matchForRoom(p.roomId):undefined,fighter=m?.state.players.find(f=>f.id===p.profile.id);
  if(m&&m.state.phase!=='finished'&&fighter&&!fighter.left)return MATCH_RECONNECT_MS;
  return p.restored?RESTORED_RECONNECT_MS:RECONNECT_MS;
 }
 /** Everything a restart must keep: rooms, who sits where and each match as of its last stable moment.
  * A match in the middle of a shot is left out (`stable:false`) so the saved copy stays at the start of that turn. */
 savedState(now=Date.now()){
  // A Chefão Mundial attempt is not kept: its damage is already in Postgres and the player comes back to the plaza.
  const kept=this.publicRooms(),keptIds=new Set(kept.map(room=>room.id));
  const game:SavedGame={savedAt:now,nextRoomNumber:this.nextRoomNumber,rooms:kept,roomMatches:[...this.roomMatches].filter(([roomId])=>keptIds.has(roomId)),
   peers:[...this.peers.values()].filter(p=>p.roomId&&keptIds.has(p.roomId)).map(p=>({id:p.profile.id,roomId:p.roomId!,channel:p.channel,profile:p.profile}))};
  const matches=[...this.matches.values()].filter(m=>!m.worldBoss).map(m=>{
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
   // A terrain saved before the fine 1px grid is expanded from its 3px cells.
   const m:Match={...rest,terrain:upgradeTerrain(saved.terrain,getMap(s.map).dimensions.width),resolveAt:0,...(invisibilityActivated?{invisibilityActivated:new Map(invisibilityActivated)}:{}),...(instance?{instance:{...instance,events:[]}}:{})};
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
 lobby(channel:number,zone:Zone='plaza'):LobbyPlayer[]{return [...this.peers.values()].filter(p=>p.connected&&!p.roomId&&p.channel===channel&&(p.zone??'plaza')===zone).map(p=>{const fishing=this.fishingPose(p);return {id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:p.profile.equipment,x:p.x,y:p.y,...(fishing?{fishing}:{})};});}
 private fishingPose(p:Peer):FishingPose|null{return p.fishing?{spot:p.fishing.spot.id,phase:p.fishing.phase,since:p.fishing.since,...(p.fishAuto?{auto:true}:{}),...(p.fishing.result?{success:p.fishing.result.success,...(p.fishing.result.catch?{fish:p.fishing.result.catch.fish}:{})}:{})}:null;}
 /**
  * The walking tick sends only who moved or changed fishing pose, to the walkers of the same channel and zone: the full
  * list (outfits included) every 100 ms grew with the square of the players in a crowded Pescaria (docs/performance.md).
  */
 private sendMoves(){
  const groups=new Map<string,LobbyMove[]>();
  for(const p of this.peers.values()){if(!p.lobbyDirty)continue;delete p.lobbyDirty;if(!p.connected||p.roomId)continue;
   const key=`${p.channel}:${p.zone??'plaza'}`;let list=groups.get(key);if(!list){list=[];groups.set(key,list);}
   list.push({id:p.profile.id,x:Math.round(p.x),y:Math.round(p.y),fishing:this.fishingPose(p)});}
  if(!groups.size)return;
  for(const p of this.peers.values()){const moves=!p.roomId&&groups.get(`${p.channel}:${p.zone??'plaza'}`);if(moves)this.emit(p,{type:'lobby-moves',moves});}
 }
 private emit(p:Peer,e:ServerEvent){if(p.connected)p.send(e);}
 private sendLobby(channel:number){const lists=new Map<Zone,LobbyPlayer[]>();const online=[...this.peers.values()].filter(p=>p.connected).length;for(const p of this.peers.values())if(p.channel===channel&&!p.roomId){const zone=p.zone??'plaza';if(!lists.has(zone))lists.set(zone,this.lobby(channel,zone));this.emit(p,{type:'lobby',players:lists.get(zone)!,online});}}
 private broadcastRooms(){const rooms=this.publicRooms();for(const p of this.peers.values())this.emit(p,{type:'rooms',rooms});this.roomsDirty=false;}
 /** Rooms listed in the halls: a Chefão Mundial attempt is a hidden solo room. */
 private publicRooms(){return [...this.rooms.values()].filter(room=>room.kind!=='world-boss');}
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
  // The mark history travels with the terrain (full snapshots): the client adds the marks of live impacts itself, in order.
  const {terrainMarks,...state}=m.state;
  return {...state,players,...(withTerrain?{terrainMarks:[...(terrainMarks??[])],terrain:Buffer.from(packTerrain(m.terrain)).toString('base64'),...(m.activeShot?{activeShot:this.visibleShot(m,m.activeShot,viewer)}:{})}:{})};
 }
 private abilityEffect(m:Match,effect:AbilityEffect){for(const peer of this.matchPeers(m))this.emit(peer,{type:'ability-effect',...effect,...(this.hiddenFrom(m,effect.playerId,peer.profile.id)?{hidden:true,x:HIDDEN_POSITION,y:HIDDEN_POSITION}:{})});}
 private room(p:Peer){const room=p.roomId?this.rooms.get(p.roomId):undefined;if(!room)throw Error('Entre em uma sala primeiro.');return room;}
 /** The caller's own living fighter while a match is aiming, whoever has the turn. */
 /** The caller's live fighter; turning in place may skip the aiming check and also works while a shot resolves or the monsters move. */
 private fighter(p:Peer,anyPhase=false){const room=this.room(p),m=this.matchForRoom(room.id);if(!m||m.state.phase==='finished'||!anyPhase&&m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');const f=m.state.players.find(x=>x.id===p.profile.id);if(!f)throw Error('Você está assistindo a esta partida.');if(f.hp<=0||f.left)throw Error('Seu personagem está fora de combate.');if(f.fall&&Date.now()<f.fall.startedAt+f.fall.duration)throw Error('Aguarde seu personagem pousar.');return {m,f};}
 private turn(p:Peer,holdable=false){const room=this.room(p),m=this.matchForRoom(room.id);if(!m||m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');if(m.state.turnId!==p.profile.id)throw Error('Aguarde a sua vez.');if(m.state.instance&&Date.now()<m.state.instance.introUntil)throw Error('Aguarde os monstros chegarem.');const f=m.state.players.find(x=>x.id===p.profile.id);if(Date.now()>m.state.deadline&&!(holdable&&this.chargeHeld(m,Date.now())))throw Error('O tempo do turno terminou.');if(!f)throw Error('Você está assistindo a esta partida.');if(f.hp<=0)throw Error('Seu personagem está fora de combate.');if(f.fall&&Date.now()<f.fall.startedAt+f.fall.duration)throw Error('Aguarde seu personagem pousar.');return {m,f};}
 /** A charge started before the clock ran out keeps the turn open until the release (capped by CHARGE_HOLD_MS). */
 private chargeHeld(m:Match,now:number){const f=m.state.players.find(x=>x.id===m.state.turnId);return m.state.phase==='aiming'&&!!f?.charging&&chargeHoldsTurn(m.state.deadline,m.chargingSince,now);}
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
  for(const rates of [this.inviteSentAt,this.inviteListAt,this.onlineListAt,this.playerInfoAt,this.hallAt])for(const [id,at] of rates)if(now-at>=ROOM_INVITE_PAIR_MS)rates.delete(id);
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
   if(p.zone==='fishing'&&(PLAZA_ONLY_COMMANDS.has(c.type)||c.type==='room-invite-answer'&&c.accept))throw Error('Volte à Praça Celeste para entrar nas salas.');
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
    case 'move':if(!p.roomId){
     const target=p.zone==='fishing'?fishingFree(c.x,c.y):lobbyFree(c.x,c.y);
     // Walking away from the spot reels the line in.
     if(p.fishing&&Math.hypot(target.x-p.fishing.spot.x,target.y-p.fishing.spot.y)>SPOT_REACH)this.stopFishing(p);
     p.targetX=target.x;p.targetY=target.y;}return;
    case 'zone':this.changeZone(p,c.zone);return;
    case 'fish-cast':delete p.fishIgnored;this.castLine(p,c.spot);return;
    case 'fish-press':this.pressBar(p,c.at);return;
    case 'fish-stop':this.stopFishing(p);return;
    case 'fish-auto':{
     if(c.on&&!p.fishAuto)p.fishAutoRun={since:Date.now(),until:0,casts:0,missed:0,fish:{},points:0,xp:0,gold:0,coupons:0,fragments:0};
     if(!c.on)this.endAutoRun(p);
     p.fishAuto=c.on;delete p.fishIgnored;const f=p.fishing;
     if(f&&c.on&&f.phase==='idle')this.castLine(p,f.spot.id);
     // Switching on in the middle of a bar lets the automatic mode finish it.
     else if(f&&c.on&&f.phase==='bite'&&!f.settling)f.resolveAt=Math.max(Date.now()+AUTO_BASE_MS,f.start);
     if(f){this.emitFishing(p);this.sendLobby(p.channel);}return;
    }
    case 'fish-gear':{
     if(!this.store.fishGear)throw Error('A pescaria está indisponível no momento.');
     if(p.fishing&&p.fishing.phase!=='idle'&&p.fishing.phase!=='result')throw Error('Recolha a linha antes de trocar a vara.');
     p.profile=await this.store.fishGear(id,c.rod);this.emit(p,{type:'profile',profile:p.profile});return;
    }
    case 'fish-sell':{
     if(!this.store.fishSell)throw Error('A pescaria está indisponível no momento.');
     if(p.zone!=='fishing')throw Error('Venda os peixes na Pescaria.');
     const outcome=await this.store.fishSell(id,c.ids);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'fish-sell-result',sold:outcome.sold,points:outcome.points});return;
    }
    case 'fish-buy':{
     if(!this.store.fishBuy)throw Error('A pescaria está indisponível no momento.');
     if(p.zone!=='fishing')throw Error('A Casa de Pesca fica na Pescaria.');
     const outcome=await this.store.fishBuy(id,c.offer,c.quantity);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'fish-buy-result',offer:c.offer,quantity:c.quantity,spent:outcome.spent});return;
    }
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
     // Members of a guild with a built Ferreiro reach the forge from the guild window, with its bonus on the chance.
     const guild=this.memberships.get(id);
     if(!guild?.smith&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.forge(id,c.item,c.stones,smithBonus(guild?.smith??0));p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'forge-result',result:outcome.result});this.sendLobby(p.channel);await this.guildMission([id],'forge');return;
    }
    case 'compose':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para compor seu equipamento.');
     const guild=this.memberships.get(id);
     if(!guild?.smith&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.compose(id,c.item,c.stone,smithBonus(guild?.smith??0));p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'composition-result',result:outcome.result});this.sendLobby(p.channel);await this.guildMission([id],'forge');return;
    }
    case 'synthesize':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para sintetizar pedras.');
     const guild=this.memberships.get(id);
     if(!guild?.smith&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     if(!this.store.synthesize)throw Error('Indisponível no momento.');
     const outcome=await this.store.synthesize(id,c.stone,c.count);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'synthesis-result',result:outcome.result});return;
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
    case 'world-boss-enter':this.enterWorldBoss(p);break;
    case 'world-boss-ranking':{
     if(!this.worldBoss)return;const now=Date.now();if(now-(this.worldBossRankingAt.get(id)??-Infinity)<1000)return;this.worldBossRankingAt.set(id,now);
     this.emit(p,{type:'world-boss-ranking',ranking:await this.worldBoss.ranking(id)});return;
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
    case 'spectate':if(this.rooms.get(c.roomId)?.kind==='expedition')throw Error('Expedições não têm espectadores.');if(this.rooms.get(c.roomId)?.kind==='world-boss')throw Error('Esta sala não está disponível para assistir.');this.spectate(p,c.roomId);break;
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
    case 'client-features':p.loadingScreen=c.loading;break;
    case 'loading-progress':this.loadingProgress(p,c.id,c.progress);break;
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
    case 'ability':{const {m,f}=this.turn(p);this.assertPetFree(f,'ability');this.useAbility(m,f,c.ability);this.broadcastBattle(m);break;}
    case 'flight':{const {m,f}=this.turn(p);if(c.active)this.assertPetFree(f,'flight');if(c.active&&(f.boosts.length||f.powerArmed||f.homingArmed))throw Error('Voo não combina com ferramentas, Power ou mira assistida.');f.flightArmed=c.active;f.aimAngle=clampAimAngle(aimSource(f),f.aimSlope??0,f.aimAngle??45);this.broadcastBattle(m);break;}
    case 'power':{const {m,f}=this.turn(p);this.assertPetFree(f,'power');this.armPower(f);this.broadcastBattle(m);break;}
    case 'boost':{const {m,f}=this.turn(p);this.assertPetFree(f,'boost');this.boost(f,c.boost);this.broadcastBattle(m);break;}
    case 'aim':{
     const {m,f}=this.turn(p,true);if(Date.now()-(p.lastAim??0)<100)return;p.lastAim=Date.now();
     // Past the deadline only the held bar moves: the charge can neither start nor be dropped there.
     const overtime=Date.now()>m.state.deadline;
     if(!overtime){if(c.charging&&!f.charging)m.chargingSince=Date.now();f.charging=c.charging;}
     adjustAimToTerrain(f,m.terrain);f.aimAngle=clampAimAngle(aimSource(f),f.aimSlope??0,c.angle);f.chargePower=c.power;this.broadcastBattle(m);break;
    }
    case 'walk':{
     const {m,f}=this.turn(p);if(Date.now()-p.lastWalk<WALK_COMMAND_MS*.72)return;p.lastWalk=Date.now();this.assertPetFree(f,'walk');
     // The first press toward the other side only turns around, for free.
     if(f.facing!==c.direction){f.facing=c.direction;adjustAimToTerrain(f,m.terrain);this.broadcastBattle(m);break;}
     // Vigor pays each DDTank step actually taken (shared/physics.ts walkStep): a refused walk costs nothing.
     if(f.stamina<1)throw Error('Vigor insuficiente.');const destination=walkPosition(m.terrain,f,c.direction);if(destination){const fromY=f.y;f.x=destination.x;f.y=destination.y;f.stamina=Math.max(0,f.stamina-destination.steps);if(f.y>WORLD.height){f.y=WORLD.height+150;f.hp=0;}this.animateFall(f,fromY,Date.now());}adjustAimToTerrain(f,m.terrain);if(!this.checkWin(m))this.broadcastBattle(m);break;
    }
    case 'face':{
     // Turning in place costs no stamina and works at any time of the match (anyone's turn, a shot in flight, the monsters' turn); it never moves the fighter.
     const {m,f}=this.fighter(p,true);if(f.facing===c.direction||Date.now()-(p.lastFace??0)<65)return;p.lastFace=Date.now();
     f.facing=c.direction;adjustAimToTerrain(f,m.terrain);this.broadcastBattle(m);break;
    }
    case 'fire':{const {m,f}=this.turn(p,true);this.assertPetFree(f,'fire');adjustAimToTerrain(f,m.terrain);this.fire(m,f,clampAimAngle(aimSource(f),f.aimSlope??0,c.angle),c.power);break;}
    case 'pass':{const {m,f}=this.turn(p,true);f.delay=(f.delay??0)+PASS_DELAY;addPower(f,POWER_PASS_CHARGE);this.nextTurn(m);break;}
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
     const msg={id:randomUUID(),playerId:id,name:p.profile.name,text:c.text,channel:c.channel,time:Date.now(),bubble:p.profile.equipment.bubble};
     if(c.channel==='private'){
      const target=c.to?this.peers.get(c.to):undefined;
      if(!c.to||c.to===id)throw Error('Escolha para quem enviar a mensagem.');
      if(!target?.connected)throw Error('Este jogador não está online agora.');
      const line={...msg,toId:target.profile.id,toName:target.profile.name};this.logChat(id,{at:msg.time,channel:'private',text:c.text,to:target.profile.name});
      this.emit(p,{type:'chat',message:line});this.emit(target,{type:'chat',message:line});
     }
     else if(c.channel==='room'){const r=this.room(p);this.logChat(id,{at:msg.time,channel:'room',text:c.text,room:r.number});const m=this.matchForRoom(r.id);const recipients=m&&m.state.phase!=='finished'?this.matchPeers(m):this.roomMembers(r).map(s=>this.peers.get(s.id)).filter((peer):peer is Peer=>!!peer&&peer.roomId===r.id);for(const peer of recipients)this.emit(peer,{type:'chat',message:msg});}
     else if(c.channel==='guild'){
      const mine=this.memberships.get(id);if(!mine)throw Error('Você não está em uma guilda.');this.logChat(id,{at:msg.time,channel:'guild',text:c.text,guild:mine.name});
      for(const peer of this.peers.values())if(peer.connected&&this.memberships.get(peer.profile.id)?.guildId===mine.guildId)this.emit(peer,{type:'chat',message:msg});
     }
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
    case 'pet-list':this.emit(p,{type:'pets',...await this.requirePets().list(id)});return;
    case 'pet-equip':
    case 'pet-unequip':
    case 'pet-rename':
    case 'pet-lock':
    case 'pet-release':
    case 'pet-feed':
    case 'pet-skill-slot':{
     const pets=this.requirePets();
     // The active pet's bonuses enter the battle snapshot: change it only between battles, like the equipment.
     if(p.roomId&&!this.isSpectator(p)&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Cuide dos seus pets entre as batalhas.');
     if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     const worn=c.type==='pet-equip'||c.type==='pet-unequip'||c.type==='pet-feed'||c.type==='pet-skill-slot';
     this.profileChanges.add(id);if(worn&&p.roomId&&!this.isSpectator(p)){const r=this.room(p);this.cancelSearch(r);r.players.forEach(s=>s.ready=s.bot);this.broadcastRoom(r);}
     let outcome:PetOutcome;
     try{
      outcome=c.type==='pet-equip'?await pets.equip(id,c.pet):c.type==='pet-unequip'?await pets.unequip(id,c.pet):c.type==='pet-rename'?await pets.rename(id,c.pet,c.name):c.type==='pet-lock'?await pets.setLocked(id,c.pet,c.locked)
       :c.type==='pet-release'?await pets.release(id,c.pet,c.name):c.type==='pet-feed'?await pets.feed(id,c.pet,c.food,c.quantity):await pets.setSkillSlot(id,c.pet,c.slot,c.skill);
     }finally{this.profileChanges.delete(id);}
     this.petOutcome(p,outcome);return;
    }
    case 'pet-skill':{const {m,f}=this.turn(p);this.usePetSkill(m,f,c.skill,c.target);break;}
    case 'hall-board':case 'hall-profile':case 'hall-guild':case 'hall-legends':{
     // Reading only. Asks closer than HALL_MIN_MS wait their turn and only the latest of each kind is answered,
     // so a client clicking fast never hammers the database and never sees an error for it.
     const hall=this.requireHall(),key=`${id}:${c.type}`,now=Date.now(),wait=HALL_MIN_MS-(now-(this.hallAt.get(key)??-Infinity));
     if(wait>0){const queued=this.hallQueued.has(key);this.hallQueued.set(key,c);if(!queued)setTimeout(()=>{const next=this.hallQueued.get(key);this.hallQueued.delete(key);if(next)void this.command(id,next).catch(()=>{});},wait).unref?.();return;}
     this.hallAt.set(key,now);
     if(c.type==='hall-board')this.emit(p,{type:'hall-board',board:await hall.board(id,{category:c.category,period:c.period,board:c.board,page:c.page})});
     else if(c.type==='hall-profile'){const profile=await hall.profile(c.playerId);if(!profile)throw Error('Jogador não encontrado.');this.emit(p,{type:'hall-profile',profile});}
     else if(c.type==='hall-guild'){const guild=await hall.guildProfile(c.guildId);if(!guild)throw Error('Esta guilda não existe mais.');this.emit(p,{type:'hall-guild',guild});}
     else this.emit(p,{type:'hall-legends',legends:await hall.legends(c.board,c.key)});
     return;
    }
    case 'guild-state':await this.sendGuild(p);return;
    case 'guild-list':this.emit(p,{type:'guild-list',guilds:await this.requireGuilds().list(c.search)});return;
    case 'guild-create':{
     const guilds=this.requireGuilds();if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);try{const outcome=await guilds.create(id,c.name);p.profile=outcome.profile;this.emit(p,{type:'profile',profile:p.profile});}finally{this.profileChanges.delete(id);}
     await this.refreshGuildMember(id);this.emit(p,{type:'guild-result',message:'Guilda fundada!'});return;
    }
    case 'guild-apply':{
     await this.requireGuilds().apply(id,c.id);await this.sendGuild(p);
     // Everyone whose rank may recruit sees the new request.
     await this.refreshGuild(c.id);
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
    case 'guild-rank-set':{const {guildId}=await this.requireGuilds().setRank(id,c.playerId,c.rank);await this.refreshGuild(guildId);this.emit(p,{type:'guild-result',message:'Cargo alterado.'});return;}
    case 'guild-ranks':{const {guildId}=await this.requireGuilds().saveRanks(id,c.ranks);await this.refreshGuild(guildId);this.emit(p,{type:'guild-result',message:'Cargos salvos.'});return;}
    case 'guild-disband':{
     const guilds=this.requireGuilds();if(this.profileChanges.has(id))throw Error('Aguarde a atualização do seu equipamento.');
     this.profileChanges.add(id);let guildId:number,members:string[];
     try{let profile:Profile|null;({guildId,members,profile}=await guilds.disband(id));if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});}}finally{this.profileChanges.delete(id);}
     await this.refreshGuild(guildId,members);
     for(const member of members){const peer=this.peers.get(member);if(peer)this.emit(peer,{type:'guild-result',message:'A guilda foi excluída pelo líder.'});}return;
    }
    case 'guild-mission':{
     const {guildId,reward}=await this.requireGuilds().claimMission(id,c.mission);await this.refreshGuild(guildId);
     this.emit(p,{type:'guild-result',message:`Missão concluída! +${reward} de contribuição e Riqueza para a guilda.`});return;
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
    case 'mail-delete-read':if(!this.mail)throw Error('Correio indisponível no momento.');await this.mail.removeRead(id);await this.sendInbox(p);return;
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
  if(!p.roomId)return;
  // Leaving during the loading screen: the others stop waiting for this player.
  const loadId=this.roomLoads.get(p.roomId);if(loadId){this.leaveRoom(p);this.emit(p,{type:'loading',loading:null});const load=this.loads.get(loadId);if(load){load.waiting.delete(p.profile.id);load.view.players=load.view.players.filter(player=>player.id!==p.profile.id);if(!load.waiting.size)this.finishLoading(load);else this.sendLoading(load);}return;}
  this.leaveRoom(p);
 }
 private leaveRoom(p:Peer){
  if(!p.roomId)return;const r=this.rooms.get(p.roomId),m=this.matchForRoom(p.roomId);
  if(r?.kind==='world-boss'){if(m){if(m.state.phase!=='finished')this.queueWorldBossDamage(m);this.closeWorldBoss(m);}else{this.rooms.delete(r.id);this.detach(p);}return;}
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
 /** Seats as they would play now: two parties face each other, a practice keeps its bots, one room keeps its teams. */
 private matchSeats(rooms:Room[],practiceSeats?:Seat[]):Seat[]{
  if(practiceSeats){const room=rooms[0];return practiceSeats.filter(seat=>seat.bot||room.players.some(player=>player.id===seat.id));}
  return rooms.length===2?rooms.flatMap((room,team)=>[...room.players].sort((a,b)=>a.slot-b.slot).map(s=>({...s,team:team as 0|1}))):rooms[0].players;
 }
 /** Found or started: everyone loads the battle first (the loading screen), then it begins. */
 private launchMatch(rooms:Room[],practiceSeats?:Seat[]){
  const r=rooms[0],rotation=pvpRotation(),map=rooms.length===2||practiceSeats?rotation[randomInt(rotation.length)]:r.map;
  // The match keeps this version of the map even if the admin panel publishes a new one meanwhile.
  const played=pinMap(map),ids=rooms.map(room=>room.id);
  this.openLoading(rooms,{kind:'pvp',map:played,players:this.matchSeats(rooms,practiceSeats).map(seat=>this.loadingPlayer(seat))},()=>{
   const live=ids.map(id=>this.rooms.get(id)).filter((room):room is Room=>!!room);
   const seats=live.length===rooms.length?this.matchSeats(live,practiceSeats):[];
   // Someone left or was too slow: the match still needs a person and both sides filled.
   if(!seats.some(seat=>!seat.bot)||[0,1].some(team=>!seats.some(seat=>seat.team===team)))return;
   this.beginMatch(live,seats,map,played,!!practiceSeats);
  });
 }
 private beginMatch(rooms:Room[],seats:Seat[],map:Room['map'],played:Battle['map'],practiceParty:boolean){
  const r=rooms[0],terrain=createTerrain(played);const fighters:Fighter[]=seats.map(seat=>{const s={...seat,equipment:battleEquipment(seat.equipment)},stats=attributes(s.equipment,s.level);const x=getMap(played).spawns[s.team][s.slot],abilityLoadout=normalizeAbilityLoadout(s.abilityLoadout);return {...s,equipment:structuredClone(s.equipment),abilityLoadout,x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:s.team===0?1:-1,boosts:[],powerCharge:0,powerArmed:false,abilities:initialAbilities(abilityLoadout),homingArmed:false,flightArmed:false,invisibleTurns:0,delay:stats.delay};});
  fighters.forEach(fighter=>adjustAimToTerrain(fighter,terrain));
  // Roster order (Agilidade first) only breaks Delay ties; everyone starts at their base Delay.
  fighters.sort((a,b)=>attributes(b.equipment).agility-attributes(a.equipment).agility);
  // In practice, the human takes the first turn so controls can be learned immediately.
  const first=seats.some(s=>s.bot)?fighters.find(f=>!f.bot)!:nextByDelay(fighters)!;startDelayTurn(fighters,first,this.baseDelay(first));
  const key=this.matches.has(r.id)?randomUUID():r.id;
  const m:Match={key,roomIds:rooms.map(room=>room.id),practiceParty,...(practiceParty||rooms.some(room=>room.practice)?{practice:true}:{}),state:{id:randomUUID(),roomId:r.id,map:played,players:fighters,turnId:first.id,turnNumber:1,wind:this.wind(),deadline:Date.now()+TURN_SECONDS*1000,phase:'aiming',winner:null},terrain,resolveAt:0,botAt:Date.now()+2000,createdAt:Date.now()};
  if(rooms.length===2&&rooms.every(room=>room.gvg)){const guilds=rooms.map(room=>this.partyGuild(room));if(guilds.every(g=>g!==null))m.gvg=guilds as [number,number];}
  this.matches.set(key,m);for(const room of rooms){this.queueIds.delete(room.id);room.status='playing';delete room.searchStartedAt;room.matchStartedAt=m.createdAt;room.map=map;this.roomMatches.set(room.id,key);this.broadcastRoom(room);}this.armPets(m,first);this.broadcastBattle(m,true);
 }
 private loadingPlayer(seat:Seat):LoadingPlayer{return {id:seat.id,name:seat.name,level:seat.level,equipment:structuredClone(battleEquipment(seat.equipment)),team:seat.team,...(seat.bot?{bot:true}:{}),...(seat.guild?{guild:seat.guild}:{}),...(seat.vipLevel?{vipLevel:seat.vipLevel}:{}),progress:seat.bot?100:0};}
 /**
  * Opens the loading screen for these rooms. Only players whose client shows it are waited for (bots and
  * older clients count as loaded); `begin` runs once all of them report 100 %, or at the deadline
  * without the ones still missing, who leave the room and go back to the hall.
  */
 private openLoading(rooms:Room[],view:Omit<MatchLoading,'id'|'deadline'>,begin:()=>void){
  const waiting=new Set(view.players.filter(player=>{const peer=this.peers.get(player.id);return !player.bot&&!!peer?.loadingScreen&&peer.connected&&rooms.some(room=>room.id===peer.roomId);}).map(player=>player.id));
  for(const player of view.players)if(!waiting.has(player.id))player.progress=100;
  if(!waiting.size){begin();return;}
  const load:PendingLoad={view:{...view,id:randomUUID(),deadline:Date.now()+LOADING_SECONDS*1000},roomIds:rooms.map(room=>room.id),waiting,begin};
  this.loads.set(load.view.id,load);
  for(const room of rooms){this.queueIds.delete(room.id);room.status='playing';delete room.searchStartedAt;this.roomLoads.set(room.id,load.view.id);this.broadcastRoom(room);}
  this.sendLoading(load);
 }
 private loadingPeers(load:PendingLoad){return load.view.players.flatMap(player=>{const peer=player.bot?undefined:this.peers.get(player.id);return peer&&peer.roomId&&load.roomIds.includes(peer.roomId)?[peer]:[];});}
 private sendLoading(load:PendingLoad){for(const peer of this.loadingPeers(load))this.emit(peer,{type:'loading',loading:load.view});}
 private loadingProgress(p:Peer,id:string,progress:number){
  const load=this.loads.get(id),player=load?.view.players.find(entry=>entry.id===p.profile.id);
  if(!load||!player||!load.waiting.has(player.id)||progress<=player.progress)return;
  player.progress=progress;if(progress>=100)load.waiting.delete(player.id);
  if(!load.waiting.size)this.finishLoading(load);else this.sendLoading(load);
 }
 /** Everyone loaded, or the time ran out: the slow players leave, the battle begins for the rest (or the rooms go back to waiting). */
 private finishLoading(load:PendingLoad,slow:string[]=[]){
  if(!this.loads.delete(load.view.id))return;
  for(const id of load.roomIds){if(this.roomLoads.get(id)===load.view.id)this.roomLoads.delete(id);const room=this.rooms.get(id);if(room&&!this.matchForRoom(id))room.status='waiting';}
  for(const id of slow){const peer=this.peers.get(id);if(!peer?.roomId||!load.roomIds.includes(peer.roomId))continue;this.leaveRoom(peer);this.emit(peer,{type:'loading',loading:null,dropped:load.view.kind});this.emit(peer,{type:'error',message:`Seu jogo não carregou em ${LOADING_SECONDS} segundos: você saiu da partida.`});}
  try{load.begin();}catch(e){this.report(e);}
  // No battle came of it (someone left, a side emptied): back to the room.
  for(const id of load.roomIds){const room=this.rooms.get(id);if(!room||this.matchForRoom(id))continue;room.status='waiting';room.players.forEach(player=>player.ready=player.bot);for(const peer of this.roomMembers(room).map(seat=>this.peers.get(seat.id)))if(peer?.roomId===id){this.emit(peer,{type:'loading',loading:null});if(slow.length)this.emit(peer,{type:'error',message:'Um jogador não carregou a tempo: a partida foi cancelada.'});}this.broadcastRoom(room);}
 }
 private startExpedition(p:Peer){
  const room=this.room(p);if(room.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar a expedição.');if(room.status!=='waiting')throw Error('A expedição já começou.');
  if(!room.expedition)throw Error('Escolha uma expedição primeiro.');
  if(room.players.some(s=>!s.connected||this.profileChanges.has(s.id)||!this.peers.get(s.id)?.connected||(!s.ready&&s.id!==room.hostId)))throw Error('Aguarde todos ficarem prontos.');
  this.launchExpedition(room,Math.min(room.expedition.stage??0,expeditionStages(room.expedition.id,room.expedition.difficulty).length-1));
 }
 /** Opens a stage: a new battle (new map) for the room's party. Each stage is its own start from the room. */
 private launchExpedition(room:Room,stageIndex:number){
  const choice=room.expedition!,stages=expeditionStages(choice.id,choice.difficulty),stage=stages[stageIndex],def=getExpedition(choice.id);
  const played=pinMap(stage.map as Battle['map']);
  this.openLoading([room],{kind:'expedition',map:played,players:room.players.filter(seat=>!seat.bot).map(seat=>this.loadingPlayer(seat)),expedition:{id:choice.id,name:def?.name??choice.id,difficulty:choice.difficulty,stage:stageIndex,stageName:stage.name,art:stage.art}},()=>{
   const live=this.rooms.get(room.id);if(!live||!live.expedition||!live.players.some(seat=>!seat.bot))return;
   this.beginExpedition(live,stageIndex,played);
  });
 }
 private beginExpedition(room:Room,stageIndex:number,played:Battle['map']){
  const choice=room.expedition!,stages=expeditionStages(choice.id,choice.difficulty);
  const seats=room.players.filter(seat=>!seat.bot);
  const terrain=createTerrain(played),now=Date.now(),setup=setupStage(seats,choice.id,choice.difficulty,stageIndex,terrain,now);
  setup.fighters.forEach(fighter=>{if(!fighter.monster)adjustAimToTerrain(fighter,terrain);});
  const run:ExpeditionRun={expedition:choice.id,difficulty:choice.difficulty,stages,stage:stageIndex,order:setup.order,round:{round:1,acted:[]},events:[]};
  const state:Battle={id:randomUUID(),roomId:room.id,map:played,players:setup.fighters,turnId:setup.order[0],turnNumber:1,wind:this.wind(),deadline:setup.instance.introUntil+30000,phase:'aiming',winner:null,instance:setup.instance};
  const key=this.matches.has(room.id)?randomUUID():room.id;
  const m:Match={key,roomIds:[room.id],state,terrain,resolveAt:0,botAt:Infinity,createdAt:now,instance:run};
  this.matches.set(key,m);this.queueIds.delete(room.id);room.status='playing';room.matchStartedAt=now;room.map=setup.map;this.roomMatches.set(room.id,key);this.broadcastRoom(room);this.armPets(m,state.players.find(f=>f.id===state.turnId));this.broadcastBattle(m,true);
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
  const f=s.players.find(player=>player.id===next.id)!;f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+TURN_SECONDS*1000;
  this.petTurnStart(m,f);if(this.checkWin(m))return;this.broadcastBattle(m,withTerrain);
 }
 /** The monsters' shared turn: everyone walks at once, those already beside an adventurer bite, the queen shoots and summons. */
 private startMonsterTurn(m:Match){
  const s=m.state,run=m.instance!,now=Date.now(),turnId=randomUUID();
  s.turnId=MONSTER_TURN_ID;s.turnNumber++;s.phase='resolving';
  // The queen acts first (draws, shoots, the camera follows her arrow), then the ants walk and bite.
  for(const f of s.players)if(f.monster&&isFrozen(f))f.frozenTurns!--;
  const frozen=s.players.filter(f=>f.monster&&isFrozen(f));
  const queen=s.players.find(f=>f.id===s.instance!.boss&&f.hp>0&&!frozen.includes(f)),stage=run.stages[run.stage];let arrowAt:number|undefined,walkAt=now;
  if(queen){const arrow=this.queenShot(m,queen);if(arrow){arrowAt=now+QUEEN_DRAW_MS;run.events.push({at:arrowAt,run:()=>this.queenArrow(m,queen.id,arrow)});walkAt=arrowAt+arrow.result.flightTime+600;}}
  // Invisible adventurers cannot be chased; frozen monsters lose this turn (one of their 2) and stand still.
  const plan=planMonsterTurn(m.terrain,s.players.filter(f=>f.team===1?!frozen.includes(f):!(f.invisibleTurns??0)));
  for(const move of plan.moves){const f=s.players.find(x=>x.id===move.id);if(!f)continue;f.x=move.to[0];f.y=move.to[1];f.facing=move.facing;}
  const walking=plan.moves.some(move=>move.from[0]!==move.to[0]);
  let at=walkAt+(walking?MONSTER_MOVE_MS:300)+MONSTER_BITE_WINDUP_MS,end=walkAt+(walking?MONSTER_MOVE_MS:600);
  const bites=plan.bites.map((bite,index)=>({...bite,at:at+index*110}));
  bites.forEach((bite,index)=>{run.events.push({at:bite.at,run:()=>{
   const monster=s.players.find(f=>f.id===bite.id),target=s.players.find(f=>f.id===bite.targetId);if(!monster||monster.hp<=0||!target||target.hp<=0||!monster.monster)return;
   const guarded=incomingPetDamage(target,monsterDamage(MONSTERS[monster.monster].attack,this.combatEquipment(target),1,monster.level)),damage=Math.min(target.hp,guarded.damage),alive=target.hp>0;target.hp-=damage;if(target.hp<=0)target.powerArmed=false;
   this.petHits(m,monster,`bite:${turnId}`,[{id:target.id,damage,x:target.x,y:target.y,projectileIndex:index,critical:false,kind:'direct',quality:1,dealt:damage,died:alive&&target.hp<=0,...(guarded.absorbed?{shield:guarded.absorbed}:{})}]);
   chargeOnDamage(target,damage);
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
   const guarded=incomingPetDamage(structuredClone(target),monsterDamage(MONSTERS['ant-queen'].attack,this.combatEquipment(target),exposure.attenuation,queen.level));
   hits.push({id:target.id,damage:guarded.damage,x:target.x,y:target.y-85,projectileIndex:0,critical:false,kind:exposure.kind,quality:exposure.quality,...(guarded.absorbed?{shield:guarded.absorbed}:{})});}
  const shot:Shot={id,shooterId:queen.id,startedAt,duration:result.flightTime+450,hits:[],impacted:[],projectiles:[{points:result.points,delay:0,flightTime:result.flightTime,impact:{x:result.x,y:result.y,radius:0},effect:'brick',monster:'arrow'}]};
  m.activeShot=shot;m.pendingImpacts=[{at:startedAt+result.flightTime,projectileIndex:0,hits,fragment:true,mark:{id:`${id}:0`,x:result.x,y:result.y,radius:0,effect:'brick',level:0}}];
  m.resolveAt=Math.max(m.resolveAt,startedAt+shot.duration+MONSTER_TURN_END_MS);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});this.broadcastBattle(m);
 }
 /** Base Delay a fighter adds when their turn starts, from their match equipment. */
 private baseDelay(f:Fighter){return attributes(this.combatEquipment(f),f.level).delay;}
 private wind(){return Math.round((Math.random()*2-1)*35)/10;}
 private boost(f:Fighter,id:BoostId){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar ferramentas.');
  const b=BOOSTS.find(b=>b.id===id)!;
  const combination=powerUpConflict(f.boosts,id);if(combination)throw Error(combination);
  // POW × Tridente follows the weapon's rule (shared/weaponKit.ts).
  const conflict=f.powerArmed?powBoostConflict(f.equipment.weapon,id):undefined;if(conflict)throw Error(conflict);
  if(id==='ice'&&f.powerArmed)throw Error('O gelo não combina com o POW.');
  if(id==='ice'&&f.homingArmed)throw Error('O gelo não combina com a mira assistida.');
  if(id==='rage'&&(f.powerArmed||(f.powerCharge??0)>=POWER_MAX))throw Error('Sua barra de POW já está cheia.');
  if(f.stamina<b.cost)throw Error('Vigor insuficiente.');f.stamina-=b.cost;f.delay=(f.delay??0)+b.delay;f.boosts.push(id);
  // Enfurecer fills the bar at once (shared/ice.ts); using the POW is still its own click.
  if(id==='rage')addPower(f,RAGE_CHARGE);
 }
 private armPower(f:Fighter){
  if(f.flightArmed)throw Error('Cancele o voo antes de usar Power.');
  if(f.powerArmed)throw Error('Power já está preparado para este tiro.');
  if((f.powerCharge??0)<POWER_MAX)throw Error('Encha a barra de POW para ativar.');
  if(f.boosts.includes('ice'))throw Error('O POW não combina com o gelo.');
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
  if(ability==='homing'&&f.boosts.includes('ice'))throw Error('A mira assistida não combina com o gelo.');
  f.abilities[ability]--;f.delay=(f.delay??0)+(ABILITIES.find(entry=>entry.id===ability)?.delay??0);let amount:number|undefined;
  if(ability==='heal'){const healed=clampHp(f.hp+HEAL_AMOUNT,f.maxHp);amount=healed-f.hp;f.hp=healed;}
  if(ability==='homing')f.homingArmed=true;
  if(ability==='invisibility'){f.invisibleTurns=INVISIBILITY_TURNS;m.invisibilityActivated??=new Map();m.invisibilityActivated.set(f.id,m.state.turnNumber);}
  this.abilityEffect(m,{playerId:f.id,ability,x:f.x,y:f.y,amount,at:Date.now()});
 }
 private fire(m:Match,f:Fighter,angle:number,power:number){
  // Delay for the seconds used this turn and for the shot itself (DDTank PrepareShoot + ball/weapon Delay).
  f.delay=(f.delay??0)+timeDelay(Date.now()-(m.state.deadline-TURN_SECONDS*1000))+(WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)?.shotDelay??0);
  // Every launch sequence earns the attack raiva once (Player.Shoot), whatever it is: normal, POW, flight or ice.
  m.shotRage=f.id;
  if(f.flightArmed){this.fireFlight(m,f,angle,power);return;}
  if(f.boosts.includes('ice')){this.fireIce(m,f,angle,power);return;}
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
 /** Gelo: one ice ball on the plane's flight (DDTank Ball1 = Ball3 physics), no damage, no crater. */
 private fireIce(m:Match,f:Fighter,angle:number,power:number){
  const weapon={...weaponStats(WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)!,f.equipment.upgrade),projectileRadius:6},result=trajectory(m.terrain,f,angle,power,m.state.wind,weapon,m.state.players.filter(p=>p.id!==f.id&&p.hp>0)),startedAt=Date.now(),id=randomUUID();
  f.charging=false;f.aimAngle=angle;f.chargePower=power;
  const shot:Shot={id,shooterId:f.id,startedAt,duration:result.flightTime+900,hits:[],impacted:[],projectiles:[{kind:'ice',effect:weapon.effect,points:result.points,delay:0,flightTime:result.flightTime,impact:{x:result.x,y:result.y,radius:0,...terrainMaterial(m.state.map,result.x,result.y)}}]};
  m.activeShot=shot;m.pendingImpacts=[{at:startedAt+result.flightTime,projectileIndex:0,hits:[],ice:true,mark:{id:`${id}:0`,x:result.x,y:result.y,radius:0,effect:weapon.effect,level:f.equipment.upgrade}}];m.state.phase='resolving';m.resolveAt=startedAt+shot.duration+TURN_GAP_MS;
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});this.broadcastBattle(m);
 }
 private resolveFire(m:Match,f:Fighter,angle:number,power:number,powered:boolean,startedAt=Date.now()){
  f.aimAngle=angle;f.chargePower=power;f.charging=false;
  const w=weaponStats(WEAPONS.find(w=>w.id===f.equipment.weapon)!,f.equipment.upgrade);
  // A weapon with its own POW (shared/catalog.ts WeaponPow) replaces the global multipliers, applied once each.
  const ownPow=powered?w.pow:undefined;
  if(powered){w.crater=powCraterRadius(w);w.blast=ownPow?.splash!==undefined?ownPow.splash/SPLASH_RADIUS_SCALE:w.blast*POWER_BLAST_MULTIPLIER;}
  else if(w.splash!==undefined)w.blast=w.splash/SPLASH_RADIUS_SCALE;
  const powDamage=powered?ownPow?.damage??POWER_DAMAGE_MULTIPLIER:1;
  const homing=f.homingArmed;f.homingArmed=false;
  // The pet's special shot: one projectile of its own, no tools, its multiplier, maybe always critical.
  const special=consumeSpecialShot(f);
  const modifiers=shotModifiers(special?[]:boostsForShot(f.equipment.weapon,f.boosts,powered)),fan=special?undefined:ownPow?.fan,shot:Shot={powered,id:randomUUID(),shooterId:f.id,projectiles:[],hits:[],duration:0,startedAt,impacted:[]};
  // Pet bonuses of the whole shot: decided once, however many volleys or projectiles it has.
  let petShot=1;if(f.pet||f.petEffects?.length){const ctx=this.petContext(m);this.petEffect(m,[...this.petTrigger(m,'before-fire',f,{sourceId:f.id,shotId:shot.id},ctx),...this.petTrigger(m,'before-damage',f,{sourceId:f.id,shotId:shot.id},ctx)]);petShot=consumeShotBonus(f)*outgoingPetFactor(f);}
  if(special)petShot*=special.multiplier??1;
  const offense=this.combatEquipment(f);
  const simulated:Match={...m,terrain:m.terrain.slice(),state:{...m.state,players:structuredClone(m.state.players)}},shooter=simulated.state.players.find(player=>player.id===f.id)!;
  // A POW fan (Bobina do Trovão) replaces the single projectile of each volley; it never stacks with the Tridente (exclusive rule).
  if(fan)modifiers.spread=fan.map(shot=>shot.angle);
  const angles=Array.from({length:modifiers.volleys},()=>modifiers.spread.map(spread=>angle+spread)).flat(),forces=fan?angles.map((_,index)=>fan[index%fan.length].force):[],delays=angles.map((_,index)=>Math.floor(index/modifiers.spread.length)*VOLLEY_CADENCE_MS),impacts:Shot['projectiles'][number]['impact'][]=[],pending:PendingImpact[]=[];
  const planImpact=(result:TrajectoryResult,index:number,delay:number,radius:number,blast:number,damageScale:number,fragment=false):Shot['projectiles'][number]['impact']=>{
   // The hole is the weapon's fixed mask; a projectile that strikes a body digs that mask at 75% in the ground under the target's feet.
   const victim=result.hitId?simulated.state.players.find(player=>player.id===result.hitId):undefined,dig:TerrainDig|undefined=victim?{x:result.x,y:victim.y,radius:Math.round(radius*DIRECT_HIT_CRATER)}:undefined;
   // The destruction profile is fixed here, from the weapon and level of this shot: its mask and painting never follow later equipment changes.
   const profile=fragment?undefined:destructionProfile(w.id,f.equipment.upgrade,powered);
   const rough=weaponRoughness(w),shape=fragment?undefined:profile?.mask??(powered&&w.powCraterShape?w.powCraterShape:w.craterShape),impact={x:result.x,y:result.y,radius,roughness:rough,...(shape?{shape}:{}),...(profile?{profile:profile.id}:{}),...terrainMaterial(m.state.map,result.x,result.y),...(dig?{dig}:{})},hole=dig??impact;
   const hits:ShotHit[]=[],rage:Record<string,number>={};
   for(const target of simulated.state.players){
    if(target.hp<=0)continue;const exposure=impactExposure(target,result,blast);if(exposure.attenuation<=0)continue;
    const critical=special?.critical||criticalFromRoll(attributes(offense,f.level).luck,this.criticalRoll());let damage=damageAtImpact(offense,this.combatEquipment(target),{attackerLevel:f.level,attenuation:exposure.attenuation,shotMultiplier:modifiers.projectileMultiplier*damageScale,boostMultiplier:modifiers.damageMultiplier*powDamage*petShot,critical});
    if(target.monster)damage=Math.round(damage/MONSTERS[target.monster].toughness);
    // Pet damage reduction and shields (the simulated copy spends the shield for the later projectiles; applyImpact repeats it on the real one).
    const guarded=incomingPetDamage(target,damage);damage=guarded.damage;
    if(damage<=0&&!guarded.absorbed)continue;
    if(damage>0)rage[target.id]=critical?Math.floor(damage/(1+criticalBonusMultiplier(attributes(offense,f.level).luck))):damage;
    hits.push({id:target.id,damage,x:target.x,y:target.y-85,projectileIndex:index,critical,kind:exposure.kind,quality:exposure.quality,...(guarded.absorbed?{shield:guarded.absorbed}:{})});
   }
   // A fighter killed here is gone for the projectiles still in the air: they fly through it to the ground or the next target.
   for(const hit of hits){const target=simulated.state.players.find(player=>player.id===hit.id)!;target.hp=Math.max(0,target.hp-hit.damage);}
   crater(simulated.terrain,hole.x,hole.y,hole.radius,m.state.map,rough,1,shape);this.settle(simulated);
   pending.push({at:startedAt+delay+result.flightTime,projectileIndex:index,hits,rage,fragment,mark:{id:`${shot.id}:${index}`,x:hole.x,y:hole.y,radius:hole.radius,roughness:rough,...(shape?{shape}:{}),...(profile?{profile:profile.id}:{}),...(impact.destructible===false?{scorch:true}:{}),effect:w.effect,level:f.equipment.upgrade}});
   return impact;
  };
  const results=volley(simulated.terrain,shooter,angles,power,m.state.wind,w,simulated.state.players.filter(player=>player.id!==f.id),(result,index)=>{
   impacts[index]=planImpact(result,index,delays[index],w.crater,w.blast,1);
  },delays,homing&&!special?{targets:homingTargets(simulated.state.players,shooter)}:undefined,true,undefined,forces);
  const petProjectile=special&&f.pet?{projectile:special.projectile!,species:f.pet.species,stage:f.pet.stage??0,skill:special.skill}:undefined;
  shot.projectiles=results.map((result,index)=>({points:result.points,delay:delays[index],flightTime:result.flightTime,impact:impacts[index],effect:w.effect,powered,...(petProjectile?{pet:petProjectile}:{})}));
  const shardCount=special?0:weaponFragmentCount(w,f.equipment.upgrade,powered);
  if(shardCount&&w.fragments)for(let parent=0;parent<results.length;parent++){
   const result=results[parent];if(result.x<0||result.x>terrainWidth(m.terrain)||result.y>WORLD.height)continue;
   const start=delays[parent]+result.flightTime,base=shot.projectiles.length,shardImpacts:Shot['projectiles'][number]['impact'][]=[];
   const pieces=shatter(simulated.terrain,{x:result.x,y:result.y},shardCount,shooter.facing,w,m.state.wind,simulated.state.players.filter(player=>player.id!==f.id&&player.id!==result.hitId),(piece,index)=>{
    shardImpacts[index]=planImpact(piece,base+index,start,w.fragments!.crater,w.fragments!.blast,w.fragments!.damage,true);
   });
   pieces.forEach((piece,index)=>shot.projectiles.push({points:piece.points,delay:start,flightTime:piece.flightTime,impact:shardImpacts[index],effect:w.effect,powered,fragment:true}));
  }
  shot.duration=Math.max(...shot.projectiles.map(projectile=>projectile.delay+projectile.flightTime))+450;
  // A pet that answers the end of the shot attacks where the last projectile landed (the middle one of the last Tridente volley), after it.
  const spread=modifiers.spread.length,middle=modifiers.spread.indexOf(0),main=impacts[angles.length-spread+(middle>=0?middle:Math.floor(spread/2))];
  if(listensTo(f.pet,'shot-end')&&main&&main.x>=0&&main.x<=terrainWidth(m.terrain)&&main.y<=WORLD.height&&pending.length){
   const at=Math.max(...pending.map(p=>p.at))+350;
   pending.push({at,projectileIndex:PET_STRIKE_INDEX,hits:[],petStrike:{x:main.x,y:main.y},mark:{id:`${shot.id}:pet`,x:main.x,y:main.y,radius:0,effect:w.effect,level:f.equipment.upgrade}});
   shot.duration=Math.max(shot.duration,at-startedAt+PET_STRIKE_MS);
  }
  m.activeShot=shot;m.pendingImpacts=pending.sort((a,b)=>a.at-b.at||a.projectileIndex-b.projectileIndex);m.state.phase='resolving';m.resolveAt=startedAt+shot.duration+TURN_GAP_MS;
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'shot',shot:this.visibleShot(m,shot,peer.profile.id)});
  this.broadcastBattle(m);
 }
 private applyImpact(m:Match,impact:PendingImpact){
  const shot=m.activeShot;if(!shot||m.state.phase!=='resolving'||shot.impacted.includes(impact.projectileIndex))return;
  const shooter=m.state.players.find(player=>player.id===shot.shooterId)!,hits:ShotHit[]=[];
  if(impact.petStrike){this.petStrike(m,shot,shooter,impact);return;}
  if(impact.ice){
   // Freezing again resets the count (IceFronzeEffect.Start); a fighter whose ice the same shot broke stays free.
   for(const target of iceTargets(m.state.players,shooter.team,impact.mark)){target.frozenTurns=ICE_FROZEN_TURNS;target.charging=false;}
   shot.impacted.push(impact.projectileIndex);for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:[]});this.broadcastBattle(m,true);return;
  }
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
  const landed:(ShotHit&{dealt:number;died:boolean})[]=[];
  for(const planned of impact.hits){
   // Hits are only planned on fighters still alive when the projectile lands (killed ones are let through).
   const target=m.state.players.find(player=>player.id===planned.id);if(!target||target.y>WORLD.height)continue;
   // Frozen: the first projectile that hits only breaks the ice; the next ones, even of the same shot, deal damage (matheus 20/10).
   if(isFrozen(target)&&(planned.damage>0||planned.shield)){target.frozenTurns=0;continue;}
   if(planned.shield)drainShield(target,planned.shield);if(planned.damage<=0&&!planned.shield)continue;
   // The dragon's life is the event's: the damage waits for the end of the turn to reach Postgres (shown at once here).
   if(target.boss){const run=m.worldBoss,wb=m.state.worldBoss;if(run&&wb&&!wb.over){run.pending+=planned.damage;wb.attemptDamage+=planned.damage;target.hp=Math.max(0,target.hp-planned.damage);}hits.push({...planned,x:target.x-60,y:target.y-target.hitHeight!-40});continue;}
   const alive=target.hp>0,absorbed=Math.min(target.hp,planned.damage);target.hp-=absorbed;if(target.hp<=0)target.powerArmed=false;
   // Damage taken charges a survivor's raiva, whoever shot (own, ally or enemy); the shooter gains nothing for hitting.
   if(absorbed>0)chargeOnDamage(target,impact.rage?.[target.id]??absorbed);
   hits.push({...planned,x:target.x,y:target.y-85});landed.push({...planned,dealt:absorbed,died:alive&&target.hp<=0});
  }
  this.petHits(m,shooter,shot.id,landed);
  const dug=crater(m.terrain,impact.mark.x,impact.mark.y,impact.mark.radius,m.state.map,impact.mark.roughness,impact.mark.stretch,impact.mark.shape);
  const standing=m.state.players.filter(player=>player.hp>0).map(player=>({id:player.id,hp:player.hp,x:player.x,y:player.y}));this.settle(m,impact.at);
  for(const before of standing){const target=m.state.players.find(player=>player.id===before.id)!;if(target.hp<=0){target.powerArmed=false;hits.push({id:target.id,damage:before.hp,x:before.x,y:before.y-85,projectileIndex:impact.projectileIndex,critical:false,kind:'fall',quality:1});}}
  // Unbreakable instance ground (the anthill) keeps no burn marks either.
  if(!impact.fragment&&(dug>0||!m.state.instance))m.state.terrainMarks=keepVisibleMarks([...(m.state.terrainMarks??[]),impact.mark],m.terrain,m.state.map);shot.hits.push(...hits);shot.impacted.push(impact.projectileIndex);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:impact.projectileIndex,at:impact.at,hits:this.visibleHits(m,hits,peer.profile.id)});
  // The match only ends in nextTurn, once every projectile of the shot has landed and settled.
  this.broadcastBattle(m,true);
 }
 /** The pet's attack after its owner's shot: the shot-end passives run at the main impact; their damage shows as numbers like a hit. */
 private petStrike(m:Match,shot:Shot,shooter:Fighter,impact:PendingImpact){
  shot.impacted.push(impact.projectileIndex);
  if(shooter.hp<=0||!shooter.pet)return;
  const before=new Map(m.state.players.map(p=>[p.id,p.hp])),applications=this.petTrigger(m,'shot-end',shooter,{sourceId:shooter.id,shotId:shot.id,point:impact.petStrike});
  if(!applications.length)return;
  this.petEffect(m,applications);
  const hits:ShotHit[]=m.state.players.filter(p=>p.hp<before.get(p.id)!).map(p=>({id:p.id,damage:before.get(p.id)!-p.hp,x:p.x,y:p.y-85,projectileIndex:PET_STRIKE_INDEX,critical:false,kind:'direct',quality:1}));
  shot.hits.push(...hits);
  for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:shot.id,projectileIndex:PET_STRIKE_INDEX,at:impact.at,hits:this.visibleHits(m,hits,peer.profile.id)});
  this.broadcastBattle(m);
 }
 private animateFall(target:Fighter,fromY:number,at:number){
  const previous=target.fall,falling=previous&&at<previous.startedAt+previous.duration;
  if(previous&&!falling)delete target.fall;
  if(target.y-fromY<9)return;
  target.fall=createFall(falling?fallPosition(previous,at):fromY,target.y,at,target.y>WORLD.height,falling?fallVelocity(previous,at):0);
 }
 private settle(m:Match,at?:number){for(const target of m.state.players){
  if(target.boss)continue;
  // Same support test as the walk (DDTank Player.StartFalling: x±1), so a fighter a step left standing never sinks here.
  const fromY=target.y;target.y=supportBelow(m.terrain,target.x,Math.max(0,target.y-3));if(target.y>WORLD.height){target.y=WORLD.height+150;target.hp=0;}
  if(at!==undefined){this.animateFall(target,fromY,at);if(target.fall)m.resolveAt=Math.max(m.resolveAt,target.fall.startedAt+target.fall.duration+TURN_GAP_MS);}
  adjustAimToTerrain(target,m.terrain);
 }}
 /** The attack raiva of this turn's launches (Player.Shoot AddDander(20)): once, only for a shooter still alive. */
 private shotRage(m:Match){
  const id=m.shotRage;if(!id)return;delete m.shotRage;
  const f=m.state.players.find(player=>player.id===id);if(f&&!f.monster&&!f.boss)addPower(f,POWER_ATTACK_CHARGE);
 }
 /** The turn timer ran out: the DDTank client sends the same skip as the pass button, so a connected player earns its raiva. */
 private timeoutRage(m:Match){
  const f=m.state.players.find(player=>player.id===m.state.turnId);if(f&&!f.monster&&!f.boss&&!f.left&&f.connected!==false)addPower(f,POWER_PASS_CHARGE);
 }
 private nextTurn(m:Match){
  this.shotRage(m);
  this.petTurnEnd(m);
  if(this.checkWin(m))return;
  if(m.instance){this.nextInstanceTurn(m);return;}
  if(m.worldBoss){this.nextWorldBossTurn(m);return;}
  const s=m.state,withTerrain=s.phase==='resolving';
  const outgoing=s.players.find(p=>p.id===s.turnId);if(outgoing&&(outgoing.invisibleTurns??0)>0&&m.invisibilityActivated?.get(outgoing.id)!==s.turnNumber)outgoing.invisibleTurns!--;
  // The living fighter with the lowest accumulated Delay plays, possibly the same one again (shared/turnDelay.ts).
  let f=nextByDelay(s.players,s.turnId)??outgoing!;startDelayTurn(s.players,f,this.baseDelay(f));
  // Gelo: a frozen fighter loses the turn (DDTank PrepareSelfTurn adds another turn of Delay) until the ice thaws on its own.
  for(let guard=0;isFrozen(f)&&guard<s.players.length*ICE_FROZEN_TURNS;guard++){
   f.frozenTurns!--;if(!isFrozen(f))break;
   f.delay=(f.delay??0)+this.baseDelay(f);f=nextByDelay(s.players,f.id)??f;startDelayTurn(s.players,f,this.baseDelay(f));
  }
  if(isFrozen(f))f.frozenTurns=0;
  delete m.pendingPower;delete m.activeShot;delete m.pendingImpacts;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+TURN_SECONDS*1000;m.botAt=Date.now()+1800;
  this.petTurnStart(m,f);if(this.checkWin(m))return;this.broadcastBattle(m,withTerrain);
 }
 private checkWin(m:Match){
  if(m.state.phase==='finished')return true;
  if(m.instance)return this.checkInstanceEnd(m);
  if(m.worldBoss)return this.checkWorldBossEnd(m);
  const teams=new Set(m.state.players.filter(p=>p.hp>0).map(p=>p.team));
  const exhausted=m.state.turnNumber>=80;
  if(teams.size>1&&!exhausted)return false;
  delete m.pendingPower;delete m.pendingImpacts;delete m.state.powerCutIn;m.state.players.forEach(f=>{f.powerArmed=false;f.flightArmed=false;f.homingArmed=false;});
  m.state.phase='finished';m.state.winner=teams.size===1?[...teams][0]:null;m.finishedAt=Date.now();
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
  const saving=run?(this.store.finishExpedition?.(m.state.id,humans.map(p=>p.id),award,bonuses)??Promise.resolve()):this.store.finishMatch(m.state.id,winners,humans.map(p=>p.id),bonuses,this.matchRecord(m));
  // GvG: every winner adds Riqueza to their guild (once per battle, like the match rewards).
  const gvgGuild=m.gvg&&m.state.winner!==null&&winners.length?m.gvg[m.state.winner]:undefined;
  // Pets settle right after the rewards (idempotent too, so a retry repeats both safely).
  saving.then(()=>this.settlePets(m,humans)).then(async()=>{
   if(gvgGuild!==undefined&&this.guilds&&await this.guilds.gvgWin(m.state.id,gvgGuild,winners,GVG_CONTRIBUTION)){
    for(const winner of winners){const peer=this.peers.get(winner);if(peer)this.emit(peer,{type:'guild-result',message:`Vitória GvG! +${GVG_CONTRIBUTION} de Riqueza para a guilda.`});}
    await this.refreshGuild(gvgGuild);
   }
   const ids=humans.map(f=>f.id);
   if(run){if(run.won)await this.guildMission(ids,'expedition');}
   else{await this.guildMission(ids,'play');await this.guildMission(winners,'win');if(gvgGuild!==undefined)await this.guildMission(winners,'gvg');}
   for(const f of humans){const p=this.peers.get(f.id);if(p){const profile=await this.store.getProfile(f.id);if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});const seat=p.roomId?this.rooms.get(p.roomId)?.players.find(s=>s.id===f.id):undefined;if(seat){seat.level=profile.level;seat.equipment={...profile.equipment};}}}}
   rewards.saved=true;if(!run)void this.refreshRanking();this.broadcastBattle(m);for(const roomId of m.roomIds){const room=this.rooms.get(roomId);if(room&&this.matchForRoom(roomId)===m)this.broadcastRoom(room);}
  }).catch(error=>{this.report(error);m.retryRewardsAt=Date.now()+2000;}).finally(()=>{m.savingRewards=false;});
 }
 /** The official result for the Hall da Fama: every human who fought (leavers too), the kind of battle and its end. */
 matchRecord(m:Match):MatchRecord{
  const fighters=m.state.players.filter(f=>!f.bot&&!f.monster),size=(team:0|1)=>m.state.players.filter(f=>f.team===team&&!f.monster).length;
  const kind=m.gvg?'gvg':m.roomIds.length===2&&!m.practiceParty&&!m.state.players.some(f=>f.bot)?'pvp':'practice';
  return {matchId:m.state.id,kind,mode:`${size(0)}v${size(1)}`,winnerTeam:m.state.winner===0||m.state.winner===1?m.state.winner:null,startedAt:m.createdAt,finishedAt:m.finishedAt??Date.now(),
   participants:fighters.map(f=>({id:f.id,team:f.team as 0|1,left:!!f.left}))};
 }
 /** A board of the Hall da Fama changed: everyone with the hall open asks again (the client decides). */
 hallChanged(categories:HallCategory[]){for(const peer of this.peers.values())if(peer.connected)this.emit(peer,{type:'hall-changed',categories});if(categories.includes('pvp'))void this.refreshRanking();}
 private requireHall(){if(!this.hall)throw Error('O Hall da Fama está fechado no momento.');return this.hall;}
 /** Reloads the day's podium and tells everyone when it changed; also rolls over at midnight. */
 refreshRanking():Promise<void>{
  if(!this.store.dailyRanking)return Promise.resolve();
  if(this.rankingLoading)return this.rankingLoading.then(():Promise<void>=>this.refreshRanking());
  this.rankingAt=Date.now();void this.refreshFishRanking();
  this.rankingLoading=this.store.dailyRanking().then(ranking=>{
   if(JSON.stringify(ranking)===JSON.stringify(this.ranking))return;
   this.ranking=ranking;for(const peer of this.peers.values())this.emit(peer,{type:'ranking',ranking});
  }).catch(this.report).finally(()=>{this.rankingLoading=null;});
  return this.rankingLoading;
 }
 /** Reloads the week's fish ranking (rolls over on Monday in Brasília) and sends it to everyone when it changed. */
 refreshFishRanking():Promise<void>{
  if(!this.store.fishRanking)return Promise.resolve();
  if(this.fishRankingLoading)return this.fishRankingLoading.then(():Promise<void>=>this.refreshFishRanking());
  const week=fishingWeek(Date.now());
  this.fishRankingLoading=this.store.fishRanking(week).then(entries=>{
   const ranking={week,entries};if(JSON.stringify(ranking)===JSON.stringify(this.fishRanking))return;
   this.fishRanking=ranking;for(const peer of this.peers.values())if(peer.connected)this.emit(peer,{type:'fish-ranking',ranking});
  }).catch(this.report).finally(()=>{this.fishRankingLoading=null;});
  return this.fishRankingLoading;
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
  for(const load of [...this.loads.values()])if(now>=load.view.deadline)this.finishLoading(load,[...load.waiting]);
  const dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;
  for(const [id,p] of this.peers){
   if(!p.connected&&now-p.lastSeen>this.reconnectWindow(p)&&!this.profileChanges.has(id)){this.leave(p);this.peers.delete(id);continue;}
   if(p.connected&&!p.roomId){const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy);if(d>1){const step=p.zone==='fishing'?fishingStep:lobbyStep,next=step(p,{x:p.targetX,y:p.targetY},LOBBY_WALK_SPEED*dt);p.x=next.x;p.y=next.y;p.lobbyDirty=true;}}
   if(p.fishing&&this.tickFishing(p,now))p.lobbyDirty=true;
  }
  if(++this.lobbyTick%2===0)this.sendMoves();
  for(const m of this.matches.values()){
   if(m.state.phase==='finished'&&m.state.rewards){const rewards=m.state.rewards;if(rewards.phase==='picking'&&now>=rewards.deadline)this.revealRewards(m,now);else if(rewards.phase==='revealed'&&!rewards.saved&&now>=(m.retryRewardsAt??0))this.saveRewards(m);if(rewards.saved&&now>=(rewards.revealedAt??Infinity)+REWARD_RETURN_MS){const run=m.instance,room=this.rooms.get(m.roomIds[0]);// Every stage ends back in the room; a win moves the room's choice on to the next stage (the last one starts over).
    if(run&&room?.expedition&&this.matchForRoom(room.id)===m&&run.won)room.expedition.stage=run.stage+1<run.stages.length?run.stage+1:0;this.returnParties(m);}this.cleanupMatch(m);}
   if(m.pendingPower&&now>=m.pendingPower.at){const pending=m.pendingPower;delete m.pendingPower;delete m.state.powerCutIn;const shooter=m.state.players.find(f=>f.id===pending.playerId);if(shooter&&shooter.hp>0&&m.state.phase==='resolving')this.resolveFire(m,shooter,pending.angle,pending.power,true,now);else if(m.state.phase!=='finished')this.nextTurn(m);}
   if(m.state.worldBoss?.closesAt!==undefined&&now>=m.state.worldBoss.closesAt){this.closeWorldBoss(m);continue;}
   while(m.state.phase==='resolving'&&m.instance?.events.length&&m.instance.events[0].at<=now)m.instance.events.shift()!.run();
   while(m.state.phase==='resolving'&&m.worldBoss?.events.length&&m.worldBoss.events[0].at<=now)m.worldBoss.events.shift()!.run();
   while(m.state.phase==='resolving'&&m.pendingImpacts?.length&&m.pendingImpacts[0].at<=now){const impact=m.pendingImpacts.shift()!;this.applyImpact(m,impact);if(!m.pendingImpacts.some(next=>!next.petStrike))this.shotRage(m);}
   if(m.state.phase==='resolving'&&now>=m.resolveAt)this.nextTurn(m);
   else if(m.state.phase==='aiming'){
    if(now>=m.state.deadline&&!this.chargeHeld(m,now)){this.timeoutRage(m);this.nextTurn(m);}
    else{const f=m.state.players.find(p=>p.id===m.state.turnId);if(f?.bot&&now>=m.botAt){m.botAt=Infinity;this.bot(m,f);}}
   }
  }
  if(this.roomsDirty)this.broadcastRooms();
  if(this.worldBoss){
   if(this.worldBossQueue.length&&now>=this.worldBossRetryAt)void this.flushWorldBoss();
   if(this.worldBossDirty&&now-this.worldBossSentAt>=1000){this.worldBossDirty=false;this.worldBossSentAt=now;const status=this.worldBoss.status();for(const peer of this.peers.values())this.emit(peer,{type:'world-boss',status});}
  }
 }
 /** Entrar: a solo attempt at the dragon in a hidden room; the battle opens with its entrance. */
 private enterWorldBoss(p:Peer){
  const realm=this.worldBoss;if(!realm)throw Error('O Chefão Mundial não está disponível no momento.');
  if(p.roomId)throw Error('Saia da sala atual antes de enfrentar o Chefão Mundial.');
  if(this.profileChanges.has(p.profile.id))throw Error('Aguarde a atualização do seu equipamento.');
  const status=realm.status(),now=Date.now();
  if(status.phase==='results')throw Error('O Chefão Mundial já terminou. Confira o ranking.');
  if(status.phase!=='active'||!status.occurrenceId||status.hp<=0||(status.endsAt??0)<=now+3000)throw Error('O Chefão Mundial não está ativo agora.');
  if(this.rooms.size>=600)throw Error('As salas estão cheias. Tente novamente em breve.');
  const room:Room={id:randomUUID(),number:0,name:status.name.slice(0,24),hostId:p.profile.id,kind:'world-boss',mode:'1v1',openSlots:[0],spectatorSlots:[],spectators:[],map:WORLD_BOSS_MAP,status:'playing',players:[this.seat(p,0,0)],matchStartedAt:now};
  const played=pinMap(WORLD_BOSS_MAP),terrain=createTerrain(played),seat={...room.players[0],equipment:battleEquipment(room.players[0].equipment)},stats=attributes(seat.equipment,seat.level),x=getMap(played).spawns[0][0],abilityLoadout=normalizeAbilityLoadout(seat.abilityLoadout);
  const hero:Fighter={...seat,equipment:structuredClone(seat.equipment),abilityLoadout,x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:1,boosts:[],powerCharge:0,powerArmed:false,abilities:initialAbilities(abilityLoadout),homingArmed:false,flightArmed:false,invisibleTurns:0,delay:stats.delay};
  adjustAimToTerrain(hero,terrain);
  const dragon:Fighter={id:DRAGON_FIGHTER_ID,name:status.name,level:seat.level,equipment:{...DEFAULT_EQUIPMENT},ready:true,bot:true,team:1,slot:0,connected:true,x:DRAGON_BODY.x,y:DRAGON_BODY.y,hp:status.hp,maxHp:status.maxHp,stamina:0,maxStamina:0,facing:-1,boosts:[],boss:'dragon',hitRadius:DRAGON_BODY.hitRadius,hitHeight:DRAGON_BODY.hitHeight};
  const entrance:DragonAct={id:randomUUID(),action:'entrance',startedAt:now,hits:[]},opening=DRAGON_ACTIONS.entrance.duration;
  const state:Battle={id:randomUUID(),roomId:room.id,map:played,players:[hero,dragon],turnId:DRAGON_TURN_ID,turnNumber:1,wind:this.wind(),deadline:now+opening+TURN_SECONDS*1000,phase:'resolving',winner:null,
   worldBoss:{occurrenceId:status.occurrenceId,name:status.name,hp:status.hp,maxHp:status.maxHp,endsAt:status.endsAt!,introUntil:now+opening,round:0,attemptDamage:0,act:entrance}};
  const m:Match={key:room.id,roomIds:[room.id],state,terrain,resolveAt:now+opening,botAt:Infinity,createdAt:now,worldBoss:{occurrenceId:status.occurrenceId,pending:0,events:[]}};
  this.rooms.set(room.id,room);this.matches.set(m.key,m);this.roomMatches.set(room.id,m.key);p.roomId=room.id;
  this.emit(p,{type:'room',room});this.broadcastBattle(m,true);this.sendLobby(p.channel);this.publishArenaPopulation();
  void realm.attempt(status.occurrenceId,p.profile.id,p.profile.name,p.profile.level).catch(this.report);
 }
 /** Player turn, then the dragon's act, then the player again; the player's damage goes out when their turn ends. */
 private nextWorldBossTurn(m:Match){
  const s=m.state,wb=s.worldBoss!,withTerrain=s.phase==='resolving',hero=s.players.find(f=>!f.boss)!;
  delete m.pendingPower;delete m.activeShot;delete m.pendingImpacts;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});
  if(s.turnId!==DRAGON_TURN_ID){
   if((hero.invisibleTurns??0)>0&&m.invisibilityActivated?.get(hero.id)!==s.turnNumber)hero.invisibleTurns!--;
   // The commit can end the event at once (this blow killed the dragon): then the dragon falls instead of acting.
   this.queueWorldBossDamage(m);if(!wb.over)this.startDragonTurn(m);return;
  }
  wb.round++;delete wb.act;hero.stamina=hero.maxStamina;hero.boosts=[];
  s.turnId=hero.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+TURN_SECONDS*1000;this.broadcastBattle(m,withTerrain);
 }
 /** The dragon's act: one move a round (claw, grab, breath or the sweeping flames), never the same kind twice in a row. */
 private startDragonTurn(m:Match){
  const s=m.state,wb=s.worldBoss!,run=m.worldBoss!,now=Date.now(),hero=s.players.find(f=>!f.boss)!,dragon=s.players.find(f=>f.boss)!;
  s.turnId=DRAGON_TURN_ID;s.turnNumber++;s.phase='resolving';
  const action=pickDragonAction(run.last,Math.random());run.last=action;
  // An invisible player is not found: the blow lands beside them.
  const def=DRAGON_ACTIONS[action],hidden=(hero.invisibleTurns??0)>0,targetX=hidden?Math.max(60,hero.x+(hero.x>400?-1:1)*(200+Math.random()*150)):hero.x;
  const at=now+(action==='firesweep'?sweepReachAt(hero.x,dragon.x-320,0):def.contact);
  const damage=monsterDamage(def.attack*dragonRage(Math.max(1,wb.round)),hero.equipment,1,hero.level);
  const act:DragonAct={id:randomUUID(),action,startedAt:now,targetId:hero.id,targetX,targetY:ground(m.terrain,targetX,0),hits:hidden&&action!=='firesweep'||!hero.hp?[]:[{at,targetId:hero.id,damage,x:hero.x,y:hero.y-85}]};
  for(const [index,hit] of act.hits.entries())run.events.push({at:hit.at,run:()=>{
   if(hero.hp<=0||hero.left||wb.over)return;const dealt=Math.min(hero.hp,hit.damage);hero.hp-=dealt;if(hero.hp<=0)hero.powerArmed=false;
   chargeOnDamage(hero,dealt);
   const shown:ShotHit={id:hero.id,damage:dealt,x:hero.x,y:hero.y-85,projectileIndex:index,critical:false,kind:'direct',quality:1};
   for(const peer of this.matchPeers(m))this.emit(peer,{type:'impact',shotId:`dragon:${act.id}`,projectileIndex:index,at:hit.at,hits:[shown]});
   if(!this.checkWin(m))this.broadcastBattle(m);
  }});
  run.events.sort((a,b)=>a.at-b.at);wb.act=act;m.resolveAt=now+def.duration+TURN_GAP_MS;this.broadcastBattle(m);
 }
 /** The attempt ends when the player falls (or leaves); the event ending is handled by `endWorldBossAttempt`. */
 private checkWorldBossEnd(m:Match){
  const s=m.state,wb=s.worldBoss!,hero=s.players.find(f=>!f.boss);
  if(wb.over)return true;
  if(hero&&hero.hp>0&&!hero.left&&s.turnNumber<400)return false;
  this.queueWorldBossDamage(m);m.worldBoss!.events=[];delete m.pendingPower;delete m.pendingImpacts;delete s.powerCutIn;
  s.phase='finished';s.winner=1;
  const now=Date.now(),actEnd=wb.act?wb.act.startedAt+DRAGON_ACTIONS[wb.act.action].duration:now,fallEnd=hero?.fall?hero.fall.startedAt+hero.fall.duration:now;
  // No result screen: the defeat plays out and the player goes back to the plaza with the event window open.
  wb.closesAt=Math.max(now+2200,actEnd+500,fallEnd+1400);this.broadcastBattle(m,true);return true;
 }
 /** The event ended during the attempt: the dragon falls (killed) or flies away (time, or stopped in the panel). */
 private endWorldBossAttempt(m:Match,reason:WorldBossEndReason){
  const s=m.state,wb=s.worldBoss!,run=m.worldBoss!,now=Date.now(),dragon=s.players.find(f=>f.boss);
  if(wb.over||wb.closesAt!==undefined)return;
  run.events=[];run.pending=0;delete m.pendingPower;delete m.pendingImpacts;delete m.activeShot;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;f.homingArmed=false;f.flightArmed=false;});
  const action:DragonAction=reason==='defeated'?'death':'retreat';if(dragon&&reason==='defeated')dragon.hp=0;
  wb.over=reason;wb.act={id:randomUUID(),action,startedAt:now,hits:[]};s.phase='finished';s.winner=reason==='defeated'?0:null;s.turnId=DRAGON_TURN_ID;
  wb.closesAt=now+DRAGON_ACTIONS[action].duration+1500;this.broadcastBattle(m,true);
 }
 /** Closes the attempt: the room and battle go away and the client opens the event window again. */
 private closeWorldBoss(m:Match){
  this.matches.delete(m.key);
  for(const roomId of m.roomIds){
   const room=this.rooms.get(roomId);this.rooms.delete(roomId);this.roomMatches.delete(roomId);
   for(const seat of room?.players??[]){const peer=this.peers.get(seat.id);if(peer?.roomId===roomId){this.detach(peer);this.emit(peer,{type:'world-boss-closed'});}}
  }
 }
 /** Moves the turn's damage into the queue for Postgres. */
 private queueWorldBossDamage(m:Match){
  const run=m.worldBoss,hero=m.state.players.find(f=>!f.boss);if(!run||!hero||run.pending<=0)return;
  this.worldBossQueue.push({occurrenceId:run.occurrenceId,battleId:m.state.id,turn:m.state.turnNumber,playerId:hero.id,name:hero.name,level:hero.level,damage:run.pending});run.pending=0;
  void this.flushWorldBoss();
 }
 private async flushWorldBoss(){
  if(this.worldBossFlushing||!this.worldBoss)return;this.worldBossFlushing=true;
  try{while(this.worldBossQueue.length){await this.worldBoss.commit(this.worldBossQueue[0]);this.worldBossQueue.shift();this.followWorldBoss(this.worldBoss.status());}}
  catch(error){this.report(error);this.worldBossRetryAt=Date.now()+2000;}
  finally{this.worldBossFlushing=false;}
 }
 /** The event changed (start, end, global life): clients hear it within a second and running attempts follow it. */
 worldBossChanged(status:WorldBossStatus){this.worldBossDirty=true;this.followWorldBoss(status);}
 private followWorldBoss(status:WorldBossStatus){
  for(const m of this.matches.values()){
   const run=m.worldBoss,wb=m.state.worldBoss;if(!run||!wb||wb.over||wb.closesAt!==undefined)continue;
   const same=status.occurrenceId===run.occurrenceId;
   if(!same||status.phase!=='active'){this.endWorldBossAttempt(m,same?status.endReason??'time':'admin');continue;}
   const queued=this.worldBossQueue.filter(entry=>entry.battleId===m.state.id).reduce((sum,entry)=>sum+entry.damage,0);
   const dragon=m.state.players.find(f=>f.boss),hp=Math.max(0,status.hp-queued-run.pending);
   if(dragon&&(dragon.hp!==hp||wb.hp!==status.hp||wb.endsAt!==status.endsAt)){dragon.hp=hp;dragon.maxHp=status.maxHp;wb.hp=status.hp;wb.maxHp=status.maxHp;wb.endsAt=status.endsAt??wb.endsAt;this.broadcastBattle(m);}
  }
 }
}
