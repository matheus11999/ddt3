import type {CSSProperties} from 'react';
import {MAX_PLAYER_LEVEL,normalizeLevel} from '../../shared/progression';
import './LevelNumber.css';

/** Nível só com o número, no estilo DDTank: cor e efeito de fundo crescem a cada faixa de 10 níveis. */
export function LevelNumber({level,size=40,className=''}:{level:number;size?:number;className?:string}){
 const value=normalizeLevel(level),tier=Math.min(5,Math.floor((value-1)/10))+1;
 return <span className={'level-number '+className} style={{'--ln-size':size+'px'} as CSSProperties} data-tier={tier} role="img" aria-label={'Nível '+value+' de '+MAX_PLAYER_LEVEL} title={'Nível '+value}>
  <span className="ln-fx" aria-hidden="true"/>
  <span className="ln-digits" aria-hidden="true"><span className="ln-edge">{value}</span><b className="ln-face">{value}</b></span>
 </span>;
}
