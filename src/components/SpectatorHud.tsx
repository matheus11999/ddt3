import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Eye,LogOut,Wind} from 'lucide-react';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import {BattleRewards} from './BattleRewards';
import {PowerCutIn} from './PowerCutIn';
import './SpectatorHud.css';

/** Watchers receive filtered server snapshots and never mount combat inputs. */
export function SpectatorHud(){
 const {battle,offset,status}=useGame(),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
 if(!battle)return null;
 const turn=battle.players.find(player=>player.id===battle.turnId),seconds=Math.max(0,Math.ceil((battle.deadline-now-offset)/1000));
 return <>
  {createPortal(<div className="spectator-hud" aria-label="Assistindo à partida">
   {[0,1].map(team=><section key={team} className={`spectator-team team-${team}`} aria-label={`Equipe ${team===0?'azul':'rubra'}`}>
    {battle.players.filter(player=>player.team===team).map(player=><div key={player.id} className={`spectator-fighter ${player.id===battle.turnId?'current-turn':''} ${player.hp<=0?'defeated':''}`}>
     <Avatar equipment={player.equipment} size={45} portrait animated={false} weapon={false}/>
     <div><strong>{player.name}</strong><div className="spectator-health" role="meter" aria-label={`Vida de ${player.name}`} aria-valuemin={0} aria-valuemax={player.maxHp} aria-valuenow={player.hp}><i style={{width:`${Math.max(0,player.hp/player.maxHp)*100}%`}}/><span>{player.hp} / {player.maxHp}</span></div></div>
    </div>)}
   </section>)}
   <div className="spectator-center"><span><Eye size={16}/> Assistindo</span><b><Wind size={17}/>{battle.wind<0?'←':'→'} {Math.abs(battle.wind).toFixed(1)}</b><small>{battle.phase==='finished'?'Fim de batalha':battle.phase==='resolving'?'Disparo':`${turn?.name??''} · ${seconds}s`}</small></div>
   <button className="spectator-leave" aria-label="Parar de assistir" disabled={status!=='online'} onClick={()=>client.send({type:'leave'})}><LogOut size={18}/> Sair</button>
  </div>,document.body)}
  <div className="artillery-hud spectator-artillery">
   <PowerCutIn battle={battle} offset={offset}/>
   {battle.phase==='finished'&&<BattleRewards battle={battle}/>}
  </div>
 </>;
}
