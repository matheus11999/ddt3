import {useEffect,useRef} from 'react';
import {client} from '../client';
import type {Equipment} from '../../shared/catalog';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../../shared/catalog';
import {createTerrain,ground,impactDig,leftArena,terrainWidth,unpackTerrain} from '../../shared/physics';
import {getMap} from '../../shared/maps';
import {createAvatarMotion,drawAvatar,heldMuzzle} from './avatar';
import type {AvatarContext,AvatarMotion} from './avatar';
import {audio,startEnvironmentAudio,stopEnvironmentAudio} from './audio';
import {releaseTerrainMarks,TerrainResidues} from './terrainResidues';
import {playImpactSound,playShotSound} from './weaponSounds';
import {applyDueImpacts} from './terrainPlayback';
import {drawImpact,drawMuzzle,drawProjectile,releaseWeaponEffects} from './weaponEffects';
import {BOOMERANG_IMPACT_DURATION} from './boomerangImpact';
import type {Projectile} from '../../shared/protocol';
import {drawHitFeedback,hitStackSlot,HIT_FEEDBACK_DURATION} from './hitFeedback';
import {flightTime,impactTime,projectileFrame,projectileVisible} from './shotPlayback';
import {drawFighterPlates,type FighterPlate} from './fighterIndicators';
import {drawAimIndicator} from './aimIndicator';
import {aimSource,weaponAimLimits} from '../../shared/aim';
import {drawHitboxDebug,HITBOX_DEBUG} from './hitboxDebug';
import {drawWalkDebug,WALK_DEBUG} from './walkDebug';
import {drawPowerArmed} from './powerArmedEffect';
import {drawTombstone,TOMBSTONE_DELAY} from './tombstone';
import {drawPet} from './petSprite';
import {drawPetApplication,drawPetProjectile,drawPetProjectileImpact,playPetShotSound,preloadPetSounds,releasePetEffects} from './petEffects';
import {INSTANCE_INTRO_MS,MONSTER_MOVE_MS,MONSTER_TURN_ID,QUEEN_DRAW_MS} from '../../shared/instanceTurn';
import {MONSTERS} from '../../shared/expeditions';
import {bubbleStyle,CHAT_BUBBLE_MS,drawSpeechBubble,drawSpeechBubbles} from './speechBubble';
import type {SpeechLine} from './speechBubble';
import type {ChatLine} from '../../shared/protocol';
import {drawArrow,drawArrowImpact,drawMonster,MONSTER_DEATH_MS,monsterPlateY,monsterView,preloadMonsters,releaseMonsters} from './monsters';
import {drawScorchSmoke,scorchAmount,scorchFilter} from './scorch';
import {dragonFocus,dragonLift,dragonPose,drawDragonBack,drawDragonFront,drawDragonPaw,preloadDragon,releaseDragon} from './worldBoss/dragon';
import type {DragonPose} from './worldBoss/dragon';
import {DRAGON_TURN_ID} from '../../shared/worldBoss';
import {blinking,hashSeed,hitFace} from './faceExpressions';
import {publishTerrain,sceneView} from './sceneView';
import {drawAbilityEffect,drawFlightProjectile,ABILITY_EFFECT_DURATION} from './abilityEffects';
import {CONSUMABLE_ICON_DURATION,drawConsumableIcon,drawFrozenBlock,drawIceImpact,drawIceProjectile,ICE_SHATTER_DURATION,playConsumableSound,releaseConsumables} from './consumableEffects';
import {releaseCombatBodies} from './combatBody';
import {releaseWalkBodies} from './walkBody';
import {scenePaint} from './scenePaint';
import {BATTLE_HUD_COVER,EnvironmentRenderer,applyCamera,createCamera,updateCamera,preloadEnvironment,releaseEnvironment,getEnvironmentQuality} from './environment';
import {fallPosition} from '../../shared/fall';
import {LobbyWorld,LOBBY_STATIONS,LOBBY_WALK} from './lobbyWorld';
/** Size of the ranked players on the lobby podium: 50% bigger than the 124 they started at. */
const PODIUM_AVATAR=186;
import {LOBBY_SPAWN,LOBBY_WIDTH} from '../../shared/lobby';
/** Each speaker's latest line of this channel still on screen (chat balloons over the heads). */
function recentSpeech(chat:ChatLine[],channel:ChatLine['channel'],now:number){const lines=new Map<string,ChatLine>();for(const m of chat)if(m.channel===channel&&m.playerId&&now-m.time<CHAT_BUBBLE_MS&&now>=m.time-1000)lines.set(m.playerId,m);return [...lines].sort((a,b)=>a[1].time-b[1].time);}
import {chaseLobbyPosition} from './lobbyMotion';
import {FishingWorld} from './fishingWorld';
import {fishingPick} from './fishingPick';
import {FISHING_SPAWN,FISHING_SPOTS,FISHING_WALK,FISHING_WIDTH,SPOT_REACH} from '../../shared/fishing';
import {chaseBattlePosition,CRAWL_LINGER_MS} from './battleMotion';
import type {LobbyAction} from './lobbyWorld';
const W=1536,H=864;
/** Painting faster than 60 frames per second (120/144 Hz monitors) only doubles the work: the animations are timed for 60. */
const FRAME_MS=1000/60;
/** Sustained frames slower than this lower the canvas resolution a step, down to 1 pixel per game unit. */
const SLOW_FRAME_MS=26,SLOW_FRAMES=150;
type Entity={x:number;y:number;lastX:number;movedAt?:number;facing:number;motion:AvatarMotion;at?:number;teleportedAt?:number;aimOffset?:number;aimChangedAt?:number;tilt?:number;tiltAt?:number};
export function Scene({angle,onLobby,blocked=false}:{angle:number;onLobby:(action:LobbyAction)=>void;blocked?:boolean}){
 const onLobbyRef=useRef(onLobby);onLobbyRef.current=onLobby;
 const blockedRef=useRef(blocked);blockedRef.current=blocked;
 const canvas=useRef<HTMLCanvasElement>(null);const angleRef=useRef(angle);angleRef.current=angle;
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let frame=0;let state=client.state;
  preloadPetSounds();
  // Expedition monsters and the dragon only load for the rooms (and battles) that use them.
  let preloadedMap='';const prepareRoom=()=>{const map=state.room?.map;if(map&&map!==preloadedMap){preloadedMap=map;void preloadEnvironment(map);}
   if(state.room?.kind==='expedition'||state.battle?.instance)preloadMonsters();if(state.room?.kind==='world-boss'||state.battle?.worldBoss)preloadDragon();};
  const unsubscribe=client.subscribe(()=>{state=client.state;prepareRoom();});prepareRoom();
  let density=1,densityCap=2,quality=getEnvironmentQuality();const resizeCanvas=()=>{const rect=el.getBoundingClientRect();quality=getEnvironmentQuality();density=Math.min(quality==='low'?1:densityCap,Math.max(1,rect.width*(window.devicePixelRatio||1)/W));const width=Math.round(W*density),height=Math.round(H*density);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';};
  resizeCanvas();const lobby=new LobbyWorld(quality==='low'?1:2),fishing=new FishingWorld();let hoverLake:string|null=null,pendingSpot:string|null=null;let hover:string|null=null,camX=-1,camY=0,walkDir=0,walkDirY=0,lastWalk=0;const sizeObserver=new ResizeObserver(resizeCanvas);sizeObserver.observe(document.documentElement);window.addEventListener('resize',resizeCanvas);
  let matchId='',terrain=createTerrain(),environment:EnvironmentRenderer|null=null,terrainSource='',shotId='',shotStart=0;const exploded=new Set<number>(),launched=new Set<number>();const entities=new Map<string,Entity>(),fallenAt=new Map<string,number>(),hurtAt=new Map<string,{at:number;critical:boolean}>();let fallenBattle='';let click:{x:number;y:number;time:number}|null=null;let turnId='';let cueMatch='',cueBoosts=0,cuePower=false;let camera=createCamera();
  let drag:{x:number;y:number;cameraX:number;cameraY:number}|null=null;
  let residues:TerrainResidues|null=null;
  const boomerangBursts=new Map<string,{projectile:Projectile;at:number;level:number}>();
  // Enfurecer and Gelo: the tool icon over the head when used, and the ice on frozen fighters (consumableEffects.ts).
  const toolIcons=new Map<string,{id:'rage'|'ice';at:number}>(),seenBoosts=new Map<string,number>(),frozenSeen=new Map<string,{since:number;turns:number;thawAt?:number}>();
  // When each pet projectile landed (its own clock or the server's impact, whichever comes first).
  const petLandings=new Map<string,number>();
  const label=(text:string,x:number,y:number,color='#fff9dd',size=15)=>{c.font=`600 ${size}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#253c46d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);};
  const avatar=(id:string,name:string,eq:Equipment,x:number,y:number,size:number,t:number,facing?:number,context:AvatarContext={},exactY=false,plaza=false)=>{let e=entities.get(id);if(!e){e={x,y,lastX:x,facing:1,motion:createAvatarMotion()};entities.set(id,e);}const dx=x-e.x,dy=y-e.y,oldX=e.x,oldY=e.y;let moving:boolean;
   if(plaza){const next=chaseLobbyPosition(e,{x,y},e.at===undefined?16:Math.min(100,t-e.at));e.at=t;e.x=next.x;e.y=next.y;moving=Math.hypot(e.x-oldX,e.y-oldY)>.05;}
   else if(state.battle&&context.combat){const dt=e.at===undefined?16:Math.min(100,t-e.at);e.at=t;const next=chaseBattlePosition(e,{x,y},dt);e.x=next.x;e.y=exactY?y:next.y;if(Math.abs(e.x-oldX)>.01)e.movedAt=t;moving=e.movedAt!==undefined&&t-e.movedAt<CRAWL_LINGER_MS;}
   else{moving=Math.abs(dx)>.8||(!state.battle&&Math.abs(dy)>.8);e.x+=dx*.16;e.y=exactY?y:e.y+dy*.16;}if(Math.abs(dx)>1.5&&Math.abs(dx)>Math.abs(dy)*.4)e.facing=dx>0?1:-1;const seed=hashSeed(id);drawAvatar(c,eq,e.x,e.y,size,t,moving,facing??e.facing,context.combat===true,e.motion,{...context,world:plaza||context.world,seed,face:context.face??(blinking(t,seed)?'blink':undefined),movementDistance:Math.hypot(e.x-oldX,e.y-oldY)*160/size});drawPet(c,eq.pet,e.x,e.y,size,(facing??e.facing)<0?-1:1,t,moving?'walk':'idle',context.combat===true,state.battle&&context.combat&&!exactY?(px,start)=>ground(terrain,px,start):undefined,id);if(!context.combat&&name)label(name,e.x,e.y-size*1.15-12,id===state.profile?.id?'#fff3a7':'#fff',14);return e;};
  let nextPaint=0,lastPaint=0,slowFrames=0,frameTotal=0,leftBattleAt=-Infinity;
  /** A long run of slow frames means the canvas is too big for this machine: drop its resolution a step. */
  const watchSpeed=(t:number)=>{
   const interval=t-lastPaint;lastPaint=t;
   if(interval<=0||interval>250){slowFrames=frameTotal=0;return;}
   slowFrames++;frameTotal+=interval;if(slowFrames<SLOW_FRAMES)return;
   if(frameTotal/slowFrames>SLOW_FRAME_MS&&densityCap>1&&density>1){densityCap=Math.max(1,Math.min(densityCap,density)-.25);resizeCanvas();console.info(`[brasa] quadros lentos: resolução do cenário reduzida para ${densityCap}x`);}
   slowFrames=frameTotal=0;
  };
  let wasFishing=false;
  /** Battle-only paintings and canvases go as soon as the battle ends, not when the garbage collector runs; an expedition's or the dragon's stay while their room is open (the next stage uses them). */
  const releaseBattleArt=(room?:string)=>{releaseWeaponEffects();releaseConsumables();releasePetEffects();releaseCombatBodies();releaseTerrainMarks();if(room!=='expedition')releaseMonsters();if(room!=='world-boss')releaseDragon();};
  const zoneReady=(scale:number)=>state.zone==='fishing'?fishing.ready(scale):lobby.ready(scale);
  /** Spots someone else is fishing from. */
  const takenSpots=()=>new Set(state.players.filter(p=>p.fishing&&p.id!==state.profile?.id).map(p=>p.fishing!.spot));
  const render=(t:number)=>{
   // The plaza's paintings leave memory while a battle runs and come back once it ends
   // (on the result screen, before the players walk out), so the return shows no gap.
   // Only the zone the player is in keeps its paintings in memory.
   if(state.loading||state.battle&&state.battle.phase!=='finished'){lobby.release();fishing.release();releaseWalkBodies();}else if(state.zone==='fishing'){lobby.release();fishing.load();}else{fishing.release();lobby.load();}
   // Leaving a battle (to the room or the plaza): its ambience, art and canvases go at once.
   if(!state.battle&&matchId){leftBattleAt=t;stopEnvironmentAudio();environment?.dispose();residues?.dispose();releaseBattleArt(state.room?.kind);releaseEnvironment(state.room?.map);preloadedMap=state.room?.map??'';environment=null;residues=null;matchId='';terrainSource='';shotId='';}
   // Opaque menus and room panels cover the plaza. Keep receiving state, but
   // avoid repainting the full world at the monitor's refresh rate underneath.
   // Covered by a menu or the room: nothing under the loading cover is left to paint.
   if(document.hidden||(!state.battle&&(blockedRef.current||state.room))){if(!document.hidden&&scenePaint.wanted())scenePaint.done();frame=requestAnimationFrame(render);lastPaint=0;return;}
   if(t<nextPaint-1){frame=requestAnimationFrame(render);return;}
   // Back from a battle that ended abruptly (left mid-match): hold the last frame while the plaza decodes, rather than an empty sky.
   if(!state.battle&&t-leftBattleAt<1500&&!zoneReady(el.width/W)){frame=requestAnimationFrame(render);return;}
   nextPaint=Math.max(nextPaint+FRAME_MS,t-FRAME_MS);watchSpeed(t);
   if(quality!==getEnvironmentQuality())resizeCanvas();
   c.setTransform(el.width/W,0,0,el.height/H,0,0);c.clearRect(0,0,W,H);const b=state.battle;
   if(!b){
    // The plaza is wider than the view: the camera eases after the player.
    const fishingZone=state.zone==='fishing',walk=fishingZone?FISHING_WALK:LOBBY_WALK;
    const meId=state.profile?.id,me=state.players.find(p=>p.id===meId),seen=meId?entities.get(meId):undefined,focus=seen?.x||me?.x||LOBBY_SPAWN.x;
    // The Pescaria is taller than the view too: there the camera follows up and down as well.
    const target=fishingZone?FishingWorld.camera(focus,seen?.y||me?.y||FISHING_SPAWN.y):{x:LobbyWorld.camera(focus),y:0};
    if(fishingZone!==wasFishing){wasFishing=fishingZone;camX=-1;pendingSpot=null;fishingPick.set(false);}
    if(camX<0){camX=target.x;camY=target.y;}else{camX+=(target.x-camX)*.12;camY+=(target.y-camY)*.12;}
    c.save();c.translate(-camX,-camY);
    if(fishingZone){fishing.drawBack(c,t,camX,camY);if(fishingPick.get())fishing.drawPick(c,t,hoverLake);}else lobby.drawBack(c,t,camX);
    if((walkDir||walkDirY)&&me&&!state.room&&!blockedRef.current&&t-lastWalk>150){lastWalk=t;pendingSpot=null;fishingPick.set(false);client.send({type:'move',x:Math.max(walk.minX,Math.min(walk.maxX,me.x+walkDir*240)),y:fishingZone?Math.max(walk.minY,Math.min(walk.maxY,me.y+walkDirY*160)):me.y});}
    // Walking to a spot picked on the water: cast once there.
    const spot=pendingSpot?FISHING_SPOTS.find(s=>s.id===pendingSpot):undefined;
    if(spot&&me&&Math.hypot(me.x-spot.x,me.y-spot.y)<SPOT_REACH*.5){pendingSpot=null;client.send({type:'fish-cast',spot:spot.id});}
   }
   if(b){
    if(matchId!==b.id){boomerangBursts.clear();petLandings.clear();toolIcons.clear();seenBoosts.clear();frozenSeen.clear();}
    const knownMatch=matchId===b.id;
    if(matchId!==b.id){environment?.dispose();residues?.dispose();matchId=b.id;terrainSource=b.terrain??'';terrain=b.terrain?unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0))):createTerrain(b.map);environment=new EnvironmentRenderer(b.map,terrain);residues=new TerrainResidues(terrain,b.map);camera=createCamera(getMap(b.map).dimensions.width);shotId='';entities.clear();exploded.clear();hurtAt.clear();startEnvironmentAudio(b.map);publishTerrain(terrain);}
    else if(b.terrain!==undefined&&b.terrain!==terrainSource){terrainSource=b.terrain;terrain=unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0)));environment!.setTerrain(terrain);residues!.setTerrain(terrain);publishTerrain(terrain);}
    residues!.sync(b.terrainMarks);
    if(turnId!==b.turnId){turnId=b.turnId;if(b.turnId===state.profile?.id)audio.play('turn');}
    // Own power-ups confirmed by the server: a cue when one more is selected or the POW is armed.
    const self=b.players.find(f=>f.id===state.profile?.id);
    if(self){const boosts=self.boosts.length,power=!!self.powerArmed;if(cueMatch===b.id){if(boosts>cueBoosts)audio.cue('boost');if(power&&!cuePower)audio.cue('pow');}cueMatch=b.id;cueBoosts=boosts;cuePower=power;}
    const shot=state.shot,shooter=shot?b.players.find(f=>f.id===shot.shooterId):undefined,level=shooter?.equipment.upgrade??0;
    if(shot&&shot.id!==shotId){shotId=shot.id;shotStart=state.shotReceivedAt;exploded.clear();launched.clear();for(const index of shot.impacted)exploded.add(index);}
    const elapsed=t-shotStart;
    if(shot){
     const applied=applyDueImpacts(terrain,b.map,shot,elapsed,exploded,b.phase==='finished');
     if(applied.removed){environment!.setTerrain(terrain);residues!.setTerrain(terrain);publishTerrain(terrain);}
     for(const i of applied.indices){const p=shot.projectiles[i];if(p.kind==='ice'&&elapsed-impactTime(p)<700)playConsumableSound('impact');if(p.kind==='flight'||p.kind==='ice'||p.fragment||p.monster)continue;{const dig=impactDig(p.impact);residues!.add({id:`${shot.id}:${i}`,x:dig.x,y:dig.y,radius:dig.radius,...(p.impact.shape?{shape:p.impact.shape}:{}),...(p.impact.profile?{profile:p.impact.profile}:{}),...(p.impact.destructible===false?{scorch:true}:{}),effect:p.effect,level});}if(elapsed-impactTime(p)<700&&!leftArena(p.impact,terrainWidth(terrain!)))playImpactSound(p.effect,level,p.powered,p.impact.destructible!==false);}
    }
    const own=b.players.find(f=>f.id===state.profile?.id),active=b.players.find(f=>f.id===b.turnId&&!f.hidden),focus=active??own;let focusX=focus?.x??W/2,focusY=(focus?.y??H/2)-140;
    // The monsters' shared turn has no fighter of its own: watch the queen while she aims, the nest while ants come out, else the walking monsters.
    const monsterTurn=b.instance?.monsterTurn;
    if(b.turnId===MONSTER_TURN_ID&&monsterTurn){const now=Date.now()+state.offset,queen=b.players.find(f=>f.id===b.instance!.boss&&f.hp>0),walkers=b.players.filter(f=>monsterTurn.moves.some(m=>m.id===f.id&&m.from[0]!==m.to[0]));
     if(queen&&monsterTurn.arrowAt!==undefined&&now<monsterTurn.arrowAt+200&&now>monsterTurn.arrowAt-QUEEN_DRAW_MS-300){focusX=queen.x;focusY=queen.y-160;}
     else if(b.instance!.nest&&monsterTurn.summons.some(s=>now>s.at-400&&now<s.at+700)){focusX=b.instance!.nest.x;focusY=b.instance!.nest.y-140;}
     else if(walkers.length){focusX=walkers.reduce((n,f)=>n+f.x,0)/walkers.length;focusY=walkers[0].y-140;}}
    // Stage 1 opens on the ants arriving: the left column for the first half, then the right one.
    const intro=b.instance&&b.instance.stage===1?b.instance.introUntil-(Date.now()+state.offset):0;
    if(intro>0){const now=Date.now()+state.offset,mid=terrainWidth(terrain)/2,left=intro>INSTANCE_INTRO_MS/2,column=b.players.filter(f=>f.monster&&f.id!==b.instance!.boss&&(f.x<mid)===left).map(f=>monsterView(b,f,terrain,now));
     if(column.length){focusX=column.reduce((n,v)=>n+v.x,0)/column.length+(left?180:-180);focusY=column[0].y-140;}}
    // A boss stage opens on the boss taunting, then on the ants leaving the nest; the camera returns to the party for the first turn.
    const opening=b.instance?.speech&&b.instance.monsterTurn?.id==='opening'&&b.turnId!==MONSTER_TURN_ID?b.instance.monsterTurn:undefined,openingNow=Date.now()+state.offset;
    if(opening&&openingNow<b.instance!.introUntil){const boss=b.players.find(f=>f.id===b.instance!.boss),firstOut=opening.summons[0]?.at??opening.startedAt;
     if(boss&&openingNow<firstOut-300){focusX=boss.x-120;focusY=boss.y-220;}
     else if(openingNow<opening.startedAt+MONSTER_MOVE_MS){const walkers=b.players.filter(f=>opening.moves.some(m=>m.id===f.id)).map(f=>monsterView(b,f,terrain,openingNow));if(walkers.length){focusX=walkers.reduce((n,v)=>n+v.x,0)/walkers.length-160;focusY=walkers[0].y-140;}}}
    // Chefão Mundial: on the player's turn the view holds both the player and the dragon's head, as in DDTank.
    if(b.worldBoss&&focus&&!focus.boss){const boss=b.players.find(f=>f.boss);if(boss){focusX=Math.min(focus.x+560,(focus.x+boss.x-60)/2);focusY=Math.min(focusY,focus.y-200);}}
    if(shot&&b.phase==='resolving'){const p=shot.projectiles.find(p=>elapsed>=p.delay&&elapsed-p.delay<flightTime(p));const point=p?.points[Math.floor(projectileFrame(p,elapsed-p.delay))];if(point){focusX=point[0];focusY=point[1]+70;}
     // Once everything has landed the camera rests on the last impact until the server opens the next turn.
     else{const landed=shot.projectiles.filter(p=>elapsed>=p.delay+flightTime(p)).sort((a,b)=>a.delay+flightTime(a)-b.delay-flightTime(b)).at(-1),last=landed?.points.at(-1);if(landed&&last&&!leftArena(landed.impact,terrainWidth(terrain!))){focusX=last[0];focusY=last[1]+70;}}}
    // Chefão Mundial: the camera follows the dragon's act (its head while it winds up, then where the blow lands).
    const dragon=b.worldBoss?b.players.find(f=>f.boss):undefined,dragonNow=Date.now()+state.offset;
    if(dragon&&(b.turnId===DRAGON_TURN_ID||b.worldBoss!.over)){const hero=own??b.players.find(f=>!f.boss),view=dragonFocus(b,dragon,dragonNow,hero?.x??dragon.x-900,hero?.y??600);if(view){focusX=view.x;focusY=view.y;}}
    let dragonHurt=-1;if(dragon)for(const impact of state.impacts)if(impact.hits.some(hit=>hit.id===dragon.id&&hit.damage>0))dragonHurt=Math.max(dragonHurt,impact.at);
    const dragonHurtAge=dragonHurt<0?-1:dragonNow-dragonHurt,heroFloor=dragon?(own?.y??ground(terrain,dragon.x-900)):0;
    const pose:DragonPose|null=dragon?dragonPose(b,dragon,dragonNow,t,dragonHurtAge,heroFloor,x=>ground(terrain,x,0)):null;
    // While aiming, a living fighter near the bottom edge would hide behind the console: lower the view
    // just enough to show it, never so far that the fighter in focus leaves the top.
    if(b.phase==='aiming'&&focus&&!shot){const hw=W/(2*camera.zoom),hh=H/(2*camera.zoom),low=b.players.filter(f=>f.hp>0&&!f.left&&!f.hidden&&!f.boss&&Math.abs(f.x-focusX)<hw-30).reduce((y,f)=>Math.max(y,f.y),0);
     if(low)focusY=Math.max(focusY,Math.min(low+40-hh+BATTLE_HUD_COVER/camera.zoom,focus.y-170+hh));}
    const look=sceneView.look;if(look){focusX=look.x;focusY=look.y;}
    updateCamera(camera,focusX,focusY);if(look){camera.x=camera.targetX;camera.y=camera.targetY;}sceneView.camera.x=camera.x;sceneView.camera.y=camera.y;sceneView.camera.zoom=camera.zoom;environment!.drawBack(c,t,camera);c.save();applyCamera(c,camera);
    if(pose&&pose.shake>0)c.translate(Math.sin(t*.091)*pose.shake,Math.cos(t*.077)*pose.shake*.6);
    // The dragon rises from behind the lair's ridge: drawn before the terrain.
    if(dragon&&pose)drawDragonBack(c,dragon,pose,dragonHurtAge,t);
    environment!.drawTerrain(c,t);residues!.draw(c);
    if(dragon&&pose)drawDragonPaw(c,pose,x=>ground(terrain,x,0));
    const serverNow=Date.now()+state.offset;
    // Fighters already down when a battle is first shown (reconnect) skip the drop-in.
    if(fallenBattle!==b.id){fallenBattle=b.id;fallenAt.clear();for(const f of b.players)if(f.hp<=0)fallenAt.set(f.id,-Infinity);}
    // The latest hit on each fighter, timed at the projectile's arrival: it drives the pain face and,
    // when critical, a short burn. Each new projectile restarts or ends it; kept past the shot's impact list.
    for(const impact of state.impacts)for(const hit of impact.hits)if(!hit.hidden&&hit.damage>0){const last=hurtAt.get(hit.id);if(!last||impact.at>last.at||(impact.at===last.at&&hit.critical))hurtAt.set(hit.id,{at:impact.at,critical:hit.critical});}
    const myTeam=b.players.find(player=>player.id===state.profile?.id)?.team,plates:FighterPlate[]=[];
    for(const f of b.players){
     if(f.fall?.void&&serverNow>=f.fall.startedAt+f.fall.duration)continue;
     if(f.hidden){entities.delete(f.id);continue;}
     if(f.boss)continue;
     if(f.monster){
      // Expedition monsters: painted strips moved along the server's timeline (walk-in, shared monster turn).
      const falling=!!f.fall&&serverNow<f.fall.startedAt+f.fall.duration,view=monsterView(b,f,terrain,serverNow),summon=b.instance?.monsterTurn?.summons.find(s=>s.id===f.id);
      const pending=!!summon&&f.hp<=0&&serverNow<summon.at+1500;if(!view.visible||(pending&&serverNow<summon!.at))continue;
      let deathAge=-1;if(f.hp<=0&&!pending&&!falling){if(!fallenAt.has(f.id))fallenAt.set(f.id,t);deathAge=t-fallenAt.get(f.id)!;if(deathAge>MONSTER_DEATH_MS)continue;}else fallenAt.delete(f.id);
      if(falling)view.y=fallPosition(f.fall!,serverNow);
      const hurt=hurtAt.get(f.id),hurtAge=hurt?serverNow-hurt.at:-1,slope=f.monster==='ant-queen'||falling?0:Math.max(-.4,Math.min(.4,Math.atan2(ground(terrain,view.x+16,Math.max(0,view.y-40))-ground(terrain,view.x-16,Math.max(0,view.y-40)),32)));
      drawMonster(c,f,view,slope,hurtAge,deathAge);
      // The queen wears a player-style plate under her feet; ants a slim bar under theirs.
      if(deathAge<0&&view.alpha>.5)plates.push(f.id===b.instance?.boss?{fighter:f,x:view.x,y:view.y+136,ally:false,active:false}:{fighter:f,x:view.x,y:monsterPlateY(f,view.y),ally:f.team===myTeam,active:false,slim:true});
      continue;
     }
     const previous=entities.get(f.id),teleport=state.abilityEffects.filter(effect=>effect.playerId===f.id&&effect.ability==='flight').at(-1);
     if(previous&&teleport&&teleport.at!==(previous.teleportedAt??0)){previous.x=f.x;previous.y=f.y;previous.lastX=f.x;previous.teleportedAt=teleport.at;}
     // HP and fall positions change only in the authoritative impact snapshot.
     const falling=!!f.fall&&serverNow<f.fall.startedAt+f.fall.duration,hold=b.phase==='resolving'&&!!shot,lift=b.worldBoss?dragonLift(b,f.id,serverNow):0,y=(falling?fallPosition(f.fall!,serverNow):f.y)-lift,hp=f.hp;
     // Killed by one projectile of a multi-shot: the stone drops on that impact, not after the rest land.
     // Later hits dig under the body and it sinks with the crater as a stone, not as the avatar again.
     if(hp<=0&&!f.fall?.void){if(!fallenAt.has(f.id))fallenAt.set(f.id,shot&&b.phase==='resolving'&&shot.projectiles.some((_,i)=>!shot.impacted.includes(i))?t-TOMBSTONE_DELAY:t);const age=t-fallenAt.get(f.id)!-TOMBSTONE_DELAY;if(age>=0){const seen=entities.get(f.id);drawTombstone(c,seen?.x??f.x,y,age,f.facing);continue;}}else if(hp>0)fallenAt.delete(f.id);
     const entity=entities.get(f.id),walking=entity&&(Math.abs(f.x-entity.x)>.8||entity.movedAt!==undefined&&t-entity.movedAt<CRAWL_LINGER_MS);
     const groundTilt=f.aimSlope!==undefined?-f.aimSlope*f.facing*Math.PI/180:Math.max(-.5,Math.min(.5,Math.atan2(ground(terrain,f.x+12,Math.max(0,y-40))-ground(terrain,f.x-12,Math.max(0,y-40)),24)));
     // The body eases into a new ground angle instead of snapping at each crawl step.
     let slope=groundTilt;if(entity){const dt=entity.tiltAt===undefined?1e3:Math.min(250,t-entity.tiltAt);entity.tilt=entity.tilt===undefined||falling?groundTilt:entity.tilt+(groundTilt-entity.tilt)*(1-Math.exp(-dt/110));entity.tiltAt=t;slope=entity.tilt;}
     let pose:AvatarContext['pose']=walking?'walk':b.turnId===f.id&&b.phase==='aiming'?(f.charging?'charge':'aim'):'idle',poseTime=0;
     if(Math.abs(slope)>.43&&!walking)pose='prone';
     if(falling)pose='fall';
     if(shot&&hold){
      const launch=shot.projectiles.filter(p=>!p.fragment&&elapsed>=p.delay&&elapsed-p.delay<500).at(-1);
      if(f.id===shot.shooterId&&launch){pose='fire';poseTime=elapsed-launch.delay;}
      const hit=shot.hits.filter(h=>h.id===f.id&&exploded.has(h.projectileIndex??0)).at(-1);
      if(hit){const p=shot.projectiles[hit.projectileIndex??0],age=p?elapsed-impactTime(p):500;if(age>=0&&age<500){pose='hit';poseTime=age;}}
     }
     if(lift>0){pose='hit';poseTime=120;}
     if(hp===0)pose='defeat';else if(b.phase==='finished')pose=b.winner===f.team?'victory':'defeat';if(falling)pose='fall';
     {const count=f.boosts.length,before=seenBoosts.get(f.id)??(knownMatch?0:count);seenBoosts.set(f.id,count);
      if(count>before&&!f.hidden){const used=f.boosts.slice(before).filter((id):id is 'rage'|'ice'=>id==='rage'||id==='ice').at(-1);if(used)toolIcons.set(f.id,{id:used,at:t});}
      const turns=hp>0?f.frozenTurns??0:0,ice=frozenSeen.get(f.id);
      if(turns>0&&(!ice||ice.thawAt!==undefined))frozenSeen.set(f.id,{since:knownMatch?t:t-1e4,turns});else if(turns>0&&ice)ice.turns=turns;
      else if(turns<=0&&ice&&ice.thawAt===undefined){ice.thawAt=t;if(hp>0)playConsumableSound('impact');}else if(ice?.thawAt!==undefined&&t-ice.thawAt>ICE_SHATTER_DURATION)frozenSeen.delete(f.id);}
     const armedFx=!!f.powerArmed&&hp>0&&!f.hidden&&(f.invisibleTurns??0)<=0;if(armedFx)drawPowerArmed(c,entity?.x??f.x,entity?.y??y,t,'back',quality==='high'?'high':'low');
     const aiming=f.id===state.profile?.id&&f.hp>0&&!falling&&b.phase!=='finished',aimAge=entity?.aimChangedAt===undefined?-1:t-entity.aimChangedAt,limits=aiming?weaponAimLimits(aimSource(f),f.aimSlope??0):undefined;
     // The red arc rides the body, behind the avatar, as DDTank's TakeAimAsset.
     if(limits)drawAimIndicator(c,entity?.x??f.x,entity?.y??y,f.facing,angleRef.current,slope,aimAge,limits,'back');
     // Pain face right after a hit; otherwise `avatar` makes the fighter blink now and then.
     const hurt=hurtAt.get(f.id),scorchAge=hurt?serverNow-hurt.at:-1,scorch=hp>0&&hurt?.critical?scorchAmount(scorchAge):0,face=hp<=0?undefined:(hurt?hitFace(serverNow-hurt.at,hurt.critical):undefined);
     c.save();if((f.invisibleTurns??0)>0)c.globalAlpha*=.35;if(scorch>0)c.filter=scorchFilter(scorch);
     const e=avatar(f.id,f.name,f.equipment,f.x,y,112,t,f.facing,{combat:true,pose,angle:f.id===state.profile?.id?angleRef.current:f.aimAngle??45,power:f.chargePower??0,slope:falling?0:slope,poseTime:pose==='hit'||pose==='fire'?poseTime:undefined,face},falling||lift>0||entity?.motion.pose==='fall');
     c.restore();if(scorch>0&&(f.invisibleTurns??0)<=0)drawScorchSmoke(c,e.x,e.y,scorchAge,scorch);if(armedFx)drawPowerArmed(c,e.x,e.y,t,'front',quality==='high'?'high':'low');
     {const ice=frozenSeen.get(f.id);if(ice&&!f.hidden)drawFrozenBlock(c,e.x,e.y,ice,t);const icon=toolIcons.get(f.id);if(icon){if(t-icon.at>=CONSUMABLE_ICON_DURATION)toolIcons.delete(f.id);else if(!f.hidden)drawConsumableIcon(c,icon.id,e.x,e.y,t-icon.at);}}
     if(hp>0)plates.push({fighter:f,x:e.x,y:e.y,ally:f.team===myTeam,active:b.turnId===f.id&&b.phase==='aiming'});
     if(e.aimOffset!==undefined&&e.aimOffset!==(f.aimSlope??0))e.aimChangedAt=t;e.aimOffset=f.aimSlope??0;
     if(limits)drawAimIndicator(c,e.x,e.y,f.facing,angleRef.current,slope,e.aimChangedAt===undefined?-1:t-e.aimChangedAt,limits,'front');
    }
    // Plates go on top of every fighter, stacked when neighbours stand close together.
    drawFighterPlates(c,plates,t);
    if(dragon&&pose)drawDragonFront(c,b,dragon,pose,serverNow,t,x=>ground(terrain,x,0),quality==='high'?'high':'low');
    // Speech bubbles (a boss taunting at a stage's opening), above the speaker's head.
    for(const line of b.instance?.speech??[]){if(serverNow<line.from||serverNow>line.to)continue;const speaker=b.players.find(f=>f.id===line.id);if(!speaker||speaker.hp<=0)continue;
     const mouth=speaker.monster?MONSTERS[speaker.monster].mouth??{forward:0,up:MONSTERS[speaker.monster].sprite.height*.66}:{forward:10,up:110};drawSpeechBubble(c,line.text,speaker.x+speaker.facing*mouth.forward,speaker.y-mouth.up,speaker.facing,serverNow-line.from,line.to-serverNow,terrainWidth(terrain));}
    // Chat balloons: what a fighter just wrote in the room chat, in the look of their Bolha, in front of the face (lying down, the head is forward).
    const said:SpeechLine[]=[];for(const [id,line] of recentSpeech(state.chat,'room',serverNow)){const f=b.players.find(p=>p.id===id),seen=entities.get(id);if(!f||f.hp<=0||f.hidden||!seen)continue;said.push({text:line.text,tipX:seen.x+f.facing*44,tipY:seen.y-24,facing:f.facing,age:serverNow-line.time,left:line.time+CHAT_BUBBLE_MS-serverNow,options:{style:bubbleStyle(line.bubble),scale:.8,side:true}});}
    drawSpeechBubbles(c,said,terrainWidth(terrain));
    if(shot&&elapsed<shot.duration+700){
     shot.projectiles.forEach((p,i)=>{if(!projectileVisible(shot,i,b.phase==='finished'))return;const age=elapsed-p.delay;if(age<0)return;const index=projectileFrame(p,age);
      if(p.monster==='arrow'){if(age<flightTime(p))drawArrow(c,p.points,index);else drawArrowImpact(c,p.impact.x,p.impact.y,age-flightTime(p));return;}
      if(p.kind==='flight'){if(age<flightTime(p))drawFlightProjectile(c,p,index,t,{quality:quality==='high'?'high':'low'});return;}
      if(p.kind==='ice'){if(!launched.has(i)){launched.add(i);if(age<180)playConsumableSound('fire');}if(age<flightTime(p))drawIceProjectile(c,p,index);else drawIceImpact(c,p.impact.x,p.impact.y,age-flightTime(p));return;}
      // Held guns and wands: the flash and the first frames of the projectile start at the
      // painted muzzle and ease onto the authoritative path. Drawing only; physics is unchanged.
      const origin=p.points[0],seen=shooter&&!p.fragment?entities.get(shooter.id):undefined,muzzle=seen&&origin?heldMuzzle(shooter!.equipment.weapon,shooter!.facing,112,-(shooter!.aimSlope??0)*shooter!.facing*Math.PI/180):null;
      const offset=muzzle&&origin?[seen!.x+muzzle[0]-origin[0],seen!.y+muzzle[1]-origin[1]]:[0,0],ease=1-Math.min(1,age/140)**2;
      if(shooter&&!p.fragment&&(i===0||shot.projectiles[i-1].delay!==p.delay)){if(!launched.has(i)){launched.add(i);if(age<180&&!playPetShotSound(p))playShotSound(p.effect,level,p.powered);}drawMuzzle(c,origin?origin[0]+offset[0]-27*shooter.facing:shooter.x,origin?origin[1]+offset[1]+40:shooter.y,p.effect,age,level,shooter.facing,p.points[1]&&origin?Math.atan2(p.points[1][1]-origin[1],p.points[1][0]-origin[0]):undefined,p.powered,{quality:quality==='high'?'high':'low'});}
      if(p.pet){
       const key=`${shot.id}:${i}`;if(!petLandings.has(key)&&(age>=flightTime(p)||shot.impacted.includes(i)))petLandings.set(key,t);
       const landed=petLandings.get(key);
       if(landed===undefined){c.save();c.translate(offset[0]*ease,offset[1]*ease);drawPetProjectile(c,p,index,t);c.restore();}else drawPetProjectileImpact(c,p,t-landed);return;}
      if(age<flightTime(p)){c.save();c.translate(offset[0]*ease,offset[1]*ease);drawProjectile(c,p,index,level,t,{quality:quality==='high'?'high':'low'});c.restore();}
      else if(p.effect==='boomerang'){
       const key=`${shot.id}:${i}`,at=shotStart+impactTime(p);
       if(t-at<BOOMERANG_IMPACT_DURATION&&!leftArena(p.impact,terrainWidth(terrain))&&!boomerangBursts.has(key))boomerangBursts.set(key,{projectile:p,at,level});
      }else drawImpact(c,p,age-flightTime(p),level,p.impact.material,{quality:quality==='high'?'high':'low'});
     });
    }
    // Let the complete impact finish even when the server has already advanced the turn.
    for(const [key,burst] of boomerangBursts){const age=t-burst.at;if(age>=BOOMERANG_IMPACT_DURATION){boomerangBursts.delete(key);continue;}drawImpact(c,burst.projectile,age,burst.level,burst.projectile.impact.material,{quality:quality==='high'?'high':'low'});}
    // Each hit of a multi-shot gets its own number, stacked above the earlier ones on the same fighter.
    // Pet skills with art: the area attack where it rose, heals on the fighter.
    for(const batch of state.petEffects){const age=Date.now()+state.offset-batch.at,healed=new Map<string,number>();for(const app of batch.applications){const seen=entities.get(app.targetId);
     // A pet heal is only a green number over the fighter, stacked like damage when several land at once.
     if((app.kind==='hot'||app.kind==='heal')&&seen&&(app.amount??0)>0){const stack=healed.get(app.targetId)??0;healed.set(app.targetId,stack+1);drawHitFeedback(c,{id:app.targetId,damage:app.amount!,x:seen.x,y:seen.y-85,projectileIndex:stack,critical:false,kind:'direct',quality:1},age,{heal:true,stack});continue;}
     drawPetApplication(c,app,age,seen?{x:seen.x,y:seen.y}:undefined,(x,y)=>ground(terrain,x,y));}}
    for(const impact of state.impacts){const age=Date.now()+state.offset-impact.at;if(age>=0&&age<HIT_FEEDBACK_DURATION)for(const hit of impact.hits)if(!hit.hidden){const stack=hitStackSlot(state.impacts,impact,hit);drawHitFeedback(c,hit,age,{quality:quality==='high'?'high':'low',stack});}}
    for(const effect of state.abilityEffects){const age=Date.now()+state.offset-effect.at;if(age>=0&&age<ABILITY_EFFECT_DURATION)drawAbilityEffect(c,effect,age,{quality:quality==='high'?'high':'low'});}
    if(HITBOX_DEBUG)drawHitboxDebug(c,b,shot??null,elapsed,state.profile?.id);
    if(WALK_DEBUG)drawWalkDebug(c,b,terrain,state.profile?.id);
    c.restore();environment!.drawFront(c,t,camera);
   }else{
    if(state.zone==='fishing'){
     const people=state.players.map(p=>({...p,name:p.name+(p.id===state.profile?.id?' · você':'')}));
     const now=Date.now()+state.offset;
     const drawn=[...fishing.sprites(t,hover,camX,camY),...people.map(p=>({y:p.y,draw:()=>{
      const spot=p.fishing?FISHING_SPOTS.find(s=>s.id===p.fishing!.spot):undefined;
      const e=avatar(p.id,p.name,p.equipment,p.x,p.y,134,t,spot?.facing,{},false,true);
      if(spot&&p.fishing)fishing.drawGear(c,p.fishing,spot,e.x,e.y,134,now);
     }}))].sort((a,b)=>a.y-b.y);
     for(const item of drawn)item.draw(c);
     fishing.drawFront(c,t,hover,camX,camY);
     const spoken:SpeechLine[]=[];for(const [id,line] of recentSpeech(state.chat,'world',now)){const seen=entities.get(id);if(!seen||!state.players.some(p=>p.id===id))continue;spoken.push({text:line.text,tipX:seen.x+seen.facing*6,tipY:seen.y-134*1.15-30,facing:seen.facing<0?-1:1,age:now-line.time,left:line.time+CHAT_BUBBLE_MS-now,options:{style:bubbleStyle(line.bubble),top:24,scale:.78}});}
     drawSpeechBubbles(c,spoken,FISHING_WIDTH);
     if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
     c.restore();fishing.drawOverlay(c,t);
    }else{
    // Keepers carry no weapon in the plaza; their name tags come from the world layer.
    const npcs=lobby.keepers().map(k=>({id:k.id,x:k.x,y:k.y,name:'',facing:k.facing,equipment:{...DEFAULT_EQUIPMENT,hat:k.hat}}));
    const people=[...npcs,...state.players.map(p=>({...p,facing:undefined,name:p.name+(p.id===state.profile?.id?' · você':'')}))];
    // The day's top three stand on their podium, half again the size of a walker in the plaza, facing the middle; drawn just after the podium itself.
    const podiums=lobby.podiums(),ranked=state.ranking.flatMap(entry=>{const spot=podiums.find(p=>p.rank===entry.rank);return spot?[{entry,spot}]:[];});
    lobby.occupied=new Set(ranked.map(({entry})=>entry.rank));
    const champions=ranked.map(({entry,spot})=>({y:LOBBY_STATIONS.find(s=>s.rank===entry.rank)!.y-23,draw:()=>{avatar(`podium-${entry.id}`,`${entry.name} · ${entry.wins} ${entry.wins===1?'vitória':'vitórias'}`,entry.equipment,spot.x,spot.y,PODIUM_AVATAR,t,entry.rank===3?-1:1,{},true);}}));
    const drawn=[...lobby.sprites(t,hover),...champions,...people.map(p=>({y:p.y,draw:()=>{avatar(p.id,p.name,p.equipment,p.x,p.y,p.id.startsWith('npc')?124:134,t,p.facing,{},false,true);}}))].sort((a,b)=>a.y-b.y);
    for(const item of drawn)item.draw(c);
    lobby.drawFront(c,t,hover);
    // Chat balloons over the walkers who just wrote in Mundo, in the look of their Bolha.
    const plazaNow=Date.now()+state.offset,spoken:SpeechLine[]=[];for(const [id,line] of recentSpeech(state.chat,'world',plazaNow)){const seen=entities.get(id);if(!seen||!state.players.some(p=>p.id===id))continue;spoken.push({text:line.text,tipX:seen.x+seen.facing*6,tipY:seen.y-134*1.15-30,facing:seen.facing<0?-1:1,age:plazaNow-line.time,left:line.time+CHAT_BUBBLE_MS-plazaNow,options:{style:bubbleStyle(line.bubble),top:24,scale:.78}});}
    drawSpeechBubbles(c,spoken,LOBBY_WIDTH);
    if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
    c.restore();lobby.drawOverlay(c,t);
    }
   }
   // A loading cover waits for a frame with every painting in it (the plaza's art decodes over a few frames).
   if(scenePaint.wanted()&&(b||zoneReady(el.width/W)))scenePaint.done();
   frame=requestAnimationFrame(render);
  };
  // Right click on someone in the plaza (walkers and the podium) opens the player menu.
  const contextMenu=(e:MouseEvent)=>{
   e.preventDefault();if(blockedRef.current||state.battle||state.room)return;
   const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W+Math.max(0,camX),y=(e.clientY-r.top)/r.height*H+camY;
   const candidates=[...state.players.map(p=>({id:p.id,name:p.name,key:p.id,size:134,context:'lobby' as const})),...(state.zone==='fishing'?[]:state.ranking).map(entry=>({id:entry.id,name:entry.name,key:`podium-${entry.id}`,size:PODIUM_AVATAR,context:'ranking' as const}))];
   let best:typeof candidates[number]|null=null,bestDistance=Infinity;
   for(const candidate of candidates){const e=entities.get(candidate.key);if(!e)continue;const half=candidate.size*.32,top=e.y-candidate.size*1.12;if(x<e.x-half||x>e.x+half||y<top||y>e.y+8)continue;const d=Math.abs(x-e.x)+Math.abs(y-(e.y-candidate.size*.5));if(d<bestDistance){best=candidate;bestDistance=d;}}
   if(best)client.openPlayerMenu(e,{id:best.id,name:best.name,context:best.context});
  };
  const pointer=(e:PointerEvent)=>{if(blockedRef.current)return;if(state.battle){if(e.button===0){el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,cameraX:camera.x,cameraY:camera.y};}return;}if(state.room||e.button!==0)return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W+Math.max(0,camX),y=(e.clientY-r.top)/r.height*H+camY;
   if(state.zone==='fishing'){
    const hit=fishing.hit(x,y),picking=fishingPick.get();pendingSpot=null;fishingPick.set(false);
    if(hit?.kind==='station'){if(hit.station.action==='plaza')client.goTo('plaza');else client.openFishShop();return;}
    if(hit?.kind==='lake'){
     // The nearest free spot of that lake to the click: walk there, and after Lançar, cast on arrival.
     const taken=takenSpots(),free=FISHING_SPOTS.filter(s=>s.lake===hit.lake.id&&!taken.has(s.id)),me=state.players.find(p=>p.id===state.profile?.id);
     // Already standing at one of its spots: fish right there.
     const here=me&&free.find(s=>Math.hypot(s.x-me.x,s.y-me.y)<=SPOT_REACH);
     if(picking&&here){client.send({type:'fish-cast',spot:here.id});return;}
     const spot=free.sort((a,b)=>Math.hypot(a.bobX-x,a.bobY-y)-Math.hypot(b.bobX-x,b.bobY-y))[0];
     if(!spot){client.update({error:'Todos os lugares deste lago estão ocupados.'});return;}
     if(picking)pendingSpot=spot.id;client.send({type:'move',x:spot.x,y:spot.y});click={x:spot.x,y:spot.y,time:performance.now()};return;
    }
    const target={x:Math.max(FISHING_WALK.minX,Math.min(FISHING_WALK.maxX,x)),y:Math.max(FISHING_WALK.minY,Math.min(FISHING_WALK.maxY,y))};client.send({type:'move',...target});click={...target,time:performance.now()};return;
   }
   const action=lobby.hit(x,y);if(action){onLobbyRef.current(action);return;}
   const target={x:Math.max(LOBBY_WALK.minX,Math.min(LOBBY_WALK.maxX,x)),y:Math.max(LOBBY_WALK.minY,Math.min(LOBBY_WALK.maxY,y))};client.send({type:'move',...target});click={...target,time:performance.now()};};
  const pointerMove=(e:PointerEvent)=>{if(drag&&state.battle){const r=el.getBoundingClientRect();sceneView.look={x:drag.cameraX-(e.clientX-drag.x)/r.width*W/camera.zoom,y:drag.cameraY-(e.clientY-drag.y)/r.height*H/camera.zoom};el.style.cursor='grabbing';return;}if(state.battle||state.room||blockedRef.current){hover=null;el.style.cursor='';return;}const r=el.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W+Math.max(0,camX),py=(e.clientY-r.top)/r.height*H+camY;
   if(state.zone==='fishing'){const hit=fishing.hit(px,py);hover=hit?.kind==='station'?hit.station.id:null;const lake=hit?.kind==='lake'?hit.lake:null;if((lake?.id??null)!==hoverLake){hoverLake=lake?.id??null;window.dispatchEvent(new CustomEvent('brasa-fishing-lake',{detail:lake?.name??null}));}el.style.cursor=hit?'pointer':fishingPick.get()?'not-allowed':'';return;}
   hoverLake=null;hover=lobby.hover(px,py)?.id??null;el.style.cursor=hover?'pointer':'';};
  // Arrow keys / A-D walk sideways along the plaza; releasing stops where the player is.
  const typing=(e:KeyboardEvent)=>['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName);
  const keyDir=(e:KeyboardEvent)=>['arrowleft','a'].includes(e.key.toLowerCase())?-1:['arrowright','d'].includes(e.key.toLowerCase())?1:0;
  // Up and down (W/S) only in the Pescaria, whose terraces climb with stairs.
  const keyDirY=(e:KeyboardEvent)=>state.zone!=='fishing'?0:['arrowup','w'].includes(e.key.toLowerCase())?-1:['arrowdown','s'].includes(e.key.toLowerCase())?1:0;
  const keyDown=(e:KeyboardEvent)=>{if(state.battle||state.room||typing(e))return;const dir=keyDir(e),dirY=keyDirY(e);if(dir){walkDir=dir;lastWalk=0;}if(dirY){walkDirY=dirY;lastWalk=0;e.preventDefault();}};
  const keyUp=(e:KeyboardEvent)=>{const dir=keyDir(e),dirY=keyDirY(e);if(dirY&&dirY===walkDirY)walkDirY=0;else if(!dir||dir!==walkDir)return;else walkDir=0;if(walkDir||walkDirY)return;pendingSpot=null;fishingPick.set(false);const me=state.players.find(p=>p.id===state.profile?.id);if(me&&!state.battle&&!state.room)client.send({type:'move',x:me.x,y:me.y});};
  const stopWalk=()=>{walkDir=0;walkDirY=0;};
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',stopWalk);
  // Holding and dragging the battlefield looks around; letting go hands the camera back to the turn and the shot.
  const release=()=>{if(!drag)return;drag=null;sceneView.look=null;el.style.cursor='';};
  el.addEventListener('contextmenu',contextMenu);el.addEventListener('pointerdown',pointer);el.addEventListener('pointermove',pointerMove);el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);frame=requestAnimationFrame(render);return()=>{unsubscribe();sizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);cancelAnimationFrame(frame);stopEnvironmentAudio();el.removeEventListener('contextmenu',contextMenu);el.removeEventListener('pointerdown',pointer);el.removeEventListener('pointermove',pointerMove);el.removeEventListener('pointerup',release);el.removeEventListener('pointercancel',release);sceneView.look=null;window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',stopWalk);};
 },[]);
 return <canvas className="world-canvas" ref={canvas} width={1536} height={864} tabIndex={0} aria-label="Mundo do jogo. Clique na rua para caminhar. Na batalha, use as setas e segure Espaço para disparar."/>;
}
