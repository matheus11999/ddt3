import {useEffect,useState} from 'react';
import {Flame,Swords,Trophy,Users} from 'lucide-react';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {DRAGON_ACT_NAMES} from '../game/worldBoss/dragon';
import {DRAGON_TURN_ID} from '../../shared/worldBoss';
import type {WorldBossRankRow,WorldBossStatus} from '../../shared/worldBoss';
import type {Battle} from '../../shared/protocol';
import {BattleText} from './BattleText';
import {Modal} from './Modal';
import {playerMenuProps} from './PlayerActions';
import './WoodTheme.css';
import './WorldBoss.css';

export const DRAGON_PORTRAIT='/assets/world-boss/portrait.png',DRAGON_ICON='/assets/world-boss/icon.png';
const number=(n:number)=>Math.max(0,Math.round(n)).toLocaleString('pt-BR');
/** mm:ss, or h:mm:ss past an hour. */
export function clock(ms:number){
 const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;
 return h?`${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}
/** Server time, refreshed a few times a second for countdowns. */
function useServerNow(every=250){
 const {offset}=useGame();const [now,setNow]=useState(()=>Date.now()+offset);
 useEffect(()=>{setNow(Date.now()+offset);const timer=setInterval(()=>setNow(Date.now()+offset),every);return()=>clearInterval(timer);},[offset,every]);
 return now;
}
const ending=(status:WorldBossStatus)=>status.endReason==='defeated'?`Derrotado${status.finalBlow?` por ${status.finalBlow}`:''}`:status.endReason==='admin'?'Evento encerrado':'O tempo acabou';

/** The dragon's face in the plaza while the event runs and for 20 minutes after it. */
export function WorldBossButton(){
 const {worldBoss:status}=useGame(),now=useServerNow(1000);
 if(!status||status.phase==='idle')return null;
 const active=status.phase==='active';
 return <button type="button" className={`world-boss-button ${active?'is-active':'is-results'}`} aria-label={`${status.name}: Chefão Mundial`} title="Chefão Mundial" onClick={()=>{client.openWorldBoss();audio.play('click');}}>
  <img src={DRAGON_ICON} alt="" draggable={false}/>
  <span className="world-boss-button-time">{active?clock((status.endsAt??now)-now):'Ranking'}</span>
 </button>;
}

function HealthBar({hp,maxHp,big=false}:{hp:number;maxHp:number;big?:boolean}){
 const ratio=maxHp>0?Math.max(0,Math.min(1,hp/maxHp)):0;
 return <div className={`world-boss-health ${big?'big':''}`} role="meter" aria-label="Vida do chefão" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={maxHp}>
  <i style={{width:`${ratio*100}%`}}/><span>{number(hp)} / {number(maxHp)}</span><b>{(ratio*100).toFixed(ratio<.01&&ratio>0?2:1).replace('.',',')}%</b>
 </div>;
}

function RankRow({row,maxHp,me}:{row:WorldBossRankRow;maxHp:number;me:boolean}){
 const share=maxHp>0?row.damage/maxHp*100:0;
 return <tr className={`${row.rank<=3?`podium podium-${row.rank}`:''} ${me?'is-me':''}`}>
  <td className="rank"><span>{row.rank}</span></td>
  <td className="name"><strong {...playerMenuProps({id:row.playerId,name:row.name,context:'ranking'})}>{row.name}</strong>{me&&<em>você</em>}</td>
  <td className="level">{row.level}</td>
  <td className="damage">{number(row.damage)}</td>
  <td className="share">{share.toFixed(share<1?2:1).replace('.',',')}%</td>
 </tr>;
}

/** The event window: what it is, the global life, the time and the damage ranking (a table, top three on the podium), and Entrar. */
export function WorldBossWindow(){
 const {worldBoss:status,worldBossRanking:ranking,profile,status:connection}=useGame(),now=useServerNow();
 useEffect(()=>{const timer=setInterval(()=>client.refreshWorldBoss(),4000);return()=>clearInterval(timer);},[]);
 if(!status||status.phase==='idle')return null;
 const active=status.phase==='active',current=ranking&&ranking.occurrenceId===status.occurrenceId?ranking:null,rows=current?.rows??[],mine=current?.me??null;
 const close=()=>{client.closeWorldBoss();audio.play('click');};
 return <Modal title={status.name} subtitle="Chefão Mundial" onClose={close} className="bag-window world-boss-window" viewport>
  <div className="world-boss-layout">
   <section className="world-boss-hero wood-cream" aria-label="O chefão">
    <div className={`world-boss-portrait ${active?'':'is-over'}`}><img src={DRAGON_PORTRAIT} alt="" draggable={false} onError={event=>event.currentTarget.classList.add('is-missing')}/></div>
    <div className={`world-boss-state ${active?'is-active':''}`}>{active?<><Flame size={16}/>Ativo · termina em <b>{clock((status.endsAt??now)-now)}</b></>:<><Trophy size={16}/>{ending(status)}</>}</div>
    <HealthBar hp={status.hp} maxHp={status.maxHp} big/>
    <p className="world-boss-lines"><span><Users size={15}/>{number(status.fighters)} {status.fighters===1?'aventureiro atacou':'aventureiros atacaram'}</span>
     {!active&&status.resultsUntil&&<span>Ranking aberto por mais {clock(status.resultsUntil-now)}</span>}</p>
    <p className="world-boss-about">Uma criatura antiga acordou no covil. Todos os aventureiros do servidor dividem a mesma vida dela: entre quantas vezes quiser e cause o máximo de dano antes de cair.</p>
    <button type="button" className="wood-button world-boss-enter" disabled={!active||connection!=='online'||(status.endsAt??0)-now<4000} onClick={()=>{audio.play('click');client.enterWorldBoss();}}><Swords size={20}/>{active?'Entrar':'Encerrado'}</button>
   </section>
   <section className="world-boss-ranking wood-cream" aria-label="Ranking de dano">
    <header><Trophy size={18}/><h2>Ranking de dano</h2></header>
    {rows.length?<div className="world-boss-table-wrap"><table className="world-boss-table">
     <thead><tr><th>#</th><th>Aventureiro</th><th>Nível</th><th>Dano</th><th>Vida</th></tr></thead>
     <tbody>{rows.map(row=><RankRow key={row.playerId} row={row} maxHp={status.maxHp} me={row.playerId===profile?.id}/>)}</tbody>
    </table></div>:<p className="world-boss-empty">{active?'Ninguém causou dano ainda. Seja o primeiro!':'Ninguém causou dano neste evento.'}</p>}
    {mine&&!rows.some(row=>row.playerId===mine.playerId)&&<table className="world-boss-table world-boss-mine"><tbody><RankRow row={mine} maxHp={status.maxHp} me/></tbody></table>}
    {!mine&&rows.length>0&&<p className="world-boss-hint">Você ainda não causou dano neste evento.</p>}
   </section>
  </div>
 </Modal>;
}

/** In battle: the dragon's global life and the event's time, in place of the enemy roster. */
export function WorldBossBar({battle}:{battle:Battle}){
 const wb=battle.worldBoss!,dragon=battle.players.find(f=>f.boss),now=useServerNow(500);
 return <div className="world-boss-bar" aria-label="Chefão Mundial">
  <div className="world-boss-bar-face"><img src={DRAGON_PORTRAIT} alt="" draggable={false}/></div>
  <div className="world-boss-bar-body">
   <p><strong>{wb.name}</strong><span>{wb.over?'Encerrado':clock(wb.endsAt-now)}</span></p>
   <HealthBar hp={dragon?.hp??wb.hp} maxHp={wb.maxHp}/>
  </div>
 </div>;
}

/** The name of the dragon's move as it starts, like the monsters' turn banner. */
export function WorldBossBanner({battle}:{battle:Battle}){
 const act=battle.worldBoss?.act,now=useServerNow(200);
 if(!act||battle.turnId!==DRAGON_TURN_ID&&!battle.worldBoss?.over)return null;
 const age=now-act.startedAt;if(age<0||age>1900)return null;
 return <div key={act.id} className="monster-turn-banner world-boss-banner" role="status"><BattleText>{DRAGON_ACT_NAMES[act.action]}</BattleText></div>;
}
