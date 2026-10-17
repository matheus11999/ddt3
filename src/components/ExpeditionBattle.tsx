import {MONSTERS} from '../../shared/expeditions';
import {MONSTER_TURN_ID} from '../../shared/instanceTurn';
import type {Battle} from '../../shared/protocol';
import {BattleText} from './BattleText';
import './Expedition.css';

/** Top bar of an expedition: monsters left instead of the enemy roster, and the queen's health bar. */
export function ExpeditionFoes({battle}:{battle:Battle}){
 const monsters=battle.players.filter(f=>f.team===1&&f.monster),boss=monsters.find(f=>f.id===battle.instance?.boss);
 const alive=monsters.filter(f=>f.hp>0&&f.id!==boss?.id).length,icon=MONSTERS['ant-worker'].sprite.src;
 return <>
  <div className="fighter-roster enemy expedition-foes" aria-label="Monstros">
   <div className="monster-count" role="status" aria-label={`${alive} ${alive===1?'formiga':'formigas'} restando`}><img src={icon} alt="" draggable={false}/><b>{alive}</b><span>{alive===1?'formiga':'formigas'}</span></div>
  </div>
  {boss&&<div className="boss-bar" role="meter" aria-label={`Vida de ${boss.name}`} aria-valuenow={Math.max(0,boss.hp)} aria-valuemin={0} aria-valuemax={boss.maxHp}>
   <i className="boss-bar-face" aria-hidden="true" style={{backgroundImage:`url(${MONSTERS['ant-queen'].sprite.src})`}}/>
   <div className="boss-bar-meter"><span className="boss-bar-name">{boss.name}</span><i style={{width:`${Math.max(0,boss.hp/boss.maxHp)*100}%`}}/><b>{Math.max(0,boss.hp).toLocaleString('pt-BR')} / {boss.maxHp.toLocaleString('pt-BR')}</b></div>
  </div>}
 </>;
}

/** The stage title while the monsters walk in, and the monsters' shared turn. */
export function ExpeditionBanners({battle,intro}:{battle:Battle;intro:boolean}){
 const instance=battle.instance!;
 return <>
  {intro&&<div key={`${battle.id}-stage`} className="stage-banner" role="status"><small>ESTÁGIO {instance.stage} DE {instance.stageCount}</small><BattleText>{instance.stageName}</BattleText></div>}
  {battle.turnId===MONSTER_TURN_ID&&battle.phase!=='finished'&&<div key={`${battle.id}-${battle.turnNumber}`} className="monster-turn-banner" role="status"><BattleText>{instance.boss?'VEZ DA RAINHA':'VEZ DAS FORMIGAS'}</BattleText><span>{instance.boss?'Ela atira flechas e chama formigas do ninho':'Elas avançam todas juntas'}</span></div>}
 </>;
}
