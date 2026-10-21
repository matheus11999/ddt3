import {view} from '../game/viewport';
import {useEffect,useRef} from 'react';
import {LogOut,Settings} from 'lucide-react';
import {getMap} from '../../shared/maps';
import {WORLD} from '../../shared/physics';
import type {Battle,Fighter} from '../../shared/protocol';
import {petSpecies,petVisual} from '../../shared/pets';
import type {PetSnapshot} from '../../shared/pets';
import {sceneView} from '../game/sceneView';
import {mapImage} from '../game/environment';
import {drawScaled,freeSurface} from '../game/spriteCache';
import {Avatar} from './Avatar';
import {LevelBadge} from './LevelBadge';
import {playerMenuProps} from './PlayerActions';

/** Full-body preview of the fighter whose turn it is, over the game's own aura seal
 * (top-left): the base sigil below +5, the Avatar's upgrade aura from +5, as in the backpack. */
export function ActivePortrait({fighter,mine,resolving,ally}:{fighter:Fighter;mine:boolean;resolving:boolean;ally:boolean}){
 return <section className={`active-portrait ${ally?'ally':'enemy'}`} aria-label={`Jogador da vez: ${fighter.name}`} data-fighter={fighter.id} {...playerMenuProps({id:fighter.id,name:fighter.name,context:'battle'})}>
  <div className="active-portrait-name">{fighter.name}</div>
  {fighter.guild&&<div className="active-portrait-guild">{fighter.guild}</div>}
  <div className="active-portrait-stage">
   {(fighter.equipment.upgrade??0)<5&&<i className="active-portrait-sigil" aria-hidden="true"/>}
   <div className="active-portrait-avatar"><Avatar key={fighter.id} equipment={fighter.equipment} size={170} pose="idle" weapon showAura auraAnimated facing={1}/></div>
   <LevelBadge level={fighter.level} size={34}/>
   <PetMedallion pet={fighter.equipment.pet}/>
  </div>
  <div className="active-portrait-state">{resolving?'DISPARANDO':mine?'SUA VEZ':ally?'VEZ DO ALIADO':'VEZ DO RIVAL'}</div>
 </section>;
}

/** The fighter's pet in a small glass circle beside the portrait, its level underneath (as in DDTank). */
function PetMedallion({pet}:{pet?:PetSnapshot}){
 const visual=petVisual(pet),art=visual?.portrait??visual?.icon??visual?.sprite;
 if(!pet||!art)return null;
 return <div className="active-portrait-pet" title={petSpecies(pet.species)?.name}>
  <span className="active-portrait-pet-ring"><img src={art} alt="" draggable={false}/></span>
  <b>Lv.{pet.level}</b>
 </div>;
}

/** Small portraits with a mini HP bar, one row per team: allies to the left of the
 * wind panel, enemies to the right (top centre). */
export function FighterRoster({players,myTeam,turnId,side}:{players:Fighter[];myTeam:0|1;turnId:string;side:'ally'|'enemy'}){
 const team=players.filter(player=>(player.team===myTeam)===(side==='ally'));
 if(!team.length)return null;
 return <div className={`fighter-roster ${side}`} aria-label={side==='ally'?'Aliados':'Inimigos'}>
  {team.map(player=>{const ratio=Math.max(0,Math.min(1,player.hp/player.maxHp));
   return <div key={player.id} className={`roster-card ${side} ${player.id===turnId?'active-fighter':''} ${player.hp<=0?'defeated-fighter':''}`} data-fighter={player.id} title={`${player.name} · ${player.hp}/${player.maxHp}`} {...playerMenuProps({id:player.id,name:player.name,context:'battle'})}>
    <div className="roster-face"><Avatar equipment={player.equipment} size={46} portrait animated={false} weapon={false}/></div>
    <div className="roster-health" role="meter" aria-label={`Vida de ${player.name}`} aria-valuenow={player.hp} aria-valuemin={0} aria-valuemax={player.maxHp}><i style={{width:`${ratio*100}%`}}/></div>
   </div>;})}
 </div>;
}

/** Wide maps get a wide, short minimap, like DDTank's. */
const MINI_W=216,miniHeight=(worldWidth:number)=>Math.round(MINI_W*WORLD.height/worldWidth);

