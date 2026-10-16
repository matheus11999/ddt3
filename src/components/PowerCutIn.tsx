import {useEffect,useState} from 'react';
import type {Battle} from '../../shared/protocol';
import {Avatar} from './Avatar';
import {BattleText} from './BattleText';
import './PowerCutIn.css';

/** The server owns the hold and launch time; reconnects show only the remaining cut-in. */
export function PowerCutIn({battle,offset}:{battle:Battle;offset:number}){
 const [now,setNow]=useState(Date.now());
 const cue=battle.powerCutIn,player=battle.players.find(p=>p.id===cue?.playerId);
 useEffect(()=>{if(!cue)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),50);return()=>clearInterval(timer);},[cue?.id]);
 if(!cue||!player||cue.endsAt<=now+offset)return null;
 return <div className="power-cut-in" key={cue.id} role="status" aria-label={`${player.name} dispara Power`}>
  <div className="power-cut-in-streaks" aria-hidden="true"/>
  <div className="power-cut-in-character"><Avatar equipment={player.equipment} size={310} pose="fire" weapon/></div>
  <div className="power-cut-in-title"><span>{player.name}</span><BattleText>POWER!</BattleText><strong>FORÇA TOTAL</strong></div>
 </div>;
}
