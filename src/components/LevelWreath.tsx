import type {CSSProperties} from 'react';
import {MAX_PLAYER_LEVEL,normalizeLevel} from '../../shared/progression';
import './LevelWreath.css';

/** Nível no estilo DDTank: coroa de louro pintada (atlas 3×2, uma faixa a cada 10 níveis) com o número escrito pelo jogo. */
export function LevelWreath({level,size=56,className=''}:{level:number;size?:number;className?:string}){
 const value=normalizeLevel(level),tier=Math.min(5,Math.floor((value-1)/10));
 const style={'--wreath-size':size+'px','--wreath-x':(tier%3)*50+'%','--wreath-y':Math.floor(tier/3)*100+'%'} as CSSProperties;
 return <span className={'level-wreath '+className} style={style} data-tier={tier+1} role="img" aria-label={'Nível '+value+' de '+MAX_PLAYER_LEVEL} title={'Nível '+value}><b aria-hidden="true">{value}</b></span>;
}
