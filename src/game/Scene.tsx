import {useEffect,useRef} from 'react';
import {client} from '../client';
import type {Equipment} from '../../shared/catalog';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../../shared/catalog';
import {createTerrain,ground,unpackTerrain} from '../../shared/physics';
import {createAvatarMotion,drawAvatar,heldMuzzle} from './avatar';
import type {AvatarContext,AvatarMotion} from './avatar';
import {audio,startEnvironmentAudio,stopEnvironmentAudio} from './audio';
import {TerrainResidues} from './terrainResidues';
import {applyDueImpacts} from './terrainPlayback';
import {drawImpact,drawMuzzle,drawProjectile} from './weaponEffects';
import {drawHitFeedback,HIT_FEEDBACK_DURATION} from './hitFeedback';
import {flightTime,impactTime,projectileFrame,projectileVisible} from './shotPlayback';
import {drawFighterIndicators} from './fighterIndicators';
import {drawAimIndicator} from './aimIndicator';
import {drawPowerArmed} from './powerArmedEffect';
import {publishTerrain,sceneView} from './sceneView';
import {drawAbilityEffect,drawFlightProjectile,ABILITY_EFFECT_DURATION} from './abilityEffects';
import {EnvironmentRenderer,applyCamera,createCamera,updateCamera,preloadEnvironment,getEnvironmentQuality} from './environment';
import {fallPosition} from '../../shared/fall';
import {weaponAimLimits} from '../../shared/aim';
const W=1536,H=864;
type Entity={x:number;y:number;lastX:number;facing:number;motion:AvatarMotion;teleportedAt?:number;aimOffset?:number;aimChangedAt?:number};
export function Scene({angle,onArena,onForge,blocked=false}:{angle:number;onArena:()=>void;onForge:()=>void;blocked?:boolean}){
 const blockedRef=useRef(blocked);blockedRef.current=blocked;
 const canvas=useRef<HTMLCanvasElement>(null);const angleRef=useRef(angle);angleRef.current=angle;
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let frame=0;let state=client.state;
  let preloadedMap='';const prepareRoom=()=>{const map=state.room?.map;if(map&&map!==preloadedMap){preloadedMap=map;void preloadEnvironment(map);}};
  const unsubscribe=client.subscribe(()=>{state=client.state;prepareRoom();});prepareRoom();const lobby=new Image();lobby.src='/assets/lobby.png';
  let density=1,quality=getEnvironmentQuality();const resizeCanvas=()=>{const rect=el.getBoundingClientRect();quality=getEnvironmentQuality();density=Math.min(quality==='low'?1:2,Math.max(1,rect.width*(window.devicePixelRatio||1)/W));const width=Math.round(W*density),height=Math.round(H*density);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';};
  resizeCanvas();const sizeObserver=new ResizeObserver(resizeCanvas);sizeObserver.observe(document.documentElement);window.addEventListener('resize',resizeCanvas);
  let matchId='',terrain=createTerrain(),environment:EnvironmentRenderer|null=null,terrainSource='',shotId='',shotStart=0;const exploded=new Set<number>(),launched=new Set<number>();const entities=new Map<string,Entity>();let click:{x:number;y:number;time:number}|null=null;let turnId='';let camera=createCamera();
  let residues:TerrainResidues|null=null;
  const label=(text:string,x:number,y:number,color='#fff9dd',size=15)=>{c.font=`600 ${size}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#253c46d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);};
  const avatar=(id:string,name:string,eq:Equipment,x:number,y:number,size:number,t:number,facing?:number,context:AvatarContext={},exactY=false)=>{let e=entities.get(id);if(!e){e={x,y,lastX:x,facing:1,motion:createAvatarMotion()};entities.set(id,e);}const dx=x-e.x,dy=y-e.y,oldX=e.x,oldY=e.y;const moving=Math.abs(dx)>.8||(!state.battle&&Math.abs(dy)>.8);e.x+=dx*.16;e.y=exactY?y:e.y+dy*.16;if(Math.abs(dx)>.5)e.facing=dx>0?1:-1;drawAvatar(c,eq,e.x,e.y,size,t,moving,facing??e.facing,context.combat===true,e.motion,{...context,movementDistance:Math.hypot(e.x-oldX,e.y-oldY)*160/size});if(!context.combat)label(name,e.x,e.y-size*1.15-12,id===state.profile?.id?'#fff3a7':'#fff',14);return e;};
  const render=(t:number)=>{
   if(quality!==getEnvironmentQuality())resizeCanvas();
   c.setTransform(el.width/W,0,0,el.height/H,0,0);c.clearRect(0,0,W,H);const b=state.battle;if(!b){if(lobby.complete&&lobby.naturalWidth)c.drawImage(lobby,0,0,W,H);else{c.fillStyle='#12365e';c.fillRect(0,0,W,H);}}
   if(b){
    if(matchId!==b.id){matchId=b.id;terrainSource=b.terrain??'';terrain=b.terrain?unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0))):createTerrain(b.map);environment=new EnvironmentRenderer(b.map,terrain);residues=new TerrainResidues(terrain);camera=createCamera();shotId='';entities.clear();exploded.clear();startEnvironmentAudio(b.map);publishTerrain(terrain);}
    else if(b.terrain!==undefined&&b.terrain!==terrainSource){terrainSource=b.terrain;terrain=unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0)));environment!.setTerrain(terrain);residues!.setTerrain(terrain);publishTerrain(terrain);}
    residues!.sync(b.terrainMarks);
    if(turnId!==b.turnId){turnId=b.turnId;if(b.turnId===state.profile?.id)audio.play('turn');}
    const shot=state.shot,shooter=shot?b.players.find(f=>f.id===shot.shooterId):undefined,level=shooter?.equipment.upgrade??0;
    if(shot&&shot.id!==shotId){shotId=shot.id;shotStart=state.shotReceivedAt;exploded.clear();launched.clear();for(const index of shot.impacted)exploded.add(index);}
    const elapsed=t-shotStart;
    if(shot){
     const applied=applyDueImpacts(terrain,b.map,shot,elapsed,exploded,b.phase==='finished');
     if(applied.removed){environment!.setTerrain(terrain);residues!.setTerrain(terrain);publishTerrain(terrain);}
     for(const i of applied.indices){const p=shot.projectiles[i];if(p.kind==='flight'||p.fragment)continue;residues!.add({id:`${shot.id}:${i}`,x:p.impact.x,y:p.impact.y,radius:p.impact.radius,effect:p.effect,level});if(elapsed-impactTime(p)<700)audio.play('impact',p.effect,level,p.powered);}
    }
    const own=b.players.find(f=>f.id===state.profile?.id),active=b.players.find(f=>f.id===b.turnId&&!f.hidden),focus=active??own;let focusX=focus?.x??W/2,focusY=(focus?.y??H/2)-140;
    if(shot&&b.phase==='resolving'){const p=shot.projectiles.find(p=>elapsed>=p.delay&&elapsed-p.delay<flightTime(p));const point=p?.points[Math.floor(projectileFrame(p,elapsed-p.delay))];if(point){focusX=point[0];focusY=point[1]+70;}}
    updateCamera(camera,focusX,focusY);sceneView.camera.x=camera.x;sceneView.camera.y=camera.y;sceneView.camera.zoom=camera.zoom;environment!.drawBack(c,t,camera);c.save();applyCamera(c,camera);environment!.drawTerrain(c,t);residues!.draw(c);
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
     const armedFx=!!f.powerArmed&&hp>0&&!f.hidden&&(f.invisibleTurns??0)<=0;if(armedFx)drawPowerArmed(c,entity?.x??f.x,entity?.y??y,t,'back',quality==='high'?'high':'low');
     c.save();if((f.invisibleTurns??0)>0)c.globalAlpha*=.35;
     const e=avatar(f.id,f.name,f.equipment,f.x,y,112,t,f.facing,{combat:true,pose,angle:f.id===state.profile?.id?angleRef.current:f.aimAngle??45,power:f.chargePower??0,slope:falling?0:slope,poseTime:pose==='hit'||pose==='fire'?poseTime:undefined},falling||entity?.motion.pose==='fall');
     c.restore();if(armedFx)drawPowerArmed(c,e.x,e.y,t,'front',quality==='high'?'high':'low');drawFighterIndicators(c,f,e.x,e.y,f.team===b.players.find(player=>player.id===state.profile?.id)?.team,b.turnId===f.id&&b.phase==='aiming',t);
     if(e.aimOffset!==undefined&&e.aimOffset!==(f.aimSlope??0))e.aimChangedAt=t;e.aimOffset=f.aimSlope??0;
     if(f.id===state.profile?.id&&f.hp>0&&!falling&&b.phase!=='finished'){const weapon=WEAPONS.find(weapon=>weapon.id===f.equipment.weapon)!,limits=weaponAimLimits(weapon,f.aimSlope??0);drawAimIndicator(c,e.x,e.y,f.facing,angleRef.current,f.aimSlope??0,e.aimChangedAt===undefined?-1:t-e.aimChangedAt,limits.minAngle,limits.maxAngle);}
    }
    if(shot&&elapsed<shot.duration+700){
     shot.projectiles.forEach((p,i)=>{if(!projectileVisible(shot,i,b.phase==='finished'))return;const age=elapsed-p.delay;if(age<0)return;const index=projectileFrame(p,age);
      if(p.kind==='flight'){if(age<flightTime(p))drawFlightProjectile(c,p,index,t,{quality:quality==='high'?'high':'low'});return;}
      // Held guns and wands: the flash and the first frames of the projectile start at the
      // painted muzzle and ease onto the authoritative path. Drawing only; physics is unchanged.
      const origin=p.points[0],seen=shooter&&!p.fragment?entities.get(shooter.id):undefined,muzzle=seen&&origin?heldMuzzle(shooter!.equipment.weapon,shooter!.facing,112):null;
      const offset=muzzle&&origin?[seen!.x+muzzle[0]-origin[0],seen!.y+muzzle[1]-origin[1]]:[0,0],ease=1-Math.min(1,age/140)**2;
      if(shooter&&!p.fragment&&(i===0||shot.projectiles[i-1].delay!==p.delay)){if(!launched.has(i)){launched.add(i);if(age<180)audio.play('shot',p.effect,level,p.powered);}drawMuzzle(c,origin?origin[0]+offset[0]-27*shooter.facing:shooter.x,origin?origin[1]+offset[1]+40:shooter.y,p.effect,age,level,shooter.facing,p.points[1]&&origin?Math.atan2(p.points[1][1]-origin[1],p.points[1][0]-origin[0]):undefined,p.powered,{quality:quality==='high'?'high':'low'});}
      if(age<flightTime(p)){c.save();c.translate(offset[0]*ease,offset[1]*ease);drawProjectile(c,p,index,level,t,{quality:quality==='high'?'high':'low'});c.restore();}else drawImpact(c,p,age-flightTime(p),level,p.impact.material,{quality:quality==='high'?'high':'low'});
     });
    }
    for(const impact of state.impacts){const age=Date.now()+state.offset-impact.at;if(age>=0&&age<HIT_FEEDBACK_DURATION)for(const hit of impact.hits)if(!hit.hidden)drawHitFeedback(c,hit,age,{quality:quality==='high'?'high':'low'});}
    for(const effect of state.abilityEffects){const age=Date.now()+state.offset-effect.at;if(age>=0&&age<ABILITY_EFFECT_DURATION)drawAbilityEffect(c,effect,age,{quality:quality==='high'?'high':'low'});}
    c.restore();environment!.drawFront(c,t,camera);
   }else{
    if(matchId)stopEnvironmentAudio();environment=null;residues=null;matchId='';terrainSource='';shotId='';
    const npcs=[{id:'npc-mira',name:'Mira · Ferreira',x:310,y:570,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-cap',outfit:'outfit-executive',weapon:'ember',upgrade:10}},{id:'npc-bento',name:'Bento · Arena',x:1192,y:540,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-tide',outfit:'outfit-surfer',weapon:'volt',upgrade:9}}];
    const all=[...npcs,...state.players.map(p=>({...p,name:p.name+(p.id===state.profile?.id?' · você':'')}))].sort((a,b)=>a.y-b.y);
    for(const p of all){const size=p.id.startsWith('npc')?118:134;avatar(p.id,p.name,p.equipment,p.x,p.y,size,t);}
    // A small number of animated motes adds life without changing world collision.
    for(let i=0;i<22;i++){const x=(i*137+t*.014)%W,y=180+(i*71)%480+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,246,184,${.15+Math.sin(t/800+i)*.12})`;c.beginPath();c.arc(x,y,1.5+i%2,0,Math.PI*2);c.fill();}
    if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
   }
   frame=requestAnimationFrame(render);
  };
  const pointer=(e:PointerEvent)=>{if(blockedRef.current)return;if(state.battle){if(e.button===0)el.focus({preventScroll:true});return;}if(state.room)return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
   if(x>1090&&x<1300&&y>380&&y<565){onArena();return;}if(x>230&&x<365&&y>410&&y<590){onForge();return;}
   const target={x:Math.max(160,Math.min(1400,x)),y:Math.max(490,Math.min(750,y))};client.send({type:'move',...target});click={...target,time:performance.now()};};
  el.addEventListener('pointerdown',pointer);frame=requestAnimationFrame(render);return()=>{unsubscribe();sizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);cancelAnimationFrame(frame);stopEnvironmentAudio();el.removeEventListener('pointerdown',pointer);};
 },[onArena,onForge]);
 return <canvas className="world-canvas" ref={canvas} width={1536} height={864} tabIndex={0} aria-label="Mundo do jogo. Clique na rua para caminhar. Na batalha, use as setas e segure Espaço para disparar."/>;
}
