import {useEffect,useRef} from 'react';
import {LogOut} from 'lucide-react';
import {getMap} from '../../shared/maps';
import {WORLD} from '../../shared/physics';
import type {Battle,Fighter} from '../../shared/protocol';
import {sceneView} from '../game/sceneView';
import {Avatar} from './Avatar';
import {LevelBadge} from './LevelBadge';

/** Full-body preview of the fighter whose turn it is, over the game's own aura seal
 * (top-left): the base sigil below +5, the Avatar's upgrade aura from +5, as in the backpack. */
export function ActivePortrait({fighter,mine,resolving,ally}:{fighter:Fighter;mine:boolean;resolving:boolean;ally:boolean}){
 return <section className={`active-portrait ${ally?'ally':'enemy'}`} aria-label={`Jogador da vez: ${fighter.name}`} data-fighter={fighter.id}>
  <div className="active-portrait-name">{fighter.name}</div>
  <div className="active-portrait-stage">
   {(fighter.equipment.upgrade??0)<5&&<i className="active-portrait-sigil" aria-hidden="true"/>}
   <div className="active-portrait-avatar"><Avatar key={fighter.id} equipment={fighter.equipment} size={170} pose="idle" weapon showAura auraAnimated facing={1}/></div>
   <LevelBadge level={fighter.level} size={34}/>
  </div>
  <div className="active-portrait-state">{resolving?'DISPARANDO':mine?'SUA VEZ':ally?'VEZ DO ALIADO':'VEZ DO RIVAL'}</div>
 </section>;
}

/** Small portraits with a mini HP bar, one row per team: allies to the left of the
 * wind panel, enemies to the right (top centre). */
export function FighterRoster({players,myTeam,turnId,side}:{players:Fighter[];myTeam:0|1;turnId:string;side:'ally'|'enemy'}){
 const team=players.filter(player=>(player.team===myTeam)===(side==='ally'));
 if(!team.length)return null;
 return <div className={`fighter-roster ${side}`} aria-label={side==='ally'?'Aliados':'Inimigos'}>
  {team.map(player=>{const ratio=Math.max(0,Math.min(1,player.hp/player.maxHp));
   return <div key={player.id} className={`roster-card ${side} ${player.id===turnId?'active-fighter':''} ${player.hp<=0?'defeated-fighter':''}`} data-fighter={player.id} title={`${player.name} · ${player.hp}/${player.maxHp}`}>
    <div className="roster-face"><Avatar equipment={player.equipment} size={46} portrait animated={false} weapon={false}/></div>
    <div className="roster-health" role="meter" aria-label={`Vida de ${player.name}`} aria-valuenow={player.hp} aria-valuemin={0} aria-valuemax={player.maxHp}><i style={{width:`${ratio*100}%`}}/></div>
   </div>;})}
 </div>;
}

/** Wide maps get a wide, short minimap, like DDTank's. */
const MINI_W=216,miniHeight=(worldWidth:number)=>Math.round(MINI_W*WORLD.height/worldWidth);

/** Whole-map overview: live terrain, fighters and the camera's view (top-right). */
export function Minimap({battle,myTeam,myId,onExit}:{battle:Battle;myTeam:0|1;myId:string;onExit:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),live=useRef({battle,myTeam,myId});live.current={battle,myTeam,myId};
 const worldWidth=getMap(battle.map).dimensions.width,MINI_H=miniHeight(worldWidth),cols=worldWidth/WORLD.cell;
 useEffect(()=>{
  const c=canvas.current?.getContext('2d');if(!c)return;
  const ground=document.createElement('canvas');ground.width=cols;ground.height=WORLD.rows;const g=ground.getContext('2d')!;
  let painted=-1,frame=0,last=0;const backdrop=new Image();backdrop.src=`/assets/maps/${getMap(live.current.battle.map).id}-preview.png`;
  const paintTerrain=(terrain:Uint8Array)=>{
   const image=g.createImageData(cols,WORLD.rows),data=image.data;
   for(let y=0;y<WORLD.rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(terrain[i]!==1)continue;const top=y===0||terrain[i-cols]!==1,o=i*4;
    if(top){data[o]=120;data[o+1]=226;data[o+2]=96;}else{const shade=Math.min(1,(y-0)/WORLD.rows+.25);data[o]=Math.round(178-60*shade);data[o+1]=Math.round(118-45*shade);data[o+2]=Math.round(62-25*shade);}data[o+3]=255;}
   g.putImageData(image,0,0);
  };
  const draw=(now:number)=>{
   frame=requestAnimationFrame(draw);if(now-last<120)return;last=now;
   const {battle:b,myTeam:team,myId:id}=live.current;
   if(sceneView.terrain?.length===cols*WORLD.rows&&sceneView.version!==painted){painted=sceneView.version;paintTerrain(sceneView.terrain);}
   const sx=MINI_W/worldWidth,sy=MINI_H/WORLD.height;
   const sky=c.createLinearGradient(0,0,0,MINI_H);sky.addColorStop(0,'#1d3b6e');sky.addColorStop(1,'#0b1730');c.fillStyle=sky;c.fillRect(0,0,MINI_W,MINI_H);
   if(backdrop.complete&&backdrop.naturalWidth){c.globalAlpha=.55;c.drawImage(backdrop,0,0,MINI_W,MINI_H);c.globalAlpha=1;c.fillStyle='#0b173055';c.fillRect(0,0,MINI_W,MINI_H);}
   c.imageSmoothingEnabled=false;c.drawImage(ground,0,0,MINI_W,MINI_H);c.imageSmoothingEnabled=true;
   const cam=sceneView.camera,hw=WORLD.width/(2*cam.zoom),hh=WORLD.height/(2*cam.zoom);
   if(cam.zoom>1.02||worldWidth>WORLD.width){c.strokeStyle='#ffffffcc';c.lineWidth=1;c.strokeRect((cam.x-hw)*sx+.5,(cam.y-hh)*sy+.5,hw*2*sx-1,hh*2*sy-1);}
   for(const player of b.players){
    if(player.hidden||player.hp<=0)continue;const x=player.x*sx,y=(player.y-14)*sy,ally=player.team===team,active=player.id===b.turnId;
    if(active){c.beginPath();c.arc(x,y,6+Math.sin(now/180)*1.2,0,Math.PI*2);c.strokeStyle='#fff3a0';c.lineWidth=1.5;c.stroke();}
    c.beginPath();c.arc(x,y,3.6,0,Math.PI*2);c.fillStyle=ally?'#3aa8ff':'#ff3b3b';c.fill();c.lineWidth=1.2;c.strokeStyle=player.id===id?'#ffe36b':'#0b1426';c.stroke();
   }
  };
  frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
 },[battle.map]);
 return <section className="battle-minimap" aria-label="Minimapa">
  <header><span>{getMap(battle.map).name}</span><small>Turno {battle.turnNumber}</small><button type="button" className="battle-exit" title="Sair da batalha" aria-label="Sair da batalha" onClick={onExit}><LogOut size={14}/></button></header>
  <canvas ref={canvas} width={MINI_W} height={MINI_H} aria-hidden="true"/>
 </section>;
}
