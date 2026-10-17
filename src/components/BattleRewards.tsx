import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Check} from 'lucide-react';
import type {Battle,Fighter} from '../../shared/protocol';
import {REWARD_RETURN_MS,REWARD_RESULT_MS} from '../../shared/rewards';
import {client,useGame} from '../client';
import {expeditionStages,getExpedition} from '../../shared/expeditions';
import {BattleText} from './BattleText';
import {prizeLabel,RewardIcon} from './RewardIcon';
import './BattleRewards.css';

export function BattleRewards({battle,me}:{battle:Battle;me?:Fighter}){
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:1000px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:1000px)'),change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const {offset,status}=useGame(),rewards=battle.rewards;
 const [now,setNow]=useState(()=>Date.now()+offset),panel=useRef<HTMLDivElement>(null);
 const result=battle.winner===null?'draw':!me?'draw':battle.winner===me.team?'victory':'defeat';
 const own=me?rewards?.cards.find(card=>card.playerId===me.id):undefined,revealed=rewards?.phase==='revealed';
 const introduction=!revealed&&now<(rewards?.opensAt??0),seconds=Math.max(0,Math.ceil(((rewards?.deadline??now)-now)/1000));
 const waitingForFall=now<(rewards?.opensAt??0)-REWARD_RESULT_MS;
 const returning=!!(revealed&&rewards?.saved&&rewards.revealedAt&&now>=rewards.revealedAt+REWARD_RETURN_MS-340);
 useEffect(()=>{const tick=()=>setNow(Date.now()+offset);tick();const timer=setInterval(tick,50);return()=>clearInterval(timer);},[offset]);
 useEffect(()=>{if(me)panel.current?.focus();},[compact,introduction,waitingForFall,me?.id]);
 if(waitingForFall)return null;
 const pick=(card:number)=>{if(me&&!introduction&&!own&&seconds>0&&!revealed&&status==='online')client.send({type:'reward-pick',card});};
 const trap=(event:React.KeyboardEvent)=>{if(event.key!=='Tab')return;const nodes=panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!nodes?.length){event.preventDefault();return;}const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first.focus();}};
 // Expedition stages: the stage's own title and fixed award; the boss stage closes the expedition.
 const instance=battle.instance,stage=instance?expeditionStages(instance.expedition,instance.difficulty)[instance.stage-1]:undefined,last=!!instance&&instance.stage===instance.stageCount;
 const award=instance?(battle.winner===0&&stage?stage.award:{coins:0,xp:0}):{coins:result==='victory'?80:25,xp:result==='victory'?120:50};
 const resultTitle=instance?(battle.winner===0?(last?`${getExpedition(instance.expedition)?.name.toUpperCase()??'EXPEDIÇÃO'} CONCLUÍDO!`:`ESTÁGIO ${instance.stage} CONCLUÍDO`):'DERROTA'):!me?(battle.winner===null?'EMPATE':`EQUIPE ${battle.winner===0?'AZUL':'RUBRA'} VENCEU`):result==='victory'?'VITÓRIA!':result==='defeat'?'DERROTA':'EMPATE';
 const content=<div className={`battle-reward-overlay compact-rewards floating-rewards result-${result} ${instance?'expedition-rewards':''} ${!me?'spectator-rewards':''} ${introduction?'result-introduction':'cards-presented'} ${returning?'rewards-returning':''}`} role={me?"dialog":"region"} aria-modal={me?true:undefined} aria-labelledby="reward-title" ref={panel} tabIndex={-1} onKeyDown={me?trap:undefined}>
  {introduction?<section className="result-announcement"><span className="result-flourish" aria-hidden="true"/><small>{instance?`${getExpedition(instance.expedition)?.name??'Expedição'} · ${instance.stageName}`:'FIM DE BATALHA'}</small><h1 id="reward-title"><BattleText>{resultTitle}</BattleText></h1><span className="result-hairline" aria-hidden="true"/>{me&&(award.coins>0||award.xp>0)&&<div className="result-base-awards"><span><RewardIcon size={25}/>+{award.coins}</span><span><RewardIcon kind="xp" size={23}/>+{award.xp} EXP</span></div>}{instance&&battle.winner===0&&!last&&<p className="result-next-stage">Prepare-se: estágio {instance.stage+1} a seguir</p>}</section>:<section className="battle-loot" key="rewards">
   <header className="loot-heading"><h1 id="reward-title"><BattleText>{resultTitle}</BattleText></h1></header>
   <div className="loot-layout">
    <section className="loot-selection" aria-label="Cartas de recompensa">
     <div className="loot-instruction"><h2>{revealed?'':!me?'Escolhas dos jogadores':own?'Carta reservada':'Escolha sua carta'}</h2><div className={`loot-countdown ${seconds<=2?'urgent':''}`} aria-label={revealed?'Cartas reveladas':`${seconds} segundos para escolher`}><BattleText>{revealed?'✓':String(seconds)}</BattleText>{!revealed&&<small>s</small>}</div></div>
     <div className="loot-deck">{(rewards?.cards??[]).map(card=>{
      const owner=battle.players.find(player=>player.id===card.playerId),mine=!!me&&card.playerId===me.id,open=revealed&&!!card.prize;
      const label=`Carta ${card.index+1}${owner?`, ${mine?'sua escolha':owner.name}`:', livre'}${open?`, ${prizeLabel(card.prize!).spoken}`:''}`;
      return <div key={card.index} className={`loot-card-slot ${mine?'mine':''} ${owner?'claimed':''} ${open?'revealed':''}`} style={{'--card-index':card.index} as CSSProperties}>
       <button type="button" className="loot-card" aria-label={label} aria-pressed={mine} disabled={!me||!!own||!!owner||!!revealed||seconds===0||status!=='online'} onClick={()=>pick(card.index)}>
        <span className="loot-card-turn"><span className="loot-card-back"><span className="loot-card-number">{card.index+1}</span>{owner&&<span className="loot-seal"><Check size={18}/></span>}</span><span className="loot-card-front">{open&&<><RewardIcon kind={card.prize!.kind} level={card.prize!.level} size={45}/><strong>{prizeLabel(card.prize!).amount}</strong><small>{prizeLabel(card.prize!).unit}</small></>}</span></span>
       </button>
       <span className="loot-owner" title={owner?.name}>{owner?(mine?(open?'SEU PRÊMIO':'SUA CARTA'):owner.name):' '}</span>
      </div>;
     })}</div>
     <div className="loot-status" role="status">{status!=='online'?'Reconectando…':revealed?(rewards?.saved?(instance&&battle.winner===0&&!last?'Indo para o próximo estágio…':'Retornando à sala…'):'Confirmando recompensas…'):own?'Aguardando as outras escolhas…':!me?'Aguardando as escolhas…':'Uma carta por jogador.'}</div>
    </section>
   </div>
  </section>}
 </div>;
 return compact?createPortal(<div className="artillery-hud rewards-mobile-shell">{content}</div>,document.body):content;
}
