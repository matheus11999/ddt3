import {expeditionStages,MONSTERS} from '../../shared/expeditions';
import {MONSTER_TURN_ID} from '../../shared/instanceTurn';
import type {Battle} from '../../shared/protocol';
import {BattleText} from './BattleText';
import './Expedition.css';

/** Top bar of an expedition: the boss shows like an enemy player (portrait and HP), without the player menu; plain monsters show nothing. */
export function ExpeditionFoes({battle}:{battle:Battle}){
 const boss=battle.players.find(f=>f.id===battle.instance?.boss&&f.monster);
 const portrait=boss?.monster?MONSTERS[boss.monster].portrait:undefined;
 if(!boss||!portrait)return null;
 const ratio=Math.max(0,Math.min(1,boss.hp/boss.maxHp));
 return <div className="fighter-roster enemy" aria-label="Chefe">
  <div className={`roster-card enemy boss-card ${boss.id===battle.turnId?'active-fighter':''} ${boss.hp<=0?'defeated-fighter':''}`} data-fighter={boss.id} title={`${boss.name} · ${boss.hp}/${boss.maxHp}`}>
   <div className="roster-face"><img src={portrait} alt={boss.name} draggable={false}/></div>
   <div className="roster-health" role="meter" aria-label={`Vida de ${boss.name}`} aria-valuenow={boss.hp} aria-valuemin={0} aria-valuemax={boss.maxHp}><i style={{width:`${ratio*100}%`}}/></div>
  </div>
 </div>;
}

/** The stage title while the monsters walk in, and the monsters' shared turn. */
export function ExpeditionBanners({battle,intro}:{battle:Battle;intro:boolean}){
 const instance=battle.instance!;
 return <>
  {intro&&<div key={`${battle.id}-stage`} className={`stage-banner${instance.boss?' stage-banner-short':''}`} role="status"><small>ESTÁGIO {instance.stage} DE {instance.stageCount}</small><BattleText>{instance.stageName}</BattleText></div>}
  {battle.turnId===MONSTER_TURN_ID&&battle.phase!=='finished'&&<div key={`${battle.id}-${battle.turnNumber}`} className="monster-turn-banner" role="status"><BattleText>{instance.boss?'VEZ DA RAINHA':'VEZ DAS FORMIGAS'}</BattleText><span>{instance.boss?'Ela atira flechas e chama formigas do ninho':'Elas avançam todas juntas'}</span></div>}
 </>;
}

/** The stage's goal under the minimap: every monster down (counted), or the boss. */
export function ExpeditionObjective({battle}:{battle:Battle}){
 const instance=battle.instance!,stage=expeditionStages(instance.expedition,instance.difficulty)[instance.stage-1],boss=battle.players.find(f=>f.id===instance.boss);
 const foes=battle.players.filter(f=>f.team===1&&f.monster&&f.id!==boss?.id),down=foes.filter(f=>f.hp<=0).length;
 const done=boss?boss.hp<=0:foes.length>0&&down===foes.length,label=boss?`Derrotar a ${boss.name}`:stage?.objective??'Derrotar todos os monstros';
 return <div className={`expedition-objective ${done?'is-done':''}`} role="status" aria-label={`Objetivo: ${label}${boss?'':` ${down} de ${foes.length}`}`}>
  <small>Objetivo</small><p><span>{label}</span>{!boss&&<b>{down}/{foes.length}</b>}</p>
 </div>;
}
