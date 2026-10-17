import {useEffect,useRef} from 'react';
import {client} from '../client';
import type {Equipment} from '../../shared/catalog';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../../shared/catalog';
import {createTerrain,ground,unpackTerrain} from '../../shared/physics';
import {createAvatarMotion,drawAvatar} from './avatar';
import type {AvatarContext,AvatarMotion} from './avatar';
import {audio,startEnvironmentAudio,stopEnvironmentAudio} from './audio';
import {TerrainResidues} from './terrainResidues';
import {applyDueImpacts} from './terrainPlayback';
import {drawImpact,drawMuzzle,drawProjectile} from './weaponEffects';
import {drawHitFeedback,HIT_FEEDBACK_DURATION} from './hitFeedback';
import {flightTime,impactTime,projectileFrame,projectileVisible} from './shotPlayback';
import {drawFighterIndicators} from './fighterIndicators';
import {drawAimIndicator} from './aimIndicator';
import {drawAbilityEffect,drawFlightProjectile,ABILITY_EFFECT_DURATION} from './abilityEffects';
import {EnvironmentRenderer,applyCamera,createCamera,updateCamera,preloadEnvironment,getEnvironmentQuality} from './environment';
import {fallPosition} from '../../shared/fall';
import {weaponAimLimits} from '../../shared/aim';
import {LobbyWorld,LOBBY_NPCS,LOBBY_WALK} from './lobbyWorld';
import type {LobbyAction} from './lobbyWorld';
const W=1536,H=864;
type Entity={x:number;y:number;lastX:number;facing:number;motion:AvatarMotion;teleportedAt?:number;aimOffset?:number;aimChangedAt?:number};
export function Scene({angle,onLobby,blocked=false}:{angle:number;onLobby:(action:LobbyAction)=>void;blocked?:boolean}){
 const onLobbyRef=useRef(onLobby);onLobbyRef.current=onLobby;
 const blockedRef=useRef(blocked);blockedRef.current=blocked;
 const canvas=useRef<HTMLCanvasElement>(null);const angleRef=useRef(angle);angleRef.current=angle;
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let frame=0;let state=client.state;
  let preloadedMap='';const prepareRoom=()=>{const map=state.room?.map;if(map&&map!==preloadedMap){preloadedMap=map;void preloadEnvironment(map);}};
  const unsubscribe=client.subscribe(()=>{state=client.state;prepareRoom();});prepareRoom();
  let density=1,quality=getEnvironmentQuality();const resizeCanvas=()=>{const rect=el.getBoundingClientRect();quality=getEnvironmentQuality();density=Math.min(quality==='low'?1:2,Math.max(1,rect.width*(window.devicePixelRatio||1)/W));const width=Math.round(W*density),height=Math.round(H*density);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';};
  resizeCanvas();const lobby=new LobbyWorld(quality==='low'?1:2);let hover:LobbyAction|null=null;const sizeObserver=new ResizeObserver(resizeCanvas);sizeObserver.observe(document.documentElement);window.addEventListener('resize',resizeCanvas);
  let matchId='',terrain=createTerrain(),environment:EnvironmentRenderer|null=null,terrainSource='',shotId='',shotStart=0;const exploded=new Set<number>(),launched=new Set<number>();const entities=new Map<string,Entity>();let click:{x:number;y:number;time:number}|null=null;let turnId='';let camera=createCamera();
  let residues:TerrainResidues|null=null;
  const label=(text:string,x:number,y:number,color='#fff9dd',size=15)=>{c.font=`600 ${size}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#253c46d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);};
  const avatar=(id:string,name:string,eq:Equipment,x:number,y:number,size:number,t:number,facing?:number,context:AvatarContext={},exactY=false)=>{let e=entities.get(id);if(!e){e={x,y,lastX:x,facing:1,motion:createAvatarMotion()};entities.set(id,e);}const dx=x-e.x,dy=y-e.y,oldX=e.x,oldY=e.y;const moving=Math.abs(dx)>.8||(!state.battle&&Math.abs(dy)>.8);e.x+=dx*.16;e.y=exactY?y:e.y+dy*.16;if(Math.abs(dx)>.5)e.facing=dx>0?1:-1;drawAvatar(c,eq,e.x,e.y,size,t,moving,facing??e.facing,context.combat===true,e.motion,{...context,movementDistance:Math.hypot(e.x-oldX,e.y-oldY)*160/size});if(!context.combat&&name)label(name,e.x,e.y-size*1.15-12,id===state.profile?.id?'#fff3a7':'#fff',14);return e;};
  const render=(t:number)=>{
   if(quality!==getEnvironmentQuality())resizeCanvas();
   c.setTransform(el.width/W,0,0,el.height/H,0,0);c.clearRect(0,0,W,H);const b=state.battle;if(!b)lobby.drawBack(c,t);
   if(b){
    if(matchId!==b.id){matchId=b.id;terrainSource=b.terrain??'';terrain=b.terrain?unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0))):createTerrain(b.map);environment=new EnvironmentRenderer(b.map,terrain);residues=new TerrainResidues(terrain);camera=createCamera();shotId='';entities.clear();exploded.clear();startEnvironmentAudio(b.map);}
    else if(b.terrain!==undefined&&b.terrain!==terrainSource){terrainSource=b.terrain;terrain=unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0)));environment!.setTerrain(terrain);residues!.setTerrain(terrain);}
    residues!.sync(b.terrainMarks);
    if(turnId!==b.turnId){turnId=b.turnId;if(b.turnId===state.profile?.id)audio.play('turn');}
    const shot=state.shot,shooter=shot?b.players.find(f=>f.id===shot.shooterId):undefined,level=shooter?.equipment.upgrade??0;
    if(shot&&shot.id!==shotId){shotId=shot.id;shotStart=state.shotReceivedAt;exploded.clear();launched.clear();for(const index of shot.impacted)exploded.add(index);}
    const elapsed=t-shotStart;
    if(shot){
     const applied=applyDueImpacts(terrain,b.map,shot,elapsed,exploded,b.phase==='finished');
     if(applied.removed){environment!.setTerrain(terrain);residues!.setTerrain(terrain);}
     for(const i of applied.indices){const p=shot.projectiles[i];if(p.kind==='flight'||p.fragment)continue;residues!.add({id:`${shot.id}:${i}`,x:p.impact.x,y:p.impact.y,radius:p.impact.radius,effect:p.effect,level});if(elapsed-impactTime(p)<700)audio.play('impact',p.effect,level,p.powered);}
    }
    const own=b.players.find(f=>f.id===state.profile?.id),active=b.players.find(f=>f.id===b.turnId&&!f.hidden),focus=active??own;let focusX=focus?.x??W/2,focusY=(focus?.y??H/2)-140;
    if(shot&&b.phase==='resolving'){const p=shot.projectiles.find(p=>elapsed>=p.delay&&elapsed-p.delay<flightTime(p));const point=p?.points[Math.floor(projectileFrame(p,elapsed-p.delay))];if(point){focusX=point[0];focusY=point[1]+70;}}
    updateCamera(camera,focusX,focusY);environment!.drawBack(c,t,camera);c.save();applyCamera(c,camera);environment!.drawTerrain(c,t);residues!.draw(c);
    const serverNow=Date.now()+state.offset;
    for(const f of b.players){
     if(f.fall?.void&&serverNow>=f.fall.startedAt+f.fall.duration)continue;
     if(f.hidden){entities.delete(f.id);continue;}
     const previous=entities.get(f.id),teleport=state.abilityEffects.filter(effect=>effect.playerId===f.id&&effect.ability==='flight').at(-1);
     if(previous&&teleport&&teleport.at!==(previous.teleportedAt??0)){previous.x=f.x;previous.y=f.y;previous.lastX=f.x;previous.teleportedAt=teleport.at;}
     // HP and fall positions change only in the authoritative impact snapshot.
     const falling=!!f.fall&&serverNow<f.fall.startedAt+f.fall.duration,hold=b.phase==='resolving'&&!!shot,y=falling?fallPosition(f.fall!,serverNow):f.y,hp=f.hp;
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
     c.save();if((f.invisibleTurns??0)>0)c.globalAlpha*=.35;
     const e=avatar(f.id,f.name,f.equipment,f.x,y,112,t,f.facing,{combat:true,pose,angle:f.id===state.profile?.id?angleRef.current:f.aimAngle??45,power:f.chargePower??0,slope:falling?0:slope,poseTime:pose==='hit'||pose==='fire'?poseTime:undefined},falling||entity?.motion.pose==='fall');
     c.restore();drawFighterIndicators(c,f,e.x,e.y,f.team===b.players.find(player=>player.id===state.profile?.id)?.team,b.turnId===f.id&&b.phase==='aiming',t);
     if(e.aimOffset!==undefined&&e.aimOffset!==(f.aimSlope??0))e.aimChangedAt=t;e.aimOffset=f.aimSlope??0;
     if(f.id===state.profile?.id&&f.hp>0&&!falling&&b.phase!=='finished'){const weapon=WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)!,limits=weaponAimLimits(weapon,f.aimSlope??0);drawAimIndicator(c,e.x,e.y,f.facing,angleRef.current,f.aimSlope??0,e.aimChangedAt===undefined?-1:t-e.aimChangedAt,limits.minAngle,limits.maxAngle);}
    }
    if(shot&&elapsed<shot.duration+700){
     shot.projectiles.forEach((p,i)=>{if(!projectileVisible(shot,i,b.phase==='finished'))return;const age=elapsed-p.delay;if(age<0)return;const index=projectileFrame(p,age);
      if(p.kind==='flight'){if(age<flightTime(p))drawFlightProjectile(c,p,index,t,{quality:quality==='high'?'high':'low'});return;}
      if(shooter&&!p.fragment&&(i===0||shot.projectiles[i-1].delay!==p.delay)){if(!launched.has(i)){launched.add(i);if(age<180)audio.play('shot',p.effect,level,p.powered);}const origin=p.points[0];drawMuzzle(c,origin?origin[0]-27*shooter.facing:shooter.x,origin?origin[1]+40:shooter.y,p.effect,age,level,shooter.facing,p.points[1]&&origin?Math.atan2(p.points[1][1]-origin[1],p.points[1][0]-origin[0]):undefined,p.powered,{quality:quality==='high'?'high':'low'});}
      if(age<flightTime(p))drawProjectile(c,p,index,level,t,{quality:quality==='high'?'high':'low'});else drawImpact(c,p,age-flightTime(p),level,p.impact.material,{quality:quality==='high'?'high':'low'});
     });
    }
    for(const impact of state.impacts){const age=Date.now()+state.offset-impact.at;if(age>=0&&age<HIT_FEEDBACK_DURATION)for(const hit of impact.hits)if(!hit.hidden)drawHitFeedback(c,hit,age,{quality:quality==='high'?'high':'low'});}
    for(const effect of state.abilityEffects){const age=Date.now()+state.offset-effect.at;if(age>=0&&age<ABILITY_EFFECT_DURATION)drawAbilityEffect(c,effect,age,{quality:quality==='high'?'high':'low'});}
    c.restore();environment!.drawFront(c,t,camera);
   }else{
    if(matchId)stopEnvironmentAudio();environment=null;residues=null;matchId='';terrainSource='';shotId='';
    // Keepers carry no weapon in the plaza; their name tags come from the world layer.
    const npcs=[{...LOBBY_NPCS.storage,name:'',facing:1,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-tide',outfit:'outfit-surfer'}},{...LOBBY_NPCS.forge,name:'',facing:-1,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-cap',outfit:'outfit-executive'}}];
    const people=[...(lobby.painted?[]:npcs),...state.players.map(p=>({...p,facing:undefined,name:p.name+(p.id===state.profile?.id?' · você':'')}))];
    const drawn=[...lobby.sprites(t,hover),...people.map(p=>({y:p.y,draw:()=>{avatar(p.id,p.name,p.equipment,p.x,p.y,p.id.startsWith('npc')?124:134,t,p.facing);}}))].sort((a,b)=>a.y-b.y);
    for(const item of drawn)item.draw(c);
    lobby.drawFront(c,t,hover);
    if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
   }
   frame=requestAnimationFrame(render);
  };
  const pointer=(e:PointerEvent)=>{if(blockedRef.current)return;if(state.battle){if(e.button===0)el.focus({preventScroll:true});return;}if(state.room)return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
   const action=lobby.hit(x,y);if(action){onLobbyRef.current(action);return;}
   const target={x:Math.max(LOBBY_WALK.minX,Math.min(LOBBY_WALK.maxX,x)),y:Math.max(LOBBY_WALK.minY,Math.min(LOBBY_WALK.maxY,y))};client.send({type:'move',...target});click={...target,time:performance.now()};};
  const pointerMove=(e:PointerEvent)=>{if(state.battle||state.room||blockedRef.current){hover=null;el.style.cursor='';return;}const r=el.getBoundingClientRect();hover=lobby.hit((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H);el.style.cursor=hover?'pointer':'';};
  el.addEventListener('pointerdown',pointer);el.addEventListener('pointermove',pointerMove);frame=requestAnimationFrame(render);return()=>{unsubscribe();sizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);cancelAnimationFrame(frame);stopEnvironmentAudio();el.removeEventListener('pointerdown',pointer);el.removeEventListener('pointermove',pointerMove);};
 },[]);
 return <canvas className="world-canvas" ref={canvas} width={1536} height={864} tabIndex={0} aria-label="Mundo do jogo. Clique na rua para caminhar. Na batalha, use as setas e segure Espaço para disparar."/>;
}
