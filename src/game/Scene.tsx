import {useEffect,useRef} from 'react';
import {client} from '../client';
import type {Equipment} from '../../shared/catalog';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../../shared/catalog';
import {createTerrain,ground,impactDig,leftArena,terrainWidth,unpackTerrain} from '../../shared/physics';
import {getMap} from '../../shared/maps';
import {createAvatarMotion,drawAvatar,heldMuzzle} from './avatar';
import type {AvatarContext,AvatarMotion} from './avatar';
import {audio,startEnvironmentAudio,stopEnvironmentAudio} from './audio';
import {TerrainResidues} from './terrainResidues';
import {playImpactSound,playShotSound} from './weaponSounds';
import {applyDueImpacts} from './terrainPlayback';
import {drawImpact,drawMuzzle,drawProjectile} from './weaponEffects';
import {drawHitFeedback,HIT_FEEDBACK_DURATION} from './hitFeedback';
import {flightTime,impactTime,projectileFrame,projectileVisible} from './shotPlayback';
import {drawFighterPlates,type FighterPlate} from './fighterIndicators';
import {drawAimIndicator} from './aimIndicator';
import {drawPowerArmed} from './powerArmedEffect';
import {drawTombstone,TOMBSTONE_DELAY} from './tombstone';
import {MONSTER_TURN_ID} from '../../shared/instanceTurn';
import {drawArrow,drawArrowImpact,drawMonster,MONSTER_DEATH_MS,monsterPlateY,monsterView,preloadMonsters} from './monsters';
import {drawScorchSmoke,scorchAmount,scorchFilter} from './scorch';
import {blinking,hashSeed,hitFace} from './faceExpressions';
import {publishTerrain,sceneView} from './sceneView';
import {drawAbilityEffect,drawFlightProjectile,ABILITY_EFFECT_DURATION} from './abilityEffects';
import {EnvironmentRenderer,applyCamera,createCamera,updateCamera,preloadEnvironment,getEnvironmentQuality} from './environment';
import {fallPosition} from '../../shared/fall';
import {aimSource,weaponAimLimits} from '../../shared/aim';
import {LobbyWorld,LOBBY_STATIONS,LOBBY_WALK} from './lobbyWorld';
/** Size of the ranked players on the lobby podium: 50% bigger than the 124 they started at. */
const PODIUM_AVATAR=186;
import {LOBBY_SPAWN} from '../../shared/lobby';
import {chaseLobbyPosition} from './lobbyMotion';
import type {LobbyAction} from './lobbyWorld';
const W=1536,H=864;
type Entity={x:number;y:number;lastX:number;facing:number;motion:AvatarMotion;at?:number;teleportedAt?:number;aimOffset?:number;aimChangedAt?:number};
export function Scene({angle,onLobby,blocked=false}:{angle:number;onLobby:(action:LobbyAction)=>void;blocked?:boolean}){
 const onLobbyRef=useRef(onLobby);onLobbyRef.current=onLobby;
 const blockedRef=useRef(blocked);blockedRef.current=blocked;
 const canvas=useRef<HTMLCanvasElement>(null);const angleRef=useRef(angle);angleRef.current=angle;
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let frame=0;let state=client.state;
  let preloadedMap='';const prepareRoom=()=>{const map=state.room?.map;if(map&&map!==preloadedMap){preloadedMap=map;void preloadEnvironment(map);}};
  preloadMonsters();
  const unsubscribe=client.subscribe(()=>{state=client.state;prepareRoom();});prepareRoom();
  let density=1,quality=getEnvironmentQuality();const resizeCanvas=()=>{const rect=el.getBoundingClientRect();quality=getEnvironmentQuality();density=Math.min(quality==='low'?1:2,Math.max(1,rect.width*(window.devicePixelRatio||1)/W));const width=Math.round(W*density),height=Math.round(H*density);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';};
  resizeCanvas();const lobby=new LobbyWorld(quality==='low'?1:2);let hover:string|null=null,camX=-1,walkDir=0,lastWalk=0;const sizeObserver=new ResizeObserver(resizeCanvas);sizeObserver.observe(document.documentElement);window.addEventListener('resize',resizeCanvas);
  let matchId='',terrain=createTerrain(),environment:EnvironmentRenderer|null=null,terrainSource='',shotId='',shotStart=0;const exploded=new Set<number>(),launched=new Set<number>();const entities=new Map<string,Entity>(),fallenAt=new Map<string,number>(),hurtAt=new Map<string,{at:number;critical:boolean}>();let fallenBattle='';let click:{x:number;y:number;time:number}|null=null;let turnId='';let cueMatch='',cueBoosts=0,cuePower=false;let camera=createCamera();
  let drag:{x:number;y:number;cameraX:number;cameraY:number}|null=null;
  let residues:TerrainResidues|null=null;
  const label=(text:string,x:number,y:number,color='#fff9dd',size=15)=>{c.font=`600 ${size}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#253c46d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);};
  const avatar=(id:string,name:string,eq:Equipment,x:number,y:number,size:number,t:number,facing?:number,context:AvatarContext={},exactY=false,plaza=false)=>{let e=entities.get(id);if(!e){e={x,y,lastX:x,facing:1,motion:createAvatarMotion()};entities.set(id,e);}const dx=x-e.x,dy=y-e.y,oldX=e.x,oldY=e.y;let moving:boolean;
   if(plaza){const next=chaseLobbyPosition(e,{x,y},e.at===undefined?16:Math.min(100,t-e.at));e.at=t;e.x=next.x;e.y=next.y;moving=Math.hypot(e.x-oldX,e.y-oldY)>.05;}
   else{moving=Math.abs(dx)>.8||(!state.battle&&Math.abs(dy)>.8);e.x+=dx*.16;e.y=exactY?y:e.y+dy*.16;}if(Math.abs(dx)>1.5&&Math.abs(dx)>Math.abs(dy)*.4)e.facing=dx>0?1:-1;const seed=hashSeed(id);drawAvatar(c,eq,e.x,e.y,size,t,moving,facing??e.facing,context.combat===true,e.motion,{...context,seed,face:context.face??(blinking(t,seed)?'blink':undefined),movementDistance:Math.hypot(e.x-oldX,e.y-oldY)*160/size});if(!context.combat&&name)label(name,e.x,e.y-size*1.15-12,id===state.profile?.id?'#fff3a7':'#fff',14);return e;};
  const render=(t:number)=>{
   if(quality!==getEnvironmentQuality())resizeCanvas();
   c.setTransform(el.width/W,0,0,el.height/H,0,0);c.clearRect(0,0,W,H);const b=state.battle;
   if(!b){
    // The plaza is wider than the view: the camera eases after the player.
    const meId=state.profile?.id,me=state.players.find(p=>p.id===meId),focus=(meId&&entities.get(meId)?.x)||me?.x||LOBBY_SPAWN.x,target=LobbyWorld.camera(focus);
    camX=camX<0?target:camX+(target-camX)*.12;c.save();c.translate(-camX,0);lobby.drawBack(c,t,camX);
    if(walkDir&&me&&!state.room&&!blockedRef.current&&t-lastWalk>150){lastWalk=t;client.send({type:'move',x:Math.max(LOBBY_WALK.minX,Math.min(LOBBY_WALK.maxX,me.x+walkDir*240)),y:me.y});}
   }
   if(b){
    if(matchId!==b.id){matchId=b.id;terrainSource=b.terrain??'';terrain=b.terrain?unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0))):createTerrain(b.map);environment=new EnvironmentRenderer(b.map,terrain);residues=new TerrainResidues(terrain);camera=createCamera(getMap(b.map).dimensions.width);shotId='';entities.clear();exploded.clear();hurtAt.clear();startEnvironmentAudio(b.map);publishTerrain(terrain);}
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
     for(const i of applied.indices){const p=shot.projectiles[i];if(p.kind==='flight'||p.fragment||p.monster)continue;{const dig=impactDig(p.impact);residues!.add({id:`${shot.id}:${i}`,x:dig.x,y:dig.y,radius:dig.radius,effect:p.effect,level});}if(elapsed-impactTime(p)<700&&!leftArena(p.impact,terrainWidth(terrain!)))playImpactSound(p.effect,level,p.powered,p.impact.destructible!==false);}
    }
    const own=b.players.find(f=>f.id===state.profile?.id),active=b.players.find(f=>f.id===b.turnId&&!f.hidden),focus=active??own;let focusX=focus?.x??W/2,focusY=(focus?.y??H/2)-140;
    // The monsters' shared turn has no fighter of its own: watch the queen while she aims, the nest while ants come out, else the walking monsters.
    const monsterTurn=b.instance?.monsterTurn;
    if(b.turnId===MONSTER_TURN_ID&&monsterTurn){const now=Date.now()+state.offset,queen=b.players.find(f=>f.id===b.instance!.boss&&f.hp>0),walkers=b.players.filter(f=>monsterTurn.moves.some(m=>m.id===f.id&&m.from[0]!==m.to[0]));
     if(queen&&monsterTurn.arrowAt!==undefined&&now<monsterTurn.arrowAt+200&&now>monsterTurn.arrowAt-900){focusX=queen.x;focusY=queen.y-160;}
     else if(b.instance!.nest&&monsterTurn.summons.some(s=>now>s.at-400&&now<s.at+700)){focusX=b.instance!.nest.x;focusY=b.instance!.nest.y-140;}
     else if(walkers.length){focusX=walkers.reduce((n,f)=>n+f.x,0)/walkers.length;focusY=walkers[0].y-140;}}
    if(shot&&b.phase==='resolving'){const p=shot.projectiles.find(p=>elapsed>=p.delay&&elapsed-p.delay<flightTime(p));const point=p?.points[Math.floor(projectileFrame(p,elapsed-p.delay))];if(point){focusX=point[0];focusY=point[1]+70;}}
    const look=sceneView.look;if(look){focusX=look.x;focusY=look.y;}
    updateCamera(camera,focusX,focusY);if(look){camera.x=camera.targetX;camera.y=camera.targetY;}sceneView.camera.x=camera.x;sceneView.camera.y=camera.y;sceneView.camera.zoom=camera.zoom;environment!.drawBack(c,t,camera);c.save();applyCamera(c,camera);environment!.drawTerrain(c,t);residues!.draw(c);
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
     if(f.monster){
      // Expedition monsters: painted strips moved along the server's timeline (walk-in, shared monster turn).
      const falling=!!f.fall&&serverNow<f.fall.startedAt+f.fall.duration,view=monsterView(b,f,terrain,serverNow),summon=b.instance?.monsterTurn?.summons.find(s=>s.id===f.id);
      const pending=!!summon&&f.hp<=0&&serverNow<summon.at+1500;if(!view.visible||(pending&&serverNow<summon!.at))continue;
      let deathAge=-1;if(f.hp<=0&&!pending&&!falling){if(!fallenAt.has(f.id))fallenAt.set(f.id,t);deathAge=t-fallenAt.get(f.id)!;if(deathAge>MONSTER_DEATH_MS)continue;}else fallenAt.delete(f.id);
      if(falling)view.y=fallPosition(f.fall!,serverNow);
      const hurt=hurtAt.get(f.id),hurtAge=hurt?serverNow-hurt.at:-1,slope=f.monster==='ant-queen'||falling?0:Math.max(-.4,Math.min(.4,Math.atan2(ground(terrain,view.x+16,Math.max(0,view.y-40))-ground(terrain,view.x-16,Math.max(0,view.y-40)),32)));
      drawMonster(c,f,view,slope,hurtAge,deathAge);
      if(deathAge<0&&view.alpha>.5&&f.id!==b.instance?.boss)plates.push({fighter:f,x:view.x,y:monsterPlateY(f,view.y),ally:f.team===myTeam,active:false});
      continue;
     }
     const previous=entities.get(f.id),teleport=state.abilityEffects.filter(effect=>effect.playerId===f.id&&effect.ability==='flight').at(-1);
     if(previous&&teleport&&teleport.at!==(previous.teleportedAt??0)){previous.x=f.x;previous.y=f.y;previous.lastX=f.x;previous.teleportedAt=teleport.at;}
     // HP and fall positions change only in the authoritative impact snapshot.
     const falling=!!f.fall&&serverNow<f.fall.startedAt+f.fall.duration,hold=b.phase==='resolving'&&!!shot,y=falling?fallPosition(f.fall!,serverNow):f.y,hp=f.hp;
     // Killed by one projectile of a multi-shot: the stone drops on that impact, not after the rest land.
     // Later hits dig under the body and it sinks with the crater as a stone, not as the avatar again.
     if(hp<=0&&!f.fall?.void){if(!fallenAt.has(f.id))fallenAt.set(f.id,shot&&b.phase==='resolving'&&shot.projectiles.some((_,i)=>!shot.impacted.includes(i))?t-TOMBSTONE_DELAY:t);const age=t-fallenAt.get(f.id)!-TOMBSTONE_DELAY;if(age>=0){const seen=entities.get(f.id);drawTombstone(c,seen?.x??f.x,y,age,f.facing);continue;}}else if(hp>0)fallenAt.delete(f.id);
     const entity=entities.get(f.id),walking=entity&&Math.abs(f.x-entity.x)>.8;
     const slope=f.aimSlope!==undefined?-f.aimSlope*f.facing*Math.PI/180:Math.max(-.5,Math.min(.5,Math.atan2(ground(terrain,f.x+12,Math.max(0,y-40))-ground(terrain,f.x-12,Math.max(0,y-40)),24)));
     let pose:AvatarContext['pose']=walking?'walk':b.turnId===f.id&&b.phase==='aiming'?(f.charging?'charge':'aim'):'idle',poseTime=0;
     if(Math.abs(slope)>.43&&!walking)pose='prone';
     if(falling)pose='fall';
     if(shot&&hold){
      const launch=shot.projectiles.filter(p=>!p.fragment&&elapsed>=p.delay&&elapsed-p.delay<350).at(-1);
      if(f.id===shot.shooterId&&launch){pose='fire';poseTime=elapsed-launch.delay;}
      const hit=shot.hits.filter(h=>h.id===f.id&&exploded.has(h.projectileIndex??0)).at(-1);
      if(hit){const p=shot.projectiles[hit.projectileIndex??0],age=p?elapsed-impactTime(p):500;if(age>=0&&age<500){pose='hit';poseTime=age;}}
     }
     if(hp===0)pose='defeat';else if(b.phase==='finished')pose=b.winner===f.team?'victory':'defeat';if(falling)pose='fall';
     const armedFx=!!f.powerArmed&&hp>0&&!f.hidden&&(f.invisibleTurns??0)<=0;if(armedFx)drawPowerArmed(c,entity?.x??f.x,entity?.y??y,t,'back',quality==='high'?'high':'low');
     const aiming=f.id===state.profile?.id&&f.hp>0&&!falling&&b.phase!=='finished',limits=aiming?weaponAimLimits(aimSource(f),f.aimSlope??0):undefined,aimAge=entity?.aimChangedAt===undefined?-1:t-entity.aimChangedAt;
     // The range band and needle pivot on the body, behind the avatar, as in DDTank.
     if(limits)drawAimIndicator(c,entity?.x??f.x,entity?.y??y,f.facing,angleRef.current,f.aimSlope??0,aimAge,limits.minAngle,limits.maxAngle,'back');
     // Pain face right after a hit; otherwise `avatar` makes the fighter blink now and then.
     const hurt=hurtAt.get(f.id),scorchAge=hurt?serverNow-hurt.at:-1,scorch=hp>0&&hurt?.critical?scorchAmount(scorchAge):0,face=hp<=0?undefined:(hurt?hitFace(serverNow-hurt.at,hurt.critical):undefined);
     c.save();if((f.invisibleTurns??0)>0)c.globalAlpha*=.35;if(scorch>0)c.filter=scorchFilter(scorch);
     const e=avatar(f.id,f.name,f.equipment,f.x,y,112,t,f.facing,{combat:true,pose,angle:f.id===state.profile?.id?angleRef.current:f.aimAngle??45,power:f.chargePower??0,slope:falling?0:slope,poseTime:pose==='hit'||pose==='fire'?poseTime:undefined,face},falling||entity?.motion.pose==='fall');
     c.restore();if(scorch>0&&(f.invisibleTurns??0)<=0)drawScorchSmoke(c,e.x,e.y,scorchAge,scorch);if(armedFx)drawPowerArmed(c,e.x,e.y,t,'front',quality==='high'?'high':'low');if(hp>0)plates.push({fighter:f,x:e.x,y:e.y,ally:f.team===myTeam,active:b.turnId===f.id&&b.phase==='aiming'});
     if(e.aimOffset!==undefined&&e.aimOffset!==(f.aimSlope??0))e.aimChangedAt=t;e.aimOffset=f.aimSlope??0;
     if(limits)drawAimIndicator(c,e.x,e.y,f.facing,angleRef.current,f.aimSlope??0,e.aimChangedAt===undefined?-1:t-e.aimChangedAt,limits.minAngle,limits.maxAngle,'front');
    }
    // Plates go on top of every fighter, stacked when neighbours stand close together.
    drawFighterPlates(c,plates,t);
    if(shot&&elapsed<shot.duration+700){
     shot.projectiles.forEach((p,i)=>{if(!projectileVisible(shot,i,b.phase==='finished'))return;const age=elapsed-p.delay;if(age<0)return;const index=projectileFrame(p,age);
      if(p.monster==='arrow'){if(age<flightTime(p))drawArrow(c,p.points,index);else drawArrowImpact(c,p.impact.x,p.impact.y,age-flightTime(p));return;}
      if(p.kind==='flight'){if(age<flightTime(p))drawFlightProjectile(c,p,index,t,{quality:quality==='high'?'high':'low'});return;}
      // Held guns and wands: the flash and the first frames of the projectile start at the
      // painted muzzle and ease onto the authoritative path. Drawing only; physics is unchanged.
      const origin=p.points[0],seen=shooter&&!p.fragment?entities.get(shooter.id):undefined,muzzle=seen&&origin?heldMuzzle(shooter!.equipment.weapon,shooter!.facing,112,-(shooter!.aimSlope??0)*shooter!.facing*Math.PI/180):null;
      const offset=muzzle&&origin?[seen!.x+muzzle[0]-origin[0],seen!.y+muzzle[1]-origin[1]]:[0,0],ease=1-Math.min(1,age/140)**2;
      if(shooter&&!p.fragment&&(i===0||shot.projectiles[i-1].delay!==p.delay)){if(!launched.has(i)){launched.add(i);if(age<180)playShotSound(p.effect,level,p.powered);}drawMuzzle(c,origin?origin[0]+offset[0]-27*shooter.facing:shooter.x,origin?origin[1]+offset[1]+40:shooter.y,p.effect,age,level,shooter.facing,p.points[1]&&origin?Math.atan2(p.points[1][1]-origin[1],p.points[1][0]-origin[0]):undefined,p.powered,{quality:quality==='high'?'high':'low'});}
      if(age<flightTime(p)){c.save();c.translate(offset[0]*ease,offset[1]*ease);drawProjectile(c,p,index,level,t,{quality:quality==='high'?'high':'low'});c.restore();}else drawImpact(c,p,age-flightTime(p),level,p.impact.material,{quality:quality==='high'?'high':'low'});
     });
    }
    // Each hit of a multi-shot gets its own number, stacked above the earlier ones on the same fighter.
    for(const impact of state.impacts){const age=Date.now()+state.offset-impact.at;if(age>=0&&age<HIT_FEEDBACK_DURATION)for(const hit of impact.hits)if(!hit.hidden){const stack=state.impacts.reduce((n,other)=>other.shotId===impact.shotId&&(other.at<impact.at||(other.at===impact.at&&other.projectileIndex<impact.projectileIndex))?n+other.hits.filter(h=>h.id===hit.id&&!h.hidden&&h.damage>0).length:n,0);drawHitFeedback(c,hit,age,{quality:quality==='high'?'high':'low',stack});}}
    for(const effect of state.abilityEffects){const age=Date.now()+state.offset-effect.at;if(age>=0&&age<ABILITY_EFFECT_DURATION)drawAbilityEffect(c,effect,age,{quality:quality==='high'?'high':'low'});}
    c.restore();environment!.drawFront(c,t,camera);
   }else{
    if(matchId)stopEnvironmentAudio();environment=null;residues=null;matchId='';terrainSource='';shotId='';
    // Keepers carry no weapon in the plaza; their name tags come from the world layer.
    const npcs=lobby.keepers().map(k=>({id:k.id,x:k.x,y:k.y,name:'',facing:k.facing,equipment:{...DEFAULT_EQUIPMENT,hat:k.hat,outfit:`outfit-${k.outfit}`}}));
    const people=[...npcs,...state.players.map(p=>({...p,facing:undefined,name:p.name+(p.id===state.profile?.id?' · você':'')}))];
    // The day's top three stand on their podium, half again the size of a walker in the plaza, facing the middle; drawn just after the podium itself.
    const podiums=lobby.podiums(),ranked=state.ranking.flatMap(entry=>{const spot=podiums.find(p=>p.rank===entry.rank);return spot?[{entry,spot}]:[];});
    lobby.occupied=new Set(ranked.map(({entry})=>entry.rank));
    const champions=ranked.map(({entry,spot})=>({y:LOBBY_STATIONS.find(s=>s.rank===entry.rank)!.y-23,draw:()=>{avatar(`podium-${entry.id}`,`${entry.name} · ${entry.wins} ${entry.wins===1?'vitória':'vitórias'}`,entry.equipment,spot.x,spot.y,PODIUM_AVATAR,t,entry.rank===3?-1:1,{},true);}}));
    const drawn=[...lobby.sprites(t,hover),...champions,...people.map(p=>({y:p.y,draw:()=>{avatar(p.id,p.name,p.equipment,p.x,p.y,p.id.startsWith('npc')?124:134,t,p.facing,{},false,true);}}))].sort((a,b)=>a.y-b.y);
    for(const item of drawn)item.draw(c);
    lobby.drawFront(c,t,hover);
    if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
    c.restore();lobby.drawOverlay(c,t);
   }
   frame=requestAnimationFrame(render);
  };
  // Right click on someone in the plaza (walkers and the podium) opens the player menu.
  const contextMenu=(e:MouseEvent)=>{
   e.preventDefault();if(blockedRef.current||state.battle||state.room)return;
   const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W+Math.max(0,camX),y=(e.clientY-r.top)/r.height*H;
   const candidates=[...state.players.map(p=>({id:p.id,name:p.name,key:p.id,size:134,context:'lobby' as const})),...state.ranking.map(entry=>({id:entry.id,name:entry.name,key:`podium-${entry.id}`,size:PODIUM_AVATAR,context:'ranking' as const}))];
   let best:typeof candidates[number]|null=null,bestDistance=Infinity;
   for(const candidate of candidates){const e=entities.get(candidate.key);if(!e)continue;const half=candidate.size*.32,top=e.y-candidate.size*1.12;if(x<e.x-half||x>e.x+half||y<top||y>e.y+8)continue;const d=Math.abs(x-e.x)+Math.abs(y-(e.y-candidate.size*.5));if(d<bestDistance){best=candidate;bestDistance=d;}}
   if(best)client.openPlayerMenu(e,{id:best.id,name:best.name,context:best.context});
  };
  const pointer=(e:PointerEvent)=>{if(blockedRef.current)return;if(state.battle){if(e.button===0){el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,cameraX:camera.x,cameraY:camera.y};}return;}if(state.room||e.button!==0)return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W+Math.max(0,camX),y=(e.clientY-r.top)/r.height*H;
   const action=lobby.hit(x,y);if(action){onLobbyRef.current(action);return;}
   const target={x:Math.max(LOBBY_WALK.minX,Math.min(LOBBY_WALK.maxX,x)),y:Math.max(LOBBY_WALK.minY,Math.min(LOBBY_WALK.maxY,y))};client.send({type:'move',...target});click={...target,time:performance.now()};};
  const pointerMove=(e:PointerEvent)=>{if(drag&&state.battle){const r=el.getBoundingClientRect();sceneView.look={x:drag.cameraX-(e.clientX-drag.x)/r.width*W/camera.zoom,y:drag.cameraY-(e.clientY-drag.y)/r.height*H/camera.zoom};el.style.cursor='grabbing';return;}if(state.battle||state.room||blockedRef.current){hover=null;el.style.cursor='';return;}const r=el.getBoundingClientRect();hover=lobby.hover((e.clientX-r.left)/r.width*W+Math.max(0,camX),(e.clientY-r.top)/r.height*H)?.id??null;el.style.cursor=hover?'pointer':'';};
  // Arrow keys / A-D walk sideways along the plaza; releasing stops where the player is.
  const typing=(e:KeyboardEvent)=>['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName);
  const keyDir=(e:KeyboardEvent)=>['arrowleft','a'].includes(e.key.toLowerCase())?-1:['arrowright','d'].includes(e.key.toLowerCase())?1:0;
  const keyDown=(e:KeyboardEvent)=>{if(state.battle||state.room||typing(e))return;const dir=keyDir(e);if(dir){walkDir=dir;lastWalk=0;}};
  const keyUp=(e:KeyboardEvent)=>{const dir=keyDir(e);if(!dir||dir!==walkDir)return;walkDir=0;const me=state.players.find(p=>p.id===state.profile?.id);if(me&&!state.battle&&!state.room)client.send({type:'move',x:me.x,y:me.y});};
  const stopWalk=()=>{walkDir=0;};
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',stopWalk);
  // Holding and dragging the battlefield looks around; letting go hands the camera back to the turn and the shot.
  const release=()=>{if(!drag)return;drag=null;sceneView.look=null;el.style.cursor='';};
  el.addEventListener('contextmenu',contextMenu);el.addEventListener('pointerdown',pointer);el.addEventListener('pointermove',pointerMove);el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);frame=requestAnimationFrame(render);return()=>{unsubscribe();sizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);cancelAnimationFrame(frame);stopEnvironmentAudio();el.removeEventListener('contextmenu',contextMenu);el.removeEventListener('pointerdown',pointer);el.removeEventListener('pointermove',pointerMove);el.removeEventListener('pointerup',release);el.removeEventListener('pointercancel',release);sceneView.look=null;window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',stopWalk);};
 },[]);
 return <canvas className="world-canvas" ref={canvas} width={1536} height={864} tabIndex={0} aria-label="Mundo do jogo. Clique na rua para caminhar. Na batalha, use as setas e segure Espaço para disparar."/>;
}
