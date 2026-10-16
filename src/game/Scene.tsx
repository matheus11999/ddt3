import {useEffect,useRef} from 'react';
import {client} from '../client';
import type {State} from '../client';
import type {Equipment} from '../../shared/catalog';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../../shared/catalog';
import {createTerrain,ground,unpackTerrain} from '../../shared/physics';
import {createAvatarMotion,drawAvatar} from './avatar';
import type {AvatarContext,AvatarMotion} from './avatar';
import {audio,startEnvironmentAudio,stopEnvironmentAudio} from './audio';
import {TerrainResidues} from './terrainResidues';
import {applyDueImpacts} from './terrainPlayback';
import {drawImpact,drawMuzzle,drawProjectile} from './weaponEffects';
import {EnvironmentRenderer,applyCamera,createCamera,updateCamera,zoomCamera,preloadEnvironment,getEnvironmentQuality} from './environment';
import {getMap} from '../../shared/maps';
const W=1536,H=864;
type Entity={x:number;y:number;lastX:number;facing:number;motion:AvatarMotion};
export function Scene({angle,onArena,onForge}:{angle:number;onArena:()=>void;onForge:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);const angleRef=useRef(angle);angleRef.current=angle;
 useEffect(()=>{
  const el=canvas.current!,c=el.getContext('2d')!;let frame=0;let state=client.state;
  let preloadedMap='';const prepareRoom=()=>{const map=state.room?.map;if(map&&map!==preloadedMap){preloadedMap=map;void preloadEnvironment(map);}};
  const unsubscribe=client.subscribe(()=>{state=client.state;prepareRoom();});prepareRoom();const lobby=new Image();lobby.src='/assets/lobby.png';
  let density=1,quality=getEnvironmentQuality();const resizeCanvas=()=>{const rect=el.getBoundingClientRect();quality=getEnvironmentQuality();density=Math.min(quality==='low'?1:2,Math.max(1,rect.width*(window.devicePixelRatio||1)/W));const width=Math.round(W*density),height=Math.round(H*density);if(el.width!==width||el.height!==height){el.width=width;el.height=height;}c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';};
  resizeCanvas();const sizeObserver=new ResizeObserver(resizeCanvas);sizeObserver.observe(document.documentElement);window.addEventListener('resize',resizeCanvas);
  let matchId='',terrain=createTerrain(),environment:EnvironmentRenderer|null=null,terrainSource='',shotId='',shotStart=0;const exploded=new Set<number>();const entities=new Map<string,Entity>();const settled=new Map<string,{y:number;hp:number}>();let click:{x:number;y:number;time:number}|null=null;let turnId='';let camera=createCamera();let pan:{x:number;y:number;until:number}|null=null;
  let residues:TerrainResidues|null=null;
  let panEnabled=false,drag:{id:number;x:number;y:number}|null=null;
  const cameraState=()=>window.dispatchEvent(new CustomEvent('brasa-camera-state',{detail:{zoom:camera.targetZoom,panning:panEnabled}}));
  const label=(text:string,x:number,y:number,color='#fff9dd',size=15)=>{c.font=`600 ${size}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#253c46d9';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);};
  const avatar=(id:string,name:string,eq:Equipment,x:number,y:number,size:number,t:number,facing?:number,context:AvatarContext={})=>{let e=entities.get(id);if(!e){e={x,y,lastX:x,facing:1,motion:createAvatarMotion()};entities.set(id,e);}const dx=x-e.x,dy=y-e.y,oldX=e.x,oldY=e.y;const moving=Math.abs(dx)>.8||(!state.battle&&Math.abs(dy)>.8);e.x+=dx*.16;e.y+=dy*.16;if(Math.abs(dx)>.5)e.facing=dx>0?1:-1;drawAvatar(c,eq,e.x,e.y,size,t,moving,facing??e.facing,true,e.motion,{...context,movementDistance:Math.hypot(e.x-oldX,e.y-oldY)*160/size});label(name,e.x,e.y-size*(context.combat?.75:1)-12,id===state.profile?.id?'#fff3a7':'#fff',14);return e;};
  const render=(t:number)=>{
   if(quality!==getEnvironmentQuality())resizeCanvas();
   c.setTransform(el.width/W,0,0,el.height/H,0,0);c.clearRect(0,0,W,H);const b=state.battle;if(!b){if(lobby.complete&&lobby.naturalWidth)c.drawImage(lobby,0,0,W,H);else{c.fillStyle='#12365e';c.fillRect(0,0,W,H);}}
   if(b){
    if(matchId!==b.id){matchId=b.id;terrainSource=b.terrain??'';terrain=b.terrain?unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0))):createTerrain(b.map);environment=new EnvironmentRenderer(b.map,terrain);residues=new TerrainResidues(terrain);camera=createCamera();shotId='';entities.clear();settled.clear();exploded.clear();pan=null;panEnabled=false;drag=null;el.style.touchAction='';cameraState();startEnvironmentAudio(b.map);}
    else if(b.terrain!==undefined&&b.terrain!==terrainSource){terrainSource=b.terrain;terrain=unpackTerrain(Uint8Array.from(atob(b.terrain),x=>x.charCodeAt(0)));environment!.setTerrain(terrain);residues!.setTerrain(terrain);settled.clear();}
    residues!.sync(b.terrainMarks);
    if(turnId!==b.turnId){turnId=b.turnId;if(b.turnId===state.profile?.id)audio.play('turn');}
    const shot=state.shot,shooter=shot?b.players.find(f=>f.id===shot.shooterId):undefined,level=shooter?.equipment.upgrade??0;
    if(shot&&shot.id!==shotId){shotId=shot.id;shotStart=state.shotReceivedAt;exploded.clear();for(const [id,initial] of Object.entries(state.shotBaseline))settled.set(id,{y:initial.y,hp:initial.hp});if(t-shotStart<700)audio.play('shot',shot.projectiles[0]?.effect,level,shot.powered);}
    const elapsed=t-shotStart;
    if(shot){
     const applied=applyDueImpacts(terrain,b.map,shot,elapsed,exploded);
     if(applied.removed){environment!.setTerrain(terrain);residues!.setTerrain(terrain);}
     for(const i of applied.indices){const p=shot.projectiles[i];if(p.fragment)continue;residues!.add({id:`${shot.id}:${i}`,x:p.impact.x,y:p.impact.y,radius:p.impact.radius,effect:p.effect,level});if(elapsed-p.delay-p.points.length*1000/60<700)audio.play('impact',p.effect,level,p.powered);}
    }
    const active=b.players.find(f=>f.id===b.turnId);let focusX=active?.x??W/2,focusY=(active?.y??H/2)-140;
    if(shot&&b.phase==='resolving'){const p=shot.projectiles.find(p=>elapsed>=p.delay&&elapsed-p.delay<p.points.length*1000/60);const point=p?.points[Math.floor((elapsed-p.delay)*60/1000)];if(point){focusX=point[0];focusY=point[1]+70;}}
    if(pan&&t<pan.until){focusX=pan.x;focusY=pan.y;}
    updateCamera(camera,focusX,focusY);environment!.drawBack(c,t,camera);c.save();applyCamera(c,camera);environment!.drawTerrain(c,t);residues!.draw(c);
    for(const f of b.players){
     const previous=settled.get(f.id)??{y:f.y,hp:f.hp},hold=b.phase==='resolving'&&!!shot;
     const y=hold?ground(terrain,f.x,Math.max(0,previous.y-3)):f.y;
     const damage=hold?shot!.hits.filter(h=>h.id===f.id&&exploded.has(h.projectileIndex??0)).reduce((sum,h)=>sum+h.damage,0):0;
     const hp=hold?Math.max(0,previous.hp-damage):f.hp;
     if(!hold)settled.set(f.id,{y:f.y,hp:f.hp});
     const entity=entities.get(f.id),falling=entity&&y-entity.y>9,walking=entity&&Math.abs(f.x-entity.x)>.8;
     const slope=Math.max(-.5,Math.min(.5,Math.atan2(ground(terrain,f.x+12,Math.max(0,y-40))-ground(terrain,f.x-12,Math.max(0,y-40)),24)));
     let pose:AvatarContext['pose']=walking?'walk':b.turnId===f.id&&b.phase==='aiming'?(f.charging?'charge':'aim'):'idle',poseTime=0;
     if(Math.abs(slope)>.43&&!walking)pose='prone';
     if(falling)pose='fall';
     if(shot&&hold){
      const launch=shot.projectiles.filter(p=>!p.fragment&&elapsed>=p.delay&&elapsed-p.delay<350).at(-1);
      if(f.id===shot.shooterId&&launch){pose='fire';poseTime=elapsed-launch.delay;}
      const hit=shot.hits.filter(h=>h.id===f.id&&exploded.has(h.projectileIndex??0)).at(-1);
      if(hit){const p=shot.projectiles[hit.projectileIndex??0],age=elapsed-p.delay-p.points.length*1000/60;if(age>=0&&age<500){pose='hit';poseTime=age;}}
     }
     if(hp===0)pose='defeat';else if(b.phase==='finished')pose=b.winner===f.team?'victory':'defeat';
     const e=avatar(f.id,f.name,f.equipment,f.x,Math.min(y,1000),112,t,f.facing,{combat:true,pose,angle:f.id===state.profile?.id?angleRef.current:f.aimAngle??45,power:f.chargePower??0,slope,poseTime:pose==='hit'||pose==='fire'?poseTime:undefined});
     c.fillStyle='#302537bb';c.fillRect(e.x-35,e.y-111,70,7);c.fillStyle=f.team===0?'#16cfff':'#ff4b67';c.fillRect(e.x-34,e.y-110,68*hp/f.maxHp,5);
     if(b.turnId===f.id&&b.phase==='aiming'){c.fillStyle='#ffe7a2';c.beginPath();c.moveTo(e.x-7,e.y-131);c.lineTo(e.x+7,e.y-131);c.lineTo(e.x,e.y-122);c.fill();
      if(f.id===state.profile?.id){const a=angleRef.current*Math.PI/180;c.save();c.strokeStyle='#fff5b1';c.lineWidth=2;c.setLineDash([4,7]);c.beginPath();c.moveTo(e.x,e.y-40);c.lineTo(e.x+Math.cos(a)*100*f.facing,e.y-40-Math.sin(a)*100);c.stroke();c.restore();}}
    }
    if(shot&&elapsed<shot.duration+700){
     shot.projectiles.forEach((p,i)=>{const age=elapsed-p.delay;if(age<0)return;const index=Math.floor(age*60/1000);
      if(shooter&&!p.fragment&&(i===0||shot.projectiles[i-1].delay!==p.delay)){const origin=p.points[0];drawMuzzle(c,origin?origin[0]-27*shooter.facing:shooter.x,origin?origin[1]+40:shooter.y,p.effect,age,level,shooter.facing,p.points[1]&&origin?Math.atan2(p.points[1][1]-origin[1],p.points[1][0]-origin[0]):undefined,p.powered);}
      if(index<p.points.length)drawProjectile(c,p,index,level,t);else drawImpact(c,p,age-p.points.length*1000/60,level,p.impact.material);
     });
     for(const hit of shot.hits){const p=shot.projectiles[hit.projectileIndex??0],age=elapsed-p.delay-p.points.length*1000/60;if(age>=0&&age<900){c.save();c.globalAlpha=Math.min(1,(900-age)/350);label('−'+hit.damage,hit.x,hit.y-age/25,'#fff0b7',25);c.restore();}}
    }
    c.restore();environment!.drawFront(c,t,camera);
   }else{
    if(matchId){stopEnvironmentAudio();panEnabled=false;drag=null;el.style.touchAction='';}environment=null;residues=null;matchId='';terrainSource='';shotId='';
    const npcs=[{id:'npc-mira',name:'Mira · Ferreira',x:310,y:570,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-cap',outfit:'outfit-executive',weapon:'ember',upgrade:10}},{id:'npc-bento',name:'Bento · Arena',x:1192,y:540,equipment:{...DEFAULT_EQUIPMENT,hat:'hat-knight',outfit:'outfit-surfer',weapon:'volt',upgrade:9}}];
    const all=[...npcs,...state.players.map(p=>({...p,name:p.name+(p.id===state.profile?.id?' · você':'')}))].sort((a,b)=>a.y-b.y);
    for(const p of all){const size=p.id.startsWith('npc')?118:134;avatar(p.id,p.name,p.equipment,p.x,p.y,size,t);}
    // A small number of animated motes adds life without changing world collision.
    for(let i=0;i<22;i++){const x=(i*137+t*.014)%W,y=180+(i*71)%480+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,246,184,${.15+Math.sin(t/800+i)*.12})`;c.beginPath();c.arc(x,y,1.5+i%2,0,Math.PI*2);c.fill();}
    if(click&&t-click.time<800){const a=(t-click.time)/800;c.strokeStyle=`rgba(255,242,164,${1-a})`;c.lineWidth=2;c.beginPath();c.ellipse(click.x,click.y,10+a*30,4+a*9,0,0,Math.PI*2);c.stroke();}
   }
   frame=requestAnimationFrame(render);
  };
  const pointer=(e:PointerEvent)=>{if(state.battle){if(e.button===0)el.focus({preventScroll:true});if(panEnabled||e.button===1){e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);}return;}if(state.room)return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
   if(x>1090&&x<1300&&y>380&&y<565){onArena();return;}if(x>230&&x<365&&y>410&&y<590){onForge();return;}
   const target={x:Math.max(160,Math.min(1400,x)),y:Math.max(490,Math.min(750,y))};client.send({type:'move',...target});click={...target,time:performance.now()};};
  const wheel=(event:WheelEvent)=>{if(!state.battle)return;event.preventDefault();zoomCamera(camera,event.deltaY<0?.13:-.13,getMap(state.battle.map));cameraState();};
  const cameraEvent=(event:Event)=>{if(!state.battle)return;const action=(event as CustomEvent<string>).detail;if(action==='reset'){camera.targetZoom=1;pan=null;panEnabled=false;el.style.touchAction='';}else if(action==='in'||action==='out')zoomCamera(camera,action==='in'?.15:-.15,getMap(state.battle.map));cameraState();};
  const panMode=(event:Event)=>{panEnabled=!!(event as CustomEvent<boolean>).detail;el.style.touchAction=panEnabled?'none':'';if(!panEnabled){pan=null;drag=null;}cameraState();};
  const panCamera=(event:PointerEvent)=>{if(!state.battle||!drag||event.pointerId!==drag.id)return;const r=el.getBoundingClientRect();const dx=(event.clientX-drag.x)*W/r.width/camera.zoom,dy=(event.clientY-drag.y)*H/r.height/camera.zoom;pan={x:(pan?.x??camera.x)-dx,y:(pan?.y??camera.y)-dy,until:performance.now()+8000};drag.x=event.clientX;drag.y=event.clientY;};
  const endPan=(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);drag=null;};
  el.addEventListener('pointerdown',pointer);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('pointermove',panCamera);el.addEventListener('pointerup',endPan);el.addEventListener('pointercancel',endPan);window.addEventListener('brasa-camera',cameraEvent);window.addEventListener('brasa-camera-pan',panMode);frame=requestAnimationFrame(render);return()=>{unsubscribe();sizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);cancelAnimationFrame(frame);stopEnvironmentAudio();el.style.touchAction='';el.removeEventListener('pointerdown',pointer);el.removeEventListener('wheel',wheel);el.removeEventListener('pointermove',panCamera);el.removeEventListener('pointerup',endPan);el.removeEventListener('pointercancel',endPan);window.removeEventListener('brasa-camera',cameraEvent);window.removeEventListener('brasa-camera-pan',panMode);};
 },[onArena,onForge]);
 return <canvas className="world-canvas" ref={canvas} width={1536} height={864} tabIndex={0} aria-label="Mundo do jogo. Clique na rua para caminhar. Na batalha, use as setas e segure Espaço para disparar."/>;
}
