import {useEffect,useState} from 'react';
import type {CSSProperties} from 'react';
import type {Battle} from '../../shared/protocol';
import {Avatar} from './Avatar';
import {BattleText} from './BattleText';
import './PowerCutIn.css';

const EMBERS=Array.from({length:16},(_,index)=>({left:`${(index*37)%100}%`,delay:`${(index*83)%700}ms`,size:`${3+(index*7)%5}px`,drift:`${((index*29)%60)-30}px`}));

/** The server owns the hold and launch time; reconnects show only the remaining cut-in. */
export function PowerCutIn({battle,offset}:{battle:Battle;offset:number}){
 const [now,setNow]=useState(Date.now());
 const cue=battle.powerCutIn,player=battle.players.find(p=>p.id===cue?.playerId);
 useEffect(()=>{if(!cue)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),50);return()=>clearInterval(timer);},[cue?.id]);
 if(!cue||!player||cue.endsAt<=now+offset)return null;
 return <div className="power-cut-in" key={cue.id} role="status" aria-label={`${player.name} dispara Power`}>
  <div className="power-cut-in-flash" aria-hidden="true"/>
  <div className="power-cut-in-rays" aria-hidden="true"/>
  <div className="power-cut-in-band" aria-hidden="true"><div className="power-cut-in-streaks"/></div>
  <div className="power-cut-in-ring" aria-hidden="true"/>
  <div className="power-cut-in-embers" aria-hidden="true">{EMBERS.map((ember,index)=><i key={index} style={{left:ember.left,animationDelay:ember.delay,width:ember.size,height:ember.size,'--drift':ember.drift} as CSSProperties}/>)}</div>
  <div className="power-cut-in-character"><Avatar equipment={player.equipment} size={330} pose="fire" weapon/></div>
  <div className="power-cut-in-title"><span>{player.name}</span><BattleText>POWER!</BattleText><strong>FORÇA TOTAL</strong></div>
 </div>;
}