/** Whole-map overview: live terrain, fighters and the camera's view (top-right). */
export function Minimap({battle,myTeam,myId,onExit,onSettings}:{battle:Battle;myTeam:0|1;myId:string;onExit:()=>void;onSettings?:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),live=useRef({battle,myTeam,myId});live.current={battle,myTeam,myId};
 const worldWidth=getMap(battle.map).dimensions.width,MINI_H=miniHeight(worldWidth),cols=worldWidth/WORLD.cell;
 useEffect(()=>{
  const c=canvas.current?.getContext('2d');if(!c)return;
  // The map's own painted terrain, cut by the live destructible cells (craters show up as they happen).
  const map=getMap(live.current.battle.map),ground=document.createElement('canvas');ground.width=MINI_W*2;ground.height=MINI_H*2;const g=ground.getContext('2d')!;
  // A coarse copy of the fine terrain is plenty for a 216 px overview: one mask pixel per 3x3 cells.
  const STEP=Math.max(1,Math.round(3/WORLD.cell)),maskCols=Math.ceil(cols/STEP),maskRows=Math.ceil(WORLD.rows/STEP);
  const mask=document.createElement('canvas');mask.width=maskCols;mask.height=maskRows;const m=mask.getContext('2d')!;
  let painted=-1,frame=0,last=0;// The battle's own decoded paintings (environment.ts), not a second copy of each.
  const backdrop=mapImage(map.art.background),art=mapImage(map.art.terrain);
  const paintTerrain=(terrain:Uint8Array)=>{
   const image=m.createImageData(maskCols,maskRows);for(let y=0;y<maskRows;y++)for(let x=0;x<maskCols;x++)if(terrain[Math.min(WORLD.rows-1,y*STEP+1)*cols+Math.min(cols-1,x*STEP+1)]===1)image.data[(y*maskCols+x)*4+3]=255;m.putImageData(image,0,0);
   g.globalCompositeOperation='source-over';g.clearRect(0,0,ground.width,ground.height);g.imageSmoothingEnabled=true;g.drawImage(mask,0,0,ground.width,ground.height);
   g.globalCompositeOperation='source-in';if(art.complete&&art.naturalWidth)g.drawImage(art,0,0,ground.width,ground.height);else{g.fillStyle='#c9d6f2';g.fillRect(0,0,ground.width,ground.height);}
  };
  const artLoaded=()=>{painted=-1;};if(!art.complete)art.addEventListener('load',artLoaded,{once:true});
  const draw=(now:number)=>{
   frame=requestAnimationFrame(draw);if(now-last<120)return;last=now;
   const {battle:b,myTeam:team,myId:id}=live.current;
   if(sceneView.terrain?.length===cols*WORLD.rows&&sceneView.version!==painted){painted=sceneView.version;paintTerrain(sceneView.terrain);}
   const sx=MINI_W/worldWidth,sy=MINI_H/WORLD.height;
   const sky=c.createLinearGradient(0,0,0,MINI_H);sky.addColorStop(0,'#1d3b6e');sky.addColorStop(1,'#0b1730');c.fillStyle=sky;c.fillRect(0,0,MINI_W,MINI_H);
   if(backdrop.complete&&backdrop.naturalWidth){const h=backdrop.naturalHeight*MINI_W/backdrop.naturalWidth;c.globalAlpha=.6;drawScaled(c,backdrop,0,MINI_H-h,MINI_W,h);c.globalAlpha=1;c.fillStyle='#0b173044';c.fillRect(0,0,MINI_W,MINI_H);}
   c.drawImage(ground,0,0,MINI_W,MINI_H);
   const cam=sceneView.camera,hw=view.width/(2*cam.zoom),hh=WORLD.height/(2*cam.zoom);
   if(cam.zoom>1.02||worldWidth>view.width){c.strokeStyle='#ffffffcc';c.lineWidth=1;c.strokeRect((cam.x-hw)*sx+.5,(cam.y-hh)*sy+.5,hw*2*sx-1,hh*2*sy-1);}
   // Expeditions: the nest as a ring, the queen as a big gold-rimmed dot, ants as small ones.
   const nest=b.instance?.nest;if(nest){c.beginPath();c.arc(nest.x*sx,(nest.y-10)*sy,4.5,0,Math.PI*2);c.strokeStyle='#e3a25a';c.lineWidth=2;c.stroke();}
   for(const player of b.players){
    if(player.hidden||player.hp<=0)continue;
    if(player.boss){c.beginPath();c.arc(player.x*sx,(player.y-(player.hitHeight??0))*sy,7,0,Math.PI*2);c.fillStyle='#ff5a2a';c.fill();c.lineWidth=2;c.strokeStyle='#ffd36b';c.stroke();continue;}
    if(player.monster){const queen=player.id===b.instance?.boss,x=player.x*sx,y=(player.y-(queen?40:10))*sy;c.beginPath();c.arc(x,y,queen?5.5:2.6,0,Math.PI*2);c.fillStyle=queen?'#ff5a2a':'#ff3b3b';c.fill();c.lineWidth=queen?2:1;c.strokeStyle=queen?'#ffd36b':'#0b1426';c.stroke();continue;}
    const x=player.x*sx,y=(player.y-14)*sy,ally=player.team===team,active=player.id===b.turnId;
    if(active){c.beginPath();c.arc(x,y,6+Math.sin(now/180)*1.2,0,Math.PI*2);c.strokeStyle='#fff3a0';c.lineWidth=1.5;c.stroke();}
    c.beginPath();c.arc(x,y,3.6,0,Math.PI*2);c.fillStyle=ally?'#3aa8ff':'#ff3b3b';c.fill();c.lineWidth=1.2;c.strokeStyle=player.id===id?'#ffe36b':'#0b1426';c.stroke();
   }
  };
  frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);art.removeEventListener('load',artLoaded);freeSurface(ground);freeSurface(mask);};
 },[battle.map]);
 // Hold and drag on the minimap to look around the map, as in DDTank; letting go hands the camera back to the turn.
 const look=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const box=event.currentTarget.getBoundingClientRect();
  sceneView.look={x:(event.clientX-box.left)/box.width*worldWidth,y:(event.clientY-box.top)/box.height*WORLD.height};
 };
 return <section className="battle-minimap" aria-label="Minimapa">
  <header><span>{getMap(battle.map).name}</span><small>Turno {battle.turnNumber}</small>{onSettings&&<button type="button" className="battle-settings" title="Ajustes" aria-label="Ajustes" onClick={onSettings}><Settings size={13}/></button>}<button type="button" className="battle-exit" title="Sair da batalha" aria-label="Sair da batalha" onClick={onExit}><LogOut size={14}/></button></header>
  <canvas ref={canvas} width={MINI_W} height={MINI_H} aria-hidden="true" title="Arraste para ver o mapa"
   onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);look(event);}}
   onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))look(event);}}
   onPointerUp={()=>{sceneView.look=null;}} onPointerCancel={()=>{sceneView.look=null;}}/>
 </section>;
}
