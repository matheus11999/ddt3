import {Eye,LockKeyhole,LockKeyholeOpen,WifiOff,X} from 'lucide-react';
import type {RoomSpectator} from '../../shared/protocol';
import './RoomSpectators.css';

export function RoomSpectators({players,openSlots,canManage,onToggle,onKick}:{players:RoomSpectator[];openSlots:number[];canManage:boolean;onToggle:(slot:0|1,open:boolean)=>void;onKick:(id:string)=>void}){
 return <section className="party-spectators" aria-label="Espectadores"><header><Eye size={15}/><span>Espectadores</span></header><div className="party-spectator-seats">{([0,1] as const).map(slot=>{
  const player=players.find(player=>player.slot===slot),open=openSlots.includes(slot);
  return <div key={slot} className={`party-spectator-slot ${player?'occupied':open?'open':'closed'}`} data-spectator-slot={slot} data-spectator-state={player?'occupied':open?'open':'closed'}>{player?<><span className="party-spectator-symbol" aria-hidden="true"><Eye size={20}/></span><strong title={player.name}>{player.name}</strong>{!player.connected&&<WifiOff size={12} aria-label="Reconectando"/>}{canManage&&<button type="button" className="party-spectator-kick" aria-label={`Expulsar espectador ${player.name}`} onClick={()=>onKick(player.id)}><X size={13}/></button>}</>:<button type="button" className="party-spectator-toggle" aria-label={`${open?'Fechar':'Abrir'} vaga de espectador ${slot+1}`} disabled={!canManage} onClick={()=>onToggle(slot,!open)}>{open?<LockKeyholeOpen size={22} strokeWidth={1.5}/>:<LockKeyhole size={22} strokeWidth={1.5}/>}</button>}</div>;
 })}</div></section>;
}
