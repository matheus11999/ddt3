import type {CSSProperties} from 'react';
import {MAX_PLAYER_LEVEL,normalizeLevel} from '../../shared/progression';
import './LevelNumber.css';

/** Nível só com o número, no estilo DDTank: brilho na cor da faixa (a cada 10 níveis) e estrelinhas que aumentam nas faixas altas. */
export function LevelNumber({level,size=40,className=''}:{level:number;size?:number;className?:string}){
 const value=normalizeLevel(level),tier=Math.min(5,Math.floor((value-1)/10))+1,stars=tier>=6?3:tier>=5?2:tier>=3?1:0;
 return <span className={'level-number '+className} style={{'--ln-size':size+'px'} as CSSProperties} data-tier={tier} role="img" aria-label={'Nível '+value+' de '+MAX_PLAYER_LEVEL} title={'Nível '+value}>
  <span className="ln-digits" aria-hidden="true"><span className="ln-edge">{value}</span><b className="ln-face">{value}</b></span>
  {Array.from({length:stars},(_,index)=><i key={index} className={'ln-star ln-star-'+(index+1)} aria-hidden="true"/>)}
 </span>;
}
