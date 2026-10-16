import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,RotateCcw,LogOut} from 'lucide-react';
import type {Battle,Fighter} from '../../shared/protocol';
import {CURRENCY_NAME} from '../../shared/rewards';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import {BattleText} from './BattleText';
import {LevelBadge} from './LevelBadge';
import {RewardIcon} from './RewardIcon';
import './BattleRewards.css';

export function BattleRewards({battle,me}:{battle:Battle;me:Fighter}){
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:700px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:700px)'),change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 const {offset,status,room}=useGame(),rewards=battle.rewards;
 const [seconds,setSeconds]=useState(15),panel=useRef<HTMLDivElement>(null);
 const result=battle.winner===null?'draw':battle.winner===me.team?'victory':'defeat';
 const own=rewards?.cards.find(card=>card.playerId===me.id),revealed=rewards?.phase==='revealed';
 useEffect(()=>{const tick=()=>setSeconds(Math.max(0,Math.ceil(((rewards?.deadline??Date.now())-Date.now()-offset)/1000)));tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);},[rewards?.deadline,offset]);
 useEffect(()=>{panel.current?.focus();},[compact]);
 const pick=(card:number)=>{if(!own&&seconds>0&&!revealed&&status==='online')client.send({type:'reward-pick',card});};
 const trap=(event:React.KeyboardEvent)=>{if(event.key!=='Tab')return;const nodes=panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!nodes?.length){event.preventDefault();return;}const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){event.preventDefault();first.focus();}};
 const content=<div className={`battle-reward-overlay result-${result}`} role="dialog" aria-modal="true" aria-labelledby="reward-title" ref={panel} tabIndex={-1} onKeyDown={trap}>
  <section className="battle-loot">
   <header className="loot-heading"><span>FIM DE BATALHA</span><h1 id="reward-title"><BattleText>{result==='victory'?'VITÓRIA!':result==='defeat'?'DERROTA':'EMPATE'}</BattleText></h1><p>{result==='victory'?'Uma boa mira merece uma boa recompensa.':result==='defeat'?'Todo duelo conta. A próxima pode ser sua!':'Um duelo à altura. Escolha sua recompensa!'}</p></header>
   <div className="loot-layout">
    <aside className="loot-player"><div className="loot-character"><Avatar equipment={me.equipment} size={270} showAura/></div><div className="loot-player-name"><LevelBadge level={me.level} size={44}/><strong>{me.name}</strong></div><span className="loot-earned-label">PELA BATALHA</span><div className="loot-base-awards"><span><RewardIcon size={30}/>+{result==='victory'?80:25}</span><span><RewardIcon kind="xp" size={27}/>+{result==='victory'?120:50} EXP</span></div><p>{revealed?(rewards?.saved?'Recompensas recebidas!':'Salvando recompensas…'):'Seu prêmio extra está nas cartas.'}</p></aside>
    <section className="loot-selection" aria-label="Cartas de recompensa">
     <div className="loot-instruction"><div><small>{revealed?'CARTAS REVELADAS':'UM PRÊMIO PARA CADA JOGADOR'}</small><h2>{revealed?'Olha o que saiu!':own?'Sua carta está reservada':'Escolha sua carta'}</h2><p>{revealed?'As escolhas de todos aparecem abaixo.':own?'Todas serão abertas quando o tempo terminar.':'Você pode escolher uma das cartas livres.'}</p></div><div className={`loot-countdown ${seconds<=5?'urgent':''}`} aria-label={revealed?'Cartas reveladas':`${seconds} segundos para escolher`}><BattleText>{revealed?'✓':String(seconds)}</BattleText><small>{revealed?'REVELADAS':'SEGUNDOS'}</small></div></div>
     <div className="loot-deck">{(rewards?.cards??[]).map(card=>{
      const owner=battle.players.find(player=>player.id===card.playerId),mine=card.playerId===me.id,open=revealed&&!!card.prize;
      const label=`Carta ${card.index+1}${owner?`, ${mine?'sua escolha':owner.name}`:', livre'}${open?`, ${card.prize!.amount} ${card.prize!.kind==='coins'?CURRENCY_NAME:'EXP'}`:''}`;
      return <div key={card.index} className={`loot-card-slot ${mine?'mine':''} ${owner?'claimed':''} ${open?'revealed':''}`}>
       <button type="button" className="loot-card" aria-label={label} aria-pressed={mine} disabled={!!own||!!owner||!!revealed||seconds===0||status!=='online'} onClick={()=>pick(card.index)}>
        <span className="loot-card-turn"><span className="loot-card-back"><span className="loot-card-number">{card.index+1}</span>{owner&&<span className="loot-seal"><Check size={26}/></span>}</span><span className="loot-card-front">{open&&<><RewardIcon kind={card.prize!.kind} size={78}/><strong>+{card.prize!.amount}</strong><small>{card.prize!.kind==='coins'?'MOEDAS BRASA':'EXP'}</small></>}</span></span>
       </button>
       <span className="loot-owner" title={owner?.name}>{owner?(mine?'SUA CARTA':owner.name):revealed?'—':'LIVRE'}{owner&&card.automatic&&<small>auto</small>}</span>
      </div>;
     })}</div>
     <div className="loot-status" role="status">{status!=='online'?'Reconectando… Sua escolha fica reservada.':!revealed?(own?'Carta reservada. Aguarde a revelação.':'Ao acabar o tempo, quem não escolheu recebe uma carta livre automaticamente.'):(rewards?.saved?own?.prize?`Você recebeu +${own.prize.amount} ${own.prize.kind==='coins'?CURRENCY_NAME:'EXP'} na sua carta.`:'Recompensas recebidas.':'Conferindo e salvando os prêmios…')}</div>
    </section>
   </div>
   <footer className="loot-actions"><span>{revealed?'Seu progresso continua na próxima batalha.':'As cartas não podem ser trocadas depois da escolha.'}</span><button type="button" className="button quiet" disabled={!rewards?.saved} onClick={()=>client.send({type:'leave'})}><LogOut size={17}/>Voltar à praça</button>{room?.hostId===me.id?<button type="button" className="button gold" disabled={!rewards?.saved||status!=='online'} onClick={()=>client.send({type:'rematch'})}><RotateCcw size={17}/>Jogar novamente</button>:<small>Aguardando o líder para jogar novamente</small>}</footer>
  </section>
 </div>;
 return compact?createPortal(<div className="artillery-hud rewards-mobile-shell">{content}</div>,document.body):content;
}
